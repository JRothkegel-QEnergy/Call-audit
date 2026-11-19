"""Golden set: división fija de las llamadas con marca por motivo del cliente y métricas por motivo contra esa marca.

Por qué: la cuarta IA propone reglas mirando los errores de la IA. Si la versión nueva del prompt se mide sobre esas
mismas llamadas, la mejora sale inflada (el prompt aprende "estas llamadas", no la pauta). Con la división:

- train (60 %): lo único que lee la cuarta IA (`discrepancies.build(..., split="train")`).
- val (20 %): decide si se adopta una versión (`prompt_evaluation`).
- test (20 %): se mira rara vez, para confirmar que la mejora se sostiene.

La asignación vive en `cases.call_metadata["golden_split"]` y no cambia: una llamada que ya tiene set lo conserva y
solo las nuevas se reparten. Es determinística (hash del call_id), así que dos corridas dan lo mismo. Se estratifica
por veredicto del cliente y por el motivo incumplido más raro de la llamada, para que los motivos con pocos casos
queden también en validación y prueba; dentro de cada estrato se ordena por evaluadora para repartirlas.

Uso (sin IA; sin --apply solo lee y deja el informe en --out, fuera del repo):

    DATABASE_URL=... uv run python -m call_audit.golden_split --out ../transcripts/golden_split/2026-11-10
    DATABASE_URL=... uv run python -m call_audit.golden_split --out <carpeta> --apply
"""

import argparse
import csv
import hashlib
from collections import Counter, defaultdict
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.config import get_settings
from call_audit.persistence.models import Case
from call_audit.rubric import load_rubric

KEY = "golden_split"
SPLITS = ("train", "val", "test")
SEED = "golden-v1"
# Ciclo de 10 con 6/2/2. Un puntero global lo recorre a través de todos los estratos, así la proporción total es
# exacta y cada estrato queda repartido con a lo más uno o dos de diferencia.
CYCLE = ("val", "train", "test", "train", "train", "val", "train", "test", "train", "train")
PASS, FAIL, UNSURE = "compliant", "non_compliant", "uncertain"
FP_GOAL, FN_GOAL = 0.05, 0.20  # metas de precisión del proyecto (docs/context.md)
MIN_SUPPORT = 5  # bajo esto, el motivo se informa pero no entra al promedio (F1 macro)


def split_of(case: Case) -> str | None:
    value = (case.call_metadata or {}).get(KEY)
    return value if value in SPLITS else None


def default_split(session: Session, wanted: str) -> str | None:
    """`wanted` si ya hay llamadas asignadas; si no, None (todas), para que nada cambie antes de asignar."""
    for metadata in session.scalars(select(Case.call_metadata)):
        if (metadata or {}).get(KEY) in SPLITS:
            return wanted
    return None


def _digest(call_id: str) -> str:
    return hashlib.sha256(f"{SEED}:{call_id}".encode()).hexdigest()


def assign(calls: list[dict], existing: dict[str, str] | None = None) -> dict[str, str]:
    """Set de cada llamada. `calls`: [{"call_id", "verdict", "fails", "evaluator"}]. Las de `existing` lo conservan."""
    out = {cid: s for cid, s in (existing or {}).items() if s in SPLITS}
    freq = Counter(c for x in calls for c in x["fails"])
    strata: dict[tuple, list[dict]] = defaultdict(list)
    for x in calls:
        if x["call_id"] in out:
            continue
        rarest = min(x["fails"], key=lambda c: (freq[c], c)) if x["fails"] else 0
        strata[(rarest != 0, freq[rarest] if rarest else 0, rarest, x["verdict"] or "")].append(x)
    pointer = len(out)
    # Primero los estratos de motivos raros, para que caigan al inicio del ciclo (que empieza en val).
    for key in sorted(strata, key=lambda k: (not k[0], k[1], k[2], k[3])):
        for x in sorted(strata[key], key=lambda x: (x["evaluator"] or "", _digest(x["call_id"]))):
            out[x["call_id"]] = CYCLE[pointer % len(CYCLE)]
            pointer += 1
    return out


