"""Registro de versiones del prompt de la capa 2 en la base (Cambio 12, D-26/D-33).

Una versión se sube como `prompt.yaml` (con historial y origen por regla) o como system prompt en texto. Se valida
con las mismas reglas de `scripts/prompt_bench/layer2_prompt.py`, salvo el CHANGELOG del repo, que acá es un campo.
Desde "testing" la versión es inmutable. Solo una está "active": la que usa el pipeline para los lotes nuevos.

Si la base no tiene versión vigente, la primera vez se toma la de `prompts/layer2/prompt.yaml` del repo.
"""

import io
import json
import sys
import zipfile
from datetime import UTC, datetime
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.config import ROOT, get_settings
from call_audit.persistence.models import PromptVersion, User

sys.path.insert(0, str(ROOT / "scripts" / "prompt_bench"))
import layer2_prompt  # noqa: E402

EDITABLE = ("draft",)


def now() -> datetime:
    return datetime.now(UTC)


class PromptError(ValueError):
    """Errores de validación que el front muestra uno por línea."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


def version_key(version: str) -> tuple:
    try:
        return layer2_prompt.version_key(version)
    except ValueError:
        return (-2,)


def add_history(row: PromptVersion, actor: str, action: str) -> None:
    row.history = [*(row.history or []), {"at": now().isoformat(), "actor": actor, "action": action}]


def active(session: Session) -> PromptVersion | None:
    return session.scalar(select(PromptVersion).where(PromptVersion.status == "active"))


def ensure_bootstrap(session: Session) -> PromptVersion:
    """La vigente; si no hay, registra la del repo (prompts/layer2/prompt.yaml) como vigente."""
    current = active(session)
    if current is not None:
        return current
    spec, schema = layer2_prompt.load_spec(), layer2_prompt.load_schema()
    version = str(spec["version"])
    row = session.get(PromptVersion, version) or PromptVersion(version=version)
    row.system_text = layer2_prompt.chat_system_prompt(spec, schema)
    row.spec_yaml = layer2_prompt.SPEC.read_text(encoding="utf-8")
    row.schema_json = schema
    row.source = "repo"
    row.status = "active"
    row.model = row.model or get_settings().pipeline_model
    row.changelog = row.changelog or changelog_entry(version)
    row.created_at = row.created_at or now()
    row.activated_at = now()
    row.activation_reason = "Versión del repo al iniciar el registro de prompts"
    add_history(row, "Sistema", "Registrada desde el repo como vigente")
    session.add(row)
    session.flush()
    return row


def changelog_entry(version: str) -> str:
    """El párrafo de CHANGELOG.md de esa versión, si está."""
    text = layer2_prompt.CHANGELOG.read_text(encoding="utf-8") if layer2_prompt.CHANGELOG.exists() else ""
    marker = f"**{version} ("
    start = text.find(marker)
    if start < 0:
        return ""
    end = text.find("\n**", start + len(marker))
    return text[start : end if end > 0 else None].strip()


def _spec_of(row: PromptVersion | None) -> dict | None:
    return yaml.safe_load(row.spec_yaml) if row is not None and row.spec_yaml else None


def _schema_of(row: PromptVersion | None) -> dict:
    return row.schema_json if row is not None and row.schema_json else layer2_prompt.load_schema()


def validate_yaml(text: str, base: PromptVersion) -> tuple[dict, list[str]]:
    """Valida un prompt.yaml contra la versión vigente. Devuelve el spec y la lista de errores."""
    try:
        spec = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        return {}, [f"YAML inválido: {exc}"]
    if not isinstance(spec, dict) or "sections" not in spec or "version" not in spec:
        return {}, ["El archivo no tiene la forma de prompt.yaml (faltan version o sections)"]
    schema = _schema_of(base)
    try:
        errors = layer2_prompt.validate(spec, schema, None)
    except (KeyError, TypeError) as exc:
        return spec, [f"Estructura incompleta: falta {exc}"]
    version = str(spec["version"])
    if version_key(version) <= version_key(base.version):
        errors.append(f"La versión debe ser mayor que la vigente (v{base.version}).")
    old = _spec_of(base)
    if old is not None and not errors:
        before = {item["id"]: layer2_prompt.render_item(item) for _, item in layer2_prompt.items(old)}
        for _, item in layer2_prompt.items(spec):
            if before.get(item["id"]) != layer2_prompt.render_item(item) and not any(
                str(e["version"]) == version for e in item.get("history", [])
            ):
                errors.append(
                    f"{item['id']} cambió en {version}: agrega en su history una entrada "
                    f'con version "{version}" y su origen'
                )
    return spec, errors


def system_from_text(text: str, base: PromptVersion) -> str:
    """Un system prompt subido como texto usa la instrucción de salida JSON y el esquema vigentes (H-70)."""
    spec = _spec_of(base) or layer2_prompt.load_spec()
    instruction = spec["json_output_instruction"].replace(
        "{schema}", json.dumps(_schema_of(base)["input_schema"], ensure_ascii=False)
    )
    body = text.strip()
    return body if spec["json_output_instruction"].split("\n")[0] in body else f"{body}\n\n{instruction}\n"


def create_draft(
    session: Session,
    *,
    author: User,
    source: str,
    content: str,
    version: str | None,
    model: str,
    changelog: str,
    rationale: str | None,
) -> PromptVersion:
    base = ensure_bootstrap(session)
    errors: list[str] = []
    if not changelog.strip():
        errors.append("Cuenta qué cambió en esta versión.")
    if source == "yaml":
        spec, yaml_errors = validate_yaml(content, base)
        errors += yaml_errors
        version = str(spec.get("version", ""))
    else:
        version = (version or "").strip()
        if not content.strip():
            errors.append("El system prompt está vacío.")
        if version_key(version) == (-2,) or not version:
            errors.append("Escribe la versión como X.Y, por ejemplo 2.11.")
        elif version_key(version) <= version_key(base.version):
            errors.append(f"La versión debe ser mayor que la vigente (v{base.version}).")
    if version and session.get(PromptVersion, version) is not None:
        errors.append(f"Ya existe la versión v{version}.")
    if errors:
        raise PromptError(errors)
    schema = _schema_of(base)
    row = PromptVersion(
        version=version,
        status="draft",
        source=source,
        spec_yaml=content if source == "yaml" else None,
        schema_json=schema,
        system_text=layer2_prompt.chat_system_prompt(spec, schema)
        if source == "yaml"
        else system_from_text(content, base),
        model=model,
        changelog=changelog.strip(),
        rationale=(rationale or "").strip() or None,
        created_by_id=author.id,
        created_at=now(),
        history=[],
    )
    add_history(row, author.name, "Creó el borrador")
    session.add(row)
    session.flush()
    return row


def update_draft(
    session: Session,
    row: PromptVersion,
    *,
    author: User,
    content: str,
    model: str,
    changelog: str,
    rationale: str | None,
) -> None:
    if row.status not in EDITABLE:
        raise PromptError(["La versión ya no se puede editar: crea una versión nueva."])
    if row.created_by_id != author.id:
        raise PromptError(["Solo quien creó el borrador puede editarlo."])
    base = ensure_bootstrap(session)
    if row.source == "yaml":
        spec, errors = validate_yaml(content, base)
        if str(spec.get("version", "")) != row.version:
            errors.append(f"El archivo dice versión {spec.get('version')}; este borrador es v{row.version}.")
        if errors:
            raise PromptError(errors)
        row.spec_yaml = content
        row.system_text = layer2_prompt.chat_system_prompt(spec, row.schema_json or _schema_of(base))
    else:
        row.system_text = system_from_text(content, base)
    if not changelog.strip():
        raise PromptError(["Cuenta qué cambió en esta versión."])
    row.model, row.changelog, row.rationale = model, changelog.strip(), (rationale or "").strip() or None
    add_history(row, author.name, "Editó el borrador")


def activate(session: Session, row: PromptVersion, *, actor: User, reason: str) -> bool:
    """Activa una versión probada, o vuelve a una retirada que fue probada. Devuelve True si fue volver atrás."""
    rollback = row.status == "retired"
    if not (row.status == "tested" or (rollback and (row.tested_at or row.source in ("repo", "bench")))):
        raise PromptError(["Solo se activan versiones probadas."])
    if not reason.strip():
        raise PromptError(["Escribe el motivo de la activación."])
    current = active(session)
    if current is not None and current.version != row.version:
        current.status = "retired"
        current.retired_at = now()
        add_history(current, actor.name, f"Retirada al activar v{row.version}")
    row.status, row.activated_at, row.activated_by_id = "active", now(), actor.id
    row.activation_reason, row.retired_at = reason.strip(), None
    add_history(row, actor.name, "Volvió a esta versión" if rollback else "Activó la versión")
    return rollback


# --- Diferencias y exportación ----------------------------------------------------------------------------------


def diff(base: PromptVersion, target: PromptVersion) -> dict[str, Any]:
    """Por regla si las dos versiones tienen prompt.yaml; si no, el texto del system prompt."""
    old, new = _spec_of(base), _spec_of(target)
    if old is None or new is None:
        return {"kind": "text", "base": base.system_text, "next": target.system_text}
    before = {item["id"]: item for _, item in layer2_prompt.items(old)}
    after = {item["id"]: item for _, item in layer2_prompt.items(new)}
    rules = []
    for rid in [*after, *(k for k in before if k not in after)]:
        a, b = before.get(rid), after.get(rid)
        text_a = layer2_prompt.render_item(a) if a else None
        text_b = layer2_prompt.render_item(b) if b else None
        if text_a == text_b:
            continue
        entry = next((e for e in (b or {}).get("history", []) if str(e["version"]) == target.version), None)
        rules.append(
            {
                "id": rid,
                "title": layer2_prompt.title(b or a),
                "before": text_a,
                "after": text_b,
                "origin": (new["origins"].get(entry["origin"], {}).get("label") if entry else None),
                "note": entry.get("note") if entry else None,
            }
        )
    return {"kind": "rules", "rules": rules}


def export_zip(row: PromptVersion) -> bytes:
    """«Descargar para el repo»: con yaml, prompt.yaml + system.txt + prompt.lock.json + entrada del CHANGELOG."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        if row.spec_yaml:
            spec = yaml.safe_load(row.spec_yaml)
            schema = row.schema_json or layer2_prompt.load_schema()
            z.writestr("prompt.yaml", row.spec_yaml)
            z.writestr("system.txt", layer2_prompt.system_prompt(spec) + "\n")
            z.writestr(
                "prompt.lock.json",
                json.dumps(layer2_prompt.lock_data(spec, schema), ensure_ascii=False, indent=2) + "\n",
            )
        else:
            z.writestr("system.txt", row.system_text)
        date = (row.created_at or now()).date().isoformat()
        z.writestr("CHANGELOG-entry.md", f"**{row.version} ({date})** {row.changelog}\n")
        meta = {
            "version": row.version,
            "source": row.source,
            "model": row.model,
            "status": row.status,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "activatedAt": row.activated_at.isoformat() if row.activated_at else None,
            "activationReason": row.activation_reason,
        }
        z.writestr("metadata.json", json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return buffer.getvalue()


def content_of(row: PromptVersion) -> str:
    """Lo que se edita en el borrador: el yaml o el texto del system prompt sin la instrucción de salida."""
    if row.spec_yaml:
        return row.spec_yaml
    marker = "## Formato de respuesta"
    return row.system_text.split(marker)[0].rstrip() if marker in row.system_text else row.system_text
