"""Loop de mejora del prompt de la capa 2 (docs/plan-loop-prompt.md). Lo avanza el worker en cada pasada.

Una vuelta, sobre la versión de la vuelta:
1. Prueba en entrenamiento, solo en las llamadas que la última versión conocida falló (veredicto distinto al del
   revisor o dudoso). Sin vuelta anterior, la última conocida es la corrida vigente.
2. Análisis de discrepancias de esa prueba (purpose "rules"): sus propuestas van a la bandeja de siempre.
3. Pausa: el admin acepta reglas y crea la versión nueva desde Seguimiento (prompt_followup). El loop la reconoce
   porque sus propuestas quedan «Incluida en vX».
4. Prueba de la versión nueva en validación (la prueba normal de la versión).
5. Análisis de causa de esa prueba (purpose "attribution"): solo pinta el azul del mosaico.
6. Si quedan vueltas, la siguiente parte de la versión nueva.

Nada se publica solo. Cada paso pagado queda con su costo estimado y real en su propia fila.

    uv run python -m call_audit.prompt_loop start --base 2.12 --rounds 3 --actor admin@ejemplo.cl
    uv run python -m call_audit.prompt_loop status
    uv run python -m call_audit.prompt_loop stop
    uv run python -m call_audit.prompt_loop retry   # tras un fallo (p. ej. sin saldo): reintenta solo lo que falló
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import discrepancy_runs, prompt_evaluation
from call_audit.discrepancy_analysis import DEFAULT_MODEL
from call_audit.persistence.models import (
    DiscrepancyAnalysis,
    DiscrepancyPattern,
    PromptEvaluation,
    PromptLoop,
    PromptVersion,
    ProposalDecision,
    User,
)

logger = logging.getLogger(__name__)
ACTIVE = ("running", "waiting_approval")
BUSY = ("queued", "running")


def now() -> datetime:
    return datetime.now(UTC)


def active(session: Session) -> PromptLoop | None:
    return session.scalar(select(PromptLoop).where(PromptLoop.status.in_(ACTIVE)).order_by(PromptLoop.created_at))


def start(session: Session, actor: User, base: str, rounds: int = 3, model: str = DEFAULT_MODEL) -> PromptLoop:
    if active(session) is not None:
        raise ValueError("already_running")
    if session.get(PromptVersion, base) is None:
        raise ValueError("unknown_version")
    if not 1 <= rounds <= 10:
        raise ValueError("invalid_rounds")
    loop = PromptLoop(
        base_version=base,
        max_rounds=rounds,
        analysis_model=model,
        rounds=[{"round": 1, "version": base}],
        created_by_id=actor.id,
    )
    session.add(loop)
    session.flush()
    return loop


def stop(session: Session, loop: PromptLoop) -> None:
    if loop.status not in ACTIVE:
        raise ValueError("not_running")
    loop.status, loop.finished_at = "stopped", now()


# --- Pasos -------------------------------------------------------------------------------------------------------


def train_cases(session: Session) -> list[str]:
    """Todas las llamadas de entrenamiento con planilla: cada vuelta corre la versión nueva sobre las 660 completas.
    Antes solo se corrían las que seguían en desacuerdo con el revisor, así que las regresiones en las que ya estaban
    bien no se veían y el análisis aprendía de un pedazo, con veredictos de versiones distintas (2026-11-13)."""
    return [case.id for case, _run in prompt_evaluation.calibration_cases(session, "train")]


def included_version(session: Session, analysis_id: str) -> str | None:
    """La versión que el admin creó con reglas de ese análisis (sus propuestas quedan «Incluida en vX»)."""
    return session.scalar(
        select(ProposalDecision.included_in_version)
        .join(DiscrepancyPattern, DiscrepancyPattern.id == ProposalDecision.pattern_id)
        .where(DiscrepancyPattern.analysis_id == analysis_id, ProposalDecision.included_in_version.is_not(None))
        .limit(1)
    )


def save(loop: PromptLoop, current: dict) -> None:
    loop.rounds = [*loop.rounds[:-1], dict(current)]


def check_errors(evaluation: PromptEvaluation, what: str) -> str | None:
    """Una prueba con llamadas en error no sirve para comparar: el loop se detiene hasta un `retry`."""
    bad = prompt_evaluation.errored(evaluation)
    if not bad:
        return None
    return f"La prueba en {what} terminó con {len(bad)} llamadas con error ({bad[0]['error'][:120]})"


def retry(session: Session, loop: PromptLoop) -> str:
    """Retoma un loop fallido: reencola las llamadas con error de sus pruebas y relanza el análisis que falló."""
    if loop.status != "failed":
        raise ValueError("not_failed")
    current = dict(loop.rounds[-1])
    actions = []
    for key in ("trainEvalId", "valEvalId"):
        evaluation = session.get(PromptEvaluation, current[key]) if current.get(key) else None
        missing = evaluation is not None and (
            prompt_evaluation.errored(evaluation) or len(evaluation.results or []) < len(evaluation.case_ids)
        )
        if evaluation is not None and evaluation.status in ("done", "failed") and missing:
            actions.append(f"{prompt_evaluation.retry_errors(session, evaluation)} llamadas de {key}")
        elif evaluation is not None and evaluation.status in ("failed", "stopped"):
            current.pop(key)
            actions.append(f"prueba nueva para {key}")
    for key in ("trainAnalysisId", "valAnalysisId"):
        analysis = session.get(DiscrepancyAnalysis, current[key]) if current.get(key) else None
        if analysis is not None and analysis.status not in (*BUSY, "done"):
            current.pop(key)
            actions.append(f"análisis nuevo para {key}")
    save(loop, current)
    loop.status, loop.error, loop.finished_at = "running", None, None
    return "; ".join(actions) or "sin cambios: sigue desde donde quedó"


def fail(loop: PromptLoop, message: str) -> str:
    loop.status, loop.error, loop.finished_at = "failed", message[:500], now()
    return "failed"


def start_analysis(
    session: Session, loop: PromptLoop, evaluation: PromptEvaluation, purpose: str
) -> DiscrepancyAnalysis | None:
    """None si hay otro análisis corriendo (se reintenta en la siguiente pasada)."""
    if discrepancy_runs.running(session) is not None:
        return None
    rows, _, _ = discrepancy_runs.table(session, evaluation)
    criteria = discrepancy_runs.criteria_with_disagreements(rows)
    if not criteria:
        raise ValueError("no_disagreements")
    return discrepancy_runs.start(
        session, loop.created_by, criteria, loop.analysis_model, source=evaluation, purpose=purpose
    )


def step(session: Session, loop: PromptLoop) -> str:
    """Avanza el loop lo que se pueda sin esperar. Devuelve en qué quedó (para el log y la CLI)."""
    current = dict(loop.rounds[-1])
    actor = loop.created_by

    if not current.get("trainEvalId"):
        version = session.get(PromptVersion, current["version"])
        cases = train_cases(session)
        evaluation = prompt_evaluation.start_train(session, version, actor, cases, loop.id)
        current["trainEvalId"] = evaluation.id
        save(loop, current)
        return f"vuelta {current['round']}: prueba en entrenamiento ({len(cases)} llamadas)"
    train = session.get(PromptEvaluation, current["trainEvalId"])
    if train.status in BUSY:
        return f"vuelta {current['round']}: esperando la prueba en entrenamiento ({train.done}/{len(train.case_ids)})"
    if train.status != "done":
        return fail(loop, f"La prueba en entrenamiento terminó {train.status}: {train.error or ''}")
    if problem := check_errors(train, "entrenamiento"):
        return fail(loop, problem)

    if not current.get("trainAnalysisId"):
        run = start_analysis(session, loop, train, "rules")
        if run is None:
            return "esperando que termine otro análisis"
        current["trainAnalysisId"] = run.id
        save(loop, current)
        return f"vuelta {current['round']}: análisis de entrenamiento lanzado"
    analysis = session.get(DiscrepancyAnalysis, current["trainAnalysisId"])
    if analysis.status in BUSY:
        return f"vuelta {current['round']}: esperando el análisis de entrenamiento"
    if not analysis.done_criteria:
        return fail(loop, f"El análisis de entrenamiento terminó {analysis.status} sin motivos")

    if not current.get("nextVersion"):
        version = included_version(session, analysis.id)
        if version is None:
            loop.status = "waiting_approval"
            return f"vuelta {current['round']}: esperando que apruebes reglas y crees la versión"
        current["nextVersion"] = version
        loop.status = "running"
        save(loop, current)

    if not current.get("valEvalId"):
        row = session.get(PromptVersion, current["nextVersion"])
        # Si el admin la creó con «Crear borrador y probar», el loop usa esa prueba en vez de lanzar otra.
        existing = prompt_evaluation.latest(session, row.version)
        if existing is not None and existing.status not in ("failed", "stopped"):
            existing.loop_id = loop.id
            evaluation, verb = existing, "usa la prueba ya lanzada de"
        else:
            evaluation, verb = prompt_evaluation.start(session, row, actor, loop_id=loop.id), "prueba de"
        current["valEvalId"] = evaluation.id
        save(loop, current)
        return f"vuelta {current['round']}: {verb} v{row.version} en validación"
    val = session.get(PromptEvaluation, current["valEvalId"])
    if val.status in BUSY:
        return f"vuelta {current['round']}: esperando la prueba en validación ({val.done}/{len(val.case_ids)})"
    if val.status != "done":
        return fail(loop, f"La prueba en validación terminó {val.status}: {val.error or ''}")
    if problem := check_errors(val, "validación"):
        return fail(loop, problem)

    if not current.get("valAnalysisId"):
        from call_audit import agreement

        # Si el admin ya lo lanzó desde el mosaico («Analizar causa»), el loop usa ese.
        existing = agreement.attribution_of(session, val)
        run = (
            existing
            if existing is not None and existing.status in (*BUSY, "done")
            else start_analysis(session, loop, val, "attribution")
        )
        if run is None:
            return "esperando que termine otro análisis"
        current["valAnalysisId"] = run.id
        save(loop, current)
        return f"vuelta {current['round']}: análisis de causa en validación lanzado"
    attribution = session.get(DiscrepancyAnalysis, current["valAnalysisId"])
    if attribution.status in BUSY:
        return f"vuelta {current['round']}: esperando el análisis de causa"

    if current["round"] >= loop.max_rounds:
        loop.status, loop.finished_at = "done", now()
        return "terminado"
    loop.rounds = [*loop.rounds, {"round": current["round"] + 1, "version": current["nextVersion"]}]
    return f"vuelta {current['round']} lista; empieza la {current['round'] + 1}"


def advance(factory: sessionmaker[Session]) -> str | None:
    """Lo llama el worker. Avanza hasta que un paso tenga que esperar."""
    for _ in range(10):
        with factory() as session, session.begin():
            loop = active(session)
            if loop is None:
                return None
            before = json.dumps(loop.rounds), loop.status
            try:
                state = step(session, loop)
            except ValueError as exc:
                state = fail(loop, f"Error: {exc}")
            changed = (json.dumps(loop.rounds), loop.status) != before
        logger.info("Loop de prompt: %s", state)
        if not changed or loop.status not in ACTIVE:
            return state
    return state


# --- Lectura -----------------------------------------------------------------------------------------------------


def round_out(session: Session, r: dict) -> dict[str, Any]:
    def ev(eid: str | None) -> dict | None:
        e = session.get(PromptEvaluation, eid) if eid else None
        if e is None:
            return None
        rates = ((e.metrics or {}).get("criterionScores") or {}) if e.status == "done" else {}
        return {
            "id": e.id,
            "status": e.status,
            "done": e.done,
            "total": len(e.case_ids),
            "costUsd": e.cost_usd,
            "fpRate": rates.get("callFpRate"),
            "fnRate": rates.get("callFnRate"),
        }

    def an(aid: str | None) -> dict | None:
        a = session.get(DiscrepancyAnalysis, aid) if aid else None
        return {"id": a.id, "status": a.status, "costUsd": a.cost_usd} if a is not None else None

    return {
        "round": r["round"],
        "version": r["version"],
        "nextVersion": r.get("nextVersion"),
        "train": ev(r.get("trainEvalId")),
        "trainAnalysis": an(r.get("trainAnalysisId")),
        "val": ev(r.get("valEvalId")),
        "valAnalysis": an(r.get("valAnalysisId")),
    }


def loop_out(session: Session, loop: PromptLoop) -> dict[str, Any]:
    rounds = [round_out(session, r) for r in loop.rounds]
    spent = sum(
        (x or {}).get("costUsd") or 0
        for r in rounds
        for x in (r["train"], r["trainAnalysis"], r["val"], r["valAnalysis"])
    )
    return {
        "id": loop.id,
        "status": loop.status,
        "baseVersion": loop.base_version,
        "maxRounds": loop.max_rounds,
        "error": loop.error,
        "spentUsd": round(spent, 4),
        "rounds": rounds,
    }


def for_version(session: Session, version: str) -> dict[str, Any] | None:
    """La cadena del loop al que pertenece la versión, para la evolución del mosaico (E4): la base y cada vuelta con su
    acuerdo en validación. None si la versión no es de un loop."""
    from call_audit import agreement

    loops = session.scalars(select(PromptLoop).order_by(PromptLoop.created_at.desc()))
    loop = next(
        (lp for lp in loops if version == lp.base_version or any(r.get("nextVersion") == version for r in lp.rounds)),
        None,
    )
    if loop is None:
        return None

    def of(evaluation: PromptEvaluation | None) -> dict | None:
        return agreement.for_evaluation(session, evaluation) if evaluation is not None else None

    rounds = [
        {
            "round": 0,
            "version": loop.base_version,
            "parentVersion": None,
            "agreement": of(prompt_evaluation.latest(session, loop.base_version)),
        }
    ]
    for r in loop.rounds:
        if not r.get("nextVersion"):
            continue
        val = session.get(PromptEvaluation, r["valEvalId"]) if r.get("valEvalId") else None
        rounds.append(
            {"round": r["round"], "version": r["nextVersion"], "parentVersion": r["version"], "agreement": of(val)}
        )
    return {"id": loop.id, "status": loop.status, "rounds": rounds}


def main() -> None:
    from call_audit.persistence.db import get_sessionmaker

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_start = sub.add_parser("start")
    p_start.add_argument("--base", required=True)
    p_start.add_argument("--rounds", type=int, default=3)
    p_start.add_argument("--actor", required=True, help="correo del admin que lanza el loop")
    p_start.add_argument("--model", default=DEFAULT_MODEL)
    sub.add_parser("status")
    sub.add_parser("stop")
    sub.add_parser("retry")
    args = parser.parse_args()
    with get_sessionmaker()() as session, session.begin():
        if args.cmd == "start":
            actor = session.scalar(select(User).where(User.email == args.actor))
            if actor is None:
                raise SystemExit("No existe ese usuario")
            loop = start(session, actor, args.base, args.rounds, args.model)
            print(json.dumps(loop_out(session, loop), ensure_ascii=False, indent=2))
            return
        loop = active(session) or session.scalar(select(PromptLoop).order_by(PromptLoop.created_at.desc()))
        if loop is None:
            raise SystemExit("No hay loops")
        if args.cmd == "stop":
            stop(session, loop)
        if args.cmd == "retry":
            print(retry(session, loop))
        print(json.dumps(loop_out(session, loop), ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
