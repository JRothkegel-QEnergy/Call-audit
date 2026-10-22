"""Catálogo de seguros del supervisor (Cambio 11). Todo exige el permiso manage_catalog (D-28).

Los errores que el front distingue van como código corto en `detail` (duplicate_key, version_conflict, ...).
El Excel se sube como cuerpo binario con el nombre en el encabezado X-File-Name (sin multipart).
"""

from typing import Annotated, Literal
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ValidationError
from sqlalchemy import select

from call_audit.api.deps import DbSession, supervisor
from call_audit.catalog import store, uploads
from call_audit.catalog.extract import UploadError, check_file
from call_audit.catalog.matching import from_api, to_api
from call_audit.catalog.schema import CatalogProduct
from call_audit.persistence.models import AccessLog, CatalogUpload, Product, User

router = APIRouter(prefix="/api/catalog")
PERMISSION = "manage_catalog"


def catalog_manager(user: Annotated[User, Depends(supervisor)]) -> User:
    if PERMISSION not in (user.permissions or []):
        raise HTTPException(403, "Sin permiso para gestionar el catálogo")
    return user


Manager = Annotated[User, Depends(catalog_manager)]


def log(session, user: User, action: str, target: str) -> None:
    session.add(AccessLog(user_id=user.id, action=f"catalog.{action}", target=target[:100]))


def get_product(session, product_id: str) -> Product:
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(404, "not_found")
    return product


def get_upload(session, upload_id: str) -> CatalogUpload:
    upload = session.get(CatalogUpload, upload_id)
    if upload is None:
        raise HTTPException(404, "not_found")
    return upload


def version_out(v) -> dict:
    return {
        "version": v.version,
        "createdAt": store.iso(v.created_at),
        "author": uploads.user_ref(v.author),
        "origin": v.origin,
        "note": v.note,
    }


def detail(product: Product) -> dict:
    summary = store.summary(product)
    for key in ("name", "insurer", "category", "policies", "systemNames"):
        summary.pop(key)
    return summary | {"product": to_api(store.current(product).data)}


def parse_product(data: dict) -> CatalogProduct:
    try:
        return CatalogProduct.model_validate(from_api(data))
    except ValidationError as exc:
        raise HTTPException(422, "validation") from exc


def save(fn):
    try:
        return fn()
    except store.DuplicateKeyError as exc:
        raise HTTPException(409, "duplicate_key") from exc
    except store.VersionConflictError as exc:
        raise HTTPException(409, "version_conflict") from exc
    except uploads.DecisionError as exc:
        raise HTTPException(exc.status, exc.code) from exc


# --- Seguros ------------------------------------------------------------------------------------


@router.get("/products")
def list_products(
    session: DbSession,
    _: Manager,
    query: str | None = None,
    insurer: str | None = None,
    category: str | None = None,
    status: str = "active",
    incomplete: bool | None = None,
):
    out = []
    needle = store.normalize(query) if query else ""
    for product in session.scalars(select(Product).order_by(Product.id)):
        s = store.summary(product)
        if status != "all" and s["status"] != status:
            continue
        if insurer and (s["insurer"] or "") != insurer:
            continue
        if category and s["category"] != category:
            continue
        if incomplete is not None and s["incomplete"] != incomplete:
            continue
        if needle:
            haystack = [s["name"], *s["systemNames"]]
            if not any(needle in store.normalize(h) for h in haystack) and not any(
                store.digits(needle) and store.digits(needle) in store.digits(p) for p in s["policies"]
            ):
                continue
        out.append(s)
    return out


@router.get("/products/{product_id}")
def product_detail(product_id: str, session: DbSession, _: Manager):
    return detail(get_product(session, product_id))


@router.get("/products/{product_id}/versions")
def product_versions(product_id: str, session: DbSession, _: Manager):
    return [version_out(v) for v in reversed(get_product(session, product_id).versions)]


@router.get("/products/{product_id}/versions/{version}")
def product_version(product_id: str, version: int, session: DbSession, _: Manager):
    product = get_product(session, product_id)
    found = next((v for v in product.versions if v.version == version), None)
    if found is None:
        raise HTTPException(404, "not_found")
    previous = next((v for v in product.versions if v.version == version - 1), None)
    return {
        "version": version_out(found),
        "product": to_api(found.data),
        "changes": store.diff(previous.data, found.data) if previous else [],
    }


class UpdateProduct(BaseModel):
    product: dict
    baseVersion: int
    note: str | None = None


@router.put("/products/{product_id}")
def update_product(product_id: str, body: UpdateProduct, session: DbSession, user: Manager):
    product = get_product(session, product_id)
    data = parse_product(body.product)
    save(lambda: store.save_version(session, product, data, {"kind": "manual"}, user, body.note, body.baseVersion))
    log(session, user, "edit", product_id)
    session.commit()
    return detail(product)


class StatusBody(BaseModel):
    status: Literal["active", "archived"]