# --- Métricas por motivo -----------------------------------------------------------------------------------------


def _ratio(a: int, b: int) -> float | None:
    return round(a / b, 3) if b else None


def criterion_scores(rows: Iterable[dict], criteria: Iterable[int]) -> list[dict]:
    """Por motivo, la IA contra la marca del cliente. rows: {"aiFails", "refFails", "aiUncertain"} (listas de ids).

    "No cumple" de la IA es el positivo; un motivo dudoso de la IA cuenta como que no lo marcó (y se informa aparte)."""
    rows = list(rows)
    out = []
    for c in criteria:
        tp = fp = fn = tn = unsure = 0
        for r in rows:
            ai, ref = c in r["aiFails"], c in r["refFails"]
            unsure += c in r.get("aiUncertain", ())
            tp += ai and ref
            fp += ai and not ref
            fn += ref and not ai
            tn += not ai and not ref
        precision, recall = _ratio(tp, tp + fp), _ratio(tp, tp + fn)
        f1 = _ratio(2 * tp, 2 * tp + fp + fn)
        out.append(
            {
                "criterionId": c,
                "support": tp + fn,
                "aiFails": tp + fp,
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "tn": tn,
                "aiUncertain": unsure,
                "precision": precision,
                "recall": recall,
                "f1": f1,
            }
        )
    return out


def call_rates(rows: list[dict]) -> dict[str, Any]:
    """Veredicto de llamada contra la meta del proyecto (docs/context.md: hasta 5 % de FP y hasta 20 % de FN).

    - FP: la IA rechaza una llamada que la corredora aprobó (sobre las aprobadas por la corredora).
    - FN: la IA aprueba una llamada que la corredora rechazó (sobre las rechazadas por la corredora).
    - Dudosa: la IA no decide y la llamada va a revisión humana; no cuenta como FP ni FN y se informa aparte."""
    rows = [r for r in rows if r.get("verdict") and r.get("external")]
    ok = [r for r in rows if r["external"] == PASS]
    bad = [r for r in rows if r["external"] == FAIL]
    fp = sum(r["verdict"] == FAIL for r in ok)
    fn = sum(r["verdict"] == PASS for r in bad)
    unsure = sum(r["verdict"] == UNSURE for r in rows)
    return {
        "callMatchRate": _ratio(sum(r["verdict"] == r["external"] for r in rows), len(rows)),
        "callFpRate": _ratio(fp, len(ok)),
        "callFnRate": _ratio(fn, len(bad)),
        "callUncertainRate": _ratio(unsure, len(rows)),
        "fpGoal": FP_GOAL,
        "fnGoal": FN_GOAL,
        # Conteos para leer las tasas con su peso real ("33 % · 36 de 109").
        "nCalls": len(rows),
        "nApproved": len(ok),
        "nRejected": len(bad),
        "fpCount": fp,
        "fnCount": fn,
        "uncertainCount": unsure,
    }


def without_criterion(rows: list[dict], criterion: int) -> list[dict]:
    """Estimación sin gastar: qué pasaría si la IA dejara de marcar `criterion`. Una llamada rechazada solo por ese
    motivo pasa a aprobada (o a dudosa si tenía otro motivo dudoso). Aproximada: no repite toda la regla de decisión."""
    out = []
    for r in rows:
        fails = [c for c in r["aiFails"] if c != criterion]
        verdict = r["verdict"]
        if verdict == FAIL and not fails:
            verdict = UNSURE if [c for c in r.get("aiUncertain", []) if c != criterion] else PASS
        out.append(r | {"aiFails": fails, "verdict": verdict})
    return out


def summary(rows: list[dict], criteria: Iterable[int], min_support: int = MIN_SUPPORT) -> dict[str, Any]:
    """Resumen comparable entre versiones: veredicto de llamada contra la meta y F1 por motivo (macro y micro)."""
    by = criterion_scores(rows, criteria)
    scored = [x for x in by if x["support"] >= min_support]
    tp, fp, fn = (sum(x[k] for x in by) for k in ("tp", "fp", "fn"))
    return {
        "n": len(rows),
        **call_rates(rows),
        "macroF1": round(sum(x["f1"] or 0 for x in scored) / len(scored), 3) if scored else None,
        "macroCriteria": [x["criterionId"] for x in scored],
        "microF1": _ratio(2 * tp, 2 * tp + fp + fn),
        "minSupport": min_support,
        "byCriterion": by,
    }


