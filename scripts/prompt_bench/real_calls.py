"""Corre el prompt de la capa 2 sobre llamadas REALES transcritas con el benchmark de ASR.

Uso:
    python scripts/prompt_bench/real_calls.py --metadata XLSX --asr-dir DIR [--names-file F] [--out DIR]
        [--models a,b] [--asr-model openrouter_gemini-3.8-flash] [--workers 12] [--only build|run|report]

Pasos:
    build   arma una llamada por grabación con la metadata del Excel y la transcripción del ASR,
            ANONIMIZADA (RUT, teléfono, correo, nombre del cliente, año de nacimiento), y renderiza los prompts.
    run     corre cada modelo de models.toml (mismo run_one que el bench sintético).
    report  compara el veredicto de cada IA con ESTADO_CALIDAD y escribe report.html con costos.

Todo queda en --out, FUERA del repo (contiene datos reales). Los archivos se nombran con el ID de la gestión,
no con el RUT.
"""

import argparse
import json
import re
import subprocess
import sys
import tomllib
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog_match  # noqa: E402
import render  # noqa: E402
import run as bench  # noqa: E402
from viewer import CRITERIA  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT.parent / "transcripts" / "layer2_real"
DEFAULT_MODELS = ["claude-haiku-5-5", "gpt-6-luna", "gemini-3-8-flash", "claude-sonnet-5-5"]

# Si el Excel no trae la columna TIPIFICACION, estos motivos no se pueden evaluar: no cuentan para el veredicto.
# El 18 (motivo de renuncia incorrecto) sí se evalúa: el Excel trae el motivo tipificado.
UNEVALUABLE = set(range(19, 26))


def unevaluable_for(row: dict) -> set[int]:
    return set() if clean(row.get("TIPIFICACION")) else UNEVALUABLE
SPEAKERS = {"EJECUTIVO": "AGENTE", "CLIENTE": "CLIENTE"}
MIN_GAP_SEC = 10
# Volumen de referencia (docs/context.md) para proyectar el costo mensual.
MONTHLY_CALLS = 100_000


# --- Anonimización -----------------------------------------------------------------


