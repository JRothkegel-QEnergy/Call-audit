"""Pipeline automático: audios del SFTP → transcripción → metadata → validación con el prompt de la capa 2 → app.

Uso (desde call-audit-rcv, con DATABASE_URL, GEMINI_API_KEY y S3_BUCKET en el entorno o en .env):
    uv run --extra bench python -m call_audit.ingestion.pipeline              # una pasada
    uv run --extra bench python -m call_audit.ingestion.pipeline --loop 900   # cada 15 min (worker del EC2)

Carpetas (PIPELINE_SFTP_DIR; en el EC2 es la del usuario SFTP del cliente):
    input/   el cliente sube los audios .mp3 y la metadata del lote en .xlsx o .csv: una fila por grabación, con el
             nombre del archivo (sin extensión) en la primera columna, como el Excel "Retenciones BECS".
    output/  <grabación>.json con la transcripción y la metadata. Si existe, el audio ya se transcribió y no se
             vuelve a pagar el ASR.

Cada pasada:
    1. Cada audio de input/ que tiene fila de metadata y no tiene output/<grabación>.json se transcribe (mismo ASR
       del bench) y se escribe su output. Sin fila de metadata, el audio espera a la siguiente pasada.
    2. Si la metadata no trae TIPIFICACION, se asume RETENCION.
    3. Las grabaciones transcritas que aún no tienen corrida automática en la base se validan con el prompt vigente
       (real_calls.py: build anonimizado + run) y se importan con import_bench, igual que una corrida del bench.
       El audio se sube a S3 para que la app lo reproduzca.

El trabajo de cada pasada (prompts, respuestas del modelo, errores) queda en PIPELINE_WORK_DIR, fuera del repo.
"""

import argparse
import csv
import importlib.util
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.config import ROOT, Settings, get_settings
from call_audit.ingestion.import_bench import bench, import_run, real_calls
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import Case, ModelRun
from call_audit.rubric import load_rubric

logger = logging.getLogger("call_audit.pipeline")

AUDIO_EXT = ".mp3"  # la app firma audios/<grabación>.mp3
METADATA_EXT = (".xlsx", ".csv")
DEFAULT_TYPIFICATION = "RETENCION"
# Un archivo que se modificó hace menos que esto puede estar subiéndose todavía por SFTP.
MIN_AGE_SEC = 120
MAX_ASR_ATTEMPTS = 3
LABEL_SUFFIX = "automático"
DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y")
TIME_FORMATS = ("", " %H:%M", " %H:%M:%S")


def load_asr() -> ModuleType:
    """scripts/asr_bench/run.py se llama igual que el run.py del bench de prompts: se carga por ruta."""
    path = ROOT / "scripts" / "asr_bench" / "run.py"
    spec = importlib.util.spec_from_file_location("asr_bench_run", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- Metadata --------------------------------------------------------------------------


def parse_date(value: Any) -> Any:
    """El CSV trae las fechas como texto; build_call espera datetime (como las entrega el Excel)."""
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return None
    for date_fmt in DATE_FORMATS:
        for time_fmt in TIME_FORMATS:
            try:
                return datetime.strptime(text, date_fmt + time_fmt)
            except ValueError:
                continue
    return value


def read_rows(path: Path) -> list[dict]:
    if path.suffix == ".xlsx":
        import openpyxl

        rows = openpyxl.load_workbook(path, read_only=True).active.iter_rows(values_only=True)
        header = next(rows)
        return [dict(zip(header, r, strict=False)) for r in rows if r and r[0]]
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")  # CSV exportado desde Excel en Windows
    dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=";,\t")
    rows = []
    for r in csv.DictReader(text.splitlines(), dialect=dialect):
        row = {k.strip(): parse_date(v) if k.strip().startswith("FECHA") else v for k, v in r.items() if k}
        if next(iter(row.values()), None):
            rows.append(row)
    return rows


def load_metadata(input_dir: Path) -> dict[str, dict]:
    """Todas las filas de los .xlsx/.csv de input/, por nombre de grabación. Un archivo más nuevo pisa al anterior."""
    out: dict[str, dict] = {}
    files = sorted(
        (p for p in input_dir.iterdir() if p.suffix.lower() in METADATA_EXT), key=lambda p: p.stat().st_mtime
    )
    for path in files:
        if not settled(path):
            continue
        try:
            rows = read_rows(path)
        except Exception:  # noqa: BLE001 - un archivo malo no frena a los demás
            logger.exception("No se pudo leer la metadata %s", path.name)
            continue
        for row in rows:
            key = real_calls.clean(next(iter(row.values())))
            out[key.removesuffix(AUDIO_EXT)] = row
    for stem, row in out.items():
        complete_row(stem, row)
    return out


