"""Versión del prompt desde Seguimiento (Cambio 18, D-75 a D-79).

Las reglas del prompt aceptadas en el análisis de discrepancias se aplican sin IA al «Criterio:» de su motivo:
"append" agrega el texto en una línea nueva al final; "replace" cambia una frase que tiene que aparecer una sola vez
(la búsqueda no distingue espacios ni saltos de línea, sí tildes, mayúsculas y puntuación). Las propuestas anteriores
al prompt de análisis v1.3.0 no traen acción: se agregan al final como «Texto libre».

El prompt.yaml se edita como texto (solo el criterion y el history de cada motivo, y version/date/origins) para que
conserve comentarios, orden y bloques `|-` (H-139). El borrador entra por `prompt_registry.create_draft`, igual que
una subida manual.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import discrepancy_runs, prompt_registry
from call_audit.persistence.models import (
    DiscrepancyAnalysis,
    DiscrepancyPattern,
    PromptEvaluation,
    PromptVersion,
    ProposalDecision,
    User,
)

ORIGIN = "discrepancy_analysis"
ORIGIN_YAML = (
    f"  {ORIGIN}:\n"
    "    label: Análisis de discrepancias\n"
    "    description: Regla propuesta por el análisis de discrepancias y aceptada por un admin en Seguimiento. La nota"
    " dice el patrón y quién la aceptó."
)


class FollowUpError(ValueError):
    """`code` es lo que recibe el front: no_yaml, not_accepted, base_changed, review_pending, no_rules,
    mixed_base (errors = las versiones base que chocan)."""

    def __init__(self, code: str, errors: list[str] | None = None):
        super().__init__(code)
        self.code = code
        self.errors = errors or []


@dataclass
class Rule:
    proposal_id: str
    criterion_id: int
    action: str | None  # append | replace | None (texto libre)
    find: str | None
    text: str
    history_note: str


# --- Aplicar reglas a un criterio (sin efectos secundarios) -------------------------------------------------------


def matches(criterion: str, find: str) -> list[re.Match[str]]:
    words = find.split()
    if not words:
        return []
    return list(re.finditer(r"\s+".join(map(re.escape, words)), criterion))


def apply_rule(criterion: str, rule: Rule) -> tuple[str, str, str | None]:
    """(criterio nuevo, estado, motivo para revisar). Estados: applied | free_text | review."""
    text = rule.text.strip()
    if rule.action == "replace":
        found = matches(criterion, rule.find or "")
        if len(found) != 1:
            reason = (
                f"No se encontró «{rule.find}» en el criterio actual."
                if not found
                else f"«{rule.find}» aparece {len(found)} veces; edita el texto final."
            )
            return criterion, "review", reason
        m = found[0]
        return criterion[: m.start()] + text + criterion[m.end() :], "applied", None
    joined = f"{criterion}\n{text}" if criterion.strip() else text
    return joined, "applied" if rule.action == "append" else "free_text", None


def clean(text: str) -> str:
    """Sin espacios al final de cada línea ni líneas en blanco al principio o al final: así lo guarda un `|-`."""
    return "\n".join(line.rstrip() for line in text.strip("\n").split("\n")).strip("\n")


# --- Editar el prompt.yaml como texto ------------------------------------------------------------------------------


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def block_end(lines: list[str], key: int, key_indent: int) -> int:
    """Índice después de la última línea con contenido del valor de la clave en `key`."""
    end = key + 1
    for i in range(key + 1, len(lines)):
        if not lines[i].strip():
            continue
        if indent_of(lines[i]) <= key_indent:
            break
        end = i + 1
    return end


def item_bounds(lines: list[str], number: int) -> tuple[int, int, int]:
    """(inicio, fin, sangría de las claves) del motivo `number`."""
    for i, line in enumerate(lines[:-1]):
        m = re.match(r"^( *)- id: \S+\s*$", line)
        if m and re.match(rf"^{m.group(1)}  number: {number}\s*$", lines[i + 1]):
            item_indent = len(m.group(1))
            return i, block_end(lines, i, item_indent), item_indent + 2
    raise KeyError(number)


def set_criterion(text: str, number: int, criterion: str, history: list[str]) -> str:
    lines = text.split("\n")
    start, end, key_indent = item_bounds(lines, number)
    pad, content_pad = " " * key_indent, " " * (key_indent + 2)
    body = [f"{content_pad}{line}" if line else "" for line in clean(criterion).split("\n")]
    keys = {
        m.group(1): i
        for i in range(start + 1, end)
        if (m := re.match(rf"^{pad}(\w+):", lines[i])) and indent_of(lines[i]) == key_indent
    }
    if "criterion" in keys:
        k = keys["criterion"]
        lines[k : block_end(lines, k, key_indent)] = [f"{pad}criterion: |-", *body]
    else:
        at = block_end(lines, keys["official"], key_indent)
        lines[at:at] = [f"{pad}criterion: |-", *body]
    _, end, _ = item_bounds(lines, number)
    k = next(i for i in range(start + 1, end) if re.match(rf"^{pad}history:", lines[i]))
    at = block_end(lines, k, key_indent)
    lines[at:at] = [f"{content_pad}{entry}" for entry in history]
    return "\n".join(lines)


def history_entry(version: str, note: str) -> str:
    # Comillas dobles de YAML con los mismos escapes que JSON.
    escaped = note.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return f'- {{version: "{version}", origin: {ORIGIN}, note: "{escaped}"}}'


def with_header(text: str, version: str, day: str, spec: dict) -> str:
    text = re.sub(r"^version: .*$", f'version: "{version}"', text, count=1, flags=re.M)
    text = re.sub(r"^date: .*$", f'date: "{day}"', text, count=1, flags=re.M)
    if ORIGIN in (spec.get("origins") or {}):
        return text
    lines = text.split("\n")
    k = next(i for i, line in enumerate(lines) if re.match(r"^origins:\s*$", line))
    at = block_end(lines, k, 0)
    lines[at:at] = ORIGIN_YAML.split("\n")
    return "\n".join(lines)


# --- Comparación por motivo ----------------------------------------------------------------------------------------


def criteria_of(spec: dict) -> dict[int, dict]:
    return {int(item["number"]): item for section in spec["sections"] for item in section["items"] if "number" in item}


def build(
    spec_text: str, version: str, day: str, rules: list[Rule], overrides: dict[int, str]
) -> tuple[str, list[dict]]:
    """prompt.yaml nuevo y la comparación por motivo. Las reglas van en el orden recibido (el de aceptación)."""
    spec = yaml.safe_load(spec_text)
    items = criteria_of(spec)
    by_criterion: dict[int, list[Rule]] = {}
    for rule in rules:
        by_criterion.setdefault(rule.criterion_id, []).append(rule)
    text = with_header(spec_text, version, day, spec)
    out = []
    for cid in sorted(by_criterion):
        item = items.get(cid)
        before = clean(item.get("criterion") or "") if item else ""
        current, states = before, []
        for rule in by_criterion[cid]:
            if item is None:
                states.append((rule, "review", f"El motivo {cid} no está en la versión vigente."))
                continue
            current, state, reason = apply_rule(current, rule)
            states.append((rule, state, reason))
        generated = clean(current)
        override = overrides.get(cid)
        manual = item is not None and override is not None and clean(override) != generated
        after = clean(override) if manual and override is not None else generated
        if manual:
            states = [(r, "manual" if s == "review" else s, None if s == "review" else why) for r, s, why in states]
        if item is not None:
            entries = [history_entry(version, r.history_note) for r, s, _ in states if s != "review"]
            text = set_criterion(text, cid, after, entries)
            if clean(criteria_of(yaml.safe_load(text))[cid].get("criterion") or "") != after:
                raise AssertionError(f"el criterio del motivo {cid} no quedó como se esperaba")
        out.append(
            {
                "criterionId": cid,
                "title": (item["official"].strip().split("\n")[0] if item else f"Motivo {cid}"),
                "before": before,
                "generated": generated,
                "after": after,
                "manual": manual,
                "rules": [{"proposalId": r.proposal_id, "state": s, "reviewReason": why} for r, s, why in states],
            }
        )
    return text, out


def next_version(base: str, taken: set[str]) -> str:
    major, minor = base.split(".")[:2]
    n = int(minor) + 1
    while f"{major}.{n}" in taken:
        n += 1
    return f"{major}.{n}"


# --- Con la base -------------------------------------------------------------------------------------------------


def accepted_rules(session: Session, proposal_ids: list[str]) -> list[tuple[DiscrepancyPattern, ProposalDecision]]:
    """Las reglas del prompt aceptadas que pide el admin, en orden de aceptación (H-126)."""
    ids = list(dict.fromkeys(proposal_ids))
    if not ids:
        raise FollowUpError("no_rules")
    rows = list(
        session.execute(
            select(DiscrepancyPattern, ProposalDecision)
            .join(ProposalDecision, ProposalDecision.pattern_id == DiscrepancyPattern.id)
            .where(DiscrepancyPattern.id.in_(ids))
        )
    )
    ok = [
        (p, d)
        for p, d in rows
        if d.status == "accepted"
        and not p.is_observation  # D-94: una observación nunca llega al prompt, aunque guarde una propuesta de regla.
        and ((p.data or {}).get("proposal") or {}).get("type") == "prompt_rule"
    ]
    if len(ok) != len(ids):
        raise FollowUpError("not_accepted")
    return sorted(ok, key=lambda pd: pd[1].decided_at)


def to_rule(session: Session, p: DiscrepancyPattern, d: ProposalDecision) -> Rule:
    proposal = (p.data or {}).get("proposal") or {}
    analysis = session.get(DiscrepancyAnalysis, p.analysis_id)
    day = analysis.created_at.date().isoformat() if analysis else "?"
    note = f"Patrón #{p.rank} (análisis del {day}) · aceptada por {d.decided_by.name}"
    if d.note:
        note += f": {d.note}"
    action = proposal.get("action") if proposal.get("action") in ("append", "replace") else None
    return Rule(
        proposal_id=p.id,
        criterion_id=p.criterion_id,
        action=action,
        find=proposal.get("find") if action == "replace" else None,
        text=d.edited_text or proposal.get("text") or "",
        history_note=note,
    )


def base_version(session: Session, proposal_ids: list[str] | None = None) -> PromptVersion:
    """La versión sobre la que se aplican las reglas: la vigente, salvo que salgan de un análisis de una prueba (loop
    de mejora, docs/plan-loop-prompt.md); ahí, la versión probada, que es la que el análisis leyó."""
    sources = set()
    for pid in proposal_ids or []:
        pattern = session.get(DiscrepancyPattern, pid)
        run = session.get(DiscrepancyAnalysis, pattern.analysis_id) if pattern is not None else None
        source_id = run.source_evaluation_id if run is not None else None
        evaluation = session.get(PromptEvaluation, source_id) if source_id else None
        sources.add(evaluation.version if evaluation is not None else None)
    if len(sources) > 1:
        active = prompt_registry.ensure_bootstrap(session)
        versions = {v or (active.version if active is not None else "?") for v in sources}
        raise FollowUpError("mixed_base", sorted(versions, key=prompt_registry.version_key))
    tested = next(iter(sources), None)
    base = session.get(PromptVersion, tested) if tested else prompt_registry.ensure_bootstrap(session)
    if base is None or not base.spec_yaml:
        raise FollowUpError("no_yaml")
    return base


def preview(session: Session, proposal_ids: list[str], overrides: dict[int, str]) -> dict:
    """La comparación por motivo, sin guardar nada ni gastar (Cambio 18 §8.3)."""
    base = base_version(session, proposal_ids)
    pairs = accepted_rules(session, proposal_ids)
    rules = [to_rule(session, p, d) for p, d in pairs]
    taken = set(session.scalars(select(PromptVersion.version)))
    version = next_version(base.version, taken)
    _, criteria = build(base.spec_yaml or "", version, date.today().isoformat(), rules, overrides)
    info = {p.id: (p, d, r) for (p, d), r in zip(pairs, rules, strict=True)}
    for c in criteria:
        for rule in c["rules"]:
            p, d, r = info[rule["proposalId"]]
            rule |= {
                "patternRank": p.rank,
                "patternTitle": (p.data or {}).get("title") or "",
                "action": r.action,
                "find": r.find,
                "text": r.text,
                "historyNote": r.history_note,
                "acceptedBy": d.decided_by.name,
                "acceptedAt": d.decided_at.isoformat(),
                "note": d.note,
            }
    motives = ", ".join(str(c["criterionId"]) for c in criteria)
    label = "motivo" if len(criteria) == 1 else "motivos"
    rationale = [
        f"Motivo {r['criterionId']} · Patrón #{rule['patternRank']}: {rule['note'] or rule['patternTitle']}"
        for r in criteria
        for rule in r["rules"]
    ]
    return {
        "baseVersion": base.version,
        # La vigente, salvo cuando las reglas salen del loop de mejora (base = la versión probada).
        "baseIsActive": base.version == prompt_registry.ensure_bootstrap(session).version,
        "version": version,
        "model": base.model,
        "changelog": f"Reglas del análisis de discrepancias: {label} {motives}.",
        "rationale": "\n".join(rationale),
        "criteria": criteria,
    }


def create(
    session: Session,
    *,
    author: User,
    base: str,
    proposal_ids: list[str],
    overrides: dict[int, str],
    model: str,
    changelog: str,
    rationale: str | None,
) -> tuple[PromptVersion, int]:
    """Crea el borrador con las reglas aplicadas y las deja «Incluida en vX». Devuelve el borrador y cuántos motivos
    se editaron a mano."""
    current = base_version(session, proposal_ids)
    if current.version != base:
        raise FollowUpError("base_changed")
    try:
        pairs = accepted_rules(session, proposal_ids)
    except FollowUpError as exc:
        raise FollowUpError("rules_changed") from exc
    rules = [to_rule(session, p, d) for p, d in pairs]
    version = next_version(current.version, set(session.scalars(select(PromptVersion.version))))
    text, criteria = build(current.spec_yaml or "", version, date.today().isoformat(), rules, overrides)
    if any(rule["state"] == "review" for c in criteria for rule in c["rules"]):
        raise FollowUpError("review_pending")
    row = prompt_registry.create_draft(
        session,
        author=author,
        source="yaml",
        content=text,
        version=None,
        model=model,
        changelog=changelog,
        rationale=rationale,
        base=current,
    )
    discrepancy_runs.include_in_version(session, [p.id for p, _ in pairs], row.version)
    return row, sum(c["manual"] for c in criteria)
