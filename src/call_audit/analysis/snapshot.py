"""Foto precomputada de «Calidad del servicio» (docs/ux/vistas-supervisor/08-alta-fidelidad.md §4.1). Sin IA.

    uv run python -m call_audit.analysis.snapshot build [--period-days 90] [--reports-dir reports/analysis]

Lee la corrida vigente de cada llamada (`model_runs.is_current`) y la planilla (`cases.external_item_fails`), y
escribe una foto completa en una transacción: si algo falla, la anterior sigue vigente. Se corre al terminar una
pasada del worker y al importar una planilla (`rebuild_quietly`), o a mano.
"""

from __future__ import annotations

import argparse
import logging
import re
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from call_audit.analysis.compute import ALL, DATA_EXPLAINED, Call, Config, criteria_rows, filtered
from call_audit.config import ROOT, get_settings
from call_audit.discrepancies import evaluator_name
from call_audit.persistence.models import (
    AnalysisReport,
    AnalysisSnapshot,
    AnalysisSnapshotCall,
    Case,
    ModelRun,
    PipelineRun,
    Review,
    User,
)
from call_audit.rubric import load_rubric

logger = logging.getLogger(__name__)

FAIL = "non_compliant"
AUDIENCES = ("company", "internal")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")


def insurance_type(case: Case) -> str:
    """Tipo de seguro agrupado desde el nombre del producto (P-3, pendiente de validar con la corredora).

    No se usa TIPO_SEGURO: en los lotes que llegaron trae el sistema de origen (MUS, SALEFORCE, ANETO), no el tipo.
    """
    name = (case.products[0] if case.products else "").lower()
    if "sale seguro" in name:
        return "Sale Seguro"
    if "incendio" in name:
        return "Incendio Hogar"
    if "accident" in name or name.startswith("ap ") or "sonap" in name:
        return "Accidentes personales"
    return "Vida y salud" if name else "Sin tipo"


def flow(case: Case) -> str:
    raw = ((case.call_metadata or {}).get("customer") or {}).get("flow")
    return str(raw).strip().capitalize() if raw else "Sin flujo"


def auditor_fails(review: Review, ai_fails: set[int]) -> set[int]:
    """Motivos No cumple según la revisión del auditor. Un motivo que no aparece en la revisión mantiene lo que dijo
    la IA: el auditor solo registra los motivos que confirmó, corrigió o agregó."""
    reviewed = {int(i["criterionId"]): i.get("verdict") for i in review.items or []}
    kept = {cid for cid in ai_fails if cid not in reviewed}
    return kept | {cid for cid, verdict in reviewed.items() if verdict == FAIL}


def to_call(case: Case, run: ModelRun, review: Review | None = None, auditor: str | None = None) -> Call:
    findings = run.findings or []
    fails = {int(f["criterionId"]) for f in findings if f.get("verdict") == FAIL}
    evidence = {
        int(f["criterionId"]): int((f.get("evidence") or {})["startMs"])
        for f in findings
        if f.get("verdict") == FAIL and (f.get("evidence") or {}).get("startMs") is not None
    }
    # D-31: «Según el auditor». Si un auditor revisó la llamada en la app, manda su revisión; si no, la planilla.
    if review is not None:
        reference, ref_fails = "auditor", frozenset(auditor_fails(review, fails))
        ref_verdict, evaluator = review.final_verdict, auditor
    elif case.external_item_fails is not None:
        reference, ref_fails = "sheet", frozenset(int(x) for x in case.external_item_fails)
        ref_verdict = case.external_verdict
        evaluator = evaluator_name((case.call_metadata or {}).get("external_evaluator"))
    else:
        reference, ref_fails, ref_verdict = None, None, case.external_verdict
        evaluator = evaluator_name((case.call_metadata or {}).get("external_evaluator"))
    return Call(
        case_id=case.id,
        call_id=case.call_id,
        call_date=case.call_date,
        agent_id=case.agent_id,
        agent_name=case.agent.name if case.agent else case.agent_id,
        evaluator=evaluator,
        insurance_type=insurance_type(case),
        flow=flow(case),
        ai_fails=frozenset(fails),
        sheet_fails=ref_fails,
        ai_evidence_ms=evidence,
        ai_verdict=run.verdict,
        sheet_verdict=ref_verdict,
        reference=reference,
    )