def complete_row(stem: str, row: dict) -> None:
    """Valores por defecto para lo que build_call lee sin .get(). Una llamada nueva no trae la auditoría del cliente
    (ESTADO_CALIDAD). El ID y la fecha se sacan del nombre del archivo (<n>_<AAAAMMDD>_<id>) si no vienen."""
    if not real_calls.clean(row.get("TIPIFICACION")):
        row["TIPIFICACION"] = DEFAULT_TYPIFICATION
    parts = stem.split("_")
    if not real_calls.clean(row.get("ID")):
        row["ID"] = parts[-1]
    if not isinstance(row.get("FECHA_GESTION"), datetime):
        day = next((p for p in parts if len(p) == 8 and p.isdigit()), None)
        row["FECHA_GESTION"] = datetime.strptime(day, "%Y%m%d") if day else datetime.now()
    for key in ("ESTADO_CALIDAD", "MOTIVO RENUNCIA", "NUM_MUS_ANETO", "NOMBRE_DEL_SEGURO"):
        row.setdefault(key, "")


def settled(path: Path) -> bool:
    return time.time() - path.stat().st_mtime >= MIN_AGE_SEC


# --- Transcripción -----------------------------------------------------------------------


def transcribe(audio: Path, asr_dir: Path, asr_model: str) -> None:
    """Deja asr_dir/<grabación>/<asr_model>.json y _summary.json, el formato que leen real_calls e import_bench."""
    summary = load_asr().run_providers(audio, [asr_model], asr_dir / audio.stem, log=logger.info)
    error = next((s["error"] for s in summary if s["provider"] == asr_model and s.get("error")), None)
    if error:
        raise RuntimeError(error)
    result = json.loads((asr_dir / audio.stem / f"{asr_model}.json").read_text(encoding="utf-8"))
    if not result.get("segments"):
        raise RuntimeError("el ASR no devolvió segmentos (JSON inválido o vacío)")


