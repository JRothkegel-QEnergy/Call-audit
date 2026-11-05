"""Cuarta IA: análisis de discrepancias por motivo (paso 2 de docs/plan-ia-discrepancias.md).

Lee la salida de call_audit.discrepancies (discrepancies.jsonl + transcripts.jsonl), arma los pedidos de cada motivo con
todos sus casos (cada uno con la llamada completa) y le pide a un LLM patrones, causa y propuesta. Un motivo que no cabe
en un pedido se parte en tandas y una pasada final (merge.txt) las junta. No toca la base ni el prompt de la capa 2.

    uv run python -m call_audit.discrepancy_analysis --table ../transcripts/discrepancies/prod-2026-11-04 \
        --criteria 25,1,18 [--model gemini-3-8-flash] [--dry-run]

Con --dry-run solo deja los pedidos en disco y estima tokens y costo, sin llamar al modelo. Deja en
<table>/analysis/v<prompt>/<modelo>/: c<id>.user.txt, c<id>.json (respuesta con las citas validadas), c<id>.meta.json
(costo, tokens, latencia) y report.md.
"""

from __future__ import annotations

import argparse
import json
import re
import tomllib
from collections import Counter
from pathlib import Path
from typing import Any

from call_audit.ingestion.import_bench import bench, real_calls

ROOT = Path(__file__).resolve().parents[2]
PROMPT_VERSION = "1.2.0"
PROMPT_DIR = ROOT / "prompts" / "discrepancy_analysis"
# Sonnet 5.5 por la API de Anthropic (Johannes, 2026-11-05): el modelo del piloto y de la corrida completa.
DEFAULT_MODEL = "claude-sonnet-5-5"
# Van todos los casos (Johannes, 2026-11-05), en este orden.
KINDS = ("fp", "fn", "ai_uncertain", "match_fail")
# Tope de tokens de entrada por pedido. Con la llamada completa en cada caso, los motivos con más desacuerdos pesan más
# de 1 M de tokens: se parten en tandas de este tamaño, con margen bajo la ventana de contexto de los modelos.
BATCH_TOKENS = 150_000
# Cómo se arman los datos que recibe la IA evaluadora: sin esto, el modelo no puede reconocer un dato faltante.
DATA_NOTES = """## Notas sobre los datos
- La tipificación viene de la metadata del lote: una sola fila por grabación, con un seguro (mus_a_neto), un resultado
  y el motivo de renuncia. Si el lote no trae TIPIFICACION, el sistema asume RETENCION. Si en la llamada se gestionó más
  de un seguro, la metadata igual trae una sola tipificación.
- Los seguros de la llamada vienen de la metadata del lote; la IA evaluadora recibió la ficha de producto de cada uno.
- Las esperas (holds_sec) las mide el código desde la transcripción, no la IA.
- El auditor marca cumple / no cumple por motivo y rara vez deja comentario."""
KIND_LABEL = {
    "fp": "fp · la IA marcó incumple y el auditor cumple",
    "fn": "fn · el auditor marcó no cumple y la IA cumple o no aplica",
    "ai_uncertain": "ai_uncertain · la IA quedó dudosa",
    "match_fail": "match_fail · los dos marcaron incumple (contraste)",
}
# Estimación para --dry-run, medida en el piloto del 2026-11-04 con Sonnet 5.5: 2,1–2,2 caracteres por token de
# entrada (transcripciones con timestamps) y 2.100–2.600 tokens de salida por pedido. Con otro modelo el tokenizador
# cambia: es una estimación, el costo real sale del uso que devuelve el proveedor.
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


