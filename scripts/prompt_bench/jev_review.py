"""Segunda opinión de Jev (TypeSafe) sobre los motivos que un modelo de la capa 2 marcó en llamadas aprobadas.

Experimento: de las llamadas que el Excel del cliente trae APROBADAS y que el modelo fuente (por defecto Gemini 3.8
Flash) rechazó, toma cada motivo incumplido y le pregunta a Jev, contra la transcripción, si de verdad incumple.
Como el auditor del cliente aprobó la llamada, lo esperado es que Jev diga que no (salvo que la auditoría manual de
Johannes, revision_capa2.csv, haya rechazado la llamada).

Uso:
    python scripts/prompt_bench/jev_review.py --run-dir ../transcripts/layer2_real_100_v2.8
        [--source gemini-3-8-flash] [--models jev-1.13.0,jev-preview] [--langs es,en] [--modes blind,finding]
        [--env ../call-audit/.env] [--workers 8] [--only list|run|report] [--force]

Variantes (una carpeta por combinación en <run-dir>/jev/<source>/<model>/<lang>_<mode>/):
    lang   es: instrucciones en español · en: instrucciones en inglés. La llamada (estado) va siempre en español.
    mode   blind: solo el criterio · finding: el criterio más el comentario y la evidencia del modelo fuente.
    qtype  noul (default): sí/no, devuelve p(incumple) · choice: incumple / cumple / no_aplica, devuelve la opción,
           una probabilidad por opción y la confianza de Jev. Va en <lang>_<mode>_choice/ y en el reporte como
           modo "<mode>_choice" (ej. --modes blind_choice,finding_choice).
           minimal: una petición por llamada con todos sus motivos; cada uno es solo «Motivo N: <nombre oficial>.
           ¿Ocurre esto en la llamada?» con opciones ocurre / no_ocurre sin descripción. Ignora --modes al correr;
           va en <lang>_minimal/ y en el reporte como modo "minimal".

Lee la key de JEV_API_KEY (o TYPESAFE_API_KEY) desde --env. El estado es el mismo prompt de usuario que recibió el
modelo fuente (prompts/<stem>.txt), ya anonimizado por real_calls.py build. Todo queda fuera del repo.
"""

import argparse
import csv
import html
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import real_calls  # noqa: E402
import run as bench  # noqa: E402

BENCH_DIR = Path(__file__).resolve().parent
QUESTIONS = BENCH_DIR / "jev_questions.yaml"
DEFAULT_ENV = bench.ROOT.parent / "call-audit" / ".env"
# Motivo 1 sale del código (silencios), no del LLM: Jev no tiene cómo medir una espera.
SKIP_CRITERIA = {1}
# Precio de entrada de Jev (USD por millón de tokens; la salida no se cobra), verificado el 2026-10-20 en
# https://flaviocopes.com/jev/ (guía de terceros). Confirmar en la consola de TypeSafe antes de presupuestar.
PRICE_INPUT_PER_MTOK = 0.042
THRESHOLD = 0.5


def load_key(env_path: Path) -> str:
    if env_path.exists():
        bench.load_dotenv(env_path)
    key = os.environ.get("JEV_API_KEY") or os.environ.get("TYPESAFE_API_KEY")
    if not key:
        sys.exit(f"Falta JEV_API_KEY en {env_path} o en el entorno")
    return key


def load_manual_review(run_dir: Path) -> dict[str, dict]:
    """Auditoría manual de Johannes (veredicto y nota por llamada), si está en alguna corrida hermana."""
    for path in sorted(run_dir.parent.glob("*/revision_capa2.csv")):
        with path.open(encoding="utf-8-sig", newline="") as f:
            return {row["stem"]: row for row in csv.DictReader(f)}
    return {}


def select_pairs(run_dir: Path, source: str) -> list[dict]:
    """(llamada, motivo) que el modelo fuente marcó incumplido en llamadas que el Excel aprobó."""
    pairs = []
    for call_path in sorted((run_dir / "calls").glob("*.json")):
        call = json.loads(call_path.read_text(encoding="utf-8"))
        if call["expected"]["call_verdict"] != "APROBADA":
            continue
        stem = call_path.stem
        result = run_dir / "results" / source / f"{stem}.json"
        if not result.exists():
            continue
        audit = bench.extract_audit(result.read_text(encoding="utf-8"))
        options = real_calls.verdict_options(argparse.Namespace(verdict="severity"), run_dir, stem)
        verdict, bad, _ = real_calls.verdict(audit, set(call["expected"].get("unevaluable") or []), **options)
        if verdict != "RECHAZADA":
            continue
        for criterion in bad:
            if criterion in SKIP_CRITERIA:
                continue
            items = [c for c in audit.get("criterios", []) if c.get("id") == criterion and c.get("estado") == "incumple"]
            pairs.append({
                "stem": stem,
                "criterion": criterion,
                "comment": " | ".join(c.get("comentario", "") for c in items),
                "evidence": [e for c in items for e in c.get("evidencia") or []],
                "other_bad": [b for b in bad if b != criterion],
            })
    return pairs


