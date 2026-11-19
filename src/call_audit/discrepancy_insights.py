"""Cifras del Resumen de Análisis de discrepancias (docs/ux/admin-prompt-metrics/10-resumen-mas-informacion.md, con el
insumo del analista en 08-resumen-insumo-analista.md). Sin IA.

Fuente única (R1 A): todo sale de las filas del mosaico (`agreement.call_rows` vía `verification.evaluation_rows`) de
una prueba en validación y de los patrones de su análisis de causa. El motivo 1 (capa 1) queda fuera, como en la prueba
del prompt; la duda de la IA va aparte. Así la barra, las dos columnas y Patrones dan el mismo número.
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import agreement, discrepancy_runs, prompt_evaluation, verification
from call_audit.persistence.models import DiscrepancyPattern, PromptEvaluation

SIDES = ("fn", "fp")
SAMPLE = 30  # Muestra fija del azul para verificar a mano (R4 A): margen de ±15 puntos (H-R2).


def mcnemar(b: int, c: int) -> float:
    """Exacta (binomial a dos colas) sobre los pares discordantes."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    return round(min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2**n), 3)


def items(rows: list[dict]) -> dict[tuple[int, str], dict]:
    """(motivo, llamada) -> {side, blue} de los desacuerdos por motivo (sin la duda de la IA)."""
    return {
        (i["criterionId"], r["callId"]): {"side": i["kind"], "blue": i["blue"]}
        for r in rows
        for i in r["items"]
        if i["kind"] in SIDES
    }


def previous_tests(session: Session, ev: PromptEvaluation, n: int = 2) -> list[PromptEvaluation]:
    """Las `n` pruebas en validación de versiones anteriores a `ev`, de la más reciente a la más antigua (una por
    versión). Sirven para la evolución (B2), los crónicos (B5) y la estabilidad del azul (B3)."""
    split = prompt_evaluation.eval_split(session)
    out: list[PromptEvaluation] = []
    seen = {ev.version}
    for other in session.scalars(
        select(PromptEvaluation)
        .where(PromptEvaluation.status == "done", PromptEvaluation.created_at < ev.created_at)
        .order_by(PromptEvaluation.created_at.desc())
    ):
        if other.version in seen or not prompt_evaluation.is_test(other):
            continue
        if split is not None and other.split != split:
            continue
        seen.add(other.version)
        out.append(other)
        if len(out) == n:
            break
    return out


def concentration(counts: Counter) -> dict[str, Any]:
    """Cuántos motivos hacen falta para llegar al 50 % y al 80 % de los desacuerdos, y los 5 primeros."""
    total = sum(counts.values())
    ranked = counts.most_common()
    acc, to50, to80 = 0, None, None
    for i, (_, n) in enumerate(ranked, start=1):
        acc += n
        if to50 is None and acc * 2 >= total:
            to50 = i
        if to80 is None and acc * 5 >= total * 4:
            to80 = i
    return {
        "total": total,
        "criteria": len(ranked),
        "to50": to50,
        "to80": to80,
        "top": [{"criterionId": cid, "n": n} for cid, n in ranked[:5]],
    }


def cause_done(session: Session, ev: PromptEvaluation) -> bool:
    run = agreement.attribution_of(session, ev)
    return run is not None and run.status == "done"


def bucket(p: DiscrepancyPattern | None) -> str:
    if p is None:
        return "unpatterned"
    return discrepancy_runs.action_of(p)