def write_output(path: Path, stem: str, row: dict, asr_dir: Path, asr_model: str) -> None:
    asr = json.loads((asr_dir / stem / f"{asr_model}.json").read_text(encoding="utf-8"))
    summary = json.loads((asr_dir / stem / "_summary.json").read_text(encoding="utf-8"))
    output = {
        "recording": stem,
        "transcribed_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "asr_model": asr_model,
        "audio_seconds": next((s["audio_seconds"] for s in summary if s.get("audio_seconds")), None),
        "metadata": row,
        "segments": asr.get("segments", []),
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(output, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    tmp.replace(path)


def restore_asr(output: Path, asr_dir: Path, asr_model: str) -> None:
    """Si se perdió el directorio de trabajo, el output basta para reconstruir lo que leen build e import."""
    data = json.loads(output.read_text(encoding="utf-8"))
    target = asr_dir / data["recording"]
    if (target / f"{asr_model}.json").exists():
        return
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{asr_model}.json").write_text(json.dumps({"segments": data["segments"]}, ensure_ascii=False), "utf-8")
    summary = [{"provider": asr_model, "audio_seconds": data["audio_seconds"], "error": None}]
    (target / "_summary.json").write_text(json.dumps(summary), encoding="utf-8")


class Failures:
    """Intentos fallidos de ASR por grabación: tras MAX_ASR_ATTEMPTS se deja de reintentar (cada intento se paga)."""

    def __init__(self, path: Path):
        self.path = path
        self.data: dict[str, dict] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def blocked(self, stem: str) -> bool:
        return self.data.get(stem, {}).get("attempts", 0) >= MAX_ASR_ATTEMPTS

    def add(self, stem: str, error: str) -> None:
        entry = self.data.setdefault(stem, {"attempts": 0})
        entry.update(attempts=entry["attempts"] + 1, error=error[:500], at=datetime.now().isoformat(timespec="seconds"))
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")

    def clear(self, stem: str) -> None:
        if self.data.pop(stem, None) is not None:
            self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")


# --- Validación ----------------------------------------------------------------------------


def validated(session: Session, model: str) -> set[str]:
    """Grabaciones que ya tienen una corrida automática de `model` (con cualquier versión de prompt)."""
    query = (
        select(Case.recording)
        .join(Case.runs)
        .where(ModelRun.model == model, ModelRun.run_label.endswith(f" {LABEL_SUFFIX}"))
    )
    return set(session.scalars(query))


def upload_audio(audio: Path, settings: Settings) -> None:
    if not settings.s3_bucket:
        return
    import boto3

    boto3.client("s3", region_name=settings.aws_region).upload_file(
        str(audio),
        settings.s3_bucket,
        f"{settings.s3_prefix}{audio.stem}{AUDIO_EXT}",
        ExtraArgs={"ContentType": "audio/mpeg"},
    )


def validate(stems: list[str], rows: dict[str, dict], audios: dict[str, Path], settings: Settings) -> int:
    """Una corrida del bench con las grabaciones pendientes, en work/runs/<fecha>, importada a la base."""
    work = settings.pipeline_work_dir
    out = work / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    asr_dir = work / "asr"
    model = settings.pipeline_model
    index = []
    for stem in stems:
        args = SimpleNamespace(
            names=[stem], asr_dir=asr_dir, asr_model=settings.pipeline_asr_model, anonymize=True, out=out
        )
        try:
            index += real_calls.build(args, rows)
        except Exception:  # noqa: BLE001 - una fila con datos raros no frena el lote
            logger.exception("No se pudo armar el prompt de %s", stem)
    if not index:
        return 0
    (out / "calls.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    real_calls.run_models(SimpleNamespace(out=out, models=[model], force=False, workers=4), index)

    for item in index:
        try:
            upload_audio(audios[item["recording"]], settings)
        except Exception:  # noqa: BLE001 - sin audio la llamada igual se puede revisar
            logger.exception("No se pudo subir el audio de %s a S3", item["recording"])

    version = (out / "prompts" / "prompt_version.txt").read_text(encoding="utf-8").strip()
    catalog = json.loads(real_calls.render.CATALOG.read_text(encoding="utf-8"))
    rubric = load_rubric(settings.rubric_path)
    with get_sessionmaker()() as session, session.begin():
        return import_run(
            session,
            out,
            rows,
            catalog,
            rubric,
            label=f"v{version} {LABEL_SUFFIX}",
            current_model=model,
            models=[model],
            asr_dir=asr_dir,
            asr_model=settings.pipeline_asr_model,
        )


# --- Pasada ----------------------------------------------------------------------------------


def run_once(settings: Settings | None = None) -> dict[str, int]:
    settings = settings or get_settings()
    bench.load_dotenv(ROOT / ".env")
    input_dir = settings.pipeline_sftp_dir / "input"
    output_dir = settings.pipeline_sftp_dir / "output"
    work = settings.pipeline_work_dir
    for d in (input_dir, output_dir, work / "asr"):
        d.mkdir(parents=True, exist_ok=True)
    asr_model = settings.pipeline_asr_model
    failures = Failures(work / "asr_failures.json")

    rows = load_metadata(input_dir)
    audios = {p.stem: p for p in sorted(input_dir.glob(f"*{AUDIO_EXT}")) if settled(p)}
    stats = {"audios": len(audios), "waiting_metadata": 0, "transcribed": 0, "asr_errors": 0, "validated": 0}

    for stem, audio in audios.items():
        output = output_dir / f"{stem}.json"
        if output.exists():
            restore_asr(output, work / "asr", asr_model)
            continue
        row = rows.get(stem)
        if row is None:
            stats["waiting_metadata"] += 1
            continue
        if failures.blocked(stem):
            continue
        try:
            transcribe(audio, work / "asr", asr_model)
            write_output(output, stem, row, work / "asr", asr_model)
        except Exception as exc:  # noqa: BLE001 - se registra y se reintenta en la próxima pasada
            logger.warning("Falló la transcripción de %s: %s", stem, exc)
            failures.add(stem, f"{type(exc).__name__}: {exc}")
            stats["asr_errors"] += 1
            continue
        failures.clear(stem)
        stats["transcribed"] += 1

    with get_sessionmaker()() as session:
        done = validated(session, settings.pipeline_model)
    pending = [s for s in audios if (output_dir / f"{s}.json").exists() and s in rows and s not in done]
    if pending:
        stats["validated"] = validate(pending, rows, audios, settings)
    logger.info("Pasada: %s", stats)
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--loop", type=int, metavar="SEG", help="repite cada SEG segundos (sin esto, una pasada)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    while True:
        try:
            run_once()
        except Exception:  # noqa: BLE001 - el worker no se cae por una pasada fallida
            logger.exception("Falló la pasada")
            if not args.loop:
                raise
        if not args.loop:
            return
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