def norm(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().upper()


class Anonymizer:
    """Enmascara PII del cliente en el texto. Mantiene montos, número de póliza y MUS (los necesita la pauta)."""

    EMAIL = re.compile(r"[\w.\-]+\s*(?:@|\barroba\b)\s*[\w\-]+(?:\s*(?:\.|\bpunto\b)\s*[a-z]{2,4})+", re.I)
    EMAIL_FRAGMENT = re.compile(r"\S*@\S*")
    # Desde 5 dígitos: los RUT y teléfonos se dictan en grupos ("60 23 0 86 - 2").
    DIGITS = re.compile(r"(?<![\w$])\+?\d(?:[\s.\-]{0,3}\d){4,}(?:\s*-\s*[\dkK]\b)?")

    def __init__(self, row: dict):
        self.keep = {re.sub(r"\D", "", str(row.get(k) or "")) for k in ("NUM_POLIZA", "NUM_MUS_ANETO")} - {""}
        self.rut = re.sub(r"\D", "", str(row.get("RUT") or ""))
        self.phone = re.sub(r"\D", "", str(row.get("FONO_CONTACTO") or ""))[-8:]
        tokens = " ".join(str(row.get(k) or "") for k in ("NOMBRE", "PATERNO", "MATENRO")).split()
        self.name_prefixes = {
            norm(t)[: max(4, len(t) - 1)] for t in tokens if len(t) >= 4 and norm(t) not in ("SINAPELLIDO", "DELOS", "DELAS")
        }
        birth = row.get("FECHA_NACIMIENTO")
        self.birth_year = str(birth.year) if birth else None

    def _digits(self, match: re.Match) -> str:
        digits = re.sub(r"\D", "", match.group())
        # Póliza y MUS los necesita la pauta; los 600 son fonos corporativos (Fono Seguros), no del cliente.
        if digits in self.keep or any(k.endswith(digits) for k in self.keep) or digits.startswith("600"):
            return match.group()
        if self.rut and (digits.startswith(self.rut) or digits in self.rut or digits[:-1] in self.rut):
            return "[RUT]"
        if self.phone and (self.phone in digits or digits in self.phone):
            return "[TELEFONO]"
        # Montos ($41.000.000 pesos, UF) y números de 5 a 7 dígitos sin relación con el cliente se dejan.
        after = match.string[match.end() : match.end() + 8].lower()
        if len(digits) < 8 or "peso" in after or re.match(r"\s*uf\b", after):
            return match.group()
        return "[NUMERO]"

    def _word(self, match: re.Match) -> str:
        word = norm(match.group())
        return "[NOMBRE_CLIENTE]" if any(word.startswith(p) for p in self.name_prefixes) else match.group()

    def __call__(self, text: str) -> str:
        text = self.EMAIL.sub("[EMAIL]", text)
        text = self.EMAIL_FRAGMENT.sub("[EMAIL]", text)
        text = self.DIGITS.sub(self._digits, text)
        if self.birth_year:
            text = re.sub(rf"\b{self.birth_year}\b", "[AÑO_NACIMIENTO]", text)
        return re.sub(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}", self._word, text)


# --- Build ---------------------------------------------------------------------------


def parse_ts(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    secs = 0.0
    for part in str(value).strip().split(":"):
        secs = secs * 60 + float(part)
    return secs


def fmt(sec: float) -> str:
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}"


def load_rows(xlsx: Path) -> dict[str, dict]:
    import openpyxl

    rows = openpyxl.load_workbook(xlsx, read_only=True).active.iter_rows(values_only=True)
    header = next(rows)
    return {r[0]: dict(zip(header, r)) for r in rows if r[0]}


def clean(value) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").split())


def patch_catalog(row: dict) -> tuple[str | None, float, str]:
    """render.find_product busca por "Nombre en sistema" y corta el proceso si no lo encuentra. La metadata real trae
    el nombre de producto: se busca con catalog_match (nombre en sistema, n° de póliza, nombre y plan, compañía).
    Si no hay match, va una ficha vacía con la categoría del Excel."""
    found, match_score, how = catalog_match.match_row(row, render.load_catalog())

    def find_product(name: str, catalog: dict) -> dict:
        if found:
            return found
        retainable = clean(row.get("RETENIBLE")).upper() == "SI" and clean(row.get("RENUNCIABLE")).upper() == "SI"
        return {
            "id": None,
            "name": "sin ficha en el catálogo",
            "insurer": next((clean(v) for k, v in row.items() if k and catalog_match.normalize(k).startswith("COMPA")), ""),
            "category": "RETENIBLE" if retainable else "NO_RETENIBLE",
            "premium_type": "sin_dato",
        }

    render.find_product = find_product
    return (found or {}).get("id"), match_score, how


def premium_text(value) -> str:
    """El Excel trae la prima en UF (0,6528) y a veces en pesos (5990)."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return clean(value)
    return f"UF {number:g}".replace(".", ",") if number < 50 else f"${number:,.0f}".replace(",", ".")


WORDS_PER_SEC = 3.0  # habla rápida; si se subestima el tiempo de habla, aparecen esperas falsas
# El cliente que rompe el silencio para ver si lo siguen atendiendo también estaba esperando al ejecutivo.
CHECK_IN = re.compile(r"^\W*(eh\W+)?(al[oó]|hola|sigue ah[ií]|est[aá] ah[ií]|me escucha|se[nñ]orita|se[nñ]or)\b", re.I)


def executive_holds(segments: list[dict]) -> list[int]:
    """Esperas en que el CLIENTE espera al EJECUTIVO (motivo 1): silencios >= MIN_GAP_SEC entre segmentos que terminan
    cuando vuelve a hablar el ejecutivo, o cuando el cliente pregunta si lo siguen atendiendo ("¿aló?"). Si el que se
    demora es el cliente (busca un dato, piensa) y retoma con contenido, no cuenta: el que espera es el ejecutivo."""
    return [round(end - start) for start, end, _ in executive_hold_spans(segments)]


def executive_hold_spans(segments: list[dict]) -> list[tuple[float, float, int]]:
    """Las mismas esperas de executive_holds, con su posición: (inicio s, fin s, índice del segmento que la termina)."""
    spans = []
    for i, (cur, nxt) in enumerate(zip(segments, segments[1:])):
        if not cur.get("end"):
            continue
        # El ASR a veces marca el fin de un monólogo largo igual a su inicio: se estima un fin mínimo por largo.
        end = max(parse_ts(cur["end"]), parse_ts(cur["start"]) + len(str(cur.get("text", "")).split()) / WORDS_PER_SEC)
        gap = parse_ts(nxt["start"]) - end
        if gap < MIN_GAP_SEC:
            continue
        speaker = SPEAKERS.get(str(nxt.get("speaker", "")).upper(), "OTRO")
        text = str(nxt.get("text", "")).strip()
        if speaker == "AGENTE" or (speaker == "CLIENTE" and CHECK_IN.match(text) and len(text.split()) <= 8):
            spans.append((end, parse_ts(nxt["start"]), i + 1))
    return spans


def update_holds(args, index: list[dict]) -> None:
    """Recalcula holds_sec en calls/*.json con la regla vigente, sin tocar los prompts ya enviados."""
    for c in index:
        path = args.out / "calls" / f"{c['stem']}.json"
        call = json.loads(path.read_text(encoding="utf-8"))
        segments = json.loads((args.asr_dir / c["recording"] / f"{args.asr_model}.json").read_text(encoding="utf-8"))["segments"]
        old, call["metadata"]["holds_sec"] = call["metadata"]["holds_sec"], executive_holds(segments)
        if old != call["metadata"]["holds_sec"]:
            print(f"{c['stem']}: {old} -> {call['metadata']['holds_sec']}")
        path.write_text(json.dumps(call, ensure_ascii=False, indent=1), encoding="utf-8")


def build_call(
    name: str, row: dict, asr_json: Path, audio_seconds: float, catalog: dict, templates, anonymize: bool
) -> tuple[dict, str]:
    anon = Anonymizer(row) if anonymize else (lambda text: text)
    typified = clean(row.get("TIPIFICACION")).upper()
    segments = json.loads(asr_json.read_text(encoding="utf-8"))["segments"]
    lines, holds, turns = [], [], []
    for i, s in enumerate(segments):
        speaker = SPEAKERS.get(str(s.get("speaker", "")).upper(), "OTRO")
        text = anon(str(s["text"]).strip())
        lines.append(f"[{fmt(parse_ts(s['start']))}] {speaker}: {text}")
        channel = {"AGENTE": "agent", "CLIENTE": "customer"}.get(speaker, "other")
        turns.append({"channel": channel, "start_ms": int(parse_ts(s["start"]) * 1000), "text": text})
    holds = executive_holds(segments)

    mus = clean(row["NUM_MUS_ANETO"])
    start = row.get("FECHA_VENTA_SEGURO")
    call = {
        "call_id": str(row["ID"]),
        "metadata": {
            "date": row["FECHA_GESTION"].date().isoformat(),
            "agent_id": "EJ-" + str(row["ID"]),
            "duration_sec": round(audio_seconds),
            "holds_sec": holds,
            "policies": [
                {
                    "name": clean(row["NOMBRE_DEL_SEGURO"]),
                    "mus_a_neto": mus,
                    "policy_number": clean(row.get("NUM_POLIZA")),
                    "start_date": start.date().isoformat() if start else None,
                    "payment_method": clean(row.get("CUENTA_DE_CARGO")) or "OTRO",
                    # Datos del contrato del cliente: el ejecutivo los lee del sistema y pueden diferir de la ficha.
                    "plan": clean(row.get("PLAN")),
                    "premium": premium_text(row.get("PRIMA_SEGURO")),
                    "periodicity": clean(row.get("PERIODO")).lower(),
                    "insured_amount": clean(row.get("MONTO_ASEGURADO")),
                }
            ],
            "typification": [{"mus_a_neto": mus, "outcome": typified or "NO INFORMADA", "reason": clean(row["MOTIVO RENUNCIA"])}],
        },
        "transcript": [],
    }
    product_id, match_score, match_how = patch_catalog(row)
    user = render.render_user_message(call, catalog, templates)
    if not typified:
        user = user.replace(
            "## Tipificación registrada por el ejecutivo\n",
            "## Tipificación registrada por el ejecutivo\n"
            "(La gestión tipificada no viene en los metadatos de esta llamada; solo se conoce el motivo de renuncia "
            "tipificado. Los motivos 19 a 25 evalúalos como indeterminado.)\n",
        )
    header = "## Transcripción (canal separado, timestamps mm:ss)\n"
    user = user.replace(
        header,
        "## Transcripción (audio mono: hablantes separados por IA; timestamps mm:ss aproximados"
        + ("; datos personales del cliente enmascarados entre corchetes" if anonymize else "")
        + ")\n"
        + "\n".join(lines)
        + "\n",
    )
    # Formato de tests/fixtures/calls para viewer.py; expected.findings = None: el Excel no trae motivos.
    call.update(
        title=f"{clean(row['NOMBRE_DEL_SEGURO'])} · Excel: {clean(row['ESTADO_CALIDAD']).upper()}",
        description=f"{round(audio_seconds / 60, 1)} min · ficha: {product_id or 'sin ficha'} ({match_how}, {match_score:.2f})"
        + f" · motivo de renuncia tipificado: {clean(row['MOTIVO RENUNCIA'])}"
        + (f" · comentario: {clean(row.get('COMENTARIO'))}" if row.get("COMENTARIO") else ""),
        audio_href=f"../../asr_bench/{name}/viewer.html",
        transcript=turns,
        expected={
            "call_verdict": clean(row["ESTADO_CALIDAD"]).upper(),
            "findings": None,
            "outcomes": [],
            "unevaluable": sorted(unevaluable_for(row)),
        },
    )
    return call, user


def build(args, rows: dict) -> list[dict]:
    catalog = render.load_catalog()
    sheet = render.read_code_blocks(render.SHEET_DOC)
    spec = render.layer2_prompt.load_spec()
    system = render.layer2_prompt.chat_system_prompt(spec, render.layer2_prompt.load_schema())
    prompts = args.out / "prompts"
    prompts.mkdir(parents=True, exist_ok=True)
    (prompts / "system.txt").write_text(system + "\n", encoding="utf-8")
    (prompts / "prompt_version.txt").write_text(f"{spec['version']}\n", encoding="utf-8")

    index = []
    for name in args.names:
        bench_dir = args.asr_dir / name
        summary = json.loads((bench_dir / "_summary.json").read_text(encoding="utf-8"))
        seconds = next(x["audio_seconds"] for x in summary if x.get("audio_seconds"))
        call, user = build_call(name, rows[name], bench_dir / f"{args.asr_model}.json", seconds, catalog, (sheet[0], sheet[1]), args.anonymize
        )
        stem = f"call_{call['call_id']}"
        (prompts / f"{stem}.txt").write_text(user, encoding="utf-8")
        (args.out / "calls").mkdir(exist_ok=True)
        (args.out / "calls" / f"{stem}.json").write_text(json.dumps(call, ensure_ascii=False, indent=1), encoding="utf-8")
        index.append({"stem": stem, "recording": name, "audio_seconds": seconds})
        print(f"ok {stem}")
    (args.out / "calls.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return index


# --- Run -----------------------------------------------------------------------------


def run_models(args, index: list[dict]) -> None:
    bench.load_dotenv(ROOT / ".env")
    bench.PROMPTS_DIR = args.out / "prompts"
    bench.RESULTS_DIR = args.out / "results"
    system = (bench.PROMPTS_DIR / "system.txt").read_text(encoding="utf-8")
    configs = {c["name"]: c for c in tomllib.loads(bench.CONFIG.read_text(encoding="utf-8"))["models"]}

    def job(task):
        cfg, stem = task
        print(f"   {cfg['name']} {stem}: {bench.run_one(cfg, stem, system, args.force)}", flush=True)

    tasks = [(configs[m], c["stem"]) for m in args.models for c in index]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(job, tasks))


# --- Report --------------------------------------------------------------------------


# Motivo 1 en código: la espera más larga de holds_sec (silencios >= MIN_GAP_SEC entre segmentos del ASR) contra
# este umbral. La nota del cliente dice "más de 30 s"; en las 100 llamadas reales el auditor aprobó silencios de 31 a
# 35 s y rechazó desde 40 s. TBD con el cliente (docs/client-open-questions.md, n.º 3).
HOLD_LIMIT_SEC = 35

# Severidad por motivo: todo incumplimiento rechaza, pero si solo hay leves el rechazo queda marcado para revisión
# (hasta v2.7 los leves no rechazaban; el usuario pidió rechazarlos con marca el 2026-10-16). Propuesta
# empírica sacada de las 100 llamadas reales (transcripts/layer2_real_100/analisis_discrepancias_v2.6.md): el auditor
# aprobó llamadas con 3, 18, 28 por omisión, 30, 32, 16 y 25. TBD con el cliente (client-open-questions, n.º 1).
MINOR_CRITERIA = {2, 3, 16, 18, 25, 28, 30, 32}


def minor_only(bad: list[int], minor: set[int]) -> bool:
    """Rechazo leve: hay motivos incumplidos y todos son de `minor`."""
    return bool(bad) and not set(bad) - set(minor)


def hold_finding(holds: list[int], limit: int = HOLD_LIMIT_SEC) -> bool:
    return max(holds or [0]) > limit


def verdict_options(args, out_dir: Path, stem: str, model: str | None = None) -> dict:
    """Argumentos de verdict() según --verdict: "severity" (motivo 1 en código + motivos leves) o "v2.6" (todo motivo
    rechaza, motivo 1 del LLM)."""
    if getattr(args, "verdict", "severity") == "v2.6":
        return {}
    call = json.loads((out_dir / "calls" / f"{stem}.json").read_text(encoding="utf-8"))
    options = {"holds": call["metadata"]["holds_sec"], "minor": MINOR_CRITERIA}
    if getattr(args, "claims", None) and model:
        import verify_claims

        overrides = verify_claims.overrides_for(out_dir, args.claims, model, stem)
        if overrides:
            # Con el verificador, 2 y 6 ya vienen filtrados por materialidad: los dos son graves.
            options.update(overrides=overrides, minor=MINOR_CRITERIA - set(overrides))
    return options


def verdict(audit: dict, unevaluable: set[int], holds: list[int] | None = None,
            minor: set[int] = frozenset(), overrides: dict[int, str] | None = None) -> tuple[str, list[int], list[int]]:
    """APROBADA / RECHAZADA / DUDOSA. Con holds, el motivo 1 sale del código y no del LLM. Todo motivo incumplido
    rechaza; si son solo de `minor`, el rechazo es leve (ver minor_only) y el dashboard lo marca para revisar. Un
    motivo de `minor` indeterminado no deja la llamada DUDOSA. `overrides` reemplaza el estado de esos motivos (2 y 6
    desde verify_claims.py); entonces la ficha incompleta ya no deja la llamada DUDOSA, salvo NO_CORRESPONDE.
    Sin holds, minor ni overrides, se comporta como hasta v2.6."""
    crit = [c for c in audit.get("criterios", []) if c.get("id") not in unevaluable]
    if holds is not None:
        crit = [c for c in crit if c.get("id") != 1] + [{"id": 1, "estado": "incumple" if hold_finding(holds) else "cumple"}]
    if overrides:
        crit = [c for c in crit if c.get("id") not in overrides] + [{"id": k, "estado": v} for k, v in overrides.items()]
    bad = sorted({c["id"] for c in crit if c.get("estado") == "incumple"})
    unsure = sorted({c["id"] for c in crit if c.get("estado") == "indeterminado"})
    if bad:
        return "RECHAZADA", bad, unsure
    # Regla 13 del prompt (v2.4): sin información del seguro usable, la llamada queda por revisar.
    info = (audit.get("informacion_seguro") or {}).get("estado", "OK")
    info_ok = info == "OK" or (bool(overrides) and info != "NO_CORRESPONDE")
    return ("DUDOSA" if set(unsure) - minor or not info_ok else "APROBADA"), bad, unsure


def quote_found(quote: str, transcript: str) -> bool:
    simplify = lambda s: re.sub(r"[^a-z0-9\[\]_ ]", "", norm(s).lower())  # noqa: E731
    q = " ".join(simplify(quote).split())
    return not q or q in " ".join(simplify(transcript).split())


def report(args, rows: dict, index: list[dict]) -> Path:
    results = args.out / "results"
    models = [m for m in args.models if (results / m).exists()]
    calls = []
    for c in index:
        row = rows[c["recording"]]
        user = (args.out / "prompts" / f"{c['stem']}.txt").read_text(encoding="utf-8")
        transcript = user.split("## Transcripción", 1)[1].split("\n", 1)[1]
        entry = {
            "stem": c["stem"],
            "recording": c["recording"],
            "minutes": round(c["audio_seconds"] / 60, 1),
            "real": clean(row["ESTADO_CALIDAD"]).upper(),
            "motivo": clean(row["MOTIVO RENUNCIA"]),
            "comentario": clean(row.get("COMENTARIO")),
            "seguro": clean(row["NOMBRE_DEL_SEGURO"]),
            "transcript": transcript,
            "models": {},
        }
        for m in models:
            out, meta_path, err = results / m / f"{c['stem']}.json", results / m / f"{c['stem']}.meta.json", results / m / f"{c['stem']}.error.txt"
            meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
            item = {"cost": meta.get("cost_usd"), "latency": meta.get("latency_ms"), "usage": meta.get("usage")}
            if out.exists():
                try:
                    audit = bench.extract_audit(out.read_text(encoding="utf-8"))
                    v, bad, unsure = verdict(audit, unevaluable_for(row), **verdict_options(args, args.out, c["stem"], m))
                    for crit in audit.get("criterios", []):
                        for ev in crit.get("evidencia") or []:
                            ev["found"] = quote_found(ev.get("cita", ""), transcript)
                    item.update(verdict=v, bad=bad, unsure=unsure, audit=audit)
                except ValueError as exc:
                    item.update(verdict="ERROR", error=str(exc))
            elif err.exists():
                item.update(verdict="ERROR", error=err.read_text(encoding="utf-8"))
            entry["models"][m] = item
        calls.append(entry)

    data = {"models": models, "calls": calls, "criteria": CRITERIA, "monthly_calls": MONTHLY_CALLS,
            "unevaluable": sorted(set().union(*(unevaluable_for(rows[c["recording"]]) for c in index))),
            "anonymized": args.anonymize}
    template = (Path(__file__).parent / "real_calls_template.html").read_text(encoding="utf-8")
    page = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = args.out / "report.html"
    out.write_text(page, encoding="utf-8")
    # Visor motivo por motivo (mismo de las llamadas sintéticas) en results/viewer.html.
    subprocess.run(
        [sys.executable, str(Path(__file__).parent / "viewer.py"), str(results), "--calls", str(args.out / "calls")],
        check=True,
        capture_output=True,
    )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--asr-dir", type=Path, required=True)
    parser.add_argument("--asr-model", default="openrouter_gemini-3.8-flash")
    parser.add_argument("--names-file", type=Path)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--models", default=",".join(DEFAULT_MODELS))
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--anonymize", action="store_true", help="Enmascara RUT, fono, correo y nombre del cliente")
    parser.add_argument("--only", choices=["build", "run", "report", "holds"])
    parser.add_argument("--verdict", choices=["severity", "v2.6"], default="severity",
                        help="severity: motivo 1 desde holds_sec y motivos leves no rechazan; v2.6: regla anterior")
    parser.add_argument("--claims", metavar="SUBDIR",
                        help="usa la verificación de afirmaciones (<out>/SUBDIR, de verify_claims.py) para los motivos 2 y 6")
    args = parser.parse_args()
    args.models = [m for m in args.models.split(",") if m]

    rows = load_rows(args.metadata)
    if args.names_file:
        args.names = [n.strip() for n in args.names_file.read_text(encoding="utf-8").splitlines() if n.strip()]
    else:
        args.names = sorted(p.name for p in args.asr_dir.iterdir() if (p / f"{args.asr_model}.json").exists())

    if args.only in (None, "build"):
        index = build(args, rows)
    else:
        index = json.loads((args.out / "calls.json").read_text(encoding="utf-8"))
    if args.only == "holds":
        update_holds(args, index)
        return
    if args.only in (None, "run"):
        run_models(args, index)
    if args.only in (None, "report"):
        print(report(args, rows, index))


if __name__ == "__main__":
    main()
