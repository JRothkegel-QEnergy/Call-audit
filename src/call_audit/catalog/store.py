"""Catálogo de seguros en la base (Cambio 11): clave única, versiones, comparación y foto para el pipeline.

La ficha se guarda en snake_case con el mismo formato que products.json, salvo `policies`, que pasa a lista. El
pipeline recibe una foto (snapshot) con el formato antiguo, así render.py y catalog_match.py no cambian.
"""

import re
import unicodedata
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from call_audit.catalog.schema import LABELS, SCHEMA_VERSION, CatalogProduct
from call_audit.persistence.models import CatalogReference, Product, ProductVersion, User, now

NO_INSURER = "SIN ASEGURADORA"
NEW_ID_PREFIX = "C"
# "POL 1 2015 0767", "84-8401-1100", "P120130161", "400": lo que parece un número de póliza dentro del texto del Excel.
POLICY = re.compile(r"POL \d+ \d{4} \d{4}|\b[A-Z]?\d[\d-]+\d\b")


class DuplicateKeyError(Exception):
    def __init__(self, product_id: str):
        super().__init__(product_id)
        self.product_id = product_id


class VersionConflictError(Exception):
    pass


def normalize(text: str | None) -> str:
    """Igual que catalog_match.normalize: sin tildes, mayúsculas y espacios colapsados."""
    plain = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return " ".join(plain.upper().split())


def product_key(name: str, insurer: str | None) -> str:
    return f"{normalize(name)}|{normalize(insurer) or NO_INSURER}"


def digits(text: str) -> str:
    return re.sub(r"\D", "", text)


# --- Formato antiguo (products.json) ------------------------------------------------------


def from_legacy(item: dict) -> CatalogProduct:
    """Un producto de products.json. Las pólizas venían como texto libre: se separan y el texto queda como nota."""
    data = {k: v for k, v in item.items() if k not in ("id", "source_sheet", "version")}
    raw = str(item.get("policies") or "").strip()
    policies = [m.group() for m in POLICY.finditer(raw)]
    data["policies"] = policies
    data["policies_note"] = raw if raw and " / ".join(policies) != raw else None
    data["insurer"] = item.get("insurer") or None
    return CatalogProduct.model_validate(data)


# Se guardan y se muestran en la ficha, pero no van al prompt de validación (render.py tampoco los lee).
NOT_IN_PROMPT = ("extra_info", "policies_note", "identification_notes", "exclusions", "credit_rates", "max_age_by_term")


def to_legacy(product_id: str, version: int, data: dict) -> dict:
    """Lo que leen render.py y catalog_match.py, sin los campos de NOT_IN_PROMPT."""
    out = {k: v for k, v in data.items() if k not in NOT_IN_PROMPT}
    out["policies"] = " / ".join(data.get("policies") or []) or None
    # Solo los retenibles tienen ficha: render.py arma la ficha si hay id y catalog_match busca por similitud solo
    # entre los que tienen id. Los demás (no retenibles, no renunciables) se reconocen por nombre en sistema.
    out["id"] = product_id if data.get("category") == "RETENIBLE" else None
    out["catalog_id"] = product_id
    out["version"] = version
    return out


# --- Lectura ---------------------------------------------------------------------------------


def current(product: Product) -> ProductVersion:
    return next(v for v in product.versions if v.version == product.current_version)


def snapshot(session: Session) -> dict:
    """Catálogo vigente con el formato de products.json; solo fichas activas (las archivadas no entran al match)."""
    reference = session.scalar(select(CatalogReference).order_by(CatalogReference.id.desc()))
    products = session.scalars(select(Product).where(Product.status == "active").order_by(Product.id))
    out = dict(reference.data) if reference else {"payment_methods": {}, "procedures": []}
    out["products"] = [to_legacy(p.id, p.current_version, current(p).data) for p in products]
    return out


def find_by_key(session: Session, key: str) -> Product | None:
    return session.scalar(select(Product).where(Product.key == key))


# --- Escritura -----------------------------------------------------------------------------


def next_id(session: Session) -> str:
    ids = session.scalars(select(Product.id).where(Product.id.like(f"{NEW_ID_PREFIX}%")))
    numbers = [int(i[len(NEW_ID_PREFIX) :]) for i in ids if i[len(NEW_ID_PREFIX) :].isdigit()]
    return f"{NEW_ID_PREFIX}{max(numbers, default=0) + 1:04d}"


def create_product(
    session: Session,
    data: CatalogProduct,
    origin: dict,
    author: User | None,
    note: str | None = None,
    product_id: str | None = None,
) -> Product:
    key = product_key(data.name, data.insurer)
    existing = find_by_key(session, key)
    if existing is not None:
        raise DuplicateKeyError(existing.id)
    product = Product(id=product_id or next_id(session), key=key, current_version=1, updated_by=author)
    product.versions.append(
        ProductVersion(
            version=1,
            data=data.model_dump(mode="json"),
            schema_version=SCHEMA_VERSION,
            origin=origin,
            note=note,
            author=author,
        )
    )
    session.add(product)
    session.flush()
    return product


