"""Análisis de discrepancias en la app (Cambio 16): el admin lo lanza con costo estimado y lo corre el worker.

Usa los mismos pasos que los CLI: la tabla de call_audit.discrepancies (sin IA, siempre sobre la corrida vigente) y el
pedido por motivo de call_audit.discrepancy_analysis. Cada motivo se guarda al terminar, así un análisis detenido o
fallido conserva lo que alcanzó a correr. Nada de esto cambia el prompt de la capa 2 ni los resultados de las llamadas:
las propuestas solo pasan a seguimiento cuando el admin las acepta (D-64).
"""

import logging
from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import discrepancies, golden_split, prompt_evaluation
from call_audit import discrepancy_analysis as analysis
from call_audit.config import ROOT, get_settings
from call_audit.ingestion.import_bench import bench, real_calls
from call_audit.persistence.models import (
    DiscrepancyAnalysis,
    DiscrepancyClassification,
    DiscrepancyPattern,
    ModelRun,
    PromptEvaluation,
    PromptVersion,
    ProposalDecision,
    Review,
    User,
)

logger = logging.getLogger(__name__)
WORKERS = 4
# Un patrón con menos casos queda como observación, sin propuesta para aceptar (R-16.3).
MIN_CASES = 3
# Peso en el impacto (H-108): un motivo menor no rechaza la llamada por sí solo.
MINOR_WEIGHT = 0.5
# Segundos por pedido, medidos en la corrida completa del 2026-11-04 con Sonnet 5.5 (30–90 s). Estimación: un motivo
# grande hace varias tandas seguidas y la pasada que las junta.
SECONDS_PER_REQUEST = 60
DISAGREEMENT = ("fp", "fn", "ai_uncertain")
RUNNING = ("queued", "running")
FOLLOW_UP = ("accepted", "asked_client", "calibrated")

# (configuración del modelo, system, user) -> (texto de la respuesta, costo USD). Los tests pasan un doble.
ModelCaller = Callable[[dict, str, str], tuple[str, float]]


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


def iso(value: datetime | None) -> str | None:
    value = aware(value)
    return value.isoformat() if value else None


def prompts() -> tuple[str, str]:
    """System del análisis por tanda y de la pasada que junta las tandas."""
    return analysis.prompt_text("system.txt"), analysis.prompt_text("merge.txt")


def model_options() -> list[dict]:
    """Modelos del bench habilitados, con si el servidor tiene su API key."""
    return [
        {
            "name": m["name"],
            "label": m.get("label", m["name"]),
            # Con su API key o con la del respaldo (ej. Gemini Flash por OpenRouter, campo fallback de models.toml).
            "available": bool(bench.api_key_for(m["provider"])) or bench.fallback_config(m) is not None,
            "priced": m.get("price_input_per_mtok") is not None,
        }
        for m in prompt_evaluation.models()
    ]


def current_series(session: Session) -> dict | None:
    """La serie (modelo, versión, corrida) más común entre las corridas vigentes."""
    row = session.execute(
        select(ModelRun.model, ModelRun.prompt_version, ModelRun.run_label, func.count())
        .where(ModelRun.is_current.is_(True))
        .group_by(ModelRun.model, ModelRun.prompt_version, ModelRun.run_label)
        .order_by(func.count().desc())
        .limit(1)
    ).first()
    return {"model": row[0], "promptVersion": row[1], "runLabel": row[2]} if row else None


def table(
    session: Session, source: PromptEvaluation | DiscrepancyAnalysis | None = None
) -> tuple[list[dict], dict[str, list[dict]], dict]:
    """Sin fuente, la corrida vigente en entrenamiento: la cuarta IA aprende solo de ese set; validación y prueba quedan
    para medir (golden_split). Con una prueba (o un análisis que salió de una), los resultados de esa prueba en su set
    (loop de mejora del prompt, docs/plan-loop-prompt.md)."""
    if isinstance(source, DiscrepancyAnalysis):
        source = session.get(PromptEvaluation, source.source_evaluation_id) if source.source_evaluation_id else None
    if source is not None:
        return discrepancies.build(session, {}, source.split, source)
    return discrepancies.build(session, {}, golden_split.default_split(session, "train"))


def criteria_with_disagreements(rows: list[dict]) -> list[int]:
    """Motivos con algún desacuerdo o duda de la IA en la tabla: los que analiza una vuelta del loop."""
    return sorted({r["criterion_id"] for r in rows if r["kind"] in DISAGREEMENT})


def of_criterion(rows: list[dict], cid: int) -> list[dict]:
    return [r for r in rows if r["criterion_id"] == cid]


