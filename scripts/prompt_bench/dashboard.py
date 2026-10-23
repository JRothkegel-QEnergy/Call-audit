"""Dashboard local para revisar la validación de capa 2 sobre llamadas reales, una por una y en conjunto.

Uso:
    python scripts/prompt_bench/dashboard.py --out <carpeta de real_calls.py> --metadata XLSX --audios DIR
        [--compare "v2.4=<carpeta de resultados anterior>"] [--label v2.6]

Escribe <out>/dashboard.html. Referencia los audios por ruta relativa: ábrelo con el servidor local
(python call-audit/scripts/prompt_bench/review_server.py desde "Qubico Develop") para poder escuchar y saltar a
cualquier punto. Con ese servidor, "Mi revisión" se guarda sola en <out>/revision_capa2.csv; con python -m
http.server queda solo en el navegador y se exporta a mano.
Contiene datos reales: no se publica ni se commitea.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import real_calls  # noqa: E402
import run as bench  # noqa: E402
from viewer import CRITERIA  # noqa: E402

LABELS = {
    "gemini-3-8-flash": "Gemini 3.8 Flash",
    "gpt-6-luna": "GPT-6 Luna",
    "claude-sonnet-5-5": "Sonnet 5.5",
    "claude-haiku-5-5": "Haiku 5.5",
    "or-gemini-3-8-flash": "Gemini 3.8 Flash (OR)",
    "or-deepseek-v4-1-flash": "DeepSeek V4.1 Flash",
}
# Color fijo por modelo (la identidad no cambia si se filtra).
ORDER = ["gemini-3-8-flash", "gpt-6-luna", "claude-sonnet-5-5", "claude-haiku-5-5", "or-gemini-3-8-flash", "or-deepseek-v4-1-flash"]


def client_bad(row: dict) -> list[int] | None:
    """Criterios que el auditor del cliente marcó NO CUMPLE: las 33 columnas que siguen a RETENIBLE, en el orden de la
    pauta (C01..C33). None si el Excel no las trae."""
    keys = list(row)
    if "RETENIBLE" not in keys:
        return None
    cols = keys[keys.index("RETENIBLE") + 1:][:len(CRITERIA)]
    if len(cols) < len(CRITERIA):
        return None
    return [i for i, k in enumerate(cols, 1) if real_calls.clean(row[k]).upper() == "NO CUMPLE"]


def read_result(results: Path, model: str, stem: str, row: dict, full: bool, options: dict) -> dict:
    out = results / model / f"{stem}.json"
    meta_path = results / model / f"{stem}.meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    item = {"cost": meta.get("cost_usd"), "latency": meta.get("latency_ms")}
    if not out.exists():
        err = results / model / f"{stem}.error.txt"
        item["verdict"] = "ERROR" if err.exists() else None
        return item
    try:
        audit = bench.extract_audit(out.read_text(encoding="utf-8"))
    except ValueError as exc:
        item.update(verdict="ERROR", error=str(exc))
        return item
    v, bad, unsure = real_calls.verdict(audit, real_calls.unevaluable_for(row), **options)
    info = audit.get("informacion_seguro") or {}
    item.update(verdict=v, bad=bad, unsure=unsure, info=info.get("estado"),
                minor_only=real_calls.minor_only(bad, options.get("minor", set())))
    if full:
        item["audit"] = {
            "resumen": audit.get("resumen"),
            "informacion_seguro": info,
            "gestiones": audit.get("gestiones"),
            "criterios": audit.get("criterios"),
        }
    return item


# Segunda opinión de Jev (jev_review.py). Variante principal y orden de las variantes en la vista: ciego antes que con
# hallazgo, y dentro de cada modo Jev 1.13 antes que 1.14, español antes que inglés. Spec:
# docs/ux/calce-ia-vs-humano/jev-segunda-opinion/07-especificacion.md (D-J3, D-J7, D-J8).
JEV_MAIN = "jev-1.13.0|es|blind|choice"  # D-J7
JEV_LOW_CONF = 0.5  # D-J8: "decisión poco segura" bajo esta confianza (pregunta de opciones)
JEV_MODEL_LABELS = {"jev-1.13.0": "Jev 1.13", "jev-1.14.0": "Jev 1.14", "jev-preview": "Jev 1.14 preview"}


def jev_data(run_dir: Path, source: str, version: str) -> dict | None:
    """D.jev para el dashboard: respuesta de Jev por llamada, motivo y variante, más las instrucciones enviadas.
    None si no hay corrida. Contrato: docs/ux/calce-ia-vs-humano/jev-segunda-opinion/07-especificacion.md §9.2."""
    import jev_review
    import yaml

    base = run_dir / "jev" / source
    if not base.is_dir():
        return None
    pairs = jev_review.select_pairs(run_dir, source)
    # La pregunta mínima (--qtype minimal) todavía no tiene diseño en el dashboard: se deja fuera.
    results = {k: r for k, r in jev_review.load_results(run_dir, source, pairs).items() if r.get("qtype") != "minimal"}
    if not results:
        return None

    def split(mode_key: str) -> tuple[str, str]:
        """load_results guarda "blind_choice" para la pregunta de opciones: (modo, tipo)."""
        return (mode_key.removesuffix("_choice"), "choice") if mode_key.endswith("_choice") else (mode_key, "yesno")

    def vkey(model: str, lang: str, mode_key: str) -> str:
        mode, qtype = split(mode_key)
        return f"{model}|{lang}|{mode}|{qtype}"

    combos = {(m, lang, mo) for m, lang, mo, _, _ in results}
    # Orden: ciego antes que con hallazgo, opciones antes que sí/no, Jev 1.13 antes que 1.14, español antes que inglés.
    combos = sorted(combos, key=lambda k: (split(k[2])[0] != "blind", split(k[2])[1] != "choice", k[0], k[1] != "es"))
    variants = []
    for model, lang, mode_key in combos:
        rs = [r for (m, la, mo, _, _), r in results.items() if (m, la, mo) == (model, lang, mode_key)]
        mode, qtype = split(mode_key)
        variants.append({
            "key": vkey(model, lang, mode_key),
            "model": JEV_MODEL_LABELS.get(model, model),
            "lang": lang,
            "mode": mode,
            "type": qtype,
            "cost_usd": round(sum(r["cost_usd"] for r in rs), 6),
            "latency_ms": round(sum(r["latency_ms"] for r in rs) / len(rs)),
        })

    # Las instrucciones no dependen del modelo de Jev; si alguna vez difieren, la clave lleva el modelo delante.
    texts: dict[tuple, dict[str, str]] = {}
    for (model, lang, mode_key, stem, crit), r in results.items():
        mode, qtype = split(mode_key)
        texts.setdefault((stem, crit, qtype, lang, mode), {})[model] = r.get("instructions", "")
    by_model = any(len(set(t.values())) > 1 for t in texts.values())

    out_pairs: dict[str, dict] = {}
    prompts: dict[str, dict] = {}
    calls: dict[str, dict] = {}
    for p in pairs:
        cells = {}
        for model, lang, mode_key in combos:
            r = results.get((model, lang, mode_key, p["stem"], p["criterion"]))
            if r is None:
                cell = None
            elif r.get("qtype") == "choice":
                cell = {"choice": r["choice"], "conf": r["confidence"], "probs": r["probabilities"]}
            else:
                cell = {"p": r["p_violation"]}
            cells[vkey(model, lang, mode_key)] = cell
        out_pairs.setdefault(p["stem"], {})[str(p["criterion"])] = cells
        texts_pair = {}
        for (stem, crit, qtype, lang, mode), per_model in texts.items():
            if (stem, crit) != (p["stem"], p["criterion"]):
                continue
            if by_model:
                texts_pair.update({f"{JEV_MODEL_LABELS.get(m, m)}|{qtype}|{lang}|{mode}": t for m, t in per_model.items()})
            else:
                texts_pair[f"{qtype}|{lang}|{mode}"] = next(iter(per_model.values()))
        prompts.setdefault(p["stem"], {})[str(p["criterion"])] = texts_pair
        # Todos los motivos incumplidos del modelo fuente en la llamada (incluido el 1), para la regla de rescate.
        calls[p["stem"]] = {"bad": sorted({p["criterion"], *p["other_bad"]})}

    q = yaml.safe_load(jev_review.QUESTIONS.read_text(encoding="utf-8"))
    main = JEV_MAIN if any(v["key"] == JEV_MAIN for v in variants) else variants[0]["key"]
    return {
        "source": source,
        "version": version,
        "threshold": jev_review.THRESHOLD,
        "near": [0.4, 0.6],
        "low_conf": JEV_LOW_CONF,
        "main": main,
        "variants": variants,
        "models": sorted({v["model"] for v in variants}),
        "calls": calls,
        "pairs": out_pairs,
        "prompts": prompts,
        "prompts_by_model": by_model,
        "options": {lang: [{"id": k, "desc": v} for k, v in opts.items()] for lang, opts in q.get("choice_options", {}).items()},
        "outcomes": {lang: [{"id": k, "desc": v} for k, v in opts.items()] for lang, opts in q.get("outcomes", {}).items()},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--audios", type=Path, required=True)
    parser.add_argument("--label", default="actual")
    parser.add_argument("--compare", action="append", default=[], help='"etiqueta=carpeta_resultados"')
    parser.add_argument("--verdict", choices=["severity", "v2.6"], default="severity")
    parser.add_argument("--jev-source", default="gemini-3-8-flash",
                        help="modelo cuyos rechazos revisó Jev (lee <out>/jev/<source>, de jev_review.py)")
    args = parser.parse_args()

    rows = real_calls.load_rows(args.metadata)
    results = args.out / "results"
    versions = [(args.label, results, True)] + [
        (label, Path(path), False) for label, path in (c.split("=", 1) for c in args.compare)
    ]
    # Los modelos de todas las versiones: si la actual corrió con menos modelos, las anteriores no pierden los suyos.
    found = {d.name for _, res_dir, _ in versions for d in res_dir.iterdir() if d.is_dir() and d.name != "viewer.html"}
    models = sorted(found, key=lambda m: ORDER.index(m) if m in ORDER else 99)

    calls = []
    for path in sorted((args.out / "calls").glob("call_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        recording = call["audio_href"].split("/")[-2]
        row = rows[recording]
        ficha = re.search(r"ficha: (\S+)", call["description"])
        entry = {
            "stem": path.stem,
            "id": call["call_id"],
            "recording": recording,
            "audio": Path(os.path.relpath((args.audios / f"{recording}.mp3").resolve(), args.out.resolve())).as_posix(),
            "asr_viewer": f"../asr_bench/{recording}/viewer.html",
            "date": call["metadata"]["date"],
            "minutes": round(call["metadata"]["duration_sec"] / 60, 1),
            "agent": real_calls.clean(row.get("EJECUTIVO")),
            "real": real_calls.clean(row["ESTADO_CALIDAD"]).upper(),
            "reason": real_calls.clean(row["MOTIVO RENUNCIA"]),
            "comment": real_calls.clean(row.get("COMENTARIO")),
            "insurance": real_calls.clean(row["NOMBRE_DEL_SEGURO"]),
            "plan": real_calls.clean(row.get("PLAN")),
            "ficha": ficha.group(1) if ficha else None,
            "typification": real_calls.clean(row.get("TIPIFICACION")),
            "holds": call["metadata"]["holds_sec"],
            "unevaluable": sorted(real_calls.unevaluable_for(row)),
            "client_bad": client_bad(row),
            "transcript": [[t["start_ms"] // 1000, t["channel"], t["text"]] for t in call["transcript"]],
            "results": {},
        }
        options = {} if args.verdict == "v2.6" else {"holds": call["metadata"]["holds_sec"], "minor": real_calls.MINOR_CRITERIA}
        for label, res_dir, full in versions:
            entry["results"][label] = {
                m: read_result(res_dir, m, path.stem, row, full, options) for m in models if (res_dir / m).exists()
            }
        calls.append(entry)

    data = {
        "versions": [v[0] for v in versions],
        "models": models,
        "labels": {m: LABELS.get(m, m) for m in models},
        "criteria": CRITERIA,
        "minor": [] if args.verdict == "v2.6" else sorted(real_calls.MINOR_CRITERIA),
        # Con --verdict severity, el motivo 1 (esperas) lo calcula el código: es igual en todos los modelos.
        "hold_by_code": args.verdict != "v2.6",
        "calls": calls,
        "monthly_calls": real_calls.MONTHLY_CALLS,
    }
    jev = jev_data(args.out, args.jev_source, args.label)
    if jev:
        data["jev"] = jev
    template = (Path(__file__).parent / "dashboard_template.html").read_text(encoding="utf-8")
    page = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = args.out / "dashboard.html"
    out.write_text(page, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
