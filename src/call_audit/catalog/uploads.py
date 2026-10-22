"""Cargas de Excel al catálogo (Cambio 11 §4.1): el worker extrae con IA, el supervisor revisa y decide cada ficha.
Nada entra al catálogo sin una decisión del supervisor."""

import logging
from datetime import timedelta

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.catalog import matching, store
from call_audit.catalog.extract import EXTRACTION_PROMPT_VERSION, UploadError, call_llm, extract
from call_audit.catalog.schema import SCHEMA_VERSION, CatalogProduct
from call_audit.persistence.models import CatalogUpload, Product, User, now

logger = logging.getLogger("call_audit.catalog")
EXPIRE_AFTER = timedelta(days=30)  # D5
BATCH_LIMIT = 50  # D4
OPEN = ("ready", "partial")


class DecisionError(Exception):
    def __init__(self, code: str, status: int = 409):
        super().__init__(code)
        self.code = code
        self.status = status


# --- Worker -----------------------------------------------------------------------------------


def process_pending(factory: sessionmaker[Session], llm=call_llm) -> int:
    """Procesa las cargas en "processing" y vence las abiertas sin actividad. Lo llama el worker."""
    with factory() as session:
        pending = list(session.scalars(select(CatalogUpload.id).where(CatalogUpload.status == "processing")))
    for upload_id in pending:
        process(factory, upload_id, llm)
    with factory() as session, session.begin():
        for upload in session.scalars(select(CatalogUpload).where(CatalogUpload.status.in_(OPEN))):
            if now() - _aware(upload.updated_at) > EXPIRE_AFTER:
                upload.status = "expired"
    return len(pending)


def _aware(value):
    return value if value.tzinfo else value.replace(tzinfo=now().tzinfo)


def process(factory: sessionmaker[Session], upload_id: str, llm=call_llm) -> None:
    with factory() as session:
        content = session.get(CatalogUpload, upload_id).content

    def on_step(step: str) -> None:
        with factory() as session, session.begin():
            session.get(CatalogUpload, upload_id).step = step

    try:
        result = extract(content or b"", llm=llm, on_step=on_step)
    except UploadError as exc:
        logger.warning("Carga %s falló: %s %s", upload_id, exc.code, exc.detail)
        _fail(factory, upload_id, exc.code, exc.detail)
        return
    except Exception as exc:  # noqa: BLE001 - proveedor caído, respuesta cortada, etc.
        logger.exception("Carga %s falló", upload_id)
        _fail(factory, upload_id, "extraction_failed", f"{type(exc).__name__}: {exc}")
        return
    on_step("matching")
    with factory() as session, session.begin():
        upload = session.get(CatalogUpload, upload_id)
        items = [matching.new_item(p["product"], p["sources"], p["missing"]) for p in result.products]
        matching.refresh(session, items)
        upload.items = items
        upload.unused_sheets = result.unused_sheets
        upload.model = result.model
        upload.cost_usd = result.cost_usd
        upload.raw_response = "\n\n".join(result.raw)
        upload.extraction_prompt_version = EXTRACTION_PROMPT_VERSION
        upload.schema_version = SCHEMA_VERSION
        upload.status, upload.step, upload.updated_at = "ready", None, now()


def _fail(factory: sessionmaker[Session], upload_id: str, code: str, detail: str) -> None:
    with factory() as session, session.begin():
        upload = session.get(CatalogUpload, upload_id)
        upload.status, upload.step, upload.error, upload.error_detail = "failed", None, code, detail[:2000]
        upload.updated_at = now()


# --- Resumen -----------------------------------------------------------------------------------


def counts(items: list[dict]) -> dict:
    match = [i["match"] for i in items]
    decisions = [(i.get("decision") or {}).get("action") for i in items]
    return {
        "total": len(items),
        "new": sum(m["status"] == "new" for m in match),
        "existsChanged": sum(m.get("state") == "changed" for m in match),
        "existsUnchanged": sum(m.get("state") == "unchanged" for m in match),
        "existsArchived": sum(m.get("state") == "archived" for m in match),
        "withWarnings": sum(bool(i["warnings"]) for i in items if not i.get("decision")),
        "decided": sum(d is not None for d in decisions),
        "created": decisions.count("created"),
        "updated": decisions.count("updated"),
        "discarded": decisions.count("discarded"),
    }


def user_ref(user: User | None) -> dict | None:
    return {"id": user.id, "name": user.name} if user else None


def summary(upload: CatalogUpload) -> dict:
    return {
        "id": upload.id,
        "fileName": upload.file_name,
        "uploadedBy": user_ref(upload.uploaded_by),
        "uploadedAt": store.iso(upload.uploaded_at),
        "status": upload.status,
        "counts": counts(upload.items or []),
    }