def discarded_for(session: Session, cid: int) -> list[dict]:
    """Propuestas descartadas del motivo, para pasárselas a la IA (D-64)."""
    rows = session.execute(
        select(DiscrepancyPattern, ProposalDecision)
        .join(ProposalDecision, ProposalDecision.pattern_id == DiscrepancyPattern.id)
        .where(DiscrepancyPattern.criterion_id == cid, ProposalDecision.status == "discarded")
    )
    out = []
    for p, d in rows:
        text = observation_text(p.data or {}) if p.is_observation else (p.data.get("proposal") or {}).get("text", "")
        if text:
            out.append({"text": text, "reason": d.reason})
    return out


def observation_text(data: dict) -> str:
    """Texto base de una observación (Cambio 20 §13.1): puede venir sin propuesta, y las tres formas se tratan igual."""
    return (data.get("proposal") or {}).get("text") or data.get("explanation") or data.get("title") or ""


# --- Estimar, lanzar, detener ------------------------------------------------------------------------------------


def estimate(
    session: Session, criteria: list[int], model: str, source: PromptEvaluation | None = None
) -> dict[str, Any]:
    """Costo estimado con el mismo pedido que se mandará; precio de models.toml, no escrito en el código."""
    cfg = analysis.model_config(model)
    rows, transcripts, summary = table(session, source)
    system, merge_system = prompts()
    total, cases, discarded, missing_price = 0.0, 0, 0, False
    requests_per_criterion = []
    for cid in criteria:
        rows_c = of_criterion(rows, cid)
        if not rows_c:
            continue
        done = discarded_for(session, cid)
        discarded += len(done)
        requests = analysis.build_requests(
            cid, rows_c, transcripts, analysis.criterion_counts(rows_c, summary["n_calls"]), done
        )
        cases += sum(len(sent) for _, sent in requests)
        requests_per_criterion.append(len(requests) + (len(requests) > 1))
        tokens_in, tokens_out = analysis.estimate_tokens(system, merge_system, requests)
        cost = bench.cost_usd(cfg, {"input_tokens": tokens_in, "output_tokens": tokens_out})
        if cost is None:
            missing_price = True
        total += cost or 0
    return {
        "model": model,
        "criteria": criteria,
        "cases": cases,
        "discardedProposals": discarded,
        "totalUsd": None if missing_price else round(total, 4),
        # Los motivos corren de a WORKERS en paralelo y cada uno hace sus pedidos seguidos.
        "minutes": round(sum(sorted(requests_per_criterion, reverse=True)[::WORKERS]) * SECONDS_PER_REQUEST / 60, 1),
    }


def running(session: Session) -> DiscrepancyAnalysis | None:
    return session.scalar(
        select(DiscrepancyAnalysis)
        .where(DiscrepancyAnalysis.status.in_(RUNNING))
        .order_by(DiscrepancyAnalysis.created_at.desc())
    )


def start(
    session: Session,
    actor: User,
    criteria: list[int],
    model: str,
    source: PromptEvaluation | None = None,
    purpose: str | None = None,
) -> DiscrepancyAnalysis:
    """Con `source`, analiza los resultados de esa prueba. `purpose` "attribution": solo para atribuir la causa de los
    desacuerdos de validación; sus propuestas no entran a la bandeja (R-11)."""
    if purpose not in (None, "rules", "attribution"):
        raise ValueError("unknown_purpose")
    if source is not None and source.status != "done":
        raise ValueError("source_not_done")
    if running(session) is not None:
        raise ValueError("already_running")
    option = next((m for m in model_options() if m["name"] == model), None)
    if option is None:
        raise ValueError("unknown_model")
    if not option["available"]:
        raise ValueError("model_unavailable")
    criteria = sorted(set(criteria))
    if not criteria:
        raise ValueError("no_criteria")
    est = estimate(session, criteria, model, source)
    series = (
        {"model": source.model, "promptVersion": source.version, "runLabel": f"Prueba v{source.version}"}
        if source is not None
        else current_series(session) or {}
    )
    run = DiscrepancyAnalysis(
        model=model,
        analysis_prompt_version=analysis.PROMPT_VERSION,
        layer2_series=series,
        source_evaluation_id=source.id if source is not None else None,
        purpose=purpose,
        criteria=criteria,
        done_criteria=[],
        failed_criteria=[],
        summaries={},
        estimated_cost_usd=est["totalUsd"],
        created_by_id=actor.id,
    )
    session.add(run)
    session.flush()
    return run


def stop(session: Session, run: DiscrepancyAnalysis, actor: User) -> None:
    if run.status not in RUNNING:
        raise ValueError("not_running")
    run.status, run.stopped_by_id, run.finished_at = "stopped", actor.id, now()


# --- Worker ------------------------------------------------------------------------------------------------------


