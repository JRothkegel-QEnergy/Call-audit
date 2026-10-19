"""Prompt de la capa 2: arma el system prompt desde prompts/layer2/prompt.yaml y controla su versión y el origen de cada regla.

Uso:
    python scripts/prompt_bench/layer2_prompt.py build   # valida y regenera system.txt, PROVENANCE.md y prompt.lock.json
    python scripts/prompt_bench/layer2_prompt.py check   # solo valida, sin escribir (antes de commitear)

Reglas que se validan:
- Si cambia el texto de un ítem, el esquema o la instrucción JSON, hay que subir "version".
- Cada ítem que cambia trae una entrada en "history" con la versión nueva y su origen.
- La versión nueva tiene su entrada en prompts/layer2/CHANGELOG.md.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
PROMPT_DIR = ROOT / "prompts" / "layer2"
SPEC = PROMPT_DIR / "prompt.yaml"
SCHEMA = PROMPT_DIR / "schema.json"
CHANGELOG = PROMPT_DIR / "CHANGELOG.md"
SYSTEM_TXT = PROMPT_DIR / "system.txt"
PROVENANCE = PROMPT_DIR / "PROVENANCE.md"
LOCK = PROMPT_DIR / "prompt.lock.json"

BASE = "base"  # presente antes del historial detallado (v2.0 o anterior)
FEEDBACK_ORIGINS = ("client_feedback", "validation_feedback")


def load_spec() -> dict:
    return yaml.safe_load(SPEC.read_text(encoding="utf-8"))


def load_schema() -> dict:
    return json.loads(SCHEMA.read_text(encoding="utf-8"))


def items(spec: dict) -> list[tuple[dict, dict]]:
    return [(section, item) for section in spec["sections"] for item in section["items"]]


def render_item(item: dict) -> str:
    if "number" not in item:
        return item["text"]
    first, *rest = item["official"].split("\n")
    lines = [f"{item['number']:>2} {first}"] + [f"   {line}" for line in rest]
    if item.get("criterion"):
        first, *rest = item["criterion"].split("\n")
        lines += [f"   Criterio: {first}"] + [f"   {line}" for line in rest]
    return "\n".join(lines)


def system_prompt(spec: dict) -> str:
    """System prompt para la herramienta registrar_auditoria (tool use)."""
    blocks = []
    for section in spec["sections"]:
        parts = [section["heading"]] if section.get("heading") else []
        blocks.append("\n".join(parts + [render_item(i) for i in section["items"]]))
    return "\n\n".join(blocks)


def chat_system_prompt(spec: dict, schema: dict) -> str:
    """System prompt con el esquema JSON al final, para responder sin herramientas."""
    instruction = spec["json_output_instruction"].replace("{schema}", json.dumps(schema["input_schema"], ensure_ascii=False))
    return f"{system_prompt(spec)}\n\n{instruction}\n"


def version_key(version: str) -> tuple:
    return (-1,) if version == BASE else tuple(int(p) for p in version.split("."))


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def fingerprints(spec: dict, schema: dict) -> dict:
    prints = {item["id"]: digest(render_item(item)) for _, item in items(spec)}
    prints["schema"] = digest(json.dumps(schema, ensure_ascii=False, sort_keys=True))
    prints["json_output_instruction"] = digest(spec["json_output_instruction"])
    return prints


def validate(spec: dict, schema: dict, lock: dict | None) -> list[str]:
    errors = []
    version = str(spec["version"])
    if not re.fullmatch(r"\d+\.\d+(\.\d+)?", version):
        return [f"version '{version}' no es X.Y o X.Y.Z"]
    ids = [item["id"] for _, item in items(spec)]
    errors += [f"id repetido: {i}" for i in sorted({i for i in ids if ids.count(i) > 1})]
    for _, item in items(spec):
        if not item.get("history"):
            errors.append(f"{item['id']}: falta history")
        for entry in item.get("history", []):
            if entry["origin"] not in spec["origins"]:
                errors.append(f"{item['id']}: origen desconocido '{entry['origin']}'")
            if version_key(str(entry["version"])) > version_key(version):
                errors.append(f"{item['id']}: history con versión {entry['version']} mayor que {version}")
    if lock is None:
        return errors

    old, new = lock["fingerprints"], fingerprints(spec, schema)
    changed = sorted(k for k in new if old.get(k) != new[k])
    removed = sorted(set(old) - set(new))
    if (changed or removed) and version == lock["version"]:
        errors.append(f"cambió {', '.join(changed + removed)} y la versión sigue en {version}: súbela en prompt.yaml")
    if version != lock["version"]:
        if version_key(version) < version_key(lock["version"]):
            errors.append(f"la versión {version} es menor que la del lock ({lock['version']})")
        by_id = {item["id"]: item for _, item in items(spec)}
        for key in changed:
            if key in by_id and not any(str(e["version"]) == version for e in by_id[key]["history"]):
                errors.append(f"{key} cambió en {version}: agrega en su history una entrada con version \"{version}\" y su origen")
        if not re.search(rf"^\*\*{re.escape(version)} \(", CHANGELOG.read_text(encoding="utf-8"), re.M):
            errors.append(f"falta la entrada **{version} (fecha)** en {CHANGELOG.relative_to(ROOT).as_posix()}")
    return errors


def title(item: dict) -> str:
    text = f"{item['number']} {item['official']}" if "number" in item else item["text"]
    text = " ".join(text.split())
    return text if len(text) <= 80 else text[:77].rsplit(" ", 1)[0] + "…"


def provenance(spec: dict) -> str:
    labels = {k: v["label"] for k, v in spec["origins"].items()}
    all_items = items(spec)
    out = [
        f"# Origen de las reglas · prompt capa 2 v{spec['version']} ({spec['date']})",
        "",
        "> Generado por `python scripts/prompt_bench/layer2_prompt.py build` desde `prompt.yaml`. No editar a mano.",
        "> `base` = la regla ya estaba antes del historial detallado (v2.0 o anterior).",
        "",
        "## Resumen por origen",
        "",
        "Un ítem cuenta en cada origen que aparece en su historial.",
        "",
        "| Origen | Ítems | Qué es |",
        "|---|---:|---|",
    ]
    for key, origin in spec["origins"].items():
        count = sum(1 for _, i in all_items if any(e["origin"] == key for e in i["history"]))
        out.append(f"| {origin['label']} | {count} | {origin['description']} |")

    out += ["", "## Reglas que vienen de feedback", ""]
    for key in FEEDBACK_ORIGINS:
        out += [f"### {labels[key]}", "", "| Versión | Ítem | Qué cambió |", "|---|---|---|"]
        entries = [(str(e["version"]), i, e) for _, i in all_items for e in i["history"] if e["origin"] == key]
        for v, i, e in sorted(entries, key=lambda x: (version_key(x[0]), x[1]["id"])):
            out.append(f"| {v} | `{i['id']}` {title(i)} | {e['note']} |")
        out.append("")

    out += [
        "## Personalizaciones de la pauta oficial",
        "",
        "Motivos con aclaración (`criterion`) sobre el texto oficial, y de dónde viene.",
        "",
        "| Motivo | Texto oficial | Origen de la aclaración |",
        "|---:|---|---|",
    ]
    motives = sorted((i for _, i in all_items if "number" in i), key=lambda i: i["number"])
    for i in motives:
        sources = sorted({labels[e["origin"]] for e in i["history"] if e["origin"] != "official_text"})
        if i.get("criterion"):
            out.append(f"| {i['number']} | {' '.join(i['official'].split())} | {', '.join(sources) or '—'} |")
    plain = [str(i["number"]) for i in motives if not i.get("criterion")]
    out += ["", f"Sin aclaración (solo texto oficial): {', '.join(plain) or 'ninguno'}.", ""]

    pending = [i for _, i in all_items if i.get("pending")]
    out += ["## Pendiente con el cliente", ""]
    out += [f"- `{i['id']}`: {i['pending']}" for i in pending] or ["- Nada."]

    out += ["", "## Detalle por ítem", "", "| Sección | Ítem | Historial |", "|---|---|---|"]
    for section, i in all_items:
        steps = "<br>".join(f"{e['version']} · {labels[e['origin']]}: {e['note']}" for e in i["history"])
        out.append(f"| {section['id']} | `{i['id']}` {title(i)} | {steps} |")
    return "\n".join(out) + "\n"


def lock_data(spec: dict, schema: dict) -> dict:
    return {
        "version": str(spec["version"]),
        "system_sha256": digest(chat_system_prompt(spec, schema)),
        "fingerprints": fingerprints(spec, schema),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["build", "check"])
    args = parser.parse_args()

    spec, schema = load_spec(), load_schema()
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else None
    errors = validate(spec, schema, lock)
    if args.command == "check" and not errors:
        outputs = {SYSTEM_TXT: system_prompt(spec) + "\n", PROVENANCE: provenance(spec)}
        stale = [p.name for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        if lock != lock_data(spec, schema):
            stale.append(LOCK.name)
        errors += [f"{name} está desactualizado: corre build" for name in stale]
    if errors:
        sys.exit("Prompt capa 2 con errores:\n- " + "\n- ".join(errors))
    if args.command == "build":
        SYSTEM_TXT.write_text(system_prompt(spec) + "\n", encoding="utf-8")
        PROVENANCE.write_text(provenance(spec), encoding="utf-8")
        LOCK.write_text(json.dumps(lock_data(spec, schema), indent=2) + "\n", encoding="utf-8")
    print(f"ok prompt capa 2 v{spec['version']}")


if __name__ == "__main__":
    main()
