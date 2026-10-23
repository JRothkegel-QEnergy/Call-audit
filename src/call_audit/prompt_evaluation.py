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

from call_audit.config import ROOT, get_settings
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


def models() -> list[dict]:
    """Modelos configurados en el bench (scripts/prompt_bench/models.toml), habilitados."""
    if not MODELS_TOML.exists():
        return []
    data = tomllib.loads(MODELS_TOML.read_text(encoding="utf-8"))
    return [m for m in data["models"] if m.get("enabled", True)]


def calibration_cases(session: Session) -> list[tuple[Case, ModelRun]]:
    rows = session.execute(
        select(Case, ModelRun)
        .join(ModelRun, ModelRun.case_id == Case.id)
        .where(Case.external_verdict.is_not(None), ModelRun.is_current.is_(True), ModelRun.user_prompt != "")
        .order_by(Case.call_date, Case.call_id)
    )
    return [(c, r) for c, r in rows]


def estimate(session: Session, model: str) -> dict[str, Any]:
    n = len(calibration_cases(session))
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


def start(session: Session, row: PromptVersion, actor: User, model: str | None = None) -> PromptEvaluation:
    if row.status not in ("draft", "test_failed"):
        raise ValueError("invalid_state")
    model = model or row.model
    cases = calibration_cases(session)
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
    )
    session.add(evaluation)
    row.status = "testing"
    row.model = model
    add_history(row, actor.name, "Inició la prueba contra la referencia (la versión queda inmutable)")
    session.flush()
    return evaluation


def latest(session: Session, version: str) -> PromptEvaluation | None:
    return session.scalar(
        select(PromptEvaluation).where(PromptEvaluation.version == version).order_by(PromptEvaluation.created_at.desc())
    )


def stop(session: Session, evaluation: PromptEvaluation, actor: User) -> None:
    if evaluation.status not in ("queued", "running"):
        raise ValueError("not_running")
    evaluation.status, evaluation.stopped_by_id, evaluation.finished_at = "stopped", actor.id, now()
    row = session.get(PromptVersion, evaluation.version)
    if row is not None:
        row.status = "test_failed"
        add_history(row, actor.name, f"Detuvo la prueba en {evaluation.done} de {len(evaluation.case_ids)} llamadas")


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
    audit = bench.extract_audit(text)
    verdict, bad, _ = real_calls.verdict(
        audit,
        real_calls.unevaluable_for({"TIPIFICACION": typification(run)}),
        holds=(case.call_metadata or {}).get("holds_sec"),
        minor=set(rubric.minor),
        hold_limit=rubric.hold_limit_sec,
    )
    transcript = run.user_prompt.split("## Transcripción", 1)[-1]
    quotes = [e.get("cita", "") for c in audit.get("criterios", []) for e in c.get("evidencia", []) if e.get("cita")]
    return {
        "verdict": VERDICTS[verdict],
        "failCriteria": sorted(bad),
        "quotes": len(quotes),
        "unvalidatedQuotes": sum(1 for q in quotes if not real_calls.quote_found(q, transcript)),
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
                    "app": app,
                    "failCriteria": [],
                    "quotes": 0,
                    "unvalidatedQuotes": 0,
                }
            return {
                "caseId": case.id,
                "external": case.external_verdict,
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

    with factory() as session, session.begin():
        evaluation = session.get(PromptEvaluation, evaluation_id)
        if evaluation.status == "stopped":
            return
        evaluation.metrics = metrics(evaluation.results)
        evaluation.status, evaluation.finished_at = "done", now()
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
    }


def current_metrics(session: Session) -> dict[str, Any] | None:
    """Métricas de la versión vigente sobre el mismo conjunto, con las corridas que ya existen (sin gastar)."""
    results = []
    for case, run in calibration_cases(session):
        review = session.scalar(select(Review).where(Review.case_id == case.id))
        evidence = [e for f in run.findings or [] for e in ([f["evidence"]] if f.get("evidence") else [])]
        results.append(
            {
                "caseId": case.id,
                "verdict": run.verdict,
                "external": case.external_verdict,
                "app": review.final_verdict if review else None,
                "cost": run.cost_usd,
                "latencyMs": run.latency_ms,
                "failCriteria": [f["criterionId"] for f in run.findings or [] if f.get("verdict") == "non_compliant"],
                "quotes": len(evidence),
                "unvalidatedQuotes": sum(1 for e in evidence if e.get("quoteValidated") is False),
            }
        )
    return metrics(results) if results else None


def count_calibration(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Case).where(Case.external_verdict.is_not(None))) or 0
