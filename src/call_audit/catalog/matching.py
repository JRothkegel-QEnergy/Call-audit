"""Reglas (sin IA) sobre las fichas que propone una carga: si el seguro ya existe, posibles duplicados, datos
personales y campos obligatorios (Cambio 11 §4.2, D-27, L-35). Se recalculan cada vez que el supervisor edita."""

import re
import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.catalog import store
from call_audit.catalog.schema import LABELS, CatalogProduct
from call_audit.persistence.models import Product

CATEGORIES = set(CatalogProduct.model_fields["category"].annotation.__args__)
RUT = re.compile(r"\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b|\b\d{7,8}-[\dkK]\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
MOBILE = re.compile(r"(?<!\d)(?:\+?56\s?)?9\s?\d{4}\s?\d{4}(?!\d)")
# Fonos de asistencia y de la aseguradora son datos legítimos de la ficha (L-35): no se marcan.
PHONE_FIELDS = {"assistance_phone", "assistances"}


def camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(w.capitalize() for w in rest)


SNAKE = {camel(f): f for f in LABELS}


def coerce(raw: dict) -> tuple[dict, list[str]]:
    """La ficha propuesta en snake_case y válida contra el esquema. Lo que no valida se vacía y va a `missing`; una
    categoría desconocida se conserva tal cual (advertencia invalid_category) para que el supervisor la elija."""
    data = {k: v for k, v in raw.items() if k in LABELS}
    category = data.get("category")
    if category not in CATEGORIES:
        data["category"] = "RETENIBLE"
    dropped: list[str] = []
    for _ in range(len(LABELS)):
        try:
            product = CatalogProduct.model_validate(data).model_dump(mode="json")
            break
        except ValidationError as exc:
            fields = {str(e["loc"][0]) for e in exc.errors() if e["loc"]}
            if not fields or "name" in fields:
                data["name"] = str(data.get("name") or "").strip() or "(sin nombre)"
                fields.discard("name")
            for f in fields:
                data.pop(f, None)
                dropped.append(f)
    else:  # pragma: no cover - no debería pasar: cada vuelta quita al menos un campo
        raise ValueError("la ficha propuesta no valida")
    if category not in CATEGORIES:
        product["category"] = category
    return product, dropped


def to_api(snake: dict) -> dict:
    return {camel(k): v for k, v in snake.items()}


def from_api(proposed: dict) -> dict:
    return {SNAKE.get(k, k): v for k, v in proposed.items()}


def effective(item: dict) -> dict:
    """La propuesta en snake_case sin los campos que no venían en el Excel (sus valores por defecto no son datos)."""
    snake = from_api(item["proposed"])
    for field in item.get("missingFields") or []:
        snake.pop(SNAKE.get(field, field), None)
    return snake


def new_item(product: dict, sources: dict, missing: list[str]) -> dict:
    snake, dropped = coerce(product)
    return {
        "id": uuid.uuid4().hex[:12],
        "proposed": to_api(snake),
        "fieldSources": {camel(k): v for k, v in sources.items() if isinstance(v, dict)},
        "missingFields": sorted({camel(m) for m in [*missing, *dropped] if m in LABELS}),
        "match": {"status": "new"},
        "warnings": [],
        "decision": None,
    }


def strings(value: Any, path: str = "") -> list[tuple[str, str]]:
    if isinstance(value, str):
        return [(path, value)]
    if isinstance(value, list):
        return [s for i, v in enumerate(value) for s in strings(v, path)]
    if isinstance(value, dict):
        return [s for k, v in value.items() for s in strings(v, path or k)]
    return []


def personal_data(snake: dict) -> list[dict]:
    found = []
    for field, text in strings(snake):
        kinds = [("rut", RUT), ("email", EMAIL)] + ([] if field in PHONE_FIELDS else [("phone", MOBILE)])
        for kind, pattern in kinds:
            if pattern.search(text) and not any(w["field"] == camel(field) and w["dataType"] == kind for w in found):
                found.append({"kind": "possible_personal_data", "field": camel(field), "dataType": kind})
    return found


def refresh(session: Session, items: list[dict]) -> None:
    """Recalcula match y advertencias de los ítems sin decidir."""
    products = list(session.scalars(select(Product)))
    by_key = {p.key: p for p in products}
    for item in items:
        if item.get("decision"):
            continue
        snake = from_api(item["proposed"])
        key = store.product_key(snake.get("name") or "", snake.get("insurer"))
        existing = by_key.get(key)
        if existing is None:
            item["match"] = {"status": "new"}
        else:
            current = store.current(existing).data
            changes = store.diff(current, store.merge(current, effective(item)))
            state = "archived" if existing.status == "archived" else "changed" if changes else "unchanged"
            item["match"] = {
                "status": "exists",
                "state": state,
                "productId": existing.id,
                "version": existing.current_version,
                "changes": changes,
            }
        item["warnings"] = warnings(snake, key, item, items, products)


def warnings(snake: dict, key: str, item: dict, items: list[dict], products: list[Product]) -> list[dict]:
    out: list[dict] = []
    for other in items:
        if other is item or (other.get("decision") or {}).get("action") == "discarded":
            continue
        o = from_api(other["proposed"])
        if store.product_key(o.get("name") or "", o.get("insurer")) == key:
            out.append({"kind": "repeated_in_file", "otherItemId": other["id"]})
    if not str(snake.get("name") or "").strip() or snake.get("name") == "(sin nombre)":
        out.append({"kind": "missing_required", "field": "name"})
    if snake.get("category") not in CATEGORIES:
        out.append({"kind": "invalid_category", "value": str(snake.get("category"))})
    elif "category" in item.get("missingFields", []):
        out.append({"kind": "missing_required", "field": "category"})
    if not snake.get("system_names") and not snake.get("policies"):
        out.append({"kind": "missing_required", "field": "identifier"})
    policies = {store.digits(p) for p in snake.get("policies") or [] if len(store.digits(p)) >= 3}
    names = {store.normalize(n) for n in snake.get("system_names") or []}
    for p in products:
        if p.key == key:
            continue
        data = store.current(p).data
        shared_policy = policies & {store.digits(x) for x in data.get("policies") or []}
        shared_name = names & {store.normalize(n) for n in data.get("system_names") or []}
        for via, values in (("policy", shared_policy), ("system_name", shared_name)):
            for value in sorted(values):
                out.append(
                    {
                        "kind": "possible_duplicate",
                        "productId": p.id,
                        "productName": data["name"],
                        "insurer": data.get("insurer"),
                        "via": via,
                        "value": value,
                    }
                )
    return out + personal_data(snake)


BLOCKING = {"repeated_in_file", "missing_required", "invalid_category"}


def blocking(item: dict) -> bool:
    return any(w["kind"] in BLOCKING for w in item["warnings"])
