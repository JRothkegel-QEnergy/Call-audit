"""Prueba de una versión del prompt contra la referencia (Cambio 12 §4.2). La corre el worker.

Conjunto de calibración: las llamadas que traen el veredicto del cliente (ESTADO_CALIDAD) y tienen una corrida vigente
con su mensaje de usuario guardado (ya anonimizado). La prueba manda ese mismo mensaje con el system prompt de la
versión nueva, así compara solo el cambio de prompt. No crea casos ni cambia resultados de la app.

El costo estimado sale del costo promedio que registraron las corridas anteriores del mismo modelo; nunca de
precios escritos en el código (CLAUDE.md). La prueba se puede detener: el worker revisa el estado entre llamadas.
"""

import logging
import sys
import tomllib
from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from statistics import mean
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import golden_split
from call_audit.config import ROOT, get_settings
from call_audit.ingestion import import_bench
from call_audit.persistence.models import Case, ModelRun, PromptEvaluation, PromptVersion, Review, User
from call_audit.prompt_registry import add_history
from call_audit.rubric import load_rubric

logger = logging.getLogger(__name__)
sys.path.insert(0, str(ROOT / "scripts" / "prompt_bench"))

MODELS_TOML = ROOT / "scripts" / "prompt_bench" / "models.toml"
WORKERS = 4
VERDICTS = {"APROBADA": "compliant", "RECHAZADA": "non_compliant", "DUDOSA": "uncertain", "ERROR": "uncertain"}

# (model, system, user) -> (texto de la respuesta, costo USD, latencia ms). Los tests pasan un doble.
ModelCaller = Callable[[str, str, str], tuple[str, float, int]]


def now() -> datetime:
    return datetime.now(UTC)


def all_models() -> list[dict]:
    """Modelos configurados en el bench (scripts/prompt_bench/models.toml), en su orden, habilitados o no."""
    if not MODELS_TOML.exists():
        return []
    return tomllib.loads(MODELS_TOML.read_text(encoding="utf-8"))["models"]


def models() -> list[dict]:
    """Modelos del bench habilitados."""
    return [m for m in all_models() if m.get("enabled", True)]


def eval_split(session: Session) -> str | None:
    """Set del golden set donde se prueba una versión: validación, si las llamadas ya tienen set asignado. La cuarta IA
    propone reglas mirando solo entrenamiento, así que medir ahí inflaría la mejora (call_audit.golden_split)."""
    return golden_split.default_split(session, "val")


def calibration_cases(session: Session, split: str | None = None) -> list[tuple[Case, ModelRun]]:
    rows = session.execute(
        select(Case, ModelRun)
        .join(ModelRun, ModelRun.case_id == Case.id)
        .where(Case.external_verdict.is_not(None), ModelRun.is_current.is_(True), ModelRun.user_prompt != "")
        .order_by(Case.call_date, Case.call_id)
    )
    return [(c, r) for c, r in rows if split is None or golden_split.split_of(c) == split]


def estimate(session: Session, model: str) -> dict[str, Any]:
    n = len(calibration_cases(session, eval_split(session)))
    recent = select(ModelRun.cost_usd, ModelRun.latency_ms).where(ModelRun.model == model, ModelRun.cost_usd > 0)
    rows = list(session.execute(recent.order_by(ModelRun.run_at.desc()).limit(200)))
    per_call = round(mean(r.cost_usd for r in rows), 6) if rows else None
    latency = mean(r.latency_ms for r in rows) if rows else None
    return {
        "calls": n,
        "model": model,
        "perCallUsd": per_call,
        "totalUsd": round(per_call * n, 4) if per_call is not None else None,
        "minutes": round(n * latency / WORKERS / 60_000, 1) if latency else None,
    }


def start(
    session: Session, row: PromptVersion, actor: User, model: str | None = None, loop_id: str | None = None
) -> PromptEvaluation:
    if row.status not in ("draft", "test_failed"):
        raise ValueError("invalid_state")
    model = model or row.model
    split = eval_split(session)
    cases = calibration_cases(session, split)
    if not cases:
        raise ValueError("no_calibration")
    est = estimate(session, model)
    evaluation = PromptEvaluation(
        version=row.version,
        model=model,
        requested_by_id=actor.id,
        case_ids=[c.id for c, _ in cases],
        estimated_cost_usd=est["totalUsd"],
        results=[],
        purpose="test",
        split=split,
        loop_id=loop_id,
    )
    session.add(evaluation)
    row.status = "testing"
    row.model = model
    where = f" · set {split} del golden set, {len(cases)} llamadas" if split else ""
    add_history(row, actor.name, f"Inició la prueba contra la referencia (la versión queda inmutable){where}")
    session.flush()
    return evaluation