def render_case(r: dict, transcript: list[dict] | None) -> str:
    lines = [
        f"### Llamada {r['call_id']} · {r['kind']}",
        f"Ejecutivo: {r.get('agent_id') or 'sin dato'} · auditor: {r.get('excel_evaluator') or 'sin dato'}",
        f"Veredicto de llamada: IA {r['ai_call_verdict']} · auditor {r['excel_call_verdict']}",
        f"Motivos incumple de la IA en esta llamada: {r['ai_fails'] or 'ninguno'} · "
        f"no cumple del auditor: {r['excel_fails'] or 'ninguno'}",
        f"IA en este motivo: {r['ai_verdict']} (confianza {r['ai_confidence']}). Comentario: {r['ai_comment'] or '—'}",
    ]
    for q in r["ai_quotes"]:
        lines.append(f"Cita de la IA [{mmss(q['startMs'])}]: «{q['quote']}»")
    lines.append(f"Comentario del auditor: {r['excel_comment'] or '(sin comentario)'}")
    manual = []
    if r.get("manual_item"):
        manual.append(f"en este motivo dijo {r['manual_item']['verdict']} ({r['manual_item']['action']})")
    if r.get("manual_call_verdict"):
        manual.append(f"veredicto de llamada {r['manual_call_verdict']}")
    manual += [f"nota: {n}" for n in r.get("manual_notes", []) + r.get("manual_finding_notes", [])]
    if manual:
        lines.append("Revisión manual Qubico: " + "; ".join(manual))
    data = {
        "seguros": r.get("policies"),
        "tipificación": r.get("typification"),
        "duración (s)": r.get("duration_sec"),
        "esperas del ejecutivo (s)": r.get("holds_sec"),
    }
    data = {k: v for k, v in data.items() if v not in (None, [], {})}
    if data:
        lines.append(f"Datos de la llamada: {json.dumps(data, ensure_ascii=False)}")
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


def header(cid: int, first: dict, counts: dict) -> list[str]:
    return [
        f"# Motivo {cid} · {first['criterion_name']}",
        "",
        f"## Regla vigente (prompt de la capa 2 v{first['rule_prompt_version']})",
        first["rule"] or "(sin texto)",
        "",
        "## Conteos en todas las llamadas analizadas",
        f"{counts['calls']} llamadas. Auditor no cumple: {counts['fn'] + counts['match_fail']} · IA incumple: "
        f"{counts['fp'] + counts['match_fail']} · ambos: {counts['match_fail']} · fp: {counts['fp']} · "
        f"fn: {counts['fn']} · IA dudosa: {counts['ai_uncertain']}.",
    ]


def build_requests(
    cid: int,
    rows: list[dict],
    transcripts: dict[str, list[dict]],
    counts: dict,
    discarded: list[dict] | None = None,
) -> list[tuple[str, list[dict]]]:
    """Pedidos de un motivo con todos sus casos y la llamada completa de cada uno. Si no caben en BATCH_TOKENS, van en
    tandas que se reparten los casos en orden (fp, fn, dudosos, contraste)."""
    base = [*header(cid, rows[0], counts), "", DATA_NOTES, *render_discarded(discarded or [])]
    cases = [
        (r, render_case(r, transcripts.get(r["call_id"])))
        for kind in KINDS
        for r in sorted((r for r in rows if r["kind"] == kind), key=lambda r: r["call_id"])
    ]
    budget = BATCH_TOKENS * CHARS_PER_TOKEN - len("\n".join(base)) - 2_000
    batches: list[list[tuple[dict, str]]] = [[]]
    used = 0
    for case in cases:
        if batches[-1] and used + len(case[1]) > budget:
            batches.append([])
            used = 0
        batches[-1].append(case)
        used += len(case[1]) + 2
    requests = []
    for i, batch in enumerate(batches, 1):
        parts = list(base)
        if len(batches) > 1:
            parts += [
                "",
                f"## Tanda {i} de {len(batches)}",
                f"Esta tanda trae {len(batch)} de los {len(cases)} casos del motivo. "
                "Los conteos de arriba son del total.",
            ]
        for kind in KINDS:
            of_kind = [text for r, text in batch if r["kind"] == kind]
            if not of_kind:
                continue
            total = sum(1 for r in rows if r["kind"] == kind)
            shown = f"{len(of_kind)} de {total}" if len(of_kind) < total else f"{total}"
            parts += ["", f"## Casos {KIND_LABEL[kind]} ({shown})"]
            for text in of_kind:
                parts += ["", text]
        requests.append(("\n".join(parts) + "\n", [r for r, _ in batch]))
    return requests


def merge_request(cid: int, first: dict, counts: dict, partials: list[dict]) -> str:
    """Pedido de la pasada que junta las tandas de un motivo (merge.txt)."""
    parts = header(cid, first, counts)
    for i, partial in enumerate(partials, 1):
        parts += ["", f"## Tanda {i} de {len(partials)}", json.dumps(partial, ensure_ascii=False)]
    return "\n".join(parts) + "\n"


