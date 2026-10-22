"""Extracción de fichas desde un Excel subido por el supervisor (Cambio 11). La IA solo propone: pasa el Excel al
esquema de CatalogProduct. Los duplicados y los datos personales los detectan reglas (matching.py), sin IA.

Dos pasos para que un Excel grande no corte la respuesta: (1) la IA lista los seguros; (2) extrae sus fichas de a
BATCH. El modelo sale de scripts/prompt_bench/models.toml (CATALOG_MODEL); el prompt está versionado en
prompts/catalog_extraction/v<EXTRACTION_PROMPT_VERSION>/.
"""

import io
import json
import tomllib
import zipfile
from dataclasses import dataclass, field

from call_audit.catalog.schema import CatalogProduct
from call_audit.config import ROOT

# 1.1.0 (2026-10-22): lista también los no retenibles / no renunciables y llena exclusiones, tasas y edad máxima por
# plazo (esquema 1.1.0). En la corrida real con la 1.0.0 (Apoyo_Seguros_MetLife_HDI.xlsx, US$1,02) se le pasaron los 19
# seguros sin ficha y esas hojas quedaron a medias en "Información adicional".
EXTRACTION_PROMPT_VERSION = "1.1.0"
PROMPT_DIR = ROOT / "prompts" / "catalog_extraction" / f"v{EXTRACTION_PROMPT_VERSION}"
CATALOG_MODEL = "gemini-3-8-flash"
MAX_BYTES = 10 * 1024 * 1024  # D3
BATCH = 8
MAX_OUTPUT_TOKENS = 64000
OLE_MAGIC = b"\xd0\xcf\x11\xe0"  # Excel cifrado con contraseña (o .xls antiguo)


class UploadError(Exception):
    """invalid_format | too_large | password_protected | no_products | extraction_failed"""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail


def check_file(name: str, content: bytes) -> None:
    """Lo que se puede rechazar al subir, antes de gastar en la IA."""
    if len(content) > MAX_BYTES:
        raise UploadError("too_large")
    if content.startswith(OLE_MAGIC):
        raise UploadError("password_protected" if name.lower().endswith(".xlsx") else "invalid_format")
    if not name.lower().endswith(".xlsx") or not zipfile.is_zipfile(io.BytesIO(content)):
        raise UploadError("invalid_format")


def workbook_text(content: bytes) -> tuple[str, list[str]]:
    """El Excel como texto: "[Hoja X · fila N] celda | celda". Las macros y fórmulas no se ejecutan (solo valores)."""
    import openpyxl

    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - cualquier archivo que openpyxl no lea es formato inválido
        raise UploadError("invalid_format", str(exc)) from exc
    lines, sheets = [], []
    for ws in wb.worksheets:
        sheets.append(ws.title)
        for n, row in enumerate(ws.iter_rows(values_only=True), start=1):
            cells = [" ".join(str(v).split()) for v in row if v not in (None, "")]
            if cells:
                lines.append(f"[{ws.title} · fila {n}] " + " | ".join(cells))
    if not lines:
        raise UploadError("no_products", "el Excel está vacío")
    return "\n".join(lines), sheets


@dataclass
class Extraction:
    products: list[dict] = field(default_factory=list)  # {"product": dict snake_case, "sources": {}, "missing": []}
    unused_sheets: list[str] = field(default_factory=list)
    model: str = ""
    cost_usd: float = 0.0
    raw: list[str] = field(default_factory=list)


def model_config() -> dict:
    configs = tomllib.loads((ROOT / "scripts" / "prompt_bench" / "models.toml").read_text(encoding="utf-8"))["models"]
    cfg = dict(next(c for c in configs if c["name"] == CATALOG_MODEL))
    cfg["max_tokens"] = MAX_OUTPUT_TOKENS
    cfg["json_mode"] = True
    return cfg


def call_llm(system: str, user: str) -> tuple[dict, str, float, str]:
    """(json, modelo devuelto, costo USD, texto crudo). Usa el adaptador del bench (mismo proveedor que la capa 2)."""
    from call_audit.ingestion.import_bench import bench

    bench.load_dotenv(ROOT / ".env")
    cfg = model_config()
    text, returned_model, usage = bench.call_openai_compatible(cfg, system, user)
    cleaned = text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise UploadError("extraction_failed", f"la IA no devolvió JSON válido: {exc}") from exc
    return data, returned_model, bench.cost_usd(cfg, usage) or 0.0, text


def extract(content: bytes, llm=call_llm, on_step=lambda step: None) -> Extraction:
    on_step("reading")
    text, sheets = workbook_text(content)
    on_step("extracting")
    out = Extraction()
    listing, out.model, cost, raw = llm((PROMPT_DIR / "list.txt").read_text(encoding="utf-8"), text)
    out.cost_usd += cost
    out.raw.append(raw)
    wanted = [p for p in listing.get("products") or [] if str(p.get("name") or "").strip()]
    out.unused_sheets = [s for s in listing.get("unused_sheets") or [] if s in sheets]
    if not wanted:
        raise UploadError("no_products", "la IA no encontró seguros en el Excel")
    schema = json.dumps(CatalogProduct.model_json_schema(by_alias=False), ensure_ascii=False)
    system = (PROMPT_DIR / "extract.txt").read_text(encoding="utf-8").replace("{schema}", schema)
    for start in range(0, len(wanted), BATCH):
        batch = wanted[start : start + BATCH]
        request = json.dumps([{"name": p["name"], "insurer": p.get("insurer")} for p in batch], ensure_ascii=False)
        data, _, cost, raw = llm(system, f"Seguros a extraer:\n{request}\n\nContenido del Excel:\n{text}")
        out.cost_usd += cost
        out.raw.append(raw)
        for item in data.get("products") or []:
            if isinstance(item, dict) and isinstance(item.get("product"), dict):
                out.products.append(
                    {
                        "product": item["product"],
                        "sources": item.get("sources") or {},
                        "missing": [str(m) for m in item.get("missing") or []],
                    }
                )
    if not out.products:
        raise UploadError("extraction_failed", "la IA no devolvió fichas")
    return out