def start_train(
    session: Session, row: PromptVersion, actor: User, case_ids: list[str], loop_id: str, model: str | None = None
) -> PromptEvaluation:
    """Pasada del loop de mejora sobre llamadas de entrenamiento (docs/plan-loop-prompt.md). No cambia el estado de la
    versión ni aparece como su prueba: sus resultados solo alimentan el análisis de discrepancias."""
    if not case_ids:
        raise ValueError("no_cases")
    model = model or row.model
    per_call = estimate(session, model)["perCallUsd"]
    evaluation = PromptEvaluation(
        version=row.version,
        model=model,
        requested_by_id=actor.id,
        case_ids=list(case_ids),
        estimated_cost_usd=round(per_call * len(case_ids), 4) if per_call is not None else None,
        results=[],
        purpose="train",
        split="train",
        loop_id=loop_id,
    )
    session.add(evaluation)
    session.flush()
    return evaluation


def is_test(evaluation: PromptEvaluation) -> bool:
    """La prueba de la versión (las anteriores al loop no tienen purpose)."""
    return evaluation.purpose in (None, "test")


def latest(session: Session, version: str) -> PromptEvaluation | None:
    return session.scalar(
        select(PromptEvaluation)
        .where(PromptEvaluation.version == version, PromptEvaluation.purpose.is_distinct_from("train"))
        .order_by(PromptEvaluation.created_at.desc())
    )


def stop(session: Session, evaluation: PromptEvaluation, actor: User) -> None:
    if evaluation.status not in ("queued", "running"):
        raise ValueError("not_running")
    evaluation.status, evaluation.stopped_by_id, evaluation.finished_at = "stopped", actor.id, now()
    row = session.get(PromptVersion, evaluation.version)
    if row is not None and is_test(evaluation):
        row.status = "test_failed"
        add_history(row, actor.name, f"Detuvo la prueba en {evaluation.done} de {len(evaluation.case_ids)} llamadas")


def errored(evaluation: PromptEvaluation) -> list[dict]:
    return [r for r in evaluation.results or [] if r.get("error")]


def retry_errors(session: Session, evaluation: PromptEvaluation) -> int:
    """Vuelve a encolar solo las llamadas que terminaron con error (p. ej. sin créditos del proveedor). Las que ya
    salieron bien se conservan y no se vuelven a pagar. Devuelve cuántas quedan por correr."""
    if evaluation.status not in ("done", "failed"):
        raise ValueError("not_finished")
    keep = [r for r in evaluation.results or [] if not r.get("error")]
    pending = len(evaluation.case_ids) - len(keep)
    if not pending:
        raise ValueError("no_errors")
    evaluation.results, evaluation.done = keep, len(keep)
    evaluation.cost_usd = round(sum(r["cost"] for r in keep), 6)
    evaluation.status, evaluation.error, evaluation.finished_at, evaluation.metrics = "queued", None, None, None
    if is_test(evaluation):
        row = session.get(PromptVersion, evaluation.version)
        row.status = "testing"
        add_history(row, "Sistema", f"Reintenta {pending} llamadas que terminaron con error")
    return pending


def out_of_credits(results: list[dict]) -> bool:
    """El proveedor rechaza todo el lote por saldo (HTTP 402): seguir solo llenaría la prueba de errores."""
    return bool(results) and all("Error code: 402" in (r.get("error") or "") for r in results)


# --- Worker ------------------------------------------------------------------------------------------------------


def bench_caller() -> ModelCaller:
    """Llama al modelo con las mismas funciones del bench (scripts/prompt_bench/run.py)."""
    import run as bench

    bench.load_dotenv(ROOT / ".env")
    configs = {m["name"]: m for m in models()}

    def call(model: str, system: str, user: str) -> tuple[str, float, int]:
        cfg = configs[model]
        fn = bench.call_anthropic if cfg["provider"] == "anthropic" else bench.call_openai_compatible
        started = datetime.now()
        text, _, usage = fn(cfg, system, user)
        latency = int((datetime.now() - started).total_seconds() * 1000)
        return text, float(bench.cost_usd(cfg, usage) or 0.0), latency

    return call


def typification(run: ModelRun) -> str:
    for section in run.input_data or []:
        for r in section.get("rows", []):
            if r.get("field") == "Tipificación" and r.get("value") != "NO INFORMADA":
                return r.get("value", "")
    return ""


