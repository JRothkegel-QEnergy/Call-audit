"""Cuarta IA: análisis de discrepancias por motivo (paso 2 de docs/plan-ia-discrepancias.md).

Lee la salida de call_audit.discrepancies (discrepancies.jsonl + transcripts.jsonl), arma un pedido por motivo con
sus casos y le pide a un LLM patrones, causa y propuesta. No toca la base ni el prompt de la capa 2.

    uv run python -m call_audit.discrepancy_analysis --table ../transcripts/discrepancies/prod-2026-11-04 \
        --criteria 25,1,18 [--model claude-sonnet-5-5] [--dry-run]

Con --dry-run solo deja los pedidos en disco y estima tokens y costo, sin llamar al modelo. Deja en
<table>/analysis/v<prompt>/<modelo>/: c<id>.user.txt, c<id>.json (respuesta con las citas validadas), c<id>.meta.json
(costo, tokens, latencia) y report.md.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import tomllib
from collections import Counter
from pathlib import Path
from typing import Any

from call_audit.ingestion.import_bench import bench, real_calls

ROOT = Path(__file__).resolve().parents[2]
PROMPT_VERSION = "1.0.0"
PROMPT_DIR = ROOT / "prompts" / "discrepancy_analysis"
DEFAULT_MODEL = "claude-sonnet-5-5"
# Máximo de casos por tipo que van al modelo; del resto solo van los conteos. Los fn llevan la llamada completa.
SAMPLE = {"fp": 25, "fn": 12, "ai_uncertain": 12, "match_fail": 6}
# Cómo se arman los datos que recibe la IA evaluadora: sin esto, el modelo no puede reconocer un dato faltante.
DATA_NOTES = """## Notas sobre los datos
- La tipificación viene de la metadata del lote: una sola fila por grabación, con un seguro (mus_a_neto), un resultado
  y el motivo de renuncia. Si el Excel no trae la columna TIPIFICACION, el sistema asume RETENCION. Si en la llamada
  se gestionó más de un seguro, la metadata igual trae solo uno.
