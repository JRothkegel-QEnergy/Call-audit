"""Verificación caso a caso del mosaico (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md).

Sin IA. Una persona revisa cada desacuerdo (motivo de una llamada en que la IA y la planilla no marcan lo mismo, o en
que la IA quedó dudosa) y registra quién tenía razón. Se guarda la respuesta correcta del motivo, no "quién ganó", así
que el mismo registro sirve para cualquier versión del prompt (H-15): en cada versión se recalcula si su IA acertó.
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import accounts, agreement, golden_split
from call_audit.config import get_settings
from call_audit.persistence.models import (
    Case,
    DisagreementVerification,
    DiscrepancyPattern,
    PromptEvaluation,
    User,
    now,
)
from call_audit.rubric import load_rubric

OUTCOMES = ("ai_error", "reviewer_error", "ambiguous", "missing_info")
SEGMENTS = ("promptFn", "promptFp", "reviewer", "undecided", "agree")
TO_VERIFY = ("fn", "fp", "undecided")
# Listas que no son una parte del mosaico (05-numeros-propuesta.md §3, §7): el lado de la falsa alarma o del rechazo no
# detectado (amarillo o rojo + el azul de ese lado), o todos los desacuerdos de un motivo.
SIDES = ("fp", "fn")
# Partes de "agree" según si también coinciden los motivos de rechazo (15-acuerdo-en-motivos-brief.md §8).
AGREE_PARTS = {"agreePass": "bothPass", "agreeSame": "same", "agreePartial": "partial", "agreeNone": "none"}
# "all": todas las llamadas, para la lista de cada verificador (13-rol-verificador).
LISTS = (*SEGMENTS, *SIDES, *AGREE_PARTS, "disagree", "all")


def matches(row: dict, segment: str, criterion: int | None = None) -> bool:
    """¿La llamada entra en la lista? Con `criterion`, solo las que tienen un desacuerdo en ese motivo (del lado
    `fp`/`fn` si se pide); sin él, la parte del mosaico o el lado de la llamada."""
    if segment in AGREE_PARTS:
        inside = row["segment"] == "agree" and row.get("reasonMatch") == AGREE_PARTS[segment]
        return inside and (criterion is None or matches(row, "disagree", criterion))
    if criterion is not None:
        # En la lista «all» (16-lista-verificador-por-motivo, L2 A) también entran las dudosas: hay que verificarlas.
        kinds = (segment,) if segment in SIDES else TO_VERIFY if segment == "all" else SIDES
        return any(i["criterionId"] == criterion and i["kind"] in kinds for i in row["items"])
    if segment in SIDES:
        side = "promptFp" if segment == "fp" else "promptFn"
        reviewer_side = PASS if segment == "fp" else FAIL
        return row["segment"] == side or (row["segment"] == "reviewer" and row["result"]["external"] == reviewer_side)
    if segment == "disagree":
        return any(i["kind"] in SIDES for i in row["items"])
    if segment == "all":
        return True
    return row["segment"] == segment


FAIL, PASS = agreement.FAIL, agreement.PASS


def wilson(k: int, n: int, z: float = 1.96) -> list[float] | None:
    """Intervalo de Wilson al 95 % de k/n, en proporción. None sin datos."""
    if n == 0:
        return None
    p = k / n
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [max(0.0, mid - half), min(1.0, mid + half)]


def order_key(evaluation_id: str, segment: str, case_id: str) -> str:
    """Orden aleatorio fijo por prueba y parte (G4): igual para todos y estable entre visitas."""
    return hashlib.sha256(f"{evaluation_id}:{segment}:{case_id}".encode()).hexdigest()


def reviewer_value(result: dict, criterion_id: int) -> str:
    return FAIL if criterion_id in {int(x) for x in result.get("externalFails") or []} else PASS


def correct_for(outcome: str, reviewer: str) -> str | None:
    if outcome == "ai_error":
        return reviewer
    if outcome == "reviewer_error":
        return PASS if reviewer == FAIL else FAIL
    return None


# --- Lectura -------------------------------------------------------------------------------------------------------


def evaluation_rows(session: Session, evaluation: PromptEvaluation) -> tuple[list[dict], list[DiscrepancyPattern]]:
    """Filas por llamada de la prueba (las mismas que el mosaico) y los patrones de su análisis de causa."""
    results = evaluation.results or []
    ids = [r["caseId"] for r in results]
    call_ids = dict(session.execute(select(Case.id, Case.call_id).where(Case.id.in_(ids))).all()) if ids else {}
    run = agreement.attribution_of(session, evaluation)
    patterns = (
        list(session.scalars(select(DiscrepancyPattern).where(DiscrepancyPattern.analysis_id == run.id)))
        if run is not None and run.status == "done"
        else []
    )
    rows = agreement.call_rows(results, call_ids, agreement.blue_cases(patterns), golden_split.layer2_criteria())
    for row in rows:
        row["order"] = order_key(evaluation.id, row["segment"], row["caseId"])
    rows.sort(key=lambda r: r["order"])
    return rows, patterns


def records_for(session: Session, case_ids: list[str]) -> dict[tuple[str, int], DisagreementVerification]:
    if not case_ids:
        return {}
    found = session.scalars(select(DisagreementVerification).where(DisagreementVerification.case_id.in_(case_ids)))
    return {(v.case_id, v.criterion_id): v for v in found}


def effective(record: DisagreementVerification | None, reviewer: str) -> tuple[str | None, bool]:
    """Salida vigente del registro frente a la planilla de hoy, y si quedó vieja (la planilla cambió)."""
    if record is None:
        return None, False
    stale = record.reviewer_fail_at != (reviewer == FAIL)
    if stale:
        return None, True
    if record.correct is None:
        return record.outcome, False
    return ("ai_error" if record.correct == reviewer else "reviewer_error"), False


def call_status(outcomes: list[str | None]) -> str:
    """§4.3: none (sin desacuerdos), ai_wrong, pending, confirmed, inconclusive."""
    if not outcomes:
        return "none"
    if "ai_error" in outcomes:
        return "ai_wrong"
    if None in outcomes:
        return "pending"
    if all(o == "reviewer_error" for o in outcomes):
        return "confirmed"
    return "inconclusive"


def disagreements(row: dict, records: dict) -> list[dict]:
    out = []
    for item in row["items"]:
        if item["kind"] not in TO_VERIFY:
            continue
        cid = item["criterionId"]
        outcome, stale = effective(records.get((row["caseId"], cid)), reviewer_value(row["result"], cid))
        out.append({**item, "outcome": outcome, "stale": stale})
    return out


def summarize(segment: str, items: list[dict], records: dict) -> dict[str, Any]:
    counts = {"pending": 0, "confirmed": 0, "ai_wrong": 0, "inconclusive": 0, "none": 0}
    seen_first = 0
    for it in items:
        counts[it["verification"]] += 1
        seen_first += sum(
            1
            for d in it["disagreements"]
            if d["outcome"] is not None and records[(it["caseId"], d["criterionId"])].seen_first
        )
    reviewed = counts["confirmed"] + counts["ai_wrong"] + counts["inconclusive"]
    hits = counts["confirmed"] if segment in ("reviewer", "agree", *AGREE_PARTS) else counts["ai_wrong"]
    return {
        "calls": len(items) - counts["none"],
        "reviewed": reviewed,
        "confirmed": counts["confirmed"],
        "aiWrong": counts["ai_wrong"],
        "inconclusive": counts["inconclusive"],
        "pending": counts["pending"],
        "ci95": wilson(hits, reviewed),
        "seenFirst": seen_first,
    }


def segment_items(rows: list[dict], records: dict, segment: str, criterion: int | None = None) -> list[dict]:
    items = []
    for i, row in enumerate(r for r in rows if matches(r, segment, criterion)):
        found = disagreements(row, records)
        items.append(
            {
                "caseId": row["caseId"],
                "callId": row["callId"],
                "order": i + 1,
                "aiVerdict": row["result"]["verdict"],
                "reviewerVerdict": row["result"]["external"],
                "disagreements": [
                    {"criterionId": d["criterionId"], "kind": d["kind"], "blue": d["blue"], "outcome": d["outcome"]}
                    for d in found
                ],
                "verification": call_status([d["outcome"] for d in found]),
                "segment": row["segment"],
                "reasonMatch": row.get("reasonMatch"),
            }
        )
    return items


def summaries(session: Session, evaluation: PromptEvaluation) -> dict[str, Any]:
    """La suma de cada parte, para la línea bajo el mosaico (§6.1)."""
    rows, _ = evaluation_rows(session, evaluation)
    records = records_for(session, [r["caseId"] for r in rows])
    return {s: summarize(s, segment_items(rows, records, s), records) for s in SEGMENTS}


def changed_rows(session: Session, rows: list[dict], vs: str) -> tuple[list[dict], dict[str, str]]:
    """Llamadas que cambian de coincidir a no coincidir (o al revés) frente a la prueba en validación de `vs`
    (10-resumen-mas-informacion.md, B2). Devuelve las filas y, por llamada, «toAgree» o «fromAgree»."""
    other = validation_test(session, vs)
    if other is None:
        raise LookupError("not_tested")
    before = {r["callId"]: r["segment"] == "agree" for r in evaluation_rows(session, other)[0]}
    groups = {}
    for r in rows:
        if r["callId"] in before and before[r["callId"]] != (r["segment"] == "agree"):
            groups[r["caseId"]] = "toAgree" if r["segment"] == "agree" else "fromAgree"
    return [r for r in rows if r["caseId"] in groups], groups


def segment_calls(
    session: Session,
    evaluation: PromptEvaluation,
    segment: str,
    criterion: int | None = None,
    vs: str | None = None,
    sample: int | None = None,
) -> dict[str, Any]:
    rows, _ = evaluation_rows(session, evaluation)
    groups: dict[str, str] = {}
    if segment == "changed":
        if not vs:
            raise LookupError("vs_required")
        rows, groups = changed_rows(session, rows, vs)
        segment_for_items = "all"
    else:
        segment_for_items = segment
    selected = [r for r in rows if segment_for_items == "all" or matches(r, segment_for_items, criterion)]
    if sample:
        # Muestra fija: las primeras `sample` en el orden aleatorio de la lista (mismo orden para todos).
        selected = selected[:sample]
    records = records_for(session, [r["caseId"] for r in selected])
    if segment == "changed" or sample:
        items = segment_items(selected, records, "all", None)
    else:
        items = segment_items(rows, records, segment, criterion)
    for it in items:
        if it["caseId"] in groups:
            it["group"] = groups[it["caseId"]]
    counts = criterion_counts(segment_items(rows, records, "all")) if segment == "all" else None
    from call_audit.api.serializers import typification_out

    cases = {c.id: c for c in session.scalars(select(Case).where(Case.id.in_([i["caseId"] for i in items])))}
    for it in items:
        case = cases.get(it["caseId"])
        it["callDate"] = case.call_date if case else ""
        it["typification"] = typification_out(case) if case else None
    return {
        "version": evaluation.version,
        "evaluationId": evaluation.id,
        "n": len(rows),
        "segment": segment,
        "criterion": criterion,
        "vs": vs,
        "sample": sample,
        "items": items,
        "summary": summarize(segment, items, records),
        **({"criterionCounts": counts} if counts is not None else {}),
    }


def criterion_counts(items: list[dict]) -> list[dict[str, int]]:
    """Por motivo, cuántas llamadas del alcance tienen algo que verificar en él y cuántas de esas siguen pendientes
    (16-lista-verificador-por-motivo, L2 A). Más llamadas primero; en empate, por número de motivo."""
    calls: Counter[int] = Counter()
    pending: Counter[int] = Counter()
    for it in items:
        for cid in {d["criterionId"] for d in it["disagreements"] if d["kind"] in TO_VERIFY}:
            calls[cid] += 1
            pending[cid] += it["verification"] == "pending"
    return [
        {"criterionId": cid, "calls": n, "pending": pending[cid]}
        for cid, n in sorted(calls.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def analysis_for(patterns: list[DiscrepancyPattern], criterion_id: int, call_id: str) -> dict | None:
    for p in patterns:
        if p.criterion_id != criterion_id or not any(str(c.get("callId")) == call_id for c in p.cases or []):
            continue
        data = p.data or {}
        return {
            "patternId": p.id,
            "title": data.get("title") or "",
            "cause": "observation" if p.is_observation else (data.get("cause") or "unknown"),
            "explanation": data.get("explanation") or "",
        }
    return None


def record_out(record: DisagreementVerification, stale: bool) -> dict[str, Any]:
    return {
        "outcome": record.outcome,
        "correct": record.correct,
        "note": record.note,
        "by": record.decided_by.name if record.decided_by else "",
        "at": record.decided_at.isoformat() if record.decided_at else None,
        "seenFirst": record.seen_first,
        "versionAt": record.version_at,
        "stale": stale,
    }


def case_comparison(
    session: Session, evaluation: PromptEvaluation, segment: str, case_id: str, criterion: int | None = None
) -> dict[str, Any]:
    rows, patterns = evaluation_rows(session, evaluation)
    row = next((r for r in rows if r["caseId"] == case_id), None)
    case = session.get(Case, case_id)
    if row is None or case is None:
        raise LookupError("not_in_test")
    listed = segment in LISTS or criterion is not None
    same = [r for r in rows if matches(r, segment, criterion)] if listed else [row]
    records = records_for(session, [r["caseId"] for r in same] + [case_id])
    statuses = [call_status([d["outcome"] for d in disagreements(r, records)]) for r in same]
    ids = [r["caseId"] for r in same]
    index = ids.index(case_id) if case_id in ids else -1
    pending = [cid for cid, st in zip(ids, statuses, strict=True) if st == "pending"]
    after = [cid for cid in ids[index + 1 :] if cid in pending] if index >= 0 else []
    before = [cid for cid in ids[:index] if cid in pending] if index >= 0 else []
    following = (after or before or [None])[0]
    if following == case_id:
        following = None

    result = row["result"]
    findings = {f["criterionId"]: f for f in result.get("findings") or []}
    rubric = load_rubric(get_settings().rubric_path)
    criteria = []
    for item in row["items"]:
        cid = item["criterionId"]
        finding = findings.get(cid) or {}
        evidence = [e for e in [finding.get("evidence"), *(finding.get("moreEvidence") or [])] if e]
        ai = (
            "uncertain"
            if item["kind"] == "undecided"
            else (FAIL if cid in set(result.get("failCriteria") or []) else PASS)
        )
        record = records.get((case_id, cid))
        reviewer = reviewer_value(result, cid)
        _, stale = effective(record, reviewer)
        crit = rubric.criteria.get(cid)
        criteria.append(
            {
                "criterionId": cid,
                "description": crit.description if crit else "",
                "block": crit.block if crit else "",
                "kind": item["kind"],
                "blue": item["blue"],
                "ai": {
                    "verdict": ai,
                    "comment": finding.get("comment") or None,
                    "evidence": evidence,
                    # Motivo 18: motivos de renuncia que sugiere la IA (prompt v2.8+), como en la vista del auditor.
                    "suggestedReasons": finding.get("suggestedReasons") or [],
                },
                "reviewerFail": reviewer == FAIL,
                "analysis": analysis_for(patterns, cid, row["callId"]) if item["kind"] in TO_VERIFY else None,
                "verification": record_out(record, stale) if record is not None else None,
            }
        )
    meta = case.call_metadata or {}
    return {
        "caseId": case.id,
        "callId": case.call_id,
        "callDate": case.call_date,
        "durationMs": case.duration_ms,
        "version": evaluation.version,
        "model": evaluation.model,
        "segment": row["segment"],
        "listSegment": segment if segment in LISTS else row["segment"],
        "listCriterion": criterion,
        "aiVerdict": result["verdict"],
        "reviewer": {
            "verdict": result["external"],
            "comment": case.external_comment,
            "evaluator": meta.get("external_evaluator"),
        },
        "findingsAvailable": "findings" in result,
        "verification": call_status([d["outcome"] for d in disagreements(row, records)]),
        "criteria": criteria,
        "position": {
            "index": index + 1 if index >= 0 else None,
            "total": len(same),
            "pending": len(pending),
            "prevCaseId": ids[index - 1] if index > 0 else None,
            "nextCaseId": ids[index + 1] if 0 <= index < len(ids) - 1 else None,
            "nextPendingCaseId": following,
        },
    }


# --- Registro ------------------------------------------------------------------------------------------------------


def record(
    session: Session,
    evaluation: PromptEvaluation,
    actor: User,
    case_id: str,
    criterion_id: int,
    outcome: str,
    note: str | None,
    seen_first: bool,
) -> DisagreementVerification:
    if outcome not in OUTCOMES:
        raise ValueError("bad_outcome")
    result = next((r for r in evaluation.results or [] if r["caseId"] == case_id), None)
    if result is None or result.get("externalFails") is None or result.get("error"):
        raise LookupError("not_in_test")
    if criterion_id not in golden_split.layer2_criteria():
        raise LookupError("bad_criterion")
    reviewer = reviewer_value(result, criterion_id)
    ai = (
        "uncertain"
        if criterion_id in set(result.get("uncertainCriteria") or [])
        else (FAIL if criterion_id in set(result.get("failCriteria") or []) else PASS)
    )
    row = session.scalar(
        select(DisagreementVerification).where(
            DisagreementVerification.case_id == case_id, DisagreementVerification.criterion_id == criterion_id
        )
    )
    before = row.outcome if row is not None else None
    if row is None:
        row = DisagreementVerification(case_id=case_id, criterion_id=criterion_id)
        session.add(row)
    row.outcome = outcome
    row.correct = correct_for(outcome, reviewer)
    row.reviewer_fail_at = reviewer == FAIL
    row.ai_verdict_at = ai
    row.version_at = evaluation.version
    row.seen_first = seen_first
    row.note = (note or "").strip() or None
    row.decided_by_id = actor.id
    row.decided_at = now()
    call_id = session.scalar(select(Case.call_id).where(Case.id == case_id)) or case_id
    accounts.log(
        session,
        actor,
        "disagreement_verified",
        f"Llamada {call_id} · motivo {criterion_id}",
        f"{before or 'sin registro'} → {outcome} (v{evaluation.version})",
    )
    session.flush()
    return row


def remove(session: Session, actor: User, case_id: str, criterion_id: int) -> None:
    row = session.scalar(
        select(DisagreementVerification).where(
            DisagreementVerification.case_id == case_id, DisagreementVerification.criterion_id == criterion_id
        )
    )
    if row is None:
        return
    call_id = session.scalar(select(Case.call_id).where(Case.id == case_id)) or case_id
    accounts.log(
        session,
        actor,
        "disagreement_unverified",
        f"Llamada {call_id} · motivo {criterion_id}",
        f"{row.outcome} → borrado",
    )
    session.delete(row)
    session.flush()


# --- Cabecera común en Discrepancias (05-numeros-propuesta.md §4) --------------------------------------------------


def with_summaries(session: Session, evaluation: PromptEvaluation) -> dict[str, Any] | None:
    """El bloque `agreement` de la prueba con la suma de lo verificado a mano en cada parte (§6.1 de 04)."""
    block = agreement.for_evaluation(session, evaluation)
    if block is not None:
        block["verification"] = summaries(session, evaluation)
    return block


def latest_quality(session: Session) -> dict[str, Any] | None:
    """La última prueba de versión terminada sobre validación, para la cabecera de Discrepancias › Resumen: las mismas
    cifras que su pestaña Prueba. None si no hay ninguna."""
    from call_audit import prompt_evaluation

    split = prompt_evaluation.eval_split(session)
    tests = session.scalars(
        select(PromptEvaluation)
        .where(PromptEvaluation.status == "done")
        .order_by(PromptEvaluation.finished_at.desc().nulls_last(), PromptEvaluation.created_at.desc())
    )
    for ev in tests:
        # Sin sets asignados (golden_split.default_split devuelve None) vale cualquier prueba.
        if not prompt_evaluation.is_test(ev) or (split is not None and ev.split != split):
            continue
        out = quality_out(session, ev)
        if out is not None:
            return out
    return None


def same_call_rules(session: Session, version: str) -> int:
    """Reglas incluidas en `version` que salen de un análisis de causa, es decir, de las mismas llamadas de validación
    con que se mide (aviso N8 A, 06-ajustes-feedback.md §4.2)."""
    from call_audit.persistence.models import DiscrepancyAnalysis, DiscrepancyPattern, ProposalDecision

    return len(
        session.scalars(
            select(ProposalDecision.pattern_id)
            .join(DiscrepancyPattern, DiscrepancyPattern.id == ProposalDecision.pattern_id)
            .join(DiscrepancyAnalysis, DiscrepancyAnalysis.id == DiscrepancyPattern.analysis_id)
            .where(ProposalDecision.included_in_version == version, DiscrepancyAnalysis.purpose == "attribution")
        ).all()
    )


def quality_out(session: Session, ev: PromptEvaluation) -> dict[str, Any] | None:
    from call_audit import prompt_evaluation

    block = with_summaries(session, ev)
    if block is None:
        return None
    block["sameCallRules"] = same_call_rules(session, ev.version)
    latest = prompt_evaluation.latest(session, ev.version)
    return {
        "version": ev.version,
        "evaluationId": ev.id,
        "model": ev.model,
        "finishedAt": ev.finished_at.isoformat() if ev.finished_at else None,
        "listVersion": ev.version if latest is not None and latest.id == ev.id else None,
        "isCurrent": False,
        "agreement": block,
    }


def validation_test(session: Session, version: str) -> PromptEvaluation | None:
    """La última prueba terminada de `version` sobre validación."""
    from call_audit import prompt_evaluation

    split = prompt_evaluation.eval_split(session)
    for ev in session.scalars(
        select(PromptEvaluation)
        .where(PromptEvaluation.version == version, PromptEvaluation.status == "done")
        .order_by(PromptEvaluation.created_at.desc())
    ):
        if prompt_evaluation.is_test(ev) and (split is None or ev.split == split):
            return ev
    return None


def quality_for_analysis(session: Session, run: Any) -> dict[str, Any] | None:
    """Qué prueba muestra el Resumen de Discrepancias según el análisis elegido (06-ajustes-feedback.md §4.1):
    - análisis de causa: su prueba de validación;
    - del loop (prueba en entrenamiento): la prueba de validación de esa versión, o `missing` si no hay;
    - antiguo, sobre la vigente: la vigente medida en validación, sin azul;
    - sin análisis: la última prueba sobre validación."""
    from call_audit import prompt_evaluation
    from call_audit.persistence.models import PromptVersion

    if run is None:
        return latest_quality(session)
    source = session.get(PromptEvaluation, run.source_evaluation_id) if run.source_evaluation_id else None
    if source is not None:
        split = prompt_evaluation.eval_split(session)
        ev = source if (split is None or source.split == split) else validation_test(session, source.version)
        if ev is None:
            return {"version": source.version, "missing": True}
        return quality_out(session, ev)
    current = prompt_evaluation.current_metrics(session)
    active = session.scalar(select(PromptVersion).where(PromptVersion.status == "active"))
    if not current or not current.get("agreement") or active is None:
        return None
    return {
        "version": active.version,
        "model": active.model,
        "finishedAt": None,
        "listVersion": None,
        "isCurrent": True,
        "agreement": current["agreement"],
    }