def bench_caller() -> ModelCaller:
    bench.load_dotenv(ROOT / ".env")

    def call(cfg: dict, system: str, user: str) -> tuple[str, float]:
        """Si el modelo falla (ej. Gemini sin saldo), el mismo modelo por su respaldo, como el pipeline."""
        used = cfg
        try:
            if not bench.api_key_for(cfg["provider"]):
                raise RuntimeError(f"sin API key para {cfg['provider']}")
            text, _, usage, _ = bench.call_with_retries(cfg, "discrepancias", system, user)
        except Exception:
            backup = bench.fallback_config(cfg)
            if backup is None:
                raise
            logger.warning("%s falló; se usa el respaldo %s", cfg["name"], backup["name"])
            used = analysis.model_config(backup["name"])
            text, _, usage, _ = bench.call_with_retries(used, "discrepancias", system, user)
        return text, bench.cost_usd(used, usage) or 0.0

    return call


def process_pending(factory: sessionmaker[Session], caller: ModelCaller | None = None) -> int:
    """Corre los análisis en cola. Lo llama el loop del worker; un análisis fallido no lo bota."""
    with factory() as session:
        pending = list(session.scalars(select(DiscrepancyAnalysis.id).where(DiscrepancyAnalysis.status.in_(RUNNING))))
    for run_id in pending:
        try:
            run_analysis(factory, run_id, caller or bench_caller())
        except Exception as exc:  # noqa: BLE001 - se registra y se marca como fallido
            logger.exception("Falló el análisis de discrepancias %s", run_id)
            with factory() as session, session.begin():
                run = session.get(DiscrepancyAnalysis, run_id)
                run.status, run.error, run.finished_at = "failed", str(exc)[:500], now()
    return len(pending)


def snapshot(r: dict) -> dict:
    """Lo que la vista muestra de un caso (R-16.4), tal como estaba al analizar."""
    manual = r.get("manual_item")
    quote = next((q for q in r["ai_quotes"] if q.get("quote")), None)
    return {
        "caseId": r.get("case_id"),
        "callId": r["call_id"],
        "callDate": r.get("call_date"),
        "kind": r["kind"],
        "aiVerdict": r["ai_verdict"],
        "aiComment": r["ai_comment"],
        "aiQuote": quote["quote"] if quote else None,
        "aiQuoteMs": quote["startMs"] if quote else None,
        "clientFail": r["excel_fail"],
        "clientComment": r["excel_comment"],
        "manualVerdict": manual["verdict"] if manual else None,
        "manualSidesWith": r.get("manual_item_sides_with"),
        "evaluator": r.get("excel_evaluator"),
    }


def reviewer_disagreement(case: dict) -> bool:
    """El Excel y la revisión manual Qubico dicen cosas distintas en el motivo (H-110)."""
    verdict = case["manualVerdict"]
    return verdict in ("compliant", "non_compliant") and (verdict == "non_compliant") != case["clientFail"]


def patterns_from(result: dict, rows_c: list[dict], cid: int, weight: float) -> list[dict]:
    by_call = {r["call_id"]: r for r in rows_c}
    out = []
    items = [(p, False) for p in result.get("patterns", [])]
    items += [
        ({"title": o.get("text", ""), "cases": o.get("cases", []), "explanation": "", "quotes": []}, True)
        for o in result.get("observations", [])
    ]
    for p, observation in items:
        calls = [str(c) for c in p.get("cases", [])]
        cases = [snapshot(by_call[c]) for c in dict.fromkeys(calls) if c in by_call]
        is_observation = observation or len(cases) < MIN_CASES or not (p.get("proposal") or {}).get("text")
        out.append(
            {
                "criterion_id": cid,
                "is_observation": is_observation,
                "impact": len(cases) * weight,
                "data": p,
                "cases": cases,
                "reviewer_disagreements": sum(reviewer_disagreement(c) for c in cases),
            }
        )
    return out


def ask(cfg: dict, system: str, user: str, caller: ModelCaller, spent: list[float]) -> dict:
    """Un pedido al modelo. Si el JSON no se puede leer, reintenta una vez. Suma lo gastado en `spent`."""
    for attempt in range(2):
        text, cost = caller(cfg, system, user)
        spent.append(cost)
        try:
            return analysis.parse_response(text)
        except ValueError:
            if attempt:
                raise ValueError(f"respuesta sin JSON válido · {sum(spent):.3f} USD") from None
    raise AssertionError("unreachable")


def analyze_criterion(
    cfg: dict,
    systems: tuple[str, str],
    requests: list[tuple[str, list[dict]]],
    merge_user: Callable[[list[dict]], str],
    transcripts: dict,
    caller: ModelCaller,
) -> tuple[dict, float]:
    """Análisis de un motivo con las citas validadas y su costo: una respuesta por tanda y, si hay más de una, la
    pasada que las junta. Si falla, el error lleva lo que ya se gastó."""
    spent: list[float] = []
    try:
        partials = [ask(cfg, systems[0], user, caller, spent) for user, _ in requests]
        result = partials[0] if len(partials) == 1 else ask(cfg, systems[1], merge_user(partials), caller, spent)
    except Exception as exc:
        raise CriterionError(str(exc), sum(spent)) from exc
    analysis.validate_quotes(result, [r for _, sent in requests for r in sent], transcripts)
    return result, sum(spent)