def layer2_criteria() -> list[int]:
    """Motivos que evalúa el prompt (el 1 sale del código, capa 1, y no se optimiza con el prompt)."""
    rubric = load_rubric(get_settings().rubric_path)
    return sorted(c for c, crit in rubric.criteria.items() if "layer2" in crit.layers)


def code_criteria() -> list[int]:
    """Motivos que decide el código (capa 1, hoy solo el 1 por espera). No entran al mosaico ni a las métricas del
    prompt, pero sí a la verificación: hay que poder revisar a mano sus desacuerdos con la planilla."""
    rubric = load_rubric(get_settings().rubric_path)
    return sorted(c for c, crit in rubric.criteria.items() if "layer1" in crit.layers and "layer2" not in crit.layers)


def run_row(case: Case) -> dict | None:
    """Fila de métricas con la corrida vigente que ya existe (sin gastar). None si no hay corrida usable."""
    run = next((r for r in case.runs if r.is_current), None)
    if run is None or run.error or case.external_item_fails is None:
        return None
    findings = run.findings or []
    return {
        "callId": case.call_id,
        "split": split_of(case),
        "verdict": run.verdict,
        "external": case.external_verdict,
        "aiFails": sorted(int(f["criterionId"]) for f in findings if f.get("verdict") == FAIL),
        "aiUncertain": sorted(int(f["criterionId"]) for f in findings if f.get("verdict") == UNSURE),
        "refFails": sorted(int(x) for x in case.external_item_fails),
        "promptVersion": run.prompt_version,
        "model": run.model,
    }


# --- CLI ---------------------------------------------------------------------------------------------------------


def _evaluator(case: Case) -> str | None:
    return (case.call_metadata or {}).get("external_evaluator")


def _fmt(x: float | None) -> str:
    return "–" if x is None else f"{x:.2f}"


def _pct(x: float | None) -> str:
    return "–" if x is None else f"{100 * x:.0f} %"