def insights(session: Session, ev: PromptEvaluation) -> dict[str, Any] | None:
    rows, patterns = verification.evaluation_rows(session, ev, with_code=False)
    if not rows:
        return None
    mine = items(rows)
    red_yellow = {k: v for k, v in mine.items() if not v["blue"]}
    blue = {k: v for k, v in mine.items() if v["blue"]}

    # --- Patrones del análisis de causa: a qué propuesta cae cada desacuerdo (cobertura, B5) ---
    ordered = sorted(patterns, key=lambda p: (p.is_observation, -(p.impact or 0)))
    best = discrepancy_runs.best_pattern(ordered)
    decisions = discrepancy_runs.decisions_for(session, [p.id for p in ordered])

    def pending(p: DiscrepancyPattern) -> bool:
        d = decisions.get(p.id)
        return d is None or d.status == "pending"

    cover = Counter(bucket(best.get(k)) for k in red_yellow)
    blue_cover = Counter(bucket(best.get(k)) for k in blue)
    by_action = Counter(bucket(best.get(k)) for k in mine)
    pending_rules = [
        p for p in ordered if not p.is_observation and discrepancy_runs.action_of(p) == "prompt_rule" and pending(p)
    ]
    pending_calibration = [
        p
        for p in ordered
        if not p.is_observation and discrepancy_runs.action_of(p) == "calibrate_auditor" and pending(p)
    ]

    # Techo de aceptar las reglas pendientes (P5): llamadas rojas o amarillas cuyos desacuerdos sin azul caen todos en
    # una regla de prompt pendiente. Es un techo: supone que la regla arregla todo lo que cubre.
    fixable = {k for k in red_yellow if (p := best.get(k)) is not None and p in pending_rules}
    flips = 0
    for r in rows:
        if r["segment"] not in ("promptFn", "promptFp"):
            continue
        wrong = [(i["criterionId"], r["callId"]) for i in r["items"] if i["kind"] in SIDES and not i["blue"]]
        if wrong and all(w in fixable for w in wrong):
            flips += 1

    # --- Evolución (B2), crónicos (B5) y estabilidad del azul (B3) contra las pruebas anteriores ---
    prev = previous_tests(session, ev)
    prev_rows = [verification.evaluation_rows(session, p, with_code=False)[0] for p in prev]
    evolution = None
    if prev_rows:
        before = {r["callId"]: r["segment"] == "agree" for r in prev_rows[0]}
        now = {r["callId"]: r["segment"] == "agree" for r in rows}
        common = set(before) & set(now)
        to_agree = sorted(c for c in common if now[c] and not before[c])
        from_agree = sorted(c for c in common if before[c] and not now[c])
        evolution = {
            "version": prev[0].version,
            "calls": len(common),
            "toAgree": len(to_agree),
            "fromAgree": len(from_agree),
            "p": mcnemar(len(to_agree), len(from_agree)),
        }
    chronic = None
    chronic_by_criterion: Counter = Counter()
    stability = None
    if len(prev_rows) == 2:
        older = [items(pr) for pr in prev_rows]
        repeated = {k for k, v in red_yellow.items() if all(o.get(k, {}).get("side") == v["side"] for o in older)}
        chronic_by_criterion = Counter(cid for cid, _ in repeated)
        chronic = {
            "n": len(repeated),
            "of": len(red_yellow),
            "versions": [p.version for p in reversed(prev)],
            "new": sum(1 for k in red_yellow if not any(k in o for o in older)),
        }
        same = [k for k, v in mine.items() if all(o.get(k, {}).get("side") == v["side"] for o in older)]
        # Solo si las tres pruebas tienen su análisis de causa: sin él no hay azul que comparar.
        analyzed = all(cause_done(session, p) for p in prev)
        if same and analyzed:
            changed = sum(1 for k in same if len({mine[k]["blue"], older[0][k]["blue"], older[1][k]["blue"]}) > 1)
            stability = {"repeated": len(same), "changed": changed, "versions": [p.version for p in reversed(prev)]}

    # --- Verificación del azul: muestra fija de 30 en el orden aleatorio de la lista (R4) ---
    blue_rows = [r for r in rows if r["segment"] == "reviewer"]
    sample_ids = [r["caseId"] for r in blue_rows[:SAMPLE]]
    records = verification.records_for(session, sample_ids)
    statuses = [
        verification.call_status([d["outcome"] for d in verification.disagreements(r, records)])
        for r in blue_rows[:SAMPLE]
    ]
    sample = {
        "size": len(sample_ids),
        "reviewed": sum(1 for s in statuses if s in ("confirmed", "ai_wrong", "inconclusive")),
        "confirmed": statuses.count("confirmed"),
    }

    per_red_yellow = Counter(cid for cid, _ in red_yellow)
    per_blue = Counter(cid for cid, _ in blue)
    return {
        "disagreements": len(mine),
        "promptSide": {
            "n": len(red_yellow),
            "fn": sum(1 for v in red_yellow.values() if v["side"] == "fn"),
            "fp": sum(1 for v in red_yellow.values() if v["side"] == "fp"),
            "concentration": concentration(per_red_yellow),
            "coverage": dict(cover),
            "pendingRules": len(pending_rules),
            "ceiling": {"calls": flips, "agree": sum(1 for r in rows if r["segment"] == "agree"), "n": len(rows)},
        },
        "reviewerSide": {
            "n": len(blue),
            "concentration": concentration(per_blue),
            "withCalibration": blue_cover.get("calibrate_auditor", 0),
            "pendingCalibration": len(pending_calibration),
        },
        "byAction": dict(by_action),
        "chronic": chronic,
        "chronicByCriterion": {str(k): v for k, v in chronic_by_criterion.items()},
        "evolution": evolution,
        "stability": stability,
        "sample": sample,
    }