class CriterionError(Exception):
    """Un motivo que falló, con lo que alcanzó a gastar (se suma al costo del análisis)."""

    def __init__(self, message: str, cost: float) -> None:
        super().__init__(message)
        self.cost = cost


def run_analysis(factory: sessionmaker[Session], run_id: str, caller: ModelCaller) -> None:
    with factory() as session, session.begin():
        run = session.get(DiscrepancyAnalysis, run_id)
        run.status, run.started_at = "running", run.started_at or now()
        model, criteria = run.model, list(run.criteria)
        finished = set(run.done_criteria) | {f["criterionId"] for f in run.failed_criteria}
        rows, transcripts, summary = table(session, run)
        discarded = {cid: discarded_for(session, cid) for cid in criteria}

    cfg = analysis.model_config(model)
    systems = prompts()
    minor = load_minor()
    todo = [cid for cid in criteria if cid not in finished]

    def job(cid: int) -> tuple[int, dict | None, list[dict], float, str | None]:
        rows_c = of_criterion(rows, cid)
        if not rows_c:
            return cid, {"summary": "Sin desacuerdos en este criterio."}, [], 0.0, None
        counts = analysis.criterion_counts(rows_c, summary["n_calls"])
        requests = analysis.build_requests(cid, rows_c, transcripts, counts, discarded.get(cid))

        def merge_user(partials: list[dict]) -> str:
            return analysis.merge_request(cid, rows_c[0], counts, partials)

        try:
            result, cost = analyze_criterion(cfg, systems, requests, merge_user, transcripts, caller)
        except CriterionError as exc:  # un motivo con error no frena los demás
            cause = exc.__cause__ or exc
            return cid, None, [], exc.cost, f"{type(cause).__name__}: {cause}"[:300]
        weight = MINOR_WEIGHT if cid in minor else 1.0
        return cid, result, patterns_from(result, rows_c, cid, weight), cost, None

    for start_at in range(0, len(todo), WORKERS):
        with factory() as session:
            if session.get(DiscrepancyAnalysis, run_id).status == "stopped":
                return
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            results = list(pool.map(job, todo[start_at : start_at + WORKERS]))
        with factory() as session, session.begin():
            run = session.get(DiscrepancyAnalysis, run_id)
            for cid, result, patterns, cost, error in results:
                run.cost_usd = round(run.cost_usd + cost, 6)
                if error is not None:
                    run.failed_criteria = [*run.failed_criteria, {"criterionId": cid, "error": error}]
                    continue
                # Si lo detuvieron mientras corría, lo que ya se pagó igual se guarda.
                session.add_all(DiscrepancyPattern(analysis_id=run_id, **p) for p in patterns)
                run.summaries = {**run.summaries, str(cid): (result or {}).get("summary", "")}
                run.done_criteria = [*run.done_criteria, cid]
            if run.status == "stopped":
                return

    with factory() as session, session.begin():
        run = session.get(DiscrepancyAnalysis, run_id)
        if run.status == "stopped":
            return
        patterns = session.scalars(
            select(DiscrepancyPattern)
            .where(DiscrepancyPattern.analysis_id == run_id)
            .order_by(DiscrepancyPattern.is_observation, DiscrepancyPattern.impact.desc())
        )
        for rank, pattern in enumerate(patterns, 1):
            pattern.rank = rank
        run.finished_at = now()
        if run.failed_criteria:
            failed = ", ".join(str(f["criterionId"]) for f in run.failed_criteria)
            run.status, run.error = "failed", f"Fallaron los criterios {failed}"
        else:
            run.status = "done"


def load_minor() -> set[int]:
    from call_audit.rubric import load_rubric

    return set(load_rubric(get_settings().rubric_path).minor)


# --- Lectura para la vista ---------------------------------------------------------------------------------------


def analysis_out(run: DiscrepancyAnalysis | None) -> dict | None:
    if run is None:
        return None
    return {
        "id": run.id,
        "status": run.status,
        "createdBy": run.created_by.name if run.created_by else None,
        "createdAt": iso(run.created_at),
        "finishedAt": iso(run.finished_at),
        "model": run.model,
        "analysisPromptVersion": run.analysis_prompt_version,
        "layer2Series": run.layer2_series or None,
        "criteria": run.criteria,
        "doneCriteria": run.done_criteria,
        "failedCriteria": run.failed_criteria,
        "estimatedUsd": run.estimated_cost_usd,
        "costUsd": run.cost_usd,
        "error": run.error,
        "stoppedBy": run.stopped_by.name if run.stopped_by else None,
        "sourceEvaluationId": run.source_evaluation_id,
        "purpose": run.purpose,
    }