def write_report(out: Path, cases: list[Case], splits: dict[str, str], criteria: list[int]) -> dict[str, dict]:
    out.mkdir(parents=True, exist_ok=True)
    with (out / "split.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["call_id", "split", "external_verdict", "evaluator", "external_fails"])
        for c in cases:
            fails = " ".join(str(x) for x in sorted(c.external_item_fails or []))
            w.writerow([c.call_id, splits[c.call_id], c.external_verdict, _evaluator(c), fails])

    rows = [r | {"split": splits[r["callId"]]} for c in cases if (r := run_row(c))]
    results = {s: summary([r for r in rows if r["split"] == s], criteria) for s in SPLITS}
    versions = Counter((r["model"], r["promptVersion"]) for r in rows)

    n = Counter(splits[c.call_id] for c in cases)
    rejected = Counter(splits[c.call_id] for c in cases if c.external_verdict == FAIL)
    support = {s: Counter() for s in SPLITS}
    for c in cases:
        support[splits[c.call_id]].update(c.external_item_fails or [])
    evaluators = {s: len({_evaluator(c) for c in cases if splits[c.call_id] == s}) for s in SPLITS}

    lines = [
        "# Golden set · división fija y línea base",
        "",
        f"{len(cases)} llamadas con marca por motivo del cliente. Línea base con las corridas vigentes "
        f"({', '.join(f'{m} v{v}: {k}' for (m, v), k in versions.most_common())}); "
        f"{len(cases) - len(rows)} sin corrida usable (error o sin corrida) quedan fuera de las métricas.",
        "",
        "| Set | Llamadas | Rechazadas (cliente) | Evaluadoras | Con corrida | Calce veredicto | F1 macro | F1 micro |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for s in SPLITS:
        r = results[s]
        lines.append(
            f"| {s} | {n[s]} | {rejected[s]} ({100 * rejected[s] / max(n[s], 1):.0f} %) | {evaluators[s]} | {r['n']} "
            f"| {_fmt(r['callMatchRate'])} | {_fmt(r['macroF1'])} | {_fmt(r['microF1'])} |"
        )
    lines += [
        "",
        f"## Veredicto de llamada contra la meta (FP ≤ {FP_GOAL:.0%}, FN ≤ {FN_GOAL:.0%})",
        "",
        "FP: la IA rechaza una llamada que la corredora aprobó. FN: la IA aprueba una que la corredora rechazó. "
        "Dudosa: va a revisión humana (no es FP ni FN). La columna «sin motivo 25» es una estimación sin gastar: "
        "las llamadas que la IA rechazó solo por el 25 pasan a aprobadas.",
        "",
        "| Set | FP | FN | Dudosas | Calce | FP sin 25 | FN sin 25 | Calce sin 25 |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for s in SPLITS:
        r = results[s]
        w = call_rates(without_criterion([x for x in rows if x["split"] == s], 25))
        lines.append(
            f"| {s} | {_pct(r['callFpRate'])} | {_pct(r['callFnRate'])} | {_pct(r['callUncertainRate'])} "
            f"| {_pct(r['callMatchRate'])} | {_pct(w['callFpRate'])} | {_pct(w['callFnRate'])} "
            f"| {_pct(w['callMatchRate'])} |"
        )
    lines += [
        "",
        f"F1 macro: promedio de los motivos con al menos {MIN_SUPPORT} marcas del cliente en ese set. "
        "El motivo 1 (espera) sale del código y no entra.",
        "",
        "## Por motivo en validación, donde se decide (entre paréntesis, marcas del cliente en train / val / test)",
        "",
        "| Motivo | Marcas cliente | IA marca | Ambos | fp | fn | IA dudosa | Precisión | Recall | F1 |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for x in sorted(results["val"]["byCriterion"], key=lambda x: -sum(support[s][x["criterionId"]] for s in SPLITS)):
        c = x["criterionId"]
        counts = " / ".join(str(support[s][c]) for s in SPLITS)
        lines.append(
            f"| {c} | {x['support']} ({counts}) | {x['aiFails']} | {x['tp']} | {x['fp']} | {x['fn']} "
            f"| {x['aiUncertain']} | {_fmt(x['precision'])} | {_fmt(x['recall'])} | {_fmt(x['f1'])} |"
        )
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return results


def main() -> None:
    from call_audit.persistence.db import get_sessionmaker

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="carpeta del informe, fuera del repo")
    parser.add_argument("--apply", action="store_true", help="guarda el set en cases.call_metadata (escribe)")
    args = parser.parse_args()

    with get_sessionmaker()() as session, session.begin():
        cases = list(session.scalars(select(Case).where(Case.external_item_fails.is_not(None)).order_by(Case.call_id)))
        existing = {c.call_id: s for c in cases if (s := split_of(c))}
        calls = [
            {
                "call_id": c.call_id,
                "verdict": c.external_verdict,
                "fails": sorted(int(x) for x in c.external_item_fails),
                "evaluator": _evaluator(c),
            }
            for c in cases
        ]
        splits = assign(calls, existing)
        results = write_report(args.out, cases, splits, layer2_criteria())
        new = [c for c in cases if c.call_id not in existing]
        if args.apply:
            for c in new:
                c.call_metadata = {**(c.call_metadata or {}), KEY: splits[c.call_id]}
        else:
            session.rollback()

    print(f"{len(cases)} llamadas ({len(existing)} ya tenían set, {len(new)} nuevas): {Counter(splits.values())}")
    for s in SPLITS:
        r = results[s]
        print(
            f"  {s}: n={r['n']} calce={_pct(r['callMatchRate'])} FP={_pct(r['callFpRate'])} "
            f"FN={_pct(r['callFnRate'])} dudosas={_pct(r['callUncertainRate'])} F1 macro={_fmt(r['macroF1'])}"
        )
    print(("Guardado en la base. " if args.apply else "Sin --apply: no se escribió nada en la base. ") + f"{args.out}")


if __name__ == "__main__":
    main()
