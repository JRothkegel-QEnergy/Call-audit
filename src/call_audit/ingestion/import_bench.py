"""Importa una corrida del bench de llamadas reales (scripts/prompt_bench/real_calls.py) a la base de datos.

Uso (desde call-audit-rcv, con DATABASE_URL apuntando a la base de destino):
    uv run python -m call_audit.ingestion.import_bench --out ../transcripts/layer2_real_100_v2.7 \
        --metadata "../audios/Retenciones BECS Para Revision.xlsx" \
        --catalog ../call-audit/data/catalog/products.json \
        --label v2.7 --current-model gemini-3-8-flash --asr-dir ../transcripts/asr_bench \
        [--models a,b] [--reviews CSV --reviewer EMAIL]

Se puede correr varias veces: el caso se identifica por call_id y la corrida por (caso, modelo, --label). Una segunda
corrida del mismo prompt se importa con otro --label (ej. "v2.7 corrida 2").

Reutiliza el parser y la regla de veredicto del bench (real_calls.verdict, run.extract_audit) para que la app muestre
exactamente lo mismo que el dashboard.

Datos personales (decisión de Johannes, 2026-10-19): la app muestra todo sin enmascarar. Con --asr-dir, la
transcripción del caso sale del ASR original (sin la anonimización de real_calls.py build --anonymize) y el
comentario del cliente va tal cual. Lo que se envió al modelo (prompt y respuesta) se guarda como salió: enmascarado.
Sin --asr-dir se usa la transcripción del bench, que viene enmascarada.
"""

import argparse
import csv
import difflib
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.config import ROOT, get_settings
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import Agent, Case, DiscrepancyClassification, ModelRun, PromptVersion, User
from call_audit.rubric import Rubric, load_rubric

sys.path.insert(0, str(ROOT / "scripts" / "prompt_bench"))
import real_calls  # noqa: E402
import run as bench  # noqa: E402

VERDICTS = {"APROBADA": "compliant", "RECHAZADA": "non_compliant", "DUDOSA": "uncertain", "ERROR": "uncertain"}
STATES = {
    "cumple": "compliant",
    "incumple": "non_compliant",
    "indeterminado": "uncertain",
    "no_aplica": "not_applicable",
}
CATEGORY_RULES = {
    "RETENIBLE": "Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo (motivo 14).",
    "NO RETENIBLE": "No se retiene: se gestiona la renuncia (motivo 17).",
    "IRRENUNCIABLE": "No se puede renunciar en este canal (motivo 9).",
}


def clean(value: Any) -> str:
    return real_calls.clean(value)


def mmss(ms: int) -> str:
    return f"{ms // 60000:02d}:{ms // 1000 % 60:02d}"