def version_status(session: Session, version: str | None) -> str | None:
    row = session.get(PromptVersion, version) if version else None
    return row.status if row else None


WHO_IS_RIGHT = ("auditor", "ia", "ambiguo")
# Grupo de «¿Dónde se arregla?» por tipo de propuesta (Cambio 19 §7.3). Pregunta y pedido de datos son del prompt de
# análisis v1.0.0 y van juntos (H-142).
ACTION_GROUP = {
    "prompt_rule": "prompt_rule",
    "calibrate_auditor": "calibrate_auditor",
    "client_question": "company",
    "data_request": "company",
}
RESOLVED = ("included", "asked_client", "calibrated")


def text_or_none(value: Any) -> str | None:
    """Texto del análisis; vacío o ausente = sin dato (null), nunca un texto inventado."""
    return value.strip() if isinstance(value, str) and value.strip() else None


def ai_fields(data: dict) -> dict:
    """Lo que solo trae el prompt de análisis v1.1+ (Cambio 19 §7.9). Clave ausente = null = «sin dato»."""
    who = data.get("who_is_right")
    fix = data.get("expected_fix")
    tentative = data.get("tentative")
    return {
        "whoIsRight": who if who in WHO_IS_RIGHT else None,
        "concentration": text_or_none(data.get("concentration")),
        "sideEffects": text_or_none(data.get("side_effects")),
        "expectedFix": [str(c) for c in fix] if isinstance(fix, list) else None,
        "tentative": tentative if isinstance(tentative, bool) else None,
    }


def kind_counts(cases: list[dict]) -> dict[str, int]:
    """fp / fn / dudosa de los casos del patrón, tal como estaban al analizar (sin IA)."""
    kinds = Counter(c.get("kind") for c in cases)
    return {"fp": kinds["fp"], "fn": kinds["fn"], "uncertain": kinds["ai_uncertain"]}


def capabilities(patterns: list[DiscrepancyPattern]) -> dict[str, bool]:
    """Qué campos de v1.1+ trae el análisis, según las claves de sus patrones (no según la versión del prompt)."""
    keys = {k for p in patterns if not p.is_observation for k in (p.data or {})}
    return {
        "whoIsRight": "who_is_right" in keys,
        "expectedFix": "expected_fix" in keys,
        "sideEffects": "side_effects" in keys,
        "concentration": "concentration" in keys,
        "tentative": "tentative" in keys,
    }


def pattern_out(session: Session, p: DiscrepancyPattern, decision: ProposalDecision | None) -> dict:
    data = p.data or {}
    proposal = data.get("proposal") or None
    note = observation_text(data) if p.is_observation else None
    decided = decision is not None and decision.status != "pending"
    proposal_view = (
        {
            "type": proposal.get("type"),
            # Cómo se aplica una regla del prompt (prompt de análisis v1.3.0, Cambio 18); null = texto libre.
            "action": proposal.get("action") if proposal.get("action") in ("append", "replace") else None,
            "find": proposal.get("find") if proposal.get("action") == "replace" else None,
            "text": proposal.get("text") or "",
            "editedText": decision.edited_text if decision else None,
        }
        if proposal and not p.is_observation
        else None
    )
    if p.is_observation and decided:
        # Una observación decidida solo puede ir a calibrar (D-94), aunque la IA haya propuesto otro tipo.
        proposal_view = {
            "type": "calibrate_auditor",
            "action": None,
            "find": None,
            "text": note,
            "editedText": decision.edited_text,
        }
    return {
        **ai_fields(data),
        "kindCounts": kind_counts(p.cases or []),
        "id": p.id,
        "analysisId": p.analysis_id,
        "criterionId": p.criterion_id,
        "criterionName": real_calls.CRITERIA.get(p.criterion_id),
        "rank": p.rank,
        "title": data.get("title") or "",
        "explanation": data.get("explanation") or "",
        "direction": data.get("direction"),
        "cause": data.get("cause"),
        "quotes": data.get("quotes") or [],
        "confidence": data.get("confidence"),
        "caseCount": len(p.cases),
        "reviewerDisagreements": p.reviewer_disagreements,
        "isObservation": p.is_observation,
        "observationText": note,
        "proposal": proposal_view,
        "status": decision.status if decision else "pending",
        "decision": {
            "by": decision.decided_by.name if decision.decided_by else None,
            "at": iso(decision.decided_at),
            "reason": decision.reason,
            "note": decision.note,
            "includedInVersion": decision.included_in_version,
            "versionStatus": version_status(session, decision.included_in_version),
        }
        if decision and decision.status != "pending"
        else None,
    }


def decisions_for(session: Session, pattern_ids: list[str]) -> dict[str, ProposalDecision]:
    if not pattern_ids:
        return {}
    rows = session.scalars(select(ProposalDecision).where(ProposalDecision.pattern_id.in_(pattern_ids)))
    return {d.pattern_id: d for d in rows}


