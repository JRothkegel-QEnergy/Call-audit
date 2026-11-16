"""Ficha completa del catálogo para el revisor (11-ficha-completa.md, K3/K6): secciones ya rotuladas en español que el
front pinta tal cual. Sale de la misma ficha (y versión) que vio la IA, para que el revisor pueda verificar lo que cita.

Acepta el formato de la base (`ProductVersion.data`) y el de products.json (pólizas como texto). Las secciones y filas
vacías no se envían. Un campo del catálogo que no esté en ninguna sección cae en «Otros datos», así no se pierde.
"""

from typing import Any

from call_audit.catalog.schema import LABELS

CATEGORY_LABEL = {
    "RETENIBLE": "Retenible",
    "NO_RETENIBLE": "No retenible",
    "NO_RENUNCIABLE_COSTO_BANCO": "No renunciable (costo banco)",
    "NO_RENUNCIABLE_SUCURSAL": "No renunciable (sucursal)",
    "NO_RENUNCIABLE_SUBSIDIADO": "No renunciable (subsidiado)",
    "NO_RENUNCIABLE_OBLIGATORIO": "No renunciable (obligatorio)",
}
PREMIUM_TYPE_LABEL = {"mensual": "Mensual", "anual": "Anual", "credito": "Crédito", "sin_dato": None}

# Columnas de cada tabla del catálogo: (campo, rótulo).
COLUMNS: dict[str, list[tuple[str, str]]] = {
    "coverages": [("name", "Cobertura"), ("amount", "Monto"), ("detail", "Detalle"), ("beneficiary", "Beneficiario")],
    "assistances": [
        ("name", "Asistencia"),
        ("detail", "Detalle"),
        ("events", "Eventos"),
        ("cap", "Tope"),
        ("phone", "Fono"),
    ],
    "exclusions": [("type", "Tipo"), ("detail", "Detalle")],
    "premiums": [
        ("plan", "Plan"),
        ("insured", "Asegurado"),
        ("age_band", "Tramo de edad"),
        ("amount_insured", "Monto asegurado"),
        ("premium_uf", "Prima UF"),
        ("premium_clp", "Prima CLP"),
        ("periodicity", "Periodicidad"),
        ("policy_table", "Póliza o tabla"),
        ("note", "Nota"),
    ],
    "claims": [
        ("coverage", "Cobertura"),
        ("deadline", "Plazo"),
        ("channel", "Canal"),
        ("documents", "Documentos"),
        ("coverage_term", "Plazo de cobertura"),
    ],
    "credit_rates": [
        ("coverage", "Cobertura"),
        ("term_from", "Desde (meses)"),
        ("term_to", "Hasta (meses)"),
        ("net_rate", "Tasa neta"),
        ("vat", "IVA"),
        ("gross_rate", "Tasa bruta"),
        ("note", "Nota"),
    ],
    "max_age_by_term": [("term_from", "Desde (meses)"), ("term_to", "Hasta (meses)"), ("max_age", "Edad máxima")],
    "temporary_disability_table": [("from_day", "Desde el día"), ("to_day", "Hasta el día"), ("amount", "Monto")],
}

# (clave, título, campos sueltos, tablas, textos). Orden de 11-ficha-completa.md §3.3.
SECTIONS: list[tuple[str, str, list[str], list[str], list[str]]] = [
    (
        "summary",
        "Resumen",
        [
            "category",
            "category_detail",
            "premium_type",
            "premium_mode",
            "insured_capital",
            "min_entry_age",
            "max_entry_age",
            "max_stay_age",
            "coverage_start",
            "premium_refund",
            "withdrawal",
        ],
        [],
        [],
    ),
    ("coverages", "Coberturas", [], ["coverages"], []),
    ("assistances", "Asistencias", ["assistance_phone"], ["assistances"], []),
    ("exclusions", "Exclusiones", [], ["exclusions"], []),
    ("premiums", "Primas por plan", [], ["premiums"], []),
    ("claims", "Siniestros", ["claim_deadline_days", "solidarity_support"], ["claims"], []),
    ("credit", "Crédito", [], ["credit_rates", "max_age_by_term", "temporary_disability_table"], []),
    ("notes", "Notas y observaciones", [], [], ["notes", "observations", "extra_info"]),
    (
        "identification",
        "Identificación",
        ["system_names", "identification_notes", "channels", "policies", "policies_note"],
        [],
        [],
    ),
]
# Metadatos del archivo o ya visibles en el encabezado de la ficha.
SKIP = {"id", "catalog_id", "version", "source_sheet", "name", "insurer"}


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        value = ", ".join(str(v) for v in value if str(v).strip())
    text = str(value).strip()
    return text or None


def _field(key: str, value: Any) -> str | None:
    if key == "category":
        return CATEGORY_LABEL.get(str(value), _text(value))
    if key == "premium_type":
        return PREMIUM_TYPE_LABEL.get(str(value), _text(value))
    return _text(value)


def _table(key: str, items: Any, same_as: dict[str, str | None] | None = None) -> dict | None:
    """`same_as`: columnas que se omiten si todas las filas repiten el valor general (ej. el fono de asistencias)."""
    columns = COLUMNS[key]
    rows = [{col: _text(item.get(col)) for col, _ in columns} for item in items or [] if isinstance(item, dict)]
    rows = [row for row in rows if any(row.values())]
    if not rows:
        return None
    repeated = {
        col for col, value in (same_as or {}).items() if value and all(row[col] in (None, value) for row in rows)
    }
    used = [(col, label) for col, label in columns if col not in repeated and any(row[col] for row in rows)]
    return {
        "title": LABELS.get(key, key),
        "columns": [{"key": col, "label": label} for col, label in used],
        "rows": [{col: row[col] or "" for col, _ in used} for row in rows],
    }


def _texts(key: str, value: Any) -> list[dict]:
    if key == "extra_info":
        return [
            {"title": _text(x.get("title")), "text": t}
            for x in value or []
            if isinstance(x, dict) and (t := _text(x.get("text")))
        ]
    if isinstance(value, list):
        return [{"title": None, "text": t} for v in value if (t := _text(v))]
    t = _text(value)
    return [{"title": None, "text": t}] if t else []


def sheet_detail(data: dict | None) -> list[dict]:
    """Secciones de la ficha completa: `{key, title, rows?, tables?, texts?}`. Vacía si no hay ficha."""
    if not data:
        return []
    out: list[dict] = []
    used = set(SKIP)
    for key, title, fields, tables, texts in SECTIONS:
        used.update(fields, tables, texts)
        section: dict[str, Any] = {"key": key, "title": title}
        rows = [{"label": LABELS.get(f, f), "value": v} for f in fields if (v := _field(f, data.get(f)))]
        phone = {"phone": _text(data.get("assistance_phone"))}
        built = [t for name in tables if (t := _table(name, data.get(name), phone if name == "assistances" else None))]
        notes = [
            {"title": n["title"] or LABELS.get(name, name), "text": n["text"]}
            for name in texts
            for n in _texts(name, data.get(name))
        ]
        if rows:
            section["rows"] = rows
        if built:
            section["tables"] = built
        if notes:
            section["texts"] = notes
        if len(section) > 2:
            out.append(section)
    other = [
        {"label": LABELS.get(k, k), "value": v}
        for k in data
        if k not in used and not isinstance(data[k], (list, dict)) and (v := _text(data[k]))
    ]
    if other:
        out.append({"key": "other", "title": "Otros datos", "rows": other})
    return out