def mmss_to_ms(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(real_calls.parse_ts(value) * 1000)
    except ValueError:
        return 0


def agent_for(session: Session, name: str, fallback: str) -> Agent:
    name = name or fallback
    agent_id = "ag-" + hashlib.sha1(name.encode()).hexdigest()[:10]
    agent = session.get(Agent, agent_id)
    if agent is None:
        agent = Agent(id=agent_id, name=name, team="")
        session.add(agent)
    return agent


def transcript_turns(call: dict, original: list[dict] | None = None) -> list[dict]:
    """Turnos del caso. `original` son los segmentos del ASR sin enmascarar: real_calls.build arma un turno por
    segmento, así que se reemplaza el texto por posición. Si no calzan, queda la transcripción del bench."""
    raw = call["transcript"]
    if original is not None and len(original) != len(raw):
        print(f"call_{call['call_id']}: el ASR original no calza con el bench; queda la transcripción enmascarada")
        original = None
    turns = []
    for i, t in enumerate(raw):
        end = raw[i + 1]["start_ms"] if i + 1 < len(raw) else t["start_ms"] + 3000
        turns.append(
            {
                "index": i,
                "speaker": t["channel"],
                "startMs": t["start_ms"],
                "endMs": max(end, t["start_ms"]),
                "text": str(original[i]["text"]).strip() if original else t["text"],
            }
        )
    return turns


PLACEHOLDER = re.compile(r"\[[A-ZÑ_]+\]")


class Unmasker:
    """Devuelve el texto original en lo que escribió el modelo (citas y comentarios), que vio la transcripción
    enmascarada. Primero busca la cita en la transcripción original con cada marcador como comodín; si no la
    encuentra (citas resumidas con "..."), cambia cada marcador por el valor que más veces le corresponde en la
    llamada, sacado de alinear palabra por palabra la transcripción enmascarada con la original."""

    def __init__(self, masked: list[str], original: list[str]):
        self.original = original
        values: dict[str, Counter[str]] = {}
        for m, o in zip(masked, original, strict=True):
            m_words, o_words = m.split(), o.split()
            matcher = difflib.SequenceMatcher(a=m_words, b=o_words, autojunk=False)
            for op, i1, i2, j1, j2 in matcher.get_opcodes():
                if op != "replace":
                    continue
                chunk = " ".join(m_words[i1:i2])
                found = PLACEHOLDER.findall(chunk)
                if len(found) == 1 and i2 - i1 == 1:
                    value = " ".join(o_words[j1:j2]).strip(".,;:¿?¡!\"'")
                    values.setdefault(found[0], Counter())[value] += 1
        self.values = {k: c.most_common(1)[0][0] for k, c in values.items()}

    def __call__(self, text: str) -> str:
        if not text or not PLACEHOLDER.search(text):
            return text
        parts = [r"\s+".join(map(re.escape, p.split())) for p in PLACEHOLDER.split(text.strip())]
        # Sin texto fijo suficiente la búsqueda calzaría en cualquier parte.
        if "..." not in text and sum(len(p) for p in parts) >= 8:
            # Entre dos textos fijos el marcador puede ser varias palabras (un RUT dictado); en los bordes, una.
            pieces = [parts[0]]
            for i in range(1, len(parts)):
                edge = (i == 1 and not parts[0]) or (i == len(parts) - 1 and not parts[i])
                pieces += [r"\s*" + (r"(\S+)" if edge else "(.{1,80}?)") + r"\s*", parts[i]]
            pattern = "".join(pieces)
            for turn in self.original:
                match = re.search(pattern, turn, re.I)
                if match:
                    return match.group(0).strip()
        return PLACEHOLDER.sub(lambda m: self.values.get(m.group(0), m.group(0)), text)


def product_sheet(product: dict | None, policy: dict) -> dict:
    call_data = [
        {"label": label, "value": str(policy.get(key) or "")}
        for label, key in [
            ("Seguro", "name"),
            ("Plan", "plan"),
            ("Prima", "premium"),
            ("Periodicidad", "periodicity"),
            ("Monto asegurado", "insured_amount"),
            ("N° de póliza", "policy_number"),
            ("MUS A Neto", "mus_a_neto"),
            ("Inicio de vigencia", "start_date"),
            ("Medio de pago", "payment_method"),
        ]
        if policy.get(key)
    ]
    product = product or {}
    category = str(product.get("category") or "").replace("_", " ") or "RETENIBLE"
    return {
        "productId": product.get("id") or "",
        "name": product.get("name") or policy.get("name") or "Sin ficha en el catálogo",
        "insurer": product.get("insurer") or "",
        "callData": call_data,
        "category": category,
        "categoryRule": CATEGORY_RULES.get(category, ""),
        "premiumType": product.get("premium_mode") or product.get("premium_type") or "",
        "premiumRefund": product.get("premium_refund") or "",
        "withdrawal": product.get("withdrawal") or "",
        "coverages": [
            {"name": c.get("name", ""), "detail": " · ".join(x for x in (c.get("amount"), c.get("detail")) if x)}
            for c in product.get("coverages") or []
        ],
    }


def hold_evidence(segments: list[dict] | None, turns: list[dict]) -> dict | None:
    """Evidencia del motivo 1: la espera más larga del ejecutivo. El audio salta al inicio del silencio y se resalta
    el turno con que se retoma la llamada. Sin los segmentos del ASR (o si no calzan con los turnos) no hay posición."""
    if not segments or len(segments) != len(turns):
        return None
    spans = real_calls.executive_hold_spans(segments)
    if not spans:
        return None
    start, end, index = max(spans, key=lambda s: s[1] - s[0])
    return {
        "quote": turns[index]["text"],
        "startMs": int(start * 1000),
        "endMs": int(end * 1000),
        "quoteValidated": True,
    }


def findings_from(
    audit: dict,
    transcript_text: str,
    holds: list[int],
    rubric: Rubric,
    unmask: Unmasker | None = None,
    hold: dict | None = None,
) -> list[dict]:
    """La cita se valida contra lo que vio el modelo (enmascarado) y después se muestra con el texto original."""
    show = unmask or (lambda text: text)
    findings = []
    for c in audit.get("criterios", []):
        cid = c.get("id")
        if cid not in rubric.criteria or cid == 1:
            continue
        evidence = None
        quotes = c.get("evidencia") or []
        if quotes:
            q = quotes[0]
            start = mmss_to_ms(q.get("t"))
            evidence = {
                "quote": show(q.get("cita", "")),
                "startMs": start,
                "endMs": start + 5000,
                "quoteValidated": real_calls.quote_found(q.get("cita", ""), transcript_text),
            }
        verdict = STATES.get(c.get("estado", ""), "uncertain")
        # Regla 4 del proyecto: una cita que no aparece en la transcripción deja el ítem dudoso.
        if evidence and not evidence["quoteValidated"] and verdict == "non_compliant":
            verdict = "uncertain"
        findings.append(
            {
                "criterionId": cid,
                "verdict": verdict,
                "confidence": float(c.get("confianza") or 0),
                "evidence": evidence,
                "comment": show(c.get("comentario", "")),
            }
        )
    # Motivo 1 en código (holds_sec contra el umbral de la rúbrica), igual que el veredicto del bench.
    longest = max(holds or [0])
    over = longest > rubric.hold_limit_sec
    findings.append(
        {
            "criterionId": 1,
            "verdict": "non_compliant" if over else "compliant",
            "confidence": 1.0,
            "evidence": hold,
            "comment": f"Espera más larga del ejecutivo: {longest} s (umbral {rubric.hold_limit_sec} s)"
            + (f", desde el {mmss(hold['startMs'])}." if hold else "."),
        }
    )
    return sorted(findings, key=lambda f: f["criterionId"])


def applied_rule(verdict: str, bad: list[int], unsure: list[int], minor_only: bool) -> str:
    if verdict == "RECHAZADA":
        listed = ", ".join(map(str, bad))
        return f"Rechazo leve: solo motivos leves ({listed})" if minor_only else f"Rechaza: incumple {listed}"
    if verdict == "DUDOSA":
        return "Dudosa: " + (
            f"indeterminado {', '.join(map(str, unsure))}" if unsure else "sin ficha del seguro usable"
        )
    if verdict == "ERROR":
        return "Dudosa: la respuesta del modelo no se pudo leer"
    return "Cumple: ningún motivo incumplido"


def input_data(call: dict, row: dict) -> list[dict]:
    meta = call["metadata"]
    sections = [
        {
            "section": "Llamada",
            "rows": [
                {"field": "Fecha", "value": meta["date"]},
                {"field": "Duración (s)", "value": str(meta["duration_sec"])},
                {"field": "Esperas del ejecutivo (s)", "value": ", ".join(map(str, meta["holds_sec"])) or "ninguna"},
                {"field": "Tipificación", "value": clean(row.get("TIPIFICACION")) or "NO INFORMADA"},
                {"field": "Motivo de renuncia tipificado", "value": clean(row.get("MOTIVO RENUNCIA"))},
            ],
        }
    ]
    for p in meta["policies"]:
        sections.append(
            {"section": f"Contrato · {p['name']}", "rows": [{"field": k, "value": str(v)} for k, v in p.items() if v]}
        )
    return sections


def import_run(
    session: Session,
    out_dir: Path,
    rows: dict[str, dict],
    catalog: dict,
    rubric: Rubric,
    label: str,
    current_model: str | None,
    models: list[str] | None = None,
    asr_dir: Path | None = None,
    asr_model: str = "gemini_3.8-flash",
) -> int:
    prompts = out_dir / "prompts"
    version_file = prompts / "prompt_version.txt"
    # Corridas anteriores a prompt_version.txt: la versión sale del label ("v2.7 corrida 2" → "2.7").
    prompt_version = (
        version_file.read_text(encoding="utf-8").strip() if version_file.exists() else label.split()[0].lstrip("v")
    )
    if session.get(PromptVersion, prompt_version) is None:
        session.add(
            PromptVersion(version=prompt_version, system_text=(prompts / "system.txt").read_text(encoding="utf-8"))
        )
    products = {p["id"]: p for p in catalog.get("products", [])}
    results = out_dir / "results"
    all_models = sorted(d.name for d in results.iterdir() if d.is_dir())
    models = [m for m in (models or all_models) if m in all_models]

    count = 0
    for path in sorted((out_dir / "calls").glob("call_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        recording = call["audio_href"].split("/")[-2]
        row = rows[recording]
        policies = call["metadata"]["policies"]
        ficha = re.search(r"ficha: (\S+)", call.get("description", ""))
        product = products.get(ficha.group(1)) if ficha else None
        agent = agent_for(session, clean(row.get("EJECUTIVO")), call["metadata"]["agent_id"])
        case = session.scalar(select(Case).where(Case.call_id == call["call_id"]))
        if case is None:
            case = Case(call_id=call["call_id"], agent=agent)
            session.add(case)
        external = clean(row.get("ESTADO_CALIDAD")).upper()
        comment = clean(row.get("COMENTARIO"))
        case.recording = recording
        case.call_date = call["metadata"]["date"]
        case.agent = agent
        case.duration_ms = call["metadata"]["duration_sec"] * 1000
        case.products = [p["name"] for p in policies]
        case.product_sheets = [product_sheet(product if i == 0 else None, p) for i, p in enumerate(policies)]
        asr_file = asr_dir / recording / f"{asr_model}.json" if asr_dir else None
        original = (
            json.loads(asr_file.read_text(encoding="utf-8"))["segments"] if asr_file and asr_file.exists() else None
        )
        case.transcript = transcript_turns(call, original)
        masked = [t["text"] for t in call["transcript"]]
        shown = [t["text"] for t in case.transcript]
        unmask = Unmasker(masked, shown) if shown != masked else None
        hold = hold_evidence(original, case.transcript)
        case.call_metadata = call["metadata"]
        case.external_verdict = VERDICTS.get(external) if external in ("APROBADA", "RECHAZADA") else None
        case.external_comment = (comment if asr_dir else real_calls.Anonymizer(row)(comment)) or None

        user_prompt = (prompts / f"{path.stem}.txt").read_text(encoding="utf-8")
        transcript_text = user_prompt.split("## Transcripción", 1)[-1]
        holds = call["metadata"]["holds_sec"]
        for model in models:
            run = import_model_run(results / model, path.stem, row, transcript_text, holds, rubric, unmask, hold)
            if run is None:
                continue
            existing = next((r for r in case.runs if r.model == model and r.run_label == label), None)
            target = existing or ModelRun(model=model, run_label=label)
            for key, value in run.items():
                setattr(target, key, value)
            target.prompt_version = prompt_version
            target.rubric_version = rubric.version
            target.user_prompt = user_prompt
            target.input_data = input_data(call, row)
            if existing is None:
                case.runs.append(target)
        if current_model:
            for r in case.runs:
                r.is_current = r.model == current_model and r.run_label == label
        session.flush()
        count += 1
    return count


def import_model_run(
    model_dir: Path,
    stem: str,
    row: dict,
    transcript_text: str,
    holds: list[int],
    rubric: Rubric,
    unmask: Unmasker | None = None,
    hold: dict | None = None,
) -> dict | None:
    out, meta_path, err = (model_dir / f"{stem}{ext}" for ext in (".json", ".meta.json", ".error.txt"))
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    base = {
        "latency_ms": int(meta.get("latency_ms") or 0),
        "cost_usd": float(meta.get("cost_usd") or 0),
        "run_at": datetime.fromisoformat(meta["run_at"]) if meta.get("run_at") else datetime.now().astimezone(),
    }
    if not out.exists():
        if not err.exists():
            return None
        return base | {
            "verdict": "uncertain",
            "applied_rule": applied_rule("ERROR", [], [], False),
            "findings": [],
            "raw_response": None,
            "error": err.read_text(encoding="utf-8"),
        }
    raw = out.read_text(encoding="utf-8")
    try:
        audit = bench.extract_audit(raw)
    except ValueError as exc:
        return base | {
            "verdict": "uncertain",
            "applied_rule": applied_rule("ERROR", [], [], False),
            "findings": [],
            "raw_response": {"text": raw},
            "error": str(exc),
        }
    verdict, bad, unsure = real_calls.verdict(
        audit, real_calls.unevaluable_for(row), holds=holds, minor=set(rubric.minor)
    )
    minor_only = real_calls.minor_only(bad, set(rubric.minor))
    return base | {
        "verdict": VERDICTS[verdict],
        "minor_only": minor_only,
        "applied_rule": applied_rule(verdict, bad, unsure, minor_only),
        "findings": findings_from(audit, transcript_text, holds, rubric, unmask, hold),
        "raw_response": audit,
        "error": None,
    }


def import_reviews(session: Session, csv_path: Path, reviewer_email: str) -> int:
    """Carga la auditoría manual del dashboard (revision_capa2.csv) como clasificación del árbol de discrepancias:
    si la IA difiere del cliente, mi veredicto dice si la IA acertó o se equivocó. La nota va a la clasificación,
    que solo ve el supervisor. Los casos siguen pendientes para los auditores."""
    reviewer = session.scalar(select(User).where(User.email == reviewer_email))
    if reviewer is None:
        raise SystemExit(f"No existe el usuario {reviewer_email}: créalo con python -m call_audit.admin create-user")
    count = 0
    with csv_path.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            mine = (
                VERDICTS.get(r["mi_veredicto"].strip().upper())
                if r["mi_veredicto"].strip().upper() in ("APROBADA", "RECHAZADA")
                else None
            )
            case = session.scalar(select(Case).where(Case.call_id == r["llamada"].strip()))
            if mine is None or case is None:
                continue
            current = next((run for run in case.runs if run.is_current), None)
            if current is None or case.external_verdict is None or current.verdict == case.external_verdict:
                continue
            item = session.get(DiscrepancyClassification, case.id) or DiscrepancyClassification(case_id=case.id)
            item.classification = "ai_correct" if current.verdict == mine else "ai_wrong"
            item.note = r.get("nota", "").strip()
            item.updated_by_id = reviewer.id
            if item.classification == "ai_correct" and item.presentation is None:
                item.presentation = "pending"
            session.merge(item)
            count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="carpeta --out de real_calls.py")
    parser.add_argument("--metadata", type=Path, required=True, help="Excel de metadata (Retenciones BECS ...xlsx)")
    parser.add_argument("--catalog", type=Path, required=True, help="data/catalog/products.json")
    parser.add_argument("--label", required=True, help='nombre de la corrida, ej. "v2.7" o "v2.7 corrida 2"')
    parser.add_argument("--current-model", help="modelo cuya corrida queda vigente (veredicto del motor)")
    parser.add_argument("--models", help="lista separada por coma; por defecto todos los de results/")
    parser.add_argument("--reviews", type=Path, help="revision_capa2.csv del dashboard")
    parser.add_argument("--reviewer", help="email del usuario a quien se atribuye --reviews")
    parser.add_argument("--asr-dir", type=Path, help="asr_bench/: transcripción original, sin enmascarar")
    parser.add_argument("--asr-model", default="gemini_3.8-flash", help="archivo del ASR usado por el bench")
    args = parser.parse_args()
    if args.reviews and not args.reviewer:
        parser.error("--reviews requiere --reviewer")

    rubric = load_rubric(get_settings().rubric_path)
    rows = real_calls.load_rows(args.metadata)
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    models = [m for m in args.models.split(",") if m] if args.models else None
    with get_sessionmaker()() as session, session.begin():
        n = import_run(
            session,
            args.out,
            rows,
            catalog,
            rubric,
            args.label,
            args.current_model,
            models,
            args.asr_dir,
            args.asr_model,
        )
        print(f"{n} llamadas importadas ({args.label})")
        if args.reviews:
            classified = import_reviews(session, args.reviews, args.reviewer)
            print(f"{classified} discrepancias clasificadas desde {args.reviews.name}")


if __name__ == "__main__":
    main()
