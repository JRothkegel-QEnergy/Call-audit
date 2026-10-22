"""Ficha de un seguro del catálogo (Cambio 11). Un solo modelo sirve para guardar (snake_case, mismo formato que
products.json), para la API (camelCase) y para el JSON Schema que llena la IA al extraer un Excel.

Versión del esquema: SCHEMA_VERSION. Si cambia un campo, se sube y se anota en el CHANGELOG (trazabilidad).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# 1.1.0 (2026-10-22): exclusiones, tasas y edad máxima por plazo del crédito; póliza/tabla y nota en primas; plazo de
# cobertura en siniestros. Son hojas del Excel de apoyo que la 1.0.0 no tenía dónde guardar.
SCHEMA_VERSION = "1.1.0"

ProductCategory = Literal[
    "RETENIBLE",
    "NO_RETENIBLE",
    "NO_RENUNCIABLE_COSTO_BANCO",
    "NO_RENUNCIABLE_SUCURSAL",
    "NO_RENUNCIABLE_SUBSIDIADO",
    "NO_RENUNCIABLE_OBLIGATORIO",
]
PremiumType = Literal["mensual", "anual", "credito", "sin_dato"]


class _Model(BaseModel):
    # Los números del Excel (prima 0.65, plazo 240) se guardan como texto, igual que en products.json.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, coerce_numbers_to_str=True)


class Coverage(_Model):
    name: str
    amount: str | None = None
    detail: str | None = None
    beneficiary: str | None = None


class Assistance(_Model):
    name: str
    detail: str | None = None
    events: str | None = None
    cap: str | None = None
    phone: str | None = None


class Premium(_Model):
    plan: str | None = None
    insured: str | None = None
    age_band: str | None = None
    amount_insured: str | None = None
    premium_uf: str | None = None
    premium_clp: str | None = None
    periodicity: str | None = None
    policy_table: str | None = None  # póliza o tabla a la que corresponde la prima
    note: str | None = None


class Claim(_Model):
    coverage: str | None = None
    deadline: str | None = None
    channel: str | None = None
    documents: str | None = None
    coverage_term: str | None = None  # plazo de cobertura (ej. "Hasta 2 horas desde el giro")


class Exclusion(_Model):
    type: str | None = None
    detail: str | None = None


class CreditRate(_Model):
    """Tasa por mil sobre el monto del crédito, según plazo (seguros asociados a créditos)."""

    coverage: str | None = None
    term_from: str | None = None  # meses
    term_to: str | None = None
    net_rate: str | None = None
    vat: str | None = None
    gross_rate: str | None = None
    note: str | None = None


class MaxAgeByTerm(_Model):
    """Edad máxima del asegurado al otorgar el crédito, según plazo."""

    term_from: str | None = None  # meses
    term_to: str | None = None
    max_age: str | None = None


class DisabilityRow(_Model):
    from_day: str | None = None
    to_day: str | None = None
    amount: str | None = None


class ExtraInfo(_Model):
    """Lo del Excel que no calza en otro campo (tasas, edades por plazo, notas de la aseguradora), tal cual. Se guarda
    y se muestra en la ficha, pero no va al prompt de validación."""

    title: str
    text: str
    source: str | None = None  # "Hoja X · fila N"


class CatalogProduct(_Model):
    # Identificación. Clave única del catálogo: nombre normalizado + aseguradora (D-27).
    name: str = Field(min_length=1)
    insurer: str | None = None
    category: ProductCategory
    system_names: list[str] = []
    policies: list[str] = []
    policies_note: str | None = None
    identification_notes: str | None = None  # "Descripción para identificarlo"
    channels: list[str] = []
    # Condiciones generales
    premium_type: PremiumType = "sin_dato"
    premium_mode: str | None = None
    insured_capital: str | None = None
    min_entry_age: str | None = None
    max_entry_age: str | None = None
    max_stay_age: str | None = None
    claim_deadline_days: str | None = None
    premium_refund: str | None = None
    withdrawal: str | None = None
    coverage_start: str | None = None
    solidarity_support: str | None = None
    assistance_phone: str | None = None
    notes: str | None = None
    category_detail: str | None = None
    # Tablas
    coverages: list[Coverage] = []
    assistances: list[Assistance] = []
    premiums: list[Premium] = []
    claims: list[Claim] = []
    temporary_disability_table: list[DisabilityRow] = []
    observations: list[str] = []
    exclusions: list[Exclusion] = []
    credit_rates: list[CreditRate] = []
    max_age_by_term: list[MaxAgeByTerm] = []
    extra_info: list[ExtraInfo] = []


# Etiquetas en español para el historial y la comparación "Actual vs Propuesto".
LABELS = {
    "name": "Nombre del seguro",
    "insurer": "Aseguradora",
    "category": "Categoría",
    "system_names": "Nombres en sistema",
    "policies": "N° de póliza",
    "policies_note": "Nota de las pólizas",
    "identification_notes": "Descripción para identificarlo",
    "channels": "Canales",
    "premium_type": "Tipo de prima",
    "premium_mode": "Modalidad de prima",
    "insured_capital": "Capital asegurado",
    "min_entry_age": "Edad mínima de ingreso",
    "max_entry_age": "Edad máxima de ingreso",
    "max_stay_age": "Edad máxima de permanencia",
    "claim_deadline_days": "Plazo para denunciar siniestros (días)",
    "premium_refund": "Devolución de prima",
    "withdrawal": "Retracto",
    "coverage_start": "Inicio de cobertura",
    "solidarity_support": "Apoyo solidario",
    "assistance_phone": "Fono de asistencias",
    "notes": "Notas",
    "category_detail": "Detalle de la categoría",
    "coverages": "Coberturas",
    "assistances": "Asistencias",
    "premiums": "Primas por plan",
    "claims": "Siniestros",
    "temporary_disability_table": "Incapacidad temporal",
    "observations": "Observaciones",
    "exclusions": "Exclusiones",
    "credit_rates": "Tasas por plazo del crédito",
    "max_age_by_term": "Edad máxima por plazo del crédito",
    "extra_info": "Información adicional",
}
REQUIRED = ("name", "category")