def build_question(q: dict, pair: dict, lang: str, mode: str, qtype: str = "noul"):
    from typesafe_sdk import Choice, Noul

    parts = [q["intro"][lang], q["criteria"][pair["criterion"]][lang]]
    if mode == "finding":
        evidence = "; ".join(f"[{e.get('t', '')}] {e.get('hablante', '')}: «{e.get('cita', '')}»" for e in pair["evidence"])
        parts.append(q["finding"][lang].format(comment=pair["comment"], evidence=evidence or "-"))
    parts.append(q["question_choice" if qtype == "choice" else "question"][lang])
    instructions = "\n\n".join(" ".join(p.split()) for p in parts)
    if qtype == "choice":
        return instructions, Choice(instructions=instructions, criteria=dict(q["choice_options"][lang]))
    return instructions, Noul(instructions=instructions, criteria=dict(q["outcomes"][lang]))


def out_path(run_dir: Path, source: str, model: str, lang: str, mode: str, pair: dict, qtype: str = "noul") -> Path:
    folder = f"{lang}_{mode}" + ("_choice" if qtype == "choice" else "")
    return run_dir / "jev" / source / model / folder / f"{pair['stem']}_M{pair['criterion']}.json"


def run_one(client, q: dict, run_dir: Path, source: str, model: str, lang: str, mode: str, pair: dict, force: bool,
            qtype: str = "noul") -> str:
    path = out_path(run_dir, source, model, lang, mode, pair, qtype)
    if path.exists() and not force:
        return "ya existe"
    state = (run_dir / "prompts" / f"{pair['stem']}.txt").read_text(encoding="utf-8")
    instructions, question = build_question(q, pair, lang, mode, qtype)
    started = time.perf_counter()
    try:
        response = client.system_one(state=state, questions={"violation": question}, model=model)
    except Exception as exc:  # noqa: BLE001 - se registra y se sigue con el resto
        path.parent.mkdir(parents=True, exist_ok=True)
        path.with_suffix(".error.txt").write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
        return f"ERROR {type(exc).__name__}: {str(exc)[:150]}"
    latency_ms = int((time.perf_counter() - started) * 1000)
    answer = response.answers["violation"]
    input_tokens = response.usage.input_tokens or 0
    if qtype == "choice":
        # Decide la opción más probable; "no_aplica" también revierte el rechazo del modelo fuente.
        probs = dict(answer.probabilities)
        extra = {"p_violation": probs.get("incumple"), "choice": answer.choice, "confidence": answer.confidence,
                 "probabilities": probs, "confirms": answer.choice == "incumple"}
        status = f"{answer.choice} (confianza {answer.confidence:.2f})"
    else:
        extra = {"p_violation": answer.noul}
        status = f"p={answer.noul:.2f}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.with_suffix(".error.txt").unlink(missing_ok=True)
    path.write_text(json.dumps({
        "stem": pair["stem"],
        "criterion": pair["criterion"],
        "requested_model": model,
        "returned_model": response.model,
        "lang": lang,
        "mode": mode,
        "qtype": qtype,
        "questions_version": q["version"],
        **extra,
        "instructions": instructions,
        "usage": {"input_tokens": input_tokens, "output_tokens": response.usage.output_tokens or 0},
        "cost_usd": round(input_tokens * PRICE_INPUT_PER_MTOK / 1e6, 6),
        "latency_ms": latency_ms,
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return status


def run_all(args, pairs: list[dict], q: dict) -> None:
    from typesafe_sdk import TypeSafeClient

    key = load_key(Path(args.env))
    tasks = [(m, lang, mode, p) for m in args.models for lang in args.langs for mode in args.modes for p in pairs]
    print(f"{len(tasks)} preguntas a Jev ({len(pairs)} pares × {len(args.models)} modelos × {len(args.langs)} idiomas × {len(args.modes)} modos)")
    with TypeSafeClient(api_key=key) as client:
        def job(task):
            model, lang, mode, pair = task
            status = run_one(client, q, Path(args.run_dir), args.source, model, lang, mode, pair, args.force, args.qtype)
            print(f"   {model} {lang}_{mode} {args.qtype} {pair['stem']} M{pair['criterion']}: {status}")

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            list(pool.map(job, tasks))


def minimal_name(q: dict, criterion: int, lang: str) -> str:
    """Nombre del motivo sin más detalle: el oficial del Excel en español; en inglés, el título de criteria.en."""
    if lang == "es":
        from viewer import CRITERIA

        return CRITERIA[criterion]
    title = " ".join(q["criteria"][criterion]["en"].split()).split(" · ", 1)[1]
    return title.split(". ", 1)[0].rstrip(".")


def run_minimal(args, pairs: list[dict], q: dict) -> None:
    """Una petición por llamada, modelo e idioma, con una pregunta de opciones por motivo."""
    from typesafe_sdk import Choice, TypeSafeClient

    run_dir = Path(args.run_dir)
    by_call: dict[str, list[dict]] = {}
    for p in pairs:
        by_call.setdefault(p["stem"], []).append(p)
    tasks = [(m, lang, stem, ps) for m in args.models for lang in args.langs for stem, ps in by_call.items()]
    print(f"{len(tasks)} peticiones a Jev ({len(by_call)} llamadas × {len(args.models)} modelos × {len(args.langs)} idiomas, "
          f"{len(pairs)} motivos por combinación)")
    m = q["minimal"]
    key = load_key(Path(args.env))
    with TypeSafeClient(api_key=key) as client:
        def job(task):
            model, lang, stem, ps = task
            paths = {p["criterion"]: out_path(run_dir, args.source, model, lang, "minimal", p) for p in ps}
            if all(path.exists() for path in paths.values()) and not args.force:
                print(f"   {model} {lang} {stem}: ya existe")
                return
            opts = m["options"][lang]
            texts = {p["criterion"]: m["question"][lang].format(id=p["criterion"], name=minimal_name(q, p["criterion"], lang)) for p in ps}
            questions = {f"m{c}": Choice(instructions=t, criteria={opts["violation"]: None, opts["ok"]: None}) for c, t in texts.items()}
            state = (run_dir / "prompts" / f"{stem}.txt").read_text(encoding="utf-8")
            started = time.perf_counter()
            try:
                response = client.system_one(state=state, questions=questions, model=model)
            except Exception as exc:  # noqa: BLE001 - se registra y se sigue con el resto
                for path in paths.values():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.with_suffix(".error.txt").write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
                print(f"   {model} {lang} {stem}: ERROR {type(exc).__name__}: {str(exc)[:150]}")
                return
            latency_ms = int((time.perf_counter() - started) * 1000)
            input_tokens = response.usage.input_tokens or 0
            status = []
            for c, path in paths.items():
                a = response.answers[f"m{c}"]
                probs = dict(a.probabilities)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.with_suffix(".error.txt").unlink(missing_ok=True)
                path.write_text(json.dumps({
                    "stem": stem,
                    "criterion": c,
                    "requested_model": model,
                    "returned_model": response.model,
                    "lang": lang,
                    "mode": "minimal",
                    "qtype": "minimal",
                    "questions_version": q["version"],
                    "p_violation": probs.get(opts["violation"]),
                    "choice": a.choice,
                    "confidence": a.confidence,
                    "probabilities": probs,
                    "confirms": a.choice == opts["violation"],
                    "instructions": texts[c],
                    "criteria_sent": [opts["violation"], opts["ok"]],
                    "questions_in_request": len(paths),
                    # La petición es por llamada: tokens, costo y latencia se reparten entre sus motivos.
                    "usage": {"input_tokens": input_tokens, "output_tokens": response.usage.output_tokens or 0},
                    "cost_usd": round(input_tokens * PRICE_INPUT_PER_MTOK / 1e6 / len(paths), 6),
                    "latency_ms": latency_ms,
                    "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }, ensure_ascii=False, indent=2), encoding="utf-8")
                status.append(f"M{c} {a.choice} {a.confidence:.2f}")
            print(f"   {model} {lang} {stem}: {' · '.join(status)}")

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            list(pool.map(job, tasks))


def load_results(run_dir: Path, source: str, pairs: list[dict]) -> dict[tuple, dict]:
    results = {}
    base = run_dir / "jev" / source
    for path in base.glob("*/*/*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        mode = r["mode"] + ("_choice" if r.get("qtype") == "choice" else "")
        results[(r["requested_model"], r["lang"], mode, r["stem"], r["criterion"])] = r
    return results


def report(args, pairs: list[dict]) -> Path:
    run_dir = Path(args.run_dir)
    results = load_results(run_dir, args.source, pairs)
    manual = load_manual_review(run_dir)
    configs = [(m, lang, mode) for m in args.models for lang in args.langs for mode in args.modes]
    configs = [c for c in configs if any((*c, p["stem"], p["criterion"]) in results for p in pairs)]

    def p_of(cfg, pair):
        r = results.get((*cfg, pair["stem"], pair["criterion"]))
        return None if r is None else r["p_violation"]

    def confirms(cfg, pair) -> bool | None:
        """¿Jev confirma el rechazo? Con choice, la opción elegida; con sí/no, p >= umbral."""
        r = results.get((*cfg, pair["stem"], pair["criterion"]))
        return None if r is None else r.get("confirms", r["p_violation"] >= THRESHOLD)

    def expected_violation(pair) -> bool | None:
        """Lo correcto según la referencia: la etiqueta del par en el dashboard (columna motivos_etiquetados) si es Sí
        o No; si no, el Excel aprobó, salvo que la auditoría manual rechace la llamada."""
        row = manual.get(pair["stem"]) or {}
        tags = dict(part.split("=", 1) for part in (row.get("motivos_etiquetados") or "").split(";") if "=" in part)
        tag = tags.get(str(pair["criterion"]), "").split("/")[0]
        if tag in ("si", "no"):
            return tag == "si"
        return row.get("mi_veredicto", "").upper() == "RECHAZADA"

    # Llamadas que se rescatarían: todos sus motivos rechazados por el modelo fuente quedan bajo el umbral en Jev
    # (si la llamada también tiene motivo 1, no se rescata: ese lo decide el código).
    by_call: dict[str, list[dict]] = {}
    for p in pairs:
        by_call.setdefault(p["stem"], []).append(p)

    summary_rows = []
    for cfg in configs:
        ps = [(p, confirms(cfg, p)) for p in pairs]
        answered = [(p, v) for p, v in ps if v is not None]
        overturned = sum(not v for _, v in answered)
        agree_ref = sum(v == expected_violation(p) for p, v in answered)
        rescued = sum(
            all(confirms(cfg, p) is False for p in ps_call) and 1 not in ps_call[0]["other_bad"]
            for ps_call in by_call.values()
        )
        cost = sum(results[(*cfg, p["stem"], p["criterion"])]["cost_usd"] for p, _ in answered)
        lat = [results[(*cfg, p["stem"], p["criterion"])]["latency_ms"] for p, _ in answered]
        summary_rows.append((cfg, len(answered), overturned, agree_ref, rescued, cost, sum(lat) / max(len(lat), 1)))

    head = "".join(f"<th>{html.escape(m)}<br>{lang} · {mode}</th>" for m, lang, mode in configs)
    body = []
    for p in pairs:
        row = manual.get(p["stem"], {})
        cells = []
        for cfg in configs:
            v, conf = p_of(cfg, p), confirms(cfg, p)
            cls = "na" if conf is None else ("bad" if conf else "ok")
            cells.append(f'<td class="num {cls}">{"–" if v is None else f"{v:.2f}"}</td>')
        evidence = "<br>".join(html.escape(f"[{e.get('t', '')}] {e.get('hablante', '')}: {e.get('cita', '')}") for e in p["evidence"])
        body.append(
            f"<tr><td>{p['stem'].removeprefix('call_')}</td><td>M{p['criterion']}</td>"
            f"<td>{html.escape(row.get('mi_veredicto', '') or '—')}</td>"
            f'<td class="txt">{html.escape(p["comment"])}<div class="ev">{evidence}</div></td>{"".join(cells)}</tr>'
        )
    summary = "".join(
        f"<tr><td>{html.escape(m)}</td><td>{lang}</td><td>{mode}</td><td class='num'>{n}</td>"
        f"<td class='num'>{o} ({o / max(n, 1):.0%})</td><td class='num'>{a} ({a / max(n, 1):.0%})</td>"
        f"<td class='num'>{r} / {len(by_call)}</td><td class='num'>{c:.4f}</td><td class='num'>{lt / 1000:.1f} s</td></tr>"
        for (m, lang, mode), n, o, a, r, c, lt in summary_rows
    )
    page = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev · segunda opinión</title><style>
:root{{--bg:#fbfaf8;--fg:#1d1d1b;--muted:#6b6a66;--line:#e6e3dd;--ok:#e6f4ea;--okf:#14532d;--bad:#fdecec;--badf:#7f1d1d}}
@media (prefers-color-scheme:dark){{:root{{--bg:#161614;--fg:#e8e6e1;--muted:#9a978f;--line:#2c2b28;--ok:#16301f;--okf:#b7e4c4;--bad:#3a1a1a;--badf:#f3b9b9}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,"Segoe UI",sans-serif}}
main{{max-width:1400px;margin:0 auto;padding:24px 16px}} h1{{font-size:21px;margin:0 0 4px}} h2{{font-size:16px;margin:28px 0 8px}}
p{{color:var(--muted);margin:4px 0}} .scroll{{overflow-x:auto}}
table{{border-collapse:collapse;width:100%}} th,td{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}}
th{{font-size:12px;color:var(--muted);font-weight:600}} .num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
td.ok{{background:var(--ok);color:var(--okf)}} td.bad{{background:var(--bad);color:var(--badf)}} td.na{{color:var(--muted)}}
.txt{{max-width:520px}} .ev{{color:var(--muted);font-size:12px;margin-top:4px}}
</style></head><body><main>
<h1>Jev · segunda opinión sobre los rechazos de {html.escape(args.source)}</h1>
<p>{run_dir.name} · llamadas APROBADAS en el Excel y RECHAZADAS por {html.escape(args.source)} · {len(pairs)} pares llamada-motivo en {len(by_call)} llamadas (sin motivo 1, que sale del código).</p>
<p>Cada celda es la probabilidad de incumplimiento que da Jev; ≥ {THRESHOLD} (rojo) confirma el rechazo, &lt; {THRESHOLD} (verde) lo revierte.
Lo esperado es revertir: el auditor del cliente aprobó. Excepción: llamadas que la auditoría manual (columna “Manual”) rechazó.</p>
<h2>Resumen por variante</h2><div class="scroll"><table>
<tr><th>Modelo</th><th>Idioma</th><th>Modo</th><th>Pares</th><th>Revierte</th><th>Coincide con la referencia</th><th>Llamadas rescatadas</th><th>Costo USD</th><th>Latencia prom.</th></tr>
{summary}</table></div>
<p>“Coincide con la referencia”: usa tu etiqueta del motivo en el dashboard (Sí / No) cuando existe; si no, revierte si la auditoría manual no rechazó la llamada y confirma si la rechazó. “Llamadas rescatadas”: todos sus motivos quedan bajo el umbral y no tiene motivo 1.</p>
<h2>Detalle</h2><div class="scroll"><table>
<tr><th>Llamada</th><th>Motivo</th><th>Manual</th><th>Hallazgo de {html.escape(args.source)}</th>{head}</tr>
{"".join(body)}</table></div>
</main></body></html>"""
    out = run_dir / "jev" / args.source / "report.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"Reporte: {out}")
    for (m, lang, mode), n, o, a, r, c, lt in summary_rows:
        print(f"   {m:12} {lang}_{mode:8} pares {n:3} · revierte {o:3} · coincide ref {a:3} · rescata {r}/{len(by_call)} · {c:.4f} USD · {lt / 1000:.1f} s")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run-dir", required=True, help="corrida de real_calls.py, ej. ../transcripts/layer2_real_100_v2.8")
    parser.add_argument("--source", default="gemini-3-8-flash", help="modelo cuyos rechazos revisa Jev")
    parser.add_argument("--models", default="jev-1.13.0", help="modelos de Jev separados por coma (jev-1.13.0, jev-preview, ...)")
    parser.add_argument("--langs", default="es,en")
    parser.add_argument("--modes", default="blind,finding", help="en el reporte: blind_choice, finding_choice para qtype choice")
    parser.add_argument("--qtype", choices=["noul", "choice", "minimal"], default="noul", help="tipo de pregunta al correr (run)")
    parser.add_argument("--env", default=str(DEFAULT_ENV), help="archivo .env con JEV_API_KEY")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--only", choices=["list", "run", "report"])
    parser.add_argument("--force", action="store_true", help="repetir aunque ya exista el resultado")
    args = parser.parse_args()
    for name in ("models", "langs", "modes"):
        setattr(args, name, [x.strip() for x in getattr(args, name).split(",") if x.strip()])

    q = yaml.safe_load(QUESTIONS.read_text(encoding="utf-8"))
    pairs = select_pairs(Path(args.run_dir), args.source)
    missing = sorted({p["criterion"] for p in pairs} - set(q["criteria"]))
    if missing:
        sys.exit(f"Faltan preguntas para los motivos {missing} en {QUESTIONS.name}")
    if args.only in (None, "list"):
        print(f"{len(pairs)} pares en {len({p['stem'] for p in pairs})} llamadas")
        for p in pairs:
            print(f"   {p['stem']} M{p['criterion']}")
    if args.only in (None, "run"):
        (run_minimal if args.qtype == "minimal" else run_all)(args, pairs, q)
    if args.only in (None, "report"):
        report(args, pairs)


if __name__ == "__main__":
    main()