@router.post("/products/{product_id}/status", status_code=204)
def product_status(product_id: str, body: StatusBody, session: DbSession, user: Manager):
    product = get_product(session, product_id)
    if body.status == "active":
        # Reactivar no puede chocar con otra ficha que haya tomado el mismo nombre + aseguradora.
        data = store.current(product).data
        other = store.find_by_key(session, store.product_key(data["name"], data.get("insurer")))
        if other is not None and other.id != product.id:
            raise HTTPException(409, "duplicate_key")
    store.set_status(session, product, body.status, user)
    log(session, user, "archive" if body.status == "archived" else "reactivate", product_id)
    session.commit()


class RestoreBody(BaseModel):
    note: str | None = None


@router.post("/products/{product_id}/versions/{version}/restore")
def restore_version(product_id: str, version: int, body: RestoreBody, session: DbSession, user: Manager):
    product = get_product(session, product_id)
    found = next((v for v in product.versions if v.version == version), None)
    if found is None:
        raise HTTPException(404, "not_found")
    data = parse_product(to_api(found.data))
    origin = {"kind": "restore", "fromVersion": version}
    save(lambda: store.save_version(session, product, data, origin, user, body.note))
    log(session, user, "restore", f"{product_id} v{version}")
    session.commit()
    return detail(product)


# --- Cargas -------------------------------------------------------------------------------------


@router.post("/uploads")
async def upload_catalog(
    request: Request,
    session: DbSession,
    user: Manager,
    x_file_name: Annotated[str, Header()],
):
    name = unquote(x_file_name)
    content = await request.body()
    try:
        check_file(name, content)
    except UploadError as exc:
        status = {"too_large": 413, "password_protected": 422}.get(exc.code, 400)
        raise HTTPException(status, exc.code) from exc
    upload = CatalogUpload(file_name=name[:255], file_size=len(content), content=content, uploaded_by=user)
    session.add(upload)
    session.flush()
    log(session, user, "upload", upload.id)
    session.commit()
    return {"uploadId": upload.id}


@router.get("/uploads")
def list_uploads(session: DbSession, _: Manager):
    rows = session.scalars(select(CatalogUpload).order_by(CatalogUpload.uploaded_at.desc()))
    return [uploads.summary(u) for u in rows]


@router.get("/uploads/{upload_id}")
def upload_detail(upload_id: str, session: DbSession, _: Manager):
    return uploads.detail(get_upload(session, upload_id))


@router.post("/uploads/{upload_id}/retry", status_code=204)
def retry_upload(upload_id: str, session: DbSession, user: Manager):
    upload = get_upload(session, upload_id)
    if upload.status != "failed" or not upload.content:
        raise HTTPException(409, "not_failed")
    upload.status, upload.step, upload.error, upload.error_detail = "processing", "reading", None, None
    log(session, user, "retry", upload_id)
    session.commit()


class ItemBody(BaseModel):
    proposed: dict


@router.put("/uploads/{upload_id}/items/{item_id}")
def update_item(upload_id: str, item_id: str, body: ItemBody, session: DbSession, _: Manager):
    upload = get_upload(session, upload_id)
    item = save(lambda: uploads.update_item(session, upload, item_id, body.proposed))
    session.commit()
    return item


class DecideBody(BaseModel):
    action: Literal["create", "update", "discard"]
    fieldChoices: dict[str, Literal["keep", "proposed"]] | None = None
    note: str | None = None
    reason: str | None = None


@router.post("/uploads/{upload_id}/items/{item_id}/decision")
def decide_item(upload_id: str, item_id: str, body: DecideBody, session: DbSession, user: Manager):
    upload = get_upload(session, upload_id)
    item = save(
        lambda: uploads.decide(session, upload, item_id, body.action, user, body.fieldChoices, body.note, body.reason)
    )
    log(session, user, f"decide.{body.action}", f"{upload_id}/{item_id}")
    session.commit()
    return item


class BatchBody(BaseModel):
    itemIds: list[str]


@router.post("/uploads/{upload_id}/batch", status_code=204)
def create_batch(upload_id: str, body: BatchBody, session: DbSession, user: Manager):
    upload = get_upload(session, upload_id)
    save(lambda: uploads.create_batch(session, upload, body.itemIds, user))
    log(session, user, "batch", f"{upload_id} ({len(body.itemIds)})")
    session.commit()


@router.post("/uploads/{upload_id}/discard", status_code=204)
def discard_upload(upload_id: str, session: DbSession, user: Manager):
    upload = get_upload(session, upload_id)
    # Lo ya guardado se mantiene; el archivo original se borra (L-35).
    upload.status, upload.content = "discarded", None
    log(session, user, "discard", upload_id)
    session.commit()


@router.get("/uploads/{upload_id}/file-url")
def upload_file_url(upload_id: str, session: DbSession, _: Manager):
    upload = get_upload(session, upload_id)
    if not upload.content:
        raise HTTPException(404, "not_found")
    return {"url": f"/api/catalog/uploads/{upload_id}/file"}


@router.get("/uploads/{upload_id}/file")
def upload_file(upload_id: str, session: DbSession, user: Manager):
    upload = get_upload(session, upload_id)
    if not upload.content:
        raise HTTPException(404, "not_found")
    log(session, user, "download", upload_id)
    session.commit()
    return Response(
        upload.content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(upload.file_name)}"},
    )
