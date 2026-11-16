from call_audit.catalog.detail import sheet_detail

PRODUCT = {
    "id": "P99",
    "name": "Seguro sintético",
    "category": "RETENIBLE",
    "premium_type": "mensual",
    "withdrawal": "Sí, 10 días",
    "assistance_phone": "600 000 000",
    "coverages": [{"name": "Muerte accidental", "amount": "UF 100"}],
    "assistances": [
        {"name": "Examen de colon", "detail": "Sangre oculta en deposiciones", "events": "1 por año"},
        {"name": "", "detail": None},
    ],
    "premiums": [],
    "observations": ["Obs. 1", " "],
    "extra_info": [{"title": "Tasas", "text": "0,5 por mil"}],
    "policies": ["123"],
    "a_new_field": "valor",
}


def test_sections_in_order_without_empty_ones() -> None:
    keys = [s["key"] for s in sheet_detail(PRODUCT)]
    assert keys == ["summary", "coverages", "assistances", "notes", "identification", "other"]


def test_assistances_table_drops_empty_rows_and_columns() -> None:
    section = next(s for s in sheet_detail(PRODUCT) if s["key"] == "assistances")
    assert section["rows"] == [{"label": "Fono de asistencias", "value": "600 000 000"}]
    table = section["tables"][0]
    assert [c["key"] for c in table["columns"]] == ["name", "detail", "events"]
    assert table["rows"] == [
        {"name": "Examen de colon", "detail": "Sangre oculta en deposiciones", "events": "1 por año"}
    ]


def test_labels_and_unknown_fields() -> None:
    sections = {s["key"]: s for s in sheet_detail(PRODUCT)}
    summary = {r["label"]: r["value"] for r in sections["summary"]["rows"]}
    assert summary["Categoría"] == "Retenible"
    assert summary["Tipo de prima"] == "Mensual"
    assert sections["notes"]["texts"] == [
        {"title": "Observaciones", "text": "Obs. 1"},
        {"title": "Tasas", "text": "0,5 por mil"},
    ]
    assert sections["other"]["rows"] == [{"label": "a_new_field", "value": "valor"}]


def test_no_product() -> None:
    assert sheet_detail(None) == []
