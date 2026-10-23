"""Filas de la base → formas de frontend/src/lib/api/types.ts (camelCase).

Las reglas de visibilidad del diseño se aplican aquí, en el backend, y no en el front:
- D-24: el auditor nunca recibe el veredicto ni el comentario del cliente.
- D-22: el prompt y la respuesta del modelo solo van a cuentas con el permiso view_model_io.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import object_session

from call_audit.config import get_settings
from call_audit.persistence.models import Agent, Case, ModelRun, Note, Product, PromptVersion, Review, User
from call_audit.rubric import Rubric

logger = logging.getLogger(__name__)


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def user_out(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "permissions": user.permissions,
    }


def agent_name(raw: str) -> str:
    """El origen trae el usuario del discador ("KARINA.RECABARREN"); la UI muestra "Karina Recabarren"."""
    return " ".join(raw.replace(".", " ").replace("_", " ").split()).title()


def agent_out(agent: Agent) -> dict:
    return {"id": agent.id, "name": agent_name(agent.name), "team": agent.team}


def rubric_out(rubric: Rubric) -> dict:
    return {
        "id": rubric.id,
        "version": rubric.version,
        "blocks": [{"id": b.id, "name": b.name, "criterionIds": list(b.criteria)} for b in rubric.blocks],
        "criteria": {
            c.id: {
                "id": c.id,
                "name": c.description,
                "blockId": c.block,
                "critical": rubric.is_critical(c.id),
                **({"productSheetSection": c.product_sheet_section} if c.product_sheet_section else {}),
            }
            for c in rubric.criteria.values()
        },
    }


def current_run(case: Case) -> ModelRun | None:
    return next((r for r in case.runs if r.is_current), case.runs[0] if case.runs else None)


def case_summary(case: Case, rubric: Rubric, viewer: User) -> dict:
    run = current_run(case)
    findings = run.findings if run else []
    bad = [f for f in findings if f["verdict"] == "non_compliant"]
    return {
        "id": case.id,
        "callId": case.call_id,
        "callDate": case.call_date,
        "agent": agent_out(case.agent),
        "products": case.products,
        "engineVerdict": run.verdict if run else "uncertain",
        "sampleCompliant": False,
        "nonCompliantCount": len(bad),
        "uncertainCount": sum(f["verdict"] == "uncertain" for f in findings),
        "durationMs": case.duration_ms,
        "queuedAt": iso(case.queued_at),
        "status": case.status,
        "lockedBy": {"id": case.locked_by.id, "name": case.locked_by.name} if case.locked_by else None,
        "assignedAuditorId": case.assigned_auditor_id,
        "hasCritical": any(f["criterionId"] in rubric.criteria and rubric.is_critical(f["criterionId"]) for f in bad),
        "externalQualityVerdict": case.external_verdict if viewer.role == "supervisor" else None,
    }


def run_out(run: ModelRun, system_prompt: str | None) -> dict:
    """Sin system_prompt (corridas no vigentes) van solo el veredicto y la respuesta: el prompt pesa ~60 KB y el
    front por ahora muestra solo la corrida vigente."""
    return {
        "id": run.id,
        "model": run.model,
        "label": run.run_label,
        "promptVersion": run.prompt_version,
        "rubricVersion": run.rubric_version,
        "runAt": iso(run.run_at),
        "latencyMs": run.latency_ms,
        "costUsd": run.cost_usd,
        "verdict": run.verdict,
        "appliedRule": run.applied_rule,
        "inputData": run.input_data,
        "promptSections": [
            {"title": "System prompt", "text": system_prompt},
            {"title": "Mensaje de usuario", "text": run.user_prompt},
        ]
        if system_prompt is not None
        else [],
        "rawResponse": run.raw_response if run.error is None else {"error": run.error, "raw": run.raw_response},
    }


def note_out(note: Note) -> dict:
    return {
        "id": note.id,
        "caseId": note.case_id,
        "scope": note.scope,
        "criterionId": note.criterion_id,
        "text": note.text,
        "authorId": note.author_id,
        "authorName": note.author.name,
        "authorRole": note.author.role,
        "createdAt": iso(note.created_at),
        "editedAt": iso(note.edited_at),
    }


def review_out(review: Review) -> dict:
    return {
        "caseId": review.case_id,
        "auditorId": review.auditor_id,
        "auditorName": review.auditor.name,
        "items": review.items,
        "badTranscriptTurns": review.bad_transcript_turns,
        "finalVerdict": review.final_verdict,
        "reviewSeconds": review.review_seconds,
        "submittedAt": iso(review.submitted_at),
    }


def presigned_audio(recording: str) -> str | None:
    settings = get_settings()
    if not settings.s3_bucket:
        return None
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    try:
        s3 = boto3.client("s3", region_name=settings.aws_region)
        return s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": f"{settings.s3_prefix}{recording}.mp3",
                "ResponseContentType": "audio/mpeg",
            },
            ExpiresIn=settings.audio_url_ttl_sec,
        )
    except (BotoCoreError, ClientError):
        # Sin audio el caso se revisa igual (el front muestra "No pudimos cargar el audio"); no se cae el detalle.
        logger.exception("No se pudo firmar la URL del audio %s", recording)
        return None


def product_sheets_out(case: Case) -> list[dict]:
    """Fichas del caso con la versión usada en la validación y la vigente hoy (Cambio 11, R-11.1)."""
    session = object_session(case)
    out = []
    for sheet in case.product_sheets or []:
        sheet = dict(sheet)
        product = session.get(Product, sheet["catalogId"]) if session and sheet.get("catalogId") else None
        sheet.setdefault("version", None)
        sheet["latestVersion"] = product.current_version if product else None
        out.append(sheet)
    return out


def case_detail(
    case: Case,
    rubric: Rubric,
    viewer: User,
    review: Review | None,
    notes: list[Note],
    prompts: dict[str, PromptVersion],
) -> dict[str, Any]:
    run = current_run(case)
    is_supervisor = viewer.role == "supervisor"
    runs: list[dict] = []
    if "view_model_io" in viewer.permissions:
        # La vigente primero (types.ts: "la primera es la vigente").
        ordered = sorted(case.runs, key=lambda r: (not r.is_current, r.model, r.run_label))
        runs = [
            run_out(
                r, (prompts[r.prompt_version].system_text if r.prompt_version in prompts else "") if i == 0 else None
            )
            for i, r in enumerate(ordered)
        ]
    return case_summary(case, rubric, viewer) | {
        "audioUrl": presigned_audio(case.recording),
        "transcript": case.transcript,
        "findings": run.findings if run else [],
        "productSheets": product_sheets_out(case),
        "modelRuns": runs,
        "rubricId": rubric.id,
        "rubricVersion": rubric.version,
        "review": review_out(review) if review else None,
        "notes": [note_out(n) for n in notes],
        "externalItemVerdicts": None,
        "externalComment": case.external_comment if is_supervisor else None,
    }