def latest_finished(session: Session) -> DiscrepancyAnalysis | None:
    """El último análisis que dejó algo (terminado, detenido o fallido con motivos hechos), de cualquier tipo: también
    el análisis de causa de una prueba (06-ajustes-feedback.md §4.1, F3)."""
    for run in session.scalars(
        select(DiscrepancyAnalysis)
        .where(DiscrepancyAnalysis.status.not_in(RUNNING))
        .order_by(DiscrepancyAnalysis.created_at.desc())
    ):
        if run.done_criteria:
            return run
    return None


def stale(session: Session, run: DiscrepancyAnalysis) -> dict | None:
    """H-111: cambió la corrida vigente o entraron revisiones o clasificaciones desde el análisis."""
    since = aware(run.created_at)
    reviews = sum(1 for at in session.scalars(select(Review.submitted_at)) if aware(at) > since)
    reviews += sum(1 for at in session.scalars(select(DiscrepancyClassification.updated_at)) if aware(at) > since)
    series = current_series(session)
    # Un análisis de una prueba no depende de la corrida vigente.
    changed = (
        not run.source_evaluation_id and bool(run.layer2_series) and series is not None and series != run.layer2_series
    )
    if not changed and not reviews:
        return None
    return {"currentSeriesChanged": changed, "currentSeries": series if changed else None, "newReviews": reviews}


def best_pattern(patterns: list[DiscrepancyPattern]) -> dict[tuple[int, str], DiscrepancyPattern]:
    """Caso (motivo × llamada) -> el patrón de mejor prioridad que lo contiene (H-140). `patterns` viene ordenado
    como la lista: primero los patrones, por impacto, y al final las observaciones."""
    out: dict[tuple[int, str], DiscrepancyPattern] = {}
    for p in patterns:
        for c in p.cases or []:
            out.setdefault((p.criterion_id, str(c["callId"])), p)
    return out


def action_of(p: DiscrepancyPattern) -> str:
    if p.is_observation:
        return "observation"
    return ACTION_GROUP.get(((p.data or {}).get("proposal") or {}).get("type"), "none")


def analysis_summary(
    rows: list[dict],
    shown: DiscrepancyAnalysis | None,
    patterns: list[DiscrepancyPattern],
    decisions: dict[str, ProposalDecision],
    caps: dict[str, bool],
) -> tuple[dict, dict[int, dict]]:
    """Cifras del resumen y de las barras (Cambio 19 §7.3), sin IA y sobre la tabla vigente. Un caso es motivo ×
    llamada y cuenta una vez. Devuelve el resumen y, por motivo analizado, sus casos en un patrón y analizados."""
    analyzed = set(shown.done_criteria) if shown else set()
    current = {(r["criterion_id"], str(r["call_id"])): r["kind"] for r in rows if r["kind"] in DISAGREEMENT}
    best = best_pattern(patterns)
    by_action = dict.fromkeys(("prompt_rule", "calibrate_auditor", "company", "none", "observation", "unpatterned"), 0)
    by_who = dict.fromkeys((*WHO_IS_RIGHT, "unpatterned"), 0)
    per_criterion: dict[int, dict] = {cid: {"fp": 0, "fn": 0, "uncertain": 0, "analyzed": 0} for cid in analyzed}
    explained = 0
    for (cid, call), kind in current.items():
        if cid not in analyzed:
            continue
        per_criterion[cid]["analyzed"] += 1
        p = best.get((cid, call))
        by_action[action_of(p) if p else "unpatterned"] += 1
        if p is None or p.is_observation:
            by_who["unpatterned"] += 1
            continue
        explained += 1
        per_criterion[cid]["uncertain" if kind == "ai_uncertain" else kind] += 1
        by_who[ai_fields(p.data or {})["whoIsRight"] or "ambiguo"] += 1
    pending = [
        p for p in patterns if not p.is_observation and (p.id not in decisions or decisions[p.id].status == "pending")
    ]
    disagreements = {k: v for k, v in current.items() if v in ("fp", "fn")}
    summary = {
        "disagreements": len(disagreements),
        "criteriaWithDisagreements": len({cid for cid, _ in disagreements}),
        "criteriaNotAnalyzed": len({cid for cid, _ in disagreements} - analyzed) if shown else None,
        "analyzedCases": sum(c["analyzed"] for c in per_criterion.values()),
        "explainedCases": explained,
        "byAction": by_action,
        "byWhoIsRight": by_who if caps["whoIsRight"] else None,
        "pendingProposals": len(pending),
        "pendingCases": len({(p.criterion_id, str(c["callId"])) for p in pending for c in p.cases or []}),
        # Casos del análisis que con la corrida vigente ya no están en desacuerdo.
        "staleCases": sum(1 for key in best if key not in current),
    }
    return summary, per_criterion