def prompt_text(name: str) -> str:
    return (PROMPT_DIR / f"v{PROMPT_VERSION}" / name).read_text(encoding="utf-8")


def estimate_tokens(system: str, merge_system: str, requests: list[tuple[str, list[dict]]]) -> tuple[int, int]:
    """Tokens de entrada y salida estimados de un motivo, con la pasada que junta las tandas si hay más de una."""
    tokens_in = sum(int((len(system) + len(user)) / CHARS_PER_TOKEN) for user, _ in requests)
    tokens_out = EXPECTED_OUTPUT_TOKENS * len(requests)
    if len(requests) > 1:
        tokens_in += int(len(merge_system) / CHARS_PER_TOKEN) + EXPECTED_OUTPUT_TOKENS * len(requests)
        tokens_out += EXPECTED_OUTPUT_TOKENS
    return tokens_in, tokens_out


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
    # criterion y evaluator son las causas de la v1.0.0; la v1.1.0 las separa en rule_text / ai_application y auditor.
    cause_label = {
        "rule_text": "Texto de la regla",
        "ai_application": "La IA aplica mal la regla",
        "auditor": "Auditor",
        "motive_overlap": "Frontera entre motivos",
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
                f"- **Quién tiene más razón:** {p.get('who_is_right') or '—'}"
                + (" · **tentativo**" if p.get("tentative") else ""),
                f"- **Por qué:** {p.get('explanation')}",
                f"- **Propuesta ({prop.get('type')}):** {prop.get('text')}"
                if prop.get("text")
                else "- **Sin propuesta**",
            ]
            if p.get("concentration"):
                lines.append(f"- **Concentración:** {p['concentration']}")
            if p.get("expected_fix"):
                lines.append(f"- **Debería corregir:** {', '.join(p['expected_fix'])}")
            if p.get("side_effects"):
                lines.append(f"- **Efectos laterales:** {p['side_effects']}")
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
    system, merge_system = prompt_text("system.txt"), prompt_text("merge.txt")
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
        counts = criterion_counts(of_criterion, n_calls)
        requests = build_requests(cid, of_criterion, transcripts, counts)
        for i, (user, _) in enumerate(requests, 1):
            (out / f"c{cid}.{i}.user.txt").write_text(user, encoding="utf-8")
        tokens_in, tokens_out = estimate_tokens(system, merge_system, requests)
        cost = bench.cost_usd(cfg, {"input_tokens": tokens_in, "output_tokens": tokens_out}) or 0
        estimate += cost
        sent = [r for _, batch in requests for r in batch]
        print(f"motivo {cid}: {len(sent)} casos en {len(requests)} pedidos, ~{tokens_in:,} tokens, ~US${cost:.2f}")
        if args.dry_run:
            continue
        usage: dict[str, int] = Counter()
        latency = 0
        partials = []
        try:
            for user, _ in requests:
                text, returned_model, used, ms = bench.call_with_retries(cfg, f"c{cid}", system, user)
                usage.update({k: v for k, v in used.items() if isinstance(v, int)})
                latency += ms
                partials.append(parse_response(text))
            if len(partials) > 1:
                user = merge_request(cid, of_criterion[0], counts, partials)
                text, returned_model, used, ms = bench.call_with_retries(cfg, f"c{cid}", merge_system, user)
                usage.update({k: v for k, v in used.items() if isinstance(v, int)})
                latency += ms
            analysis = parse_response(text)
        except ValueError as exc:
            # Un motivo que falla no corta los demás: queda la respuesta cruda para revisarla.
            (out / f"c{cid}.error.txt").write_text(text, encoding="utf-8")
            cost = bench.cost_usd(cfg, dict(usage)) or 0
            print(f"   {exc}; respuesta en c{cid}.error.txt (US${cost:.3f})")
            continue
        usage = dict(usage)
        missing = validate_quotes(analysis, sent, transcripts)
        meta: dict[str, Any] = {
            "criterion_id": cid,
            "criterion_name": of_criterion[0]["criterion_name"],
            "prompt_version": PROMPT_VERSION,
            "model": returned_model,
            "cases_sent": len(sent),
            "requests": len(requests) + (len(requests) > 1),
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