def score(case: Case, run: ModelRun, text: str) -> dict[str, Any]:
    """Veredicto de una respuesta con la misma regla del bench (real_calls.verdict)."""
    import real_calls
    import run as bench

    rubric = load_rubric(get_settings().rubric_path)
    holds = (case.call_metadata or {}).get("holds_sec")
    audit = bench.extract_audit(text)
    verdict, bad, unsure = real_calls.verdict(
        audit,
        real_calls.unevaluable_for({"TIPIFICACION": typification(run)}),
        holds=holds,
        minor=set(rubric.minor),
        hold_limit=rubric.hold_limit_sec,
    )
    transcript = run.user_prompt.split("## Transcripción", 1)[-1]
    quotes = [e.get("cita", "") for c in audit.get("criterios", []) for e in c.get("evidencia", []) if e.get("cita")]
    return {
        "verdict": VERDICTS[verdict],
        "failCriteria": sorted(bad),
        "uncertainCriteria": sorted(unsure),
        "quotes": len(quotes),
        "unvalidatedQuotes": sum(1 for q in quotes if not real_calls.quote_found(q, transcript)),
        # Hallazgos por motivo con comentario y citas, como los de una corrida: el análisis de discrepancias del loop
        # los necesita para leer qué vio la IA (docs/plan-loop-prompt.md). Texto enmascarado, el que vio el modelo.
        "findings": import_bench.findings_from(audit, transcript, holds or [], rubric),
    }


def process_pending(factory: sessionmaker[Session], caller: ModelCaller | None = None) -> int:
    """Corre las pruebas en cola. Lo llama el loop del worker; una prueba fallida no lo bota."""
    with factory() as session:
        pending = list(
            session.scalars(select(PromptEvaluation.id).where(PromptEvaluation.status.in_(("queued", "running"))))
        )
    for evaluation_id in pending:
        try:
            run_evaluation(factory, evaluation_id, caller or bench_caller())
        except Exception as exc:  # noqa: BLE001 - se registra y se marca como fallida
            logger.exception("Falló la prueba %s", evaluation_id)
            with factory() as session, session.begin():
                evaluation = session.get(PromptEvaluation, evaluation_id)
                evaluation.status, evaluation.error, evaluation.finished_at = "failed", str(exc)[:500], now()
                if is_test(evaluation):
                    row = session.get(PromptVersion, evaluation.version)
                    row.status = "test_failed"
                    add_history(row, "Sistema", "La prueba falló")
    return len(pending)


def run_evaluation(factory: sessionmaker[Session], evaluation_id: str, caller: ModelCaller) -> None:
    with factory() as session, session.begin():
        evaluation = session.get(PromptEvaluation, evaluation_id)
        evaluation.status, evaluation.started_at = "running", evaluation.started_at or now()
        system = session.get(PromptVersion, evaluation.version).system_text
        model, case_ids, done_ids = (
            evaluation.model,
            list(evaluation.case_ids),
            {r["caseId"] for r in evaluation.results},
        )

    todo = [cid for cid in case_ids if cid not in done_ids]
    for start_at in range(0, len(todo), WORKERS):
        with factory() as session:
            if session.get(PromptEvaluation, evaluation_id).status == "stopped":
                return
            chunk = []
            for cid in todo[start_at : start_at + WORKERS]:
                case = session.get(Case, cid)
                run = next((r for r in case.runs if r.is_current), None)
                if run is not None:
                    review = session.scalar(select(Review).where(Review.case_id == cid))
                    chunk.append((case, run, review.final_verdict if review else None))

        def job(item):
            case, run, app = item
            try:
                text, cost, latency = caller(model, system, run.user_prompt)
                scored = score(case, run, text)
            except Exception as exc:  # noqa: BLE001 - una llamada con error no frena la prueba
                return {
                    "caseId": case.id,
                    "verdict": "uncertain",
                    "error": str(exc)[:200],
                    "cost": 0.0,
                    "latencyMs": 0,
                    "external": case.external_verdict,
                    "externalFails": case.external_item_fails,
                    "split": golden_split.split_of(case),
                    "app": app,
                    "failCriteria": [],
                    "uncertainCriteria": [],
                    "quotes": 0,
                    "unvalidatedQuotes": 0,
                }
            return {
                "caseId": case.id,
                "external": case.external_verdict,
                "externalFails": case.external_item_fails,
                "split": golden_split.split_of(case),
                "app": app,
                "cost": cost,
                "latencyMs": latency,
                **scored,
            }

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            results = list(pool.map(job, chunk))
        with factory() as session, session.begin():
            evaluation = session.get(PromptEvaluation, evaluation_id)
            if evaluation.status == "stopped":
                return
            evaluation.results = [*evaluation.results, *results]
            evaluation.done = len(evaluation.results)
            evaluation.cost_usd = round(sum(r["cost"] for r in evaluation.results), 6)
        if out_of_credits(results):
            # process_pending la marca fallida; `retry_errors` después reencola solo lo que falta.
            raise RuntimeError("El proveedor del modelo rechazó las llamadas por falta de saldo (402)")

    with factory() as session, session.begin():
        evaluation = session.get(PromptEvaluation, evaluation_id)
        if evaluation.status == "stopped":
            return
        evaluation.metrics = metrics(evaluation.results)
        evaluation.status, evaluation.finished_at = "done", now()
        if not is_test(evaluation):
            return
        row = session.get(PromptVersion, evaluation.version)
        row.status, row.tested_at = "tested", now()
        add_history(row, "Sistema", f"Terminó la prueba · {evaluation.done} llamadas · {evaluation.cost_usd:.4f} USD")