def follow_up_counts(session: Session) -> dict[str, int]:
    """Avance de Seguimiento (Cambio 19 §7.5): siempre el estado actual, de todos los análisis."""
    statuses = Counter(session.scalars(select(ProposalDecision.status)))
    return {
        "accepted": sum(statuses[s] for s in (*FOLLOW_UP, "included")),
        "resolved": sum(statuses[s] for s in RESOLVED),
        "discarded": statuses["discarded"],
    }


def overview(session: Session, analysis_id: str | None = None) -> dict[str, Any]:
    shown = session.get(DiscrepancyAnalysis, analysis_id) if analysis_id else latest_finished(session)
    if analysis_id and shown is None:
        raise LookupError("not_found")
    rows, _, summary = table(session, shown)
    latest = latest_finished(session)
    patterns = (
        list(
            session.scalars(
                select(DiscrepancyPattern)
                .where(DiscrepancyPattern.analysis_id == shown.id)
                .order_by(DiscrepancyPattern.is_observation, DiscrepancyPattern.impact.desc())
            )
        )
        if shown
        else []
    )
    decisions = decisions_for(session, [p.id for p in patterns])
    per_criterion = Counter(p.criterion_id for p in patterns if not p.is_observation)
    analyzed = set(shown.done_criteria) if shown else set()
    caps = capabilities(patterns)
    analysis_summary_out, explained = analysis_summary(rows, shown, patterns, decisions, caps)
    criteria = [
        {
            "criterionId": t["criterion_id"],
            "name": t["criterion_name"],
            "clientFails": t["excel_fail"],
            "aiFails": t["ai_fail"],
            "matchFail": t["match_fail"],
            "fp": t["fp"],
            "fn": t["fn"],
            "aiUncertain": t["ai_uncertain"],
            "disagreements": t["disagreements"],
            "manualItems": t["manual_items"],
            "patterns": per_criterion[t["criterion_id"]] if t["criterion_id"] in analyzed else None,
            "explained": {k: explained[t["criterion_id"]][k] for k in ("fp", "fn", "uncertain")}
            if t["criterion_id"] in analyzed
            else None,
            "analyzedCases": explained[t["criterion_id"]]["analyzed"] if t["criterion_id"] in analyzed else None,
            "summary": (shown.summaries or {}).get(str(t["criterion_id"])) if shown else None,
        }
        for t in discrepancies.criterion_table(summary["counts"])
        if t["excel_fail"] or t["ai_fail"] or t["ai_uncertain"]
    ]
    criteria.sort(key=lambda c: -c["disagreements"])
    calls = summary["calls"]
    disagreements = [r for r in rows if r["kind"] in DISAGREEMENT]
    evaluators = None
    if set(summary["by_evaluator"]) - {"sin dato"}:
        evaluators = [
            {
                "evaluator": name,
                "calls": c["calls"],
                "clientCallFails": c["excel_call_fail"],
                "callMatch": c["call_match"],
                "clientFails": c["fn"] + c["match_fail"],
                "fp": c["fp"],
                "fn": c["fn"],
            }
            for name, c in sorted(summary["by_evaluator"].items(), key=lambda kv: -kv[1]["calls"])
        ]
    return {
        "currentSeries": current_series(session),
        "calls": summary["n_calls"],
        "cases": len(disagreements),
        "manualCases": sum(1 for r in disagreements if r.get("manual_item")),
        "callsOutside": dict(summary["skipped"]),
        "callMatch": {
            "agree": calls[("compliant", "compliant")] + calls[("non_compliant", "non_compliant")],
            "total": summary["n_calls"],
        },
        "criteria": criteria,
        "evaluators": evaluators,
        "analysis": {**analysis_out(shown), "capabilities": caps} if shown else None,
        "summary": analysis_summary_out,
        "followUp": follow_up_counts(session),
        "readOnly": shown is not None and latest is not None and shown.id != latest.id,
        "running": analysis_out(running(session)),
        "stale": stale(session, shown) if shown is not None and shown.id == getattr(latest, "id", None) else None,
        "patterns": [pattern_out(session, p, decisions.get(p.id)) for p in patterns],
        "models": model_options(),
        "defaultModel": analysis.DEFAULT_MODEL,
    }


def pattern_detail(session: Session, pattern_id: str) -> dict[str, Any]:
    p = session.get(DiscrepancyPattern, pattern_id)
    if p is None:
        raise LookupError("not_found")
    decision = session.get(ProposalDecision, pattern_id)
    run = session.get(DiscrepancyAnalysis, p.analysis_id)
    latest = latest_finished(session)
    fix = ai_fields(p.data or {})["expectedFix"]
    return {
        **pattern_out(session, p, decision),
        "cases": [{**c, "expectedFix": None if fix is None else str(c["callId"]) in fix} for c in p.cases],
        "criterionSummary": (run.summaries or {}).get(str(p.criterion_id)),
        "readOnly": latest is not None and run.id != latest.id,
    }