def detail(upload: CatalogUpload) -> dict:
    return summary(upload) | {
        "fileSizeBytes": upload.file_size,
        "step": upload.step if upload.status == "processing" else None,
        "error": upload.error,
        "model": upload.model,
        "extractionPromptVersion": upload.extraction_prompt_version,
        "schemaVersion": upload.schema_version,
        "unusedSheets": upload.unused_sheets or [],
        "items": upload.items or [],
    }


# --- Decisiones del supervisor -----------------------------------------------------------------


def _open(upload: CatalogUpload) -> None:
    if upload.status not in OPEN:
        raise DecisionError("upload_closed")


def _item(upload: CatalogUpload, item_id: str) -> tuple[list[dict], dict]:
    items = [dict(i) for i in upload.items]
    item = next((i for i in items if i["id"] == item_id), None)
    if item is None:
        raise DecisionError("not_found", 404)
    return items, item


def _save(session: Session, upload: CatalogUpload, items: list[dict]) -> None:
    matching.refresh(session, items)
    upload.items = items
    upload.updated_at = now()
    if all(i.get("decision") for i in items):
        upload.status = "closed"
    elif any(i.get("decision") for i in items):
        upload.status = "partial"


def update_item(session: Session, upload: CatalogUpload, item_id: str, proposed: dict) -> dict:
    """Autoguardado del borrador; recalcula match y advertencias."""
    _open(upload)
    items, item = _item(upload, item_id)
    if item.get("decision"):
        raise DecisionError("already_decided")
    snake, _ = matching.coerce(matching.from_api(proposed))
    item["proposed"] = matching.to_api(snake)
    _save(session, upload, items)
    return item


def _validated(proposed_snake: dict) -> CatalogProduct:
    try:
        return CatalogProduct.model_validate(proposed_snake)
    except ValidationError as exc:
        raise DecisionError("validation", 422) from exc


def decide(
    session: Session,
    upload: CatalogUpload,
    item_id: str,
    action: str,
    user: User,
    field_choices: dict[str, str] | None = None,
    note: str | None = None,
    reason: str | None = None,
    batch: bool = False,
) -> dict:
    _open(upload)
    items, item = _item(upload, item_id)
    if item.get("decision"):
        raise DecisionError("already_decided")
    matching.refresh(session, items)
    proposed = matching.from_api(item["proposed"])
    origin = {"kind": "upload", "uploadId": upload.id, "fileName": upload.file_name, "batch": batch}
    product_id, version = None, None
    if action == "create":
        if item["match"]["status"] != "new":
            raise DecisionError("not_new")
        if matching.blocking(item):
            raise DecisionError("blocking_warnings")
        product = store.create_product(session, _validated(proposed), origin, user, note)
        product_id, version, done = product.id, 1, "created"
    elif action == "update":
        if item["match"]["status"] != "exists":
            raise DecisionError("not_existing")
        if any(w["kind"] in ("repeated_in_file", "invalid_category") for w in item["warnings"]):
            raise DecisionError("blocking_warnings")
        product = session.get(Product, item["match"]["productId"])
        merged = store.merge(store.current(product).data, matching.effective(item), field_choices)
        store.save_version(session, product, _validated(merged), origin, user, note)
        if product.status == "archived":
            store.set_status(session, product, "active", user)
        product_id, version, done = product.id, product.current_version, "updated"
    elif action == "discard":
        done = "discarded"
    else:
        raise DecisionError("validation", 422)
    item["decision"] = {
        "action": done,
        "productId": product_id,
        "version": version,
        "by": user_ref(user),
        "at": store.iso(now()),
        "batch": batch,
        "reason": reason,
    }
    _save(session, upload, items)
    return item


def create_batch(session: Session, upload: CatalogUpload, item_ids: list[str], user: User) -> int:
    """Guardado en lote (D4): solo seguros nuevos sin advertencias; se verifica de nuevo aquí."""
    _open(upload)
    if len(item_ids) > BATCH_LIMIT:
        raise DecisionError("too_many", 422)
    items = [dict(i) for i in upload.items]
    matching.refresh(session, items)
    upload.items = items
    by_id = {i["id"]: i for i in items}
    for item_id in item_ids:
        item = by_id.get(item_id)
        if item is None or item.get("decision") or item["match"]["status"] != "new" or item["warnings"]:
            raise DecisionError("not_eligible")
    for item_id in item_ids:
        decide(session, upload, item_id, "create", user, batch=True)
    return len(item_ids)
