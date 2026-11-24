"""Asignación de llamadas a verificadores (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md).

Sin IA. Cada llamada de la corrida completa de una versión se asigna a un verificador (rol qubico_verifier). Una
llamada asignada está **revisada** cuando todos sus motivos en desacuerdo tienen registro (DisagreementVerification) o,
si no tiene desacuerdos, cuando el verificador la marcó «Sin observaciones» (`reviewed_at`).

El reparto es determinístico y estratificado por segmento del mosaico × set del golden set: dentro de cada estrato, en
el orden aleatorio fijo de la lista, se van turnando los verificadores, empezando por el que lleva menos. Lo ya
asignado no se mueve.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import accounts, verification
from call_audit.persistence.models import Case, PromptEvaluation, User, VerificationAssignment, now

VERIFIER = "qubico_verifier"
SEGMENTS = verification.SEGMENTS
CHILE = ZoneInfo("America/Santiago")
# Bandejas del verificador (18-verificador-bandeja-y-revisadas, W1-W4) y tipos de discrepancia del filtro (W6 A).
TRAYS = ("pending", "reviewed")
DISCREPANCIES = ("fn", "fp", "undecided", "criteria", "none")


def verifiers(session: Session) -> list[User]:
    return list(session.scalars(select(User).where(User.role == VERIFIER, User.status == "active").order_by(User.name)))


def assignment_map(session: Session, case_ids: list[str] | None = None) -> dict[str, VerificationAssignment]:
    query = select(VerificationAssignment)
    if case_ids is not None:
        if not case_ids:
            return {}
        query = query.where(VerificationAssignment.case_id.in_(case_ids))
    return {a.case_id: a for a in session.scalars(query)}


def scope_ids(session: Session, evaluation: PromptEvaluation, user: User, assignee: str | None) -> set[str] | None:
    """Llamadas que entran con el filtro «Asignadas a». None = todas.

    `assignee`: "me" (el verificador), "all", "unassigned" o el id de un verificador. Sin valor, el verificador parte
    en «Mí» (V3 A) y el admin en «Todos»."""
    if assignee is None:
        assignee = "me" if user.role == VERIFIER else "all"
    if assignee == "all":
        return None
    ids = [r["caseId"] for r in evaluation.results or []]
    found = assignment_map(session, ids)
    if assignee == "unassigned":
        return {cid for cid in ids if cid not in found}
    owner = user.id if assignee == "me" else assignee
    return {cid for cid, a in found.items() if a.user_id == owner}


def scoped(evaluation: PromptEvaluation, ids: set[str] | None) -> Any:
    """La misma prueba con solo las llamadas de `ids`, para que el mosaico, las cifras y las listas sigan el filtro.
    Conserva el id (orden aleatorio fijo y análisis de causa iguales)."""
    if ids is None:
        return evaluation
    return SimpleNamespace(
        id=evaluation.id,
        version=evaluation.version,
        model=evaluation.model,
        status=evaluation.status,
        purpose=evaluation.purpose,
        results=[r for r in evaluation.results or [] if r["caseId"] in ids],
    )


def is_reviewed(item: dict, assignment: VerificationAssignment | None) -> bool:
    """¿Calibrada? `item` es una fila de verification.segment_items. Con criterios por calibrar, cuando todos tienen
    registro vigente (pedido 2026-11-24: un «Qubyt se equivocó» ya no la cierra sola); sin ellos, cuando se marcó «Sin
    observaciones» o se calibró al revés algún criterio en acuerdo (20, Y5 A)."""
    outcomes = [d["outcome"] for d in item["disagreements"]]
    if outcomes:
        return None not in outcomes
    return item.get("bothWrong", 0) > 0 or (assignment is not None and assignment.reviewed_at is not None)


def discrepancy_of(item: dict) -> str:
    """Tipo de discrepancia de la llamada para el filtro W6 A. «Posible error del revisor» cae en el lado de su
    veredicto (la misma regla que las listas `fn`/`fp`), para no sesgar al verificador."""
    seg = item["segment"]
    if seg == "promptFn" or (seg == "reviewer" and item["reviewerVerdict"] == verification.FAIL):
        return "fn"
    if seg in ("promptFp", "reviewer"):
        return "fp"
    if seg == "undecided":
        return "undecided"
    return "criteria" if item.get("reasonMatch") in ("partial", "none") else "none"


def last_reviewed(records: dict, found: dict[str, VerificationAssignment]) -> dict[str, datetime]:
    """Por llamada, el último registro: el más reciente de sus criterios o de «Sin observaciones»."""
    last: dict[str, datetime] = {}
    for (cid, _), rec in records.items():
        if rec.decided_at and (cid not in last or rec.decided_at > last[cid]):
            last[cid] = rec.decided_at
    for cid, a in found.items():
        if a.reviewed_at and (cid not in last or a.reviewed_at > last[cid]):
            last[cid] = a.reviewed_at
    return last


def iso(value: datetime | None) -> str | None:
    return accounts.aware(value).isoformat() if value else None


def tray(
    session: Session,
    evaluation: PromptEvaluation,
    ids: set[str] | None,
    tray_name: str | None,
    discrepancy: str | None,
    criterion: int | None = None,
) -> dict[str, Any]:
    """Llamadas de la bandeja (pendientes o revisadas) y del tipo de discrepancia, dentro del alcance `ids`.

    Devuelve los ids en el orden de la bandeja (revisadas: la más reciente primero), los conteos por tipo de
    discrepancia (sobre la bandeja y el criterio, sin el filtro de discrepancia) y la fecha del último registro."""
    rows, _ = verification.evaluation_rows(session, scoped(evaluation, ids))
    records = verification.records_for(session, [r["caseId"] for r in rows], verification.own_version(evaluation))
    items = verification.segment_items(rows, records, "all")
    found = assignment_map(session, [it["caseId"] for it in items])
    last = last_reviewed(records, found)
    if tray_name in TRAYS:
        items = [it for it in items if is_reviewed(it, found.get(it["caseId"])) == (tray_name == "reviewed")]
    with_criterion = (
        {r["caseId"] for r in rows if verification.matches(r, "all", criterion)} if criterion is not None else None
    )
    counts = Counter(discrepancy_of(it) for it in items if with_criterion is None or it["caseId"] in with_criterion)
    if discrepancy in DISCREPANCIES:
        items = [it for it in items if discrepancy_of(it) == discrepancy]
    order = [it["caseId"] for it in items]
    if tray_name == "reviewed":
        order.sort(key=lambda cid: last[cid].timestamp() if cid in last else 0, reverse=True)
    return {
        "ids": order,
        "discrepancyCounts": {d: counts[d] for d in DISCREPANCIES},
        "lastReviewedAt": {cid: iso(at) for cid, at in last.items()},
    }


def all_items(session: Session, evaluation: PromptEvaluation) -> list[dict]:
    rows, _ = verification.evaluation_rows(session, evaluation)
    records = verification.records_for(session, [r["caseId"] for r in rows], verification.own_version(evaluation))
    items = verification.segment_items(rows, records, "all")
    splits = {r["caseId"]: r.get("split") for r in evaluation.results or []}
    for it in items:
        it["split"] = splits.get(it["caseId"])
    return items


# --- Reparto -------------------------------------------------------------------------------------------------------


def plan(
    session: Session, evaluation: PromptEvaluation, user_ids: list[str], only: set[str] | None = None
) -> dict[str, Any]:
    """Qué le tocaría a cada verificador: solo lo sin asignar y no revisado, estratificado por segmento × set.

    `only`: ids de caso a los que se limita el reparto (p. ej. las divergentes de una planilla). None = todas."""
    people = {u.id: u for u in verifiers(session) if u.id in set(user_ids)}
    if not people:
        raise ValueError("no_verifiers")
    order = [uid for uid in user_ids if uid in people]
    items = all_items(session, evaluation)
    found = assignment_map(session, [it["caseId"] for it in items])
    load = Counter(a.user_id for a in found.values() if a.user_id in people)
    strata: dict[tuple[str, str | None], list[dict]] = defaultdict(list)
    for it in items:
        if (only is not None and it["caseId"] not in only) or it["caseId"] in found or is_reviewed(it, None):
            continue
        strata[(it["segment"], it["split"])].append(it)
    picks: dict[str, str] = {}
    for key in sorted(strata, key=lambda k: (SEGMENTS.index(k[0]) if k[0] in SEGMENTS else 99, k[1] or "")):
        for it in strata[key]:
            uid = min(order, key=lambda u: (load[u], order.index(u)))
            picks[it["caseId"]] = uid
            load[uid] += 1
    by_user = {uid: Counter() for uid in order}
    segment_of = {it["caseId"]: it["segment"] for it in items}
    for cid, uid in picks.items():
        by_user[uid][segment_of[cid]] += 1
    return {
        "calls": len(picks),
        "people": [
            {"id": uid, "name": people[uid].name, "calls": sum(c.values()), "bySegment": dict(c)}
            for uid, c in by_user.items()
        ],
        "_picks": picks,
    }


def distribute(
    session: Session, evaluation: PromptEvaluation, user_ids: list[str], actor: User, only: set[str] | None = None
) -> dict[str, Any]:
    result = plan(session, evaluation, user_ids, only)
    for cid, uid in result["_picks"].items():
        session.add(VerificationAssignment(case_id=cid, user_id=uid, assigned_by_id=actor.id))
    accounts.log(
        session,
        actor,
        "verification_distributed",
        f"v{evaluation.version}",
        " · ".join(f"{p['name']} {p['calls']}" for p in result["people"]),
    )
    session.flush()
    return result


def move_pending(
    session: Session, evaluation: PromptEvaluation, from_user_id: str, to_user_ids: list[str], actor: User
) -> int:
    """Pasa las pendientes de una persona a otras, turnándolas. Lo revisado no cambia de dueño."""
    targets = [u.id for u in verifiers(session) if u.id in set(to_user_ids) and u.id != from_user_id]
    if not targets:
        raise ValueError("no_verifiers")
    items = {it["caseId"]: it for it in all_items(session, evaluation)}
    mine = [
        a
        for a in session.scalars(select(VerificationAssignment).where(VerificationAssignment.user_id == from_user_id))
        if a.case_id in items and not is_reviewed(items[a.case_id], a)
    ]
    mine.sort(key=lambda a: items[a.case_id]["order"])
    for i, a in enumerate(mine):
        a.user_id = targets[i % len(targets)]
        a.assigned_by_id, a.assigned_at = actor.id, now()
    giver = session.get(User, from_user_id)
    accounts.log(session, actor, "verification_moved", giver.name if giver else from_user_id, f"{len(mine)} llamadas")
    session.flush()
    return len(mine)


UNASSIGNED = "unassigned"


class TooMany(ValueError):
    """Se pidieron más llamadas de las disponibles (24, AD4 A)."""

    def __init__(self, available: int) -> None:
        super().__init__("too_many")
        self.available = available


def interleaved(items: list[dict]) -> list[dict]:
    """Orden en que se toman las llamadas al asignar una cantidad (24, AD3 A): cualquier tramo inicial queda en
    proporción entre los grupos segmento × set. Dentro de cada grupo se respeta el orden aleatorio fijo."""
    strata: dict[tuple[str, str | None], list[dict]] = defaultdict(list)
    for it in sorted(items, key=lambda it: it["order"]):
        strata[(it["segment"], it.get("split"))].append(it)
    keyed = []
    for key, group in strata.items():
        rank = SEGMENTS.index(key[0]) if key[0] in SEGMENTS else 99
        for i, it in enumerate(group):
            keyed.append(((i + 0.5) / len(group), rank, key[1] or "", i, it))
    keyed.sort(key=lambda k: k[:4])
    return [k[4] for k in keyed]


def assign(
    session: Session,
    evaluation: PromptEvaluation,
    source: str,
    targets: list[tuple[str | None, int | None]],
    actor: User,
    apply: bool,
) -> dict[str, Any]:
    """«Asignar llamadas» (24-asignar-cantidad-a-calibrador, AD1-AD4 A). `source`: «unassigned» (lo sin asignar y sin
    calibrar) o el id de un calibrador (sus pendientes, también las empezadas; lo calibrado no cambia de dueño).
    `targets`: (calibrador o None = «Sin asignar», cantidad o None = parejo lo que quede). La cantidad se suma a lo que
    ya tiene. Si se piden más de las disponibles, `TooMany`."""
    people = {u.id: u for u in verifiers(session)}
    items = all_items(session, evaluation)
    found = assignment_map(session, [it["caseId"] for it in items])
    if source == UNASSIGNED:
        pool = [it for it in items if it["caseId"] not in found and not is_reviewed(it, None)]
    elif (giver := session.get(User, source)) is not None and giver.role == VERIFIER:
        # También desde una cuenta desactivada: sus pendientes se pueden pasar a otros.
        pool = [
            it
            for it in items
            if (a := found.get(it["caseId"])) is not None and a.user_id == source and not is_reviewed(it, a)
        ]
    else:
        raise ValueError("bad_source")
    seen: set[str | None] = set()
    clean: list[tuple[str | None, int | None]] = []
    for uid, count in targets:
        if uid == source:
            continue  # un destino igual al origen se ignora
        if uid in seen or (uid is not None and uid not in people) or (uid is None and source == UNASSIGNED):
            raise ValueError("bad_target")
        if count is not None and count < 1:
            raise ValueError("bad_count")
        seen.add(uid)
        clean.append((uid, count))
    if not clean:
        raise ValueError("no_verifiers")
    fixed = sum(c for _, c in clean if c is not None)
    if fixed > len(pool):
        raise TooMany(len(pool))
    free = [uid for uid, c in clean if c is None]
    rest = len(pool) - fixed
    quota = {uid: c for uid, c in clean if c is not None}
    for i, uid in enumerate(free):
        quota[uid] = rest // len(free) + (1 if i < rest % len(free) else 0)
    # Cada llamada, en el orden intercalado, va a quien lleva menos de su cupo (en proporción): así el lote de cada
    # uno también queda repartido entre los grupos.
    given: Counter[str | None] = Counter()
    picks: dict[str, str | None] = {}
    order = [uid for uid, _ in clean]
    for it in interleaved(pool):
        open_ = [uid for uid in order if given[uid] < quota[uid]]
        if not open_:
            break
        uid = min(open_, key=lambda u: (given[u] / quota[u], order.index(u)))
        picks[it["caseId"]] = uid
        given[uid] += 1
    segment_of = {it["caseId"]: it["segment"] for it in items}
    by: dict[str | None, Counter[str]] = {uid: Counter() for uid in order}
    for cid, uid in picks.items():
        by[uid][segment_of[cid]] += 1
    result = {
        "available": len(pool),
        "calls": len(picks),
        "people": [
            {
                "id": uid,
                "name": people[uid].name if uid is not None else "Sin asignar",
                "calls": sum(c.values()),
                "bySegment": dict(c),
            }
            for uid, c in by.items()
        ],
    }
    if not apply:
        return result
    for cid, uid in picks.items():
        row = found.get(cid)
        if uid is None:
            if row is not None:
                session.delete(row)
        elif row is None:
            session.add(VerificationAssignment(case_id=cid, user_id=uid, assigned_by_id=actor.id))
        else:
            row.user_id, row.assigned_by_id, row.assigned_at = uid, actor.id, now()
    origin = "Sin asignar" if source == UNASSIGNED else giver.name
    accounts.log(
        session,
        actor,
        "verification_assigned_bulk",
        f"v{evaluation.version} · desde {origin}",
        " · ".join(f"{p['name']} {p['calls']}" for p in result["people"]),
    )
    session.flush()
    return result


def set_assignee(session: Session, case_id: str, user_id: str | None, actor: User) -> None:
    case = session.get(Case, case_id)
    if case is None:
        raise LookupError("not_found")
    row = session.scalar(select(VerificationAssignment).where(VerificationAssignment.case_id == case_id))
    if user_id is None:
        if row is not None:
            session.delete(row)
    else:
        target = session.get(User, user_id)
        if target is None or target.role != VERIFIER:
            raise LookupError("not_verifier")
        if row is None:
            session.add(VerificationAssignment(case_id=case_id, user_id=user_id, assigned_by_id=actor.id))
        else:
            row.user_id, row.assigned_by_id, row.assigned_at = user_id, actor.id, now()
    accounts.log(session, actor, "verification_assigned", f"Llamada {case.call_id}", user_id or "sin asignar")
    session.flush()


# --- Permisos y «Sin observaciones» --------------------------------------------------------------------------------


def can_record(session: Session, user: User, case_id: str) -> bool:
    """El admin registra en cualquier llamada; el verificador, solo en las suyas (V4 A)."""
    if user.role == "qubico_admin":
        return True
    if user.role != VERIFIER:
        return False
    row = session.scalar(select(VerificationAssignment).where(VerificationAssignment.case_id == case_id))
    return row is not None and row.user_id == user.id


def can_change_record(user: User, decided_by_id: str | None) -> bool:
    """V9 A: el verificador corrige solo sus propios registros; el admin, cualquiera."""
    return user.role == "qubico_admin" or (user.role == VERIFIER and decided_by_id == user.id)


def mark_reviewed(session: Session, case_id: str, user: User, reviewed: bool) -> VerificationAssignment:
    row = session.scalar(select(VerificationAssignment).where(VerificationAssignment.case_id == case_id))
    if row is None:
        raise LookupError("not_assigned")
    if reviewed:
        row.reviewed_by_id, row.reviewed_at = user.id, now()
    else:
        if row.reviewed_by_id and not can_change_record(user, row.reviewed_by_id):
            raise PermissionError("not_owner")
        row.reviewed_by_id, row.reviewed_at = None, None
    call_id = session.scalar(select(Case.call_id).where(Case.id == case_id)) or case_id
    accounts.log(
        session, user, "call_reviewed" if reviewed else "call_unreviewed", f"Llamada {call_id}", "sin observaciones"
    )
    session.flush()
    return row


def assignment_out(row: VerificationAssignment | None, user: User) -> dict[str, Any]:
    return {
        "assigneeId": row.user_id if row else None,
        "assigneeName": row.user.name if row and row.user else None,
        "mine": row is not None and row.user_id == user.id,
        "reviewedAt": row.reviewed_at.isoformat() if row and row.reviewed_at else None,
        "reviewedBy": row.reviewed_by.name if row and row.reviewed_by else None,
    }


# --- Avance (V6 A) -------------------------------------------------------------------------------------------------


def progress(session: Session, evaluation: PromptEvaluation) -> dict[str, Any]:
    items = all_items(session, evaluation)
    found = assignment_map(session, [it["caseId"] for it in items])
    people = {u.id: u for u in verifiers(session)}
    for a in found.values():
        if a.user_id not in people and a.user is not None:
            people[a.user_id] = a.user
    last: dict[str, Any] = {}
    case_owner = {cid: a.user_id for cid, a in found.items()}
    for rec in verification.records_for(session, list(case_owner), verification.own_version(evaluation)).values():
        uid = case_owner.get(rec.case_id)
        if uid and rec.decided_by_id == uid and (last.get(uid) is None or rec.decided_at > last[uid]):
            last[uid] = rec.decided_at
    for a in found.values():
        if (
            a.reviewed_at
            and a.reviewed_by_id == a.user_id
            and (last.get(a.user_id) is None or a.reviewed_at > last[a.user_id])
        ):
            last[a.user_id] = a.reviewed_at

    def blank() -> dict[str, Any]:
        return {"assigned": 0, "reviewed": 0, "pending": 0, "bySegment": {}, "bySplit": {}}

    rows: dict[str | None, dict[str, Any]] = {uid: blank() for uid in people}
    rows[None] = blank()
    total = blank()
    for it in items:
        a = found.get(it["caseId"])
        uid = a.user_id if a else None
        done = is_reviewed(it, a)
        for block in (rows.setdefault(uid, blank()), total):
            block["assigned"] += 1
            block["reviewed" if done else "pending"] += 1
            for key, val in (("bySegment", it["segment"]), ("bySplit", it["split"] or "none")):
                cell = block[key].setdefault(val, {"assigned": 0, "reviewed": 0, "pending": 0})
                cell["assigned"] += 1
                cell["reviewed" if done else "pending"] += 1
    unassigned = rows.pop(None)
    return {
        "version": evaluation.version,
        "evaluationId": evaluation.id,
        "people": [
            {
                "id": uid,
                "name": people[uid].name,
                "active": people[uid].status == "active",
                "lastActivityAt": last[uid].isoformat() if uid in last else None,
                **block,
            }
            for uid, block in sorted(rows.items(), key=lambda kv: people[kv[0]].name)
        ],
        "unassigned": unassigned,
        "total": total,
    }


def my_summary(session: Session, evaluation: PromptEvaluation, user: User) -> dict[str, Any]:
    """Tarjeta «Te quedan {d} de {n} llamadas» y la próxima pendiente propia, en el orden aleatorio fijo."""
    items = all_items(session, evaluation)
    found = assignment_map(session, [it["caseId"] for it in items])
    mine = [it for it in items if (a := found.get(it["caseId"])) is not None and a.user_id == user.id]
    pending = [it for it in mine if not is_reviewed(it, found[it["caseId"]])]
    pending.sort(key=lambda it: it["order"])
    done = {it["caseId"] for it in mine} - {it["caseId"] for it in pending}
    last = last_reviewed(
        verification.records_for(session, list(done), verification.own_version(evaluation)), {c: found[c] for c in done}
    )
    today = datetime.now(CHILE).date()
    return {
        "assigned": len(mine),
        "pending": len(pending),
        "reviewed": len(done),
        "reviewedToday": sum(1 for at in last.values() if accounts.aware(at).astimezone(CHILE).date() == today),
        "nextCaseId": pending[0]["caseId"] if pending else None,
    }


def next_pending(
    session: Session, evaluation: PromptEvaluation, user: User, ordered_ids: list[str], current: str
) -> str | None:
    """La próxima pendiente propia en el orden de la lista actual, después de `current` (luego desde el inicio)."""
    items = {it["caseId"]: it for it in all_items(session, evaluation)}
    found = assignment_map(session, ordered_ids)
    mine = [
        cid
        for cid in ordered_ids
        if cid != current
        and (a := found.get(cid)) is not None
        and a.user_id == user.id
        and cid in items
        and not is_reviewed(items[cid], a)
    ]
    if current in ordered_ids:
        idx = ordered_ids.index(current)
        after = [cid for cid in mine if ordered_ids.index(cid) > idx]
        if after:
            return after[0]
    return mine[0] if mine else None