def list_analyses(session: Session) -> list[dict]:
    runs = list(session.scalars(select(DiscrepancyAnalysis).order_by(DiscrepancyAnalysis.created_at.desc())))
    counts = Counter(
        session.scalars(select(DiscrepancyPattern.analysis_id).where(DiscrepancyPattern.is_observation.is_(False)))
    )
    return [{**analysis_out(r), "patterns": counts[r.id]} for r in runs]


def follow_up(session: Session) -> list[dict]:
    rows = session.execute(
        select(DiscrepancyPattern, ProposalDecision)
        .join(ProposalDecision, ProposalDecision.pattern_id == DiscrepancyPattern.id)
        .where(ProposalDecision.status != "pending")
        .order_by(ProposalDecision.decided_at.desc())
    )
    return [pattern_out(session, p, d) for p, d in rows]


# --- Decisiones sobre las propuestas -----------------------------------------------------------------------------


def decide(
    session: Session,
    pattern: DiscrepancyPattern,
    actor: User,
    decision: str,
    text: str | None = None,
    reason: str | None = None,
    note: str | None = None,
) -> ProposalDecision:
    """Aceptar no toca el prompt: la propuesta pasa a seguimiento (D-64). Descartar exige motivo. Las propuestas de un
    análisis de causa también se deciden (F4); la versión que las use lleva el aviso de medir en las mismas llamadas."""
    if decision == "discarded" and not (reason or "").strip():
        raise ValueError("reason_required")
    row = session.get(ProposalDecision, pattern.id)
    if row is not None and row.status == "included" and decision != "pending":
        raise ValueError("already_included")
    if row is None:
        row = ProposalDecision(pattern_id=pattern.id, decided_by_id=actor.id)
        session.add(row)
    data = pattern.data or {}
    original = observation_text(data) if pattern.is_observation else (data.get("proposal") or {}).get("text", "")
    row.status, row.decided_by_id, row.decided_at = decision, actor.id, now()
    row.included_in_version = None
    row.reason = reason.strip() if decision == "discarded" and reason else None
    if decision == "accepted":
        edited = (text or "").strip()
        row.edited_text = edited if edited and edited != original else None
        row.note = (note or "").strip() or None
    return row


def discard_observations(
    session: Session, ids: list[str], actor: User, reason: str
) -> tuple[list[tuple[DiscrepancyPattern, ProposalDecision]], int]:
    """Descarta en bloque las observaciones de un motivo (D-95). Las que otro admin ya decidió no se tocan y vuelven
    con su estado. Devuelve todas, en el orden pedido, y cuántas se descartaron."""
    reason = reason.strip()
    if not reason:
        raise ValueError("reason_required")
    ids = list(dict.fromkeys(ids))
    if not ids:
        raise ValueError("no_ids")
    patterns = {p.id: p for p in session.scalars(select(DiscrepancyPattern).where(DiscrepancyPattern.id.in_(ids)))}
    if len(patterns) != len(ids):
        raise LookupError("not_found")
    if len({p.criterion_id for p in patterns.values()}) > 1:
        raise ValueError("mixed_criteria")
    if not all(p.is_observation for p in patterns.values()):
        raise PermissionError("not_observation")
    out = []
    changed = 0
    for pattern_id in ids:
        pattern = patterns[pattern_id]
        row = session.get(ProposalDecision, pattern_id)
        if row is None or row.status == "pending":
            row = decide(session, pattern, actor, "discarded", reason=reason)
            changed += 1
        out.append((pattern, row))
    return out, changed


def set_follow_up(session: Session, pattern: DiscrepancyPattern, actor: User, status: str) -> ProposalDecision:
    if pattern.is_observation and status == "asked_client":
        raise ValueError("observation_status")
    row = session.get(ProposalDecision, pattern.id)
    if row is None or row.status not in FOLLOW_UP:
        raise ValueError("not_accepted")
    row.status, row.decided_by_id, row.decided_at = status, actor.id, now()
    return row


def include_in_version(session: Session, pattern_ids: list[str], version: str) -> int:
    """Al guardar una versión del prompt, las reglas aceptadas que marcó el admin quedan «Incluida en v{X}» (D-68)."""
    rows = list(decisions_for(session, pattern_ids).values())
    for row in rows:
        if row.status != "accepted":
            raise ValueError("not_accepted")
        row.status, row.included_in_version = "included", version
    return len(rows)


def release_version(session: Session, version: str) -> None:
    """Si la versión se descarta sin activarse, sus propuestas vuelven a «Aceptada» (D-68)."""
    for row in session.scalars(select(ProposalDecision).where(ProposalDecision.included_in_version == version)):
        row.status, row.included_in_version = "accepted", None