# --- Métricas ----------------------------------------------------------------------------------------------------


def reference(results: list[dict], key: str, kind: str) -> dict[str, Any] | None:
    rows = [r for r in results if r.get(key)]
    if not rows:
        return None
    n = len(rows)
    quotes = sum(r.get("quotes", 0) for r in rows)
    return {
        "kind": kind,
        "n": n,
        "matchRate": round(100 * sum(r["verdict"] == r[key] for r in rows) / n, 1),
        "uncertainRate": round(100 * sum(r["verdict"] == "uncertain" for r in rows) / n, 1),
        "aiOnlyFail": sum(r["verdict"] == "non_compliant" and r[key] == "compliant" for r in rows),
        "aiMissedFail": sum(r["verdict"] == "compliant" and r[key] == "non_compliant" for r in rows),
        "unvalidatedQuoteRate": round(100 * sum(r.get("unvalidatedQuotes", 0) for r in rows) / quotes, 1)
        if quotes
        else 0.0,
    }


def metrics(results: list[dict]) -> dict[str, Any]:
    fails = Counter(c for r in results for c in r.get("failCriteria", []))
    latencies = sorted(r["latencyMs"] for r in results if r.get("latencyMs"))
    return {
        "references": [
            x for x in (reference(results, "external", "client"), reference(results, "app", "app_auditors")) if x
        ],
        "costPerCallUsd": round(sum(r.get("cost", 0) for r in results) / len(results), 6) if results else 0.0,
        "latencyMsP50": latencies[len(latencies) // 2] if latencies else 0,
        "latencyMsP95": latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))] if latencies else 0,
        "byCriterion": [{"criterionId": c, "failCount": n} for c, n in sorted(fails.items())],
        "splits": dict(Counter(r.get("split") or "none" for r in results)),
        "criterionScores": criterion_scores(results),
    }


def criterion_scores(results: list[dict]) -> dict[str, Any] | None:
    """Precisión, recall y F1 por motivo contra la marca del cliente (golden_split.summary). Sin las llamadas con
    error, que no traen hallazgos y contarían como "la IA no marcó nada"."""
    rows = [
        {
            "verdict": r["verdict"],
            "external": r.get("external"),
            "aiFails": r.get("failCriteria", []),
            "aiUncertain": r.get("uncertainCriteria", []),
            "refFails": [int(x) for x in r["externalFails"]],
        }
        for r in results
        if r.get("externalFails") is not None and not r.get("error")
    ]
    return golden_split.summary(rows, golden_split.layer2_criteria()) if rows else None


def current_metrics(session: Session) -> dict[str, Any] | None:
    """Métricas de la versión vigente sobre el mismo conjunto, con las corridas que ya existen (sin gastar)."""
    results = []
    for case, run in calibration_cases(session, eval_split(session)):
        review = session.scalar(select(Review).where(Review.case_id == case.id))
        evidence = [e for f in run.findings or [] for e in ([f["evidence"]] if f.get("evidence") else [])]
        results.append(
            {
                "caseId": case.id,
                "verdict": run.verdict,
                "external": case.external_verdict,
                "externalFails": case.external_item_fails,
                "split": golden_split.split_of(case),
                "error": run.error,
                "app": review.final_verdict if review else None,
                "cost": run.cost_usd,
                "latencyMs": run.latency_ms,
                "failCriteria": [f["criterionId"] for f in run.findings or [] if f.get("verdict") == "non_compliant"],
                "uncertainCriteria": [f["criterionId"] for f in run.findings or [] if f.get("verdict") == "uncertain"],
                "quotes": len(evidence),
                "unvalidatedQuotes": sum(1 for e in evidence if e.get("quoteValidated") is False),
            }
        )
    if not results:
        return None
    from call_audit import agreement

    # La vigente se mide con sus corridas de producción: sin análisis de causa (no es una prueba).
    return {**metrics(results), "agreement": agreement.for_results(session, results, None, False)}


def count_calibration(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Case).where(Case.external_verdict.is_not(None))) or 0