def current_calls(session: Session, period_days: int) -> tuple[list[Call], dict[str, str]]:
    """Llamadas con corrida vigente sin error dentro del periodo (contado hacia atrás desde la llamada más nueva)."""
    pairs = session.execute(
        select(Case, ModelRun).join(ModelRun, (ModelRun.case_id == Case.id) & ModelRun.is_current)
    ).all()
    pairs = [(c, r) for c, r in pairs if not r.error and r.findings]
    if not pairs:
        return [], {}
    newest = max(date.fromisoformat(c.call_date) for c, _ in pairs)
    since = (newest - timedelta(days=period_days - 1)).isoformat()
    pairs = [(c, r) for c, r in pairs if c.call_date >= since]
    labels = Counter(r.run_label for _, r in pairs)
    label = labels.most_common(1)[0][0]
    # D-18: una sola corrida para todo. Si la vigente mezcla corridas, la banda lo dice (S-07).
    runs = {"perCall": label, "perCriterion": label if len(labels) == 1 else " + ".join(sorted(labels))}
    reviews = {
        r.case_id: r for r in session.scalars(select(Review).where(Review.case_id.in_([c.id for c, _ in pairs])))
    }
    names = {u.id: u.name for u in session.scalars(select(User))}
    calls = [
        to_call(c, r, reviews.get(c.id), names.get(reviews[c.id].auditor_id) if c.id in reviews else None)
        for c, r in pairs
    ]
    return calls, runs


def parse_report(path: Path) -> dict[str, Any]:
    """Markdown con encabezado YAML (title, date, run, audience, slug). Lanza ValueError si no es válido."""
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not match:
        raise ValueError(f"{path.name}: falta el encabezado YAML")
    head = yaml.safe_load(match.group(1)) or {}
    slug = str(head.get("slug") or path.stem).lower()
    if not SLUG.match(slug):
        raise ValueError(f"{path.name}: slug inválido")
    if head.get("audience") not in AUDIENCES:
        raise ValueError(f"{path.name}: audience debe ser company o internal")
    if not head.get("title") or not head.get("date"):
        raise ValueError(f"{path.name}: faltan title o date")
    return {
        "slug": slug,
        "title": str(head["title"]),
        "date": str(head["date"]),
        "run": str(head.get("run") or ""),
        "audience": head["audience"],
        "body_md": match.group(2).strip(),
    }


def build(session: Session, config: Config | None = None, reports_dir: Path | None = None) -> AnalysisSnapshot | None:
    """Arma la foto y la deja vigente. No hace commit: el que llama maneja la transacción. None si no hay llamadas."""
    config = config or Config(data_explained=dict(DATA_EXPLAINED))
    calls, runs = current_calls(session, config.period_days)
    if not calls:
        return None
    rubric = load_rubric(get_settings().rubric_path)
    blocks = {cid: b.id for b in rubric.blocks for cid in b.criteria}
    types = sorted({c.insurance_type for c in calls})
    flows = sorted({c.flow for c in calls})
    criteria = {
        f"{t}|{f}": criteria_rows(filtered(calls, t, f), blocks, config) for t in (ALL, *types) for f in (ALL, *flows)
    }
    sheet_dates = [c.call_date for c in calls if c.reference == "sheet"]
    reference = {"auditor": sum(c.reference == "auditor" for c in calls), "sheet": len(sheet_dates)}
    snapshot = AnalysisSnapshot(
        is_current=False,
        period_from=min(c.call_date for c in calls),
        period_to=max(c.call_date for c in calls),
        sheet_until=max(sheet_dates) if sheet_dates else None,
        runs=runs,
        config=config.as_dict(),
        payload={
            "criteria": criteria,
            "filters": {"insuranceTypes": types, "flows": flows},
            "blocks": blocks,
            "reference": reference,
        },
    )
    session.add(snapshot)
    session.flush()
    session.add_all(
        AnalysisSnapshotCall(
            snapshot_id=snapshot.id,
            case_id=c.case_id,
            call_id=c.call_id,
            call_date=c.call_date,
            agent_id=c.agent_id,
            agent_name=c.agent_name,
            evaluator=c.evaluator,
            insurance_type=c.insurance_type,
            flow=c.flow,
            ai_fails=sorted(c.ai_fails),
            sheet_fails=sorted(c.sheet_fails) if c.sheet_fails is not None else None,
            ai_evidence_ms={str(k): v for k, v in c.ai_evidence_ms.items()},
            ai_verdict=c.ai_verdict,
            sheet_verdict=c.sheet_verdict,
            reference=c.reference,
        )
        for c in calls
    )
    if reports_dir is not None and reports_dir.is_dir():
        reports = [parse_report(p) for p in sorted(reports_dir.glob("*.md"))]  # uno inválido corta todo
        session.execute(delete(AnalysisReport))
        session.add_all(AnalysisReport(snapshot_id=snapshot.id, **r) for r in reports)
    previous = select(AnalysisSnapshot.id).where(AnalysisSnapshot.is_current)
    old_ids = list(session.scalars(previous))
    session.execute(update(AnalysisSnapshot).where(AnalysisSnapshot.is_current).values(is_current=False))
    snapshot.is_current = True
    # Solo se guardan las llamadas de la foto vigente; las anteriores quedan como registro sin su detalle.
    if old_ids:
        session.execute(delete(AnalysisSnapshotCall).where(AnalysisSnapshotCall.snapshot_id.in_(old_ids)))
    return snapshot