def save_version(
    session: Session,
    product: Product,
    data: CatalogProduct,
    origin: dict,
    author: User | None,
    note: str | None = None,
    base_version: int | None = None,
) -> Product:
    """Nueva versión de una ficha. Nunca se sobrescribe la anterior."""
    if base_version is not None and base_version != product.current_version:
        raise VersionConflictError()
    key = product_key(data.name, data.insurer)
    other = find_by_key(session, key)
    if other is not None and other.id != product.id:
        raise DuplicateKeyError(other.id)
    product.key = key
    product.current_version += 1
    product.updated_at = now()
    product.updated_by = author
    product.versions.append(
        ProductVersion(
            version=product.current_version,
            data=data.model_dump(mode="json"),
            schema_version=SCHEMA_VERSION,
            origin=origin,
            note=note,
            author=author,
        )
    )
    session.flush()
    return product


def set_status(session: Session, product: Product, status: str, author: User) -> None:
    """Archivar o reactivar no cambia la ficha: queda en el historial como una nota de la versión vigente."""
    product.status = status
    product.updated_at = now()
    product.updated_by = author
    session.flush()


def seed(session: Session, catalog: dict) -> int:
    """Carga inicial (D-31): cada producto de products.json entra como v1 con su id actual."""
    if session.scalar(select(func.count()).select_from(Product)):
        raise SystemExit("El catálogo ya tiene seguros: la carga inicial solo corre sobre una base vacía.")
    products = [(item["id"], from_legacy(item)) for item in catalog["products"]]
    keys: dict[str, str] = {}
    for pid, data in products:
        key = product_key(data.name, data.insurer)
        if key in keys:
            raise SystemExit(f"{pid} y {keys[key]} tienen el mismo nombre y aseguradora: resuélvelo antes de cargar.")
        keys[key] = pid
    session.add(CatalogReference(data={k: v for k, v in catalog.items() if k != "products"}))
    for pid, data in products:
        create_product(session, data, {"kind": "initial_load"}, None, product_id=pid)
    return len(products)


# --- Comparación -------------------------------------------------------------------------------

NAMED_TABLES = {"coverages": "name", "assistances": "name"}
EMPTY = (None, "", [], "sin_dato")


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


def diff(before: dict, after: dict) -> list[dict]:
    """Campos distintos entre dos fichas (snake_case), con ruta camelCase y etiqueta en español para la UI."""
    changes = []
    for field, label in LABELS.items():
        old, new = before.get(field), after.get(field)
        if old == new or (not old and not new):
            continue
        if field in NAMED_TABLES and isinstance(old, list) and isinstance(new, list):
            changes += _diff_named(field, label, old, new)
            continue
        kind = "added" if not old else "removed" if not new else "changed"
        changes.append({"path": _camel(field), "label": label, "kind": kind, "before": old, "after": new})
    return changes


def _diff_named(field: str, label: str, old: list[dict], new: list[dict]) -> list[dict]:
    key = NAMED_TABLES[field]
    olds, news = {r.get(key): r for r in old}, {r.get(key): r for r in new}
    out = []
    for name in list(olds) + [n for n in news if n not in olds]:
        a, b = olds.get(name), news.get(name)
        if a == b:
            continue
        path = f"{_camel(field)}[{name}]"
        if a is None or b is None:
            out.append(
                {
                    "path": path,
                    "label": f"{label} · {name}",
                    "kind": "added" if a is None else "removed",
                    "before": a,
                    "after": b,
                }
            )
            continue
        for sub in sorted(set(a) | set(b)):
            if a.get(sub) != b.get(sub):
                out.append(
                    {
                        "path": f"{path}.{_camel(sub)}",
                        "label": f"{label} · {name} · {sub}",
                        "kind": "changed",
                        "before": a.get(sub),
                        "after": b.get(sub),
                    }
                )
    return out


def merge(existing: dict, proposed: dict, choices: dict[str, str] | None = None) -> dict:
    """Ficha resultante al actualizar desde una carga. Por defecto: un campo vacío en el Excel no borra el actual, y
    las pólizas y nombres en sistema se unen. `choices` (ruta camelCase → keep | proposed) gana sobre eso."""
    out = dict(existing)
    for field in LABELS:
        new = proposed.get(field)
        if field in ("policies", "system_names", "channels"):
            out[field] = list(dict.fromkeys([*(existing.get(field) or []), *(new or [])]))
        elif new not in EMPTY:
            out[field] = new
    for path, choice in (choices or {}).items():
        field = next((f for f in LABELS if _camel(f) == path.split("[")[0].split(".")[0]), None)
        if field is None:
            continue
        out[field] = existing.get(field) if choice == "keep" else proposed.get(field)
    return out


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def summary(product: Product) -> dict[str, Any]:
    data = current(product).data
    return {
        "id": product.id,
        "name": data["name"],
        "insurer": data.get("insurer"),
        "category": data["category"],
        "policies": data.get("policies") or [],
        "systemNames": data.get("system_names") or [],
        "status": product.status,
        "version": product.current_version,
        "updatedAt": iso(product.updated_at),
        "updatedBy": {"id": product.updated_by.id, "name": product.updated_by.name} if product.updated_by else None,
        "incomplete": not data.get("system_names") and not data.get("policies"),
    }