- Las esperas (holds_sec) las mide el código desde la transcripción, no la IA.
- El cliente marca CUMPLE / NO CUMPLE por motivo y rara vez deja comentario."""
KIND_LABEL = {
    "fp": "fp · la IA marcó incumple y el cliente no",
    "fn": "fn · el cliente marcó NO CUMPLE y la IA no",
    "ai_uncertain": "ai_uncertain · la IA quedó dudosa",
    "match_fail": "match_fail · los dos marcaron incumple (contraste)",
}
# Estimación para --dry-run, medida en el piloto del 2026-11-04 con Sonnet 5.5: 2,1–2,2 caracteres por token de
# entrada (transcripciones con timestamps) y 2.100–2.600 tokens de salida por motivo.
CHARS_PER_TOKEN = 2.1
EXPECTED_OUTPUT_TOKENS = 3000


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def model_config(name: str) -> dict:
    configs = tomllib.loads(bench.CONFIG.read_text(encoding="utf-8"))["models"]
    cfg = next((c for c in configs if c["name"] == name), None)
    if cfg is None:
        raise SystemExit(f"{name} no está en {bench.CONFIG}")
    # El análisis entrega un JSON libre, no la auditoría de la capa 2: sin la herramienta registrar_auditoria.
    return {k: v for k, v in cfg.items() if k != "tool_mode"}


def mmss(ms: int | None) -> str:
    sec = (ms or 0) // 1000
    return f"{sec // 60:02d}:{sec % 60:02d}"


def render_turns(turns: list[dict]) -> str:
    speaker = {"agent": "EJECUTIVO", "customer": "CLIENTE"}
    return "\n".join(f"[{mmss(t['startMs'])}] {speaker.get(t['speaker'], t['speaker'])}: {t['text']}" for t in turns)


def sample(rows: list[dict], kind: str, seed: int) -> list[dict]:
    """Muestra estable (misma semilla = mismos casos) para que dos corridas del análisis sean comparables."""
    of_kind = sorted((r for r in rows if r["kind"] == kind), key=lambda r: r["call_id"])
    limit = SAMPLE[kind]
    return (
        of_kind
        if len(of_kind) <= limit
        else sorted(random.Random(seed).sample(of_kind, limit), key=lambda r: r["call_id"])
    )


def render_case(r: dict, transcript: list[dict] | None) -> str:
    lines = [
        f"### Llamada {r['call_id']} · {r['kind']}",
        f"Veredicto de llamada: IA {r['ai_call_verdict']} · cliente {r['excel_call_verdict']}",
        f"Motivos incumple de la IA en esta llamada: {r['ai_fails'] or 'ninguno'} · "
        f"NO CUMPLE del cliente: {r['excel_fails'] or 'ninguno'}",
        f"IA en este motivo: {r['ai_verdict']} (confianza {r['ai_confidence']}). Comentario: {r['ai_comment'] or '—'}",
    ]
    for q in r["ai_quotes"]:
        lines.append(f"Cita de la IA [{mmss(q['startMs'])}]: «{q['quote']}»")
    lines.append(f"Comentario del cliente: {r['excel_comment'] or '(sin comentario)'}")
    if r.get("excel_evaluator"):
        lines.append(f"Evaluador del cliente: {r['excel_evaluator']}")
    manual = []
    if r.get("manual_item"):
        manual.append(f"en este motivo dijo {r['manual_item']['verdict']} ({r['manual_item']['action']})")
    if r.get("manual_call_verdict"):
        manual.append(f"veredicto de llamada {r['manual_call_verdict']}")
    manual += [f"nota: {n}" for n in r.get("manual_notes", []) + r.get("manual_finding_notes", [])]
    if manual:
        lines.append("Revisión manual Qubico: " + "; ".join(manual))
    if r.get("typification"):
        lines.append(f"Tipificación registrada: {json.dumps(r['typification'], ensure_ascii=False)}")
    if r.get("holds_sec") is not None:
        lines.append(f"Esperas del ejecutivo (s): {r['holds_sec']}")
    if transcript is not None:
        lines += ["Transcripción completa:", render_turns(transcript)]
    elif r["transcript_excerpt"]:
        lines += ["Tramo de la transcripción:", render_turns(r["transcript_excerpt"])]
    return "\n".join(lines)


def render_discarded(discarded: list[dict]) -> list[str]:
    """Propuestas que el admin ya descartó en este motivo (D-64), para que la IA no las repita sin evidencia nueva."""
    if not discarded:
        return []
    lines = [
        "",
        "## Propuestas ya descartadas por el equipo",
        "No las repitas salvo que los casos muestren evidencia distinta; si lo haces, explica qué cambió.",
    ]
    lines += [f"- «{d['text']}» · motivo del descarte: {d.get('reason') or 'sin motivo'}" for d in discarded]
    return lines


def build_request(
    cid: int,
    rows: list[dict],
    transcripts: dict[str, list[dict]],
    counts: dict,
    discarded: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    """Pedido de un motivo y los casos que van en él."""
    first = rows[0]
    parts = [
        f"# Motivo {cid} · {first['criterion_name']}",
        "",
        f"## Regla vigente (prompt de la capa 2 v{first['rule_prompt_version']})",
        first["rule"] or "(sin texto)",
        "",
        "## Conteos en todas las llamadas analizadas",
        f"{counts['calls']} llamadas. Cliente NO CUMPLE: {counts['fn'] + counts['match_fail']} · IA incumple: "
        f"{counts['fp'] + counts['match_fail']} · ambos: {counts['match_fail']} · fp: {counts['fp']} · "
        f"fn: {counts['fn']} · IA dudosa: {counts['ai_uncertain']}.",
        "",
        DATA_NOTES,
        *render_discarded(discarded or []),
    ]
    sent: list[dict] = []
    for kind in SAMPLE:
        chosen = sample(rows, kind, seed=cid)
        if not chosen:
            continue
        total = sum(1 for r in rows if r["kind"] == kind)
        shown = f"{len(chosen)} de {total}" if len(chosen) < total else f"{total}"
        parts += ["", f"## Casos {KIND_LABEL[kind]} ({shown})"]
        for r in chosen:
            parts += ["", render_case(r, transcripts.get(r["call_id"]) if kind == "fn" else None)]
        sent += chosen
    return "\n".join(parts) + "\n", sent


def parse_response(text: str) -> dict:
    """Primer objeto JSON con "patterns" en la respuesta (tolera ```json y texto alrededor)."""
    text = re.sub(r"```(?:json)?", "", text)
    decoder, pos = json.JSONDecoder(), text.find("{")
    while pos != -1:
        try:
            obj, _ = decoder.raw_decode(text, pos)
        except json.JSONDecodeError:
            pos = text.find("{", pos + 1)
            continue
        if isinstance(obj, dict) and isinstance(obj.get("patterns"), list):
            return obj
        pos = text.find("{", pos + 1)
    raise ValueError("la respuesta no trae un JSON con 'patterns'")


def validate_quotes(analysis: dict, sent: list[dict], transcripts: dict[str, list[dict]]) -> int:
    """Marca cada cita con validated: True si aparece en lo que recibió el modelo de esa llamada (transcripción,
    comentarios o citas de la IA). Devuelve cuántas no se encontraron."""
    sources: dict[str, str] = {}
    for r in sent:
        turns = transcripts.get(r["call_id"]) or r["transcript_excerpt"]
        texts = [t["text"] for t in turns] + [r["ai_comment"] or "", r["excel_comment"] or ""]
        texts += [q["quote"] for q in r["ai_quotes"]] + r.get("manual_notes", [])
        sources[r["call_id"]] = sources.get(r["call_id"], "") + " " + " ".join(texts)
    missing = 0
    for pattern in analysis.get("patterns", []):
        for q in pattern.get("quotes", []):
            q["validated"] = real_calls.quote_found(q.get("text", ""), sources.get(str(q.get("call_id")), ""))
            missing += not q["validated"]
    return missing


def criterion_counts(rows: list[dict], n_calls: int) -> dict:
    c = Counter(r["kind"] for r in rows)
    return {"calls": n_calls, **{k: c[k] for k in ("fp", "fn", "ai_uncertain", "match_fail")}}


def write_report(out: Path, results: list[dict], model: str) -> None:
    cause_label = {
        "criterion": "Criterio",
        "evaluator": "Evaluador",
        "transcript": "Transcripción",
        "missing_data": "Dato faltante",
    }
    lines = [f"# Análisis de discrepancias · prompt v{PROMPT_VERSION} · {model}", ""]
    total = sum(r["meta"].get("cost_usd") or 0 for r in results)
    lines += [f"Costo total: US${total:.2f}.", ""]
    for r in results:
        a, meta = r["analysis"], r["meta"]
        lines += [f"## Motivo {a.get('criterion_id')} · {meta['criterion_name']}", "", a.get("summary", ""), ""]
        for i, p in enumerate(a.get("patterns", []), 1):
            prop = p.get("proposal") or {}
            lines += [
                f"### {i}. {p.get('title')}",
                "",
                f"- **Causa:** {cause_label.get(p.get('cause'), p.get('cause'))} · **dirección:** {p.get('direction')}"
                f" · **confianza:** {p.get('confidence')} · **casos ({len(p.get('cases', []))}):** "
                + ", ".join(p.get("cases", [])),
                f"- **Por qué:** {p.get('explanation')}",
                f"- **Propuesta ({prop.get('type')}):** {prop.get('text')}",
            ]
            for q in p.get("quotes", []):
                mark = "" if q.get("validated") else " ⚠ cita no encontrada"
                lines.append(f"  - {q.get('call_id')}: «{q.get('text')}»{mark}")
            lines.append("")
        if a.get("observations"):
            lines += ["**Observaciones:**", ""]
            lines += [f"- {', '.join(o.get('cases', []))}: {o.get('text')}" for o in a["observations"]]
            lines.append("")
        if a.get("unexplained_cases"):
            lines += [f"**Sin explicar:** {', '.join(a['unexplained_cases'])}", ""]
        lines += [
            f"_Casos enviados: {meta['cases_sent']} · tokens {meta['input_tokens']} → {meta['output_tokens']} · "
            f"US${meta.get('cost_usd') or 0:.3f} · citas no encontradas: {meta['quotes_missing']}_",
            "",
        ]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--table", type=Path, required=True, help="carpeta --out de call_audit.discrepancies")
    parser.add_argument("--criteria", required=True, help="motivos separados por coma, ej. 25,1,18")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="name de scripts/prompt_bench/models.toml")
    parser.add_argument(
        "--dry-run", action="store_true", help="arma los pedidos y estima el costo, sin llamar al modelo"
    )
    args = parser.parse_args()

    bench.load_dotenv(ROOT / ".env")
    bench.load_dotenv(ROOT.parent / "call-audit" / ".env")
    cfg = model_config(args.model)
    system = (PROMPT_DIR / f"v{PROMPT_VERSION}" / "system.txt").read_text(encoding="utf-8")
    rows = load_jsonl(args.table / "discrepancies.jsonl")
    transcripts = {t["call_id"]: t["turns"] for t in load_jsonl(args.table / "transcripts.jsonl")}
    n_calls = int(re.search(r"^(\d+) llamadas", (args.table / "summary.md").read_text(encoding="utf-8"), re.M)[1])
    out = args.table / "analysis" / f"v{PROMPT_VERSION}" / cfg["name"]
    out.mkdir(parents=True, exist_ok=True)

    estimate = 0.0
    for cid in [int(x) for x in args.criteria.split(",")]:
        of_criterion = [r for r in rows if r["criterion_id"] == cid]
        if not of_criterion:
            print(f"motivo {cid}: sin casos")
            continue
        user, sent = build_request(cid, of_criterion, transcripts, criterion_counts(of_criterion, n_calls))
        (out / f"c{cid}.user.txt").write_text(user, encoding="utf-8")
        tokens_in = int((len(system) + len(user)) / CHARS_PER_TOKEN)
        cost = bench.cost_usd(cfg, {"input_tokens": tokens_in, "output_tokens": EXPECTED_OUTPUT_TOKENS}) or 0
        estimate += cost
        print(f"motivo {cid}: {len(sent)} casos enviados, ~{tokens_in:,} tokens de entrada, ~US${cost:.2f}")
        if args.dry_run:
            continue
        text, returned_model, usage, latency = bench.call_with_retries(cfg, f"c{cid}", system, user)
        try:
            analysis = parse_response(text)
        except ValueError as exc:
            # Un motivo que falla no corta los demás: queda la respuesta cruda para revisarla.
            (out / f"c{cid}.error.txt").write_text(text, encoding="utf-8")
            cost = bench.cost_usd(cfg, usage) or 0
            print(f"   {exc}; respuesta en c{cid}.error.txt (US${cost:.3f})")
            continue
        missing = validate_quotes(analysis, sent, transcripts)
        meta: dict[str, Any] = {
            "criterion_id": cid,
            "criterion_name": of_criterion[0]["criterion_name"],
            "prompt_version": PROMPT_VERSION,
            "model": returned_model,
            "cases_sent": len(sent),
            "latency_ms": latency,
            "cost_usd": bench.cost_usd(cfg, usage),
            "quotes_missing": missing,
            **usage,
        }
        (out / f"c{cid}.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / f"c{cid}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        n_patterns = len(analysis.get("patterns", []))
        print(f"   {n_patterns} patrones, US${meta['cost_usd'] or 0:.3f}, citas no encontradas: {missing}")
    if args.dry_run:
        print(f"Estimado total: ~US${estimate:.2f} con {cfg['name']} (precios de models.toml). Pedidos en {out}")
        return
    # El informe junta todo lo analizado en la carpeta (también corridas anteriores), de más a menos desacuerdos.
    disagreements = Counter(r["criterion_id"] for r in rows if r["kind"] in ("fp", "fn", "ai_uncertain"))
    results = [
        {
            "analysis": json.loads(path.read_text(encoding="utf-8")),
            "meta": json.loads(path.with_suffix(".meta.json").read_text(encoding="utf-8")),
        }
        for path in out.glob("c*.json")
        if not path.name.endswith(".meta.json")
    ]
    results.sort(key=lambda r: -disagreements[r["meta"]["criterion_id"]])
    write_report(out, results, cfg["name"])
    print(f"Listo en {out / 'report.md'}")


if __name__ == "__main__":
    main()