def rebuild_quietly(session_factory: Any) -> None:
    """Para el worker y la importación de la planilla: si falla, queda la foto anterior y solo se registra."""
    try:
        with session_factory() as session, session.begin():
            build(session, reports_dir=default_reports_dir())
    except Exception:  # noqa: BLE001 — nunca debe cortar la pasada
        logger.exception("No se pudo actualizar la foto de Calidad del servicio")


def default_reports_dir() -> Path:
    return ROOT / "reports" / "analysis"


# ---- Lectura (API) ----


def current(session: Session) -> AnalysisSnapshot | None:
    return session.scalar(select(AnalysisSnapshot).where(AnalysisSnapshot.is_current))


_CALLS: dict[tuple[str, int], list[Call]] = {}


def calls_of(session: Session, snapshot: AnalysisSnapshot) -> list[Call]:
    """Llamadas de la foto. Se guardan en memoria por foto: la foto no cambia una vez escrita."""
    key = (snapshot.id, id(session.get_bind()))
    if key not in _CALLS:
        rows = session.scalars(select(AnalysisSnapshotCall).where(AnalysisSnapshotCall.snapshot_id == snapshot.id))
        if len(_CALLS) > 4:
            _CALLS.clear()
        _CALLS[key] = [
            Call(
                case_id=r.case_id,
                call_id=r.call_id,
                call_date=r.call_date,
                agent_id=r.agent_id,
                agent_name=r.agent_name,
                evaluator=r.evaluator,
                insurance_type=r.insurance_type,
                flow=r.flow,
                ai_fails=frozenset(r.ai_fails),
                sheet_fails=frozenset(r.sheet_fails) if r.sheet_fails is not None else None,
                ai_evidence_ms={int(k): v for k, v in (r.ai_evidence_ms or {}).items()},
                ai_verdict=r.ai_verdict,
                sheet_verdict=r.sheet_verdict,
                reference=r.reference,
            )
            for r in rows
        ]
    return _CALLS[key]


def last_processed_at(session: Session) -> str | None:
    finished = session.scalar(select(PipelineRun.finished_at).order_by(PipelineRun.finished_at.desc()).limit(1))
    return finished.isoformat() if finished else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["build"])
    parser.add_argument("--period-days", type=int, default=90)
    parser.add_argument("--u", type=float, default=15.0, help="puntos de desacuerdo para «Se marca distinto»")
    parser.add_argument("--low", type=int, default=10, help="bajo esto, «pocas llamadas»")
    parser.add_argument("--min-agents", type=int, default=5)
    parser.add_argument("--reports-dir", type=Path, default=None)
    args = parser.parse_args()
    from call_audit.persistence.db import get_sessionmaker

    config = Config(
        u=args.u,
        low=args.low,
        min_agents=args.min_agents,
        period_days=args.period_days,
        data_explained=dict(DATA_EXPLAINED),
    )
    with get_sessionmaker()() as session, session.begin():
        snapshot = build(session, config, args.reports_dir or default_reports_dir())
        if snapshot is None:
            print("No hay llamadas con corrida vigente: no se escribió ninguna foto.")
            return
        print(f"Foto {snapshot.id}: {snapshot.period_from} a {snapshot.period_to}, corrida {snapshot.runs}")


if __name__ == "__main__":
    main()
