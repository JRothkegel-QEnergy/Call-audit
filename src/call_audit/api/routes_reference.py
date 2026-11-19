"""Listas de referencia de solo lectura para la UI.

Motivos de renuncia (docs/ux/vistas-supervisor/10-criterios-y-motivos-de-renuncia.md §5.6): la lista oficial vive en
el prompt de la capa 2 (`renunciation_reasons`). Se lee del prompt vigente; si no hay versión registrada, del
`prompt.yaml` del repo. La fuente sigue siendo única: no se copia a la rúbrica.
"""

from typing import Annotated, Any

import yaml
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from call_audit.api.deps import DbSession, current_user
from call_audit.discrepancies import PROMPT_SPEC
from call_audit.persistence.models import PromptVersion, User

router = APIRouter(prefix="/api/reference")


def renunciation_reasons(spec: dict[str, Any]) -> list[str]:
    """Lista oficial en el orden del prompt: texto separado por «|»."""
    for section in spec.get("sections") or []:
        for item in section.get("items") or []:
            if item.get("id") == "renunciation_reasons":
                return [r.strip() for r in str(item.get("text", "")).split("|") if r.strip()]
    return []


@router.get("/renunciation-reasons")
def reasons(session: DbSession, _: Annotated[User, Depends(current_user)]):
    row = session.scalar(select(PromptVersion).where(PromptVersion.status == "active"))
    text = row.spec_yaml if row is not None and row.spec_yaml else PROMPT_SPEC.read_text(encoding="utf-8")
    spec = yaml.safe_load(text) or {}
    found = renunciation_reasons(spec)
    if not found:
        raise HTTPException(404, "not_found")
    return {"promptVersion": str(spec.get("version", "")), "reasons": found}
