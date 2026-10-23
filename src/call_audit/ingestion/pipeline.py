"""Pipeline automático: audios del SFTP → transcripción → metadata → validación con el prompt de la capa 2 → app.

Uso (desde call-audit-rcv, con DATABASE_URL, GEMINI_API_KEY, S3_BUCKET y SFTP_* en el entorno o en .env):
    uv run --extra bench python -m call_audit.ingestion.pipeline              # una pasada
    uv run --extra bench python -m call_audit.ingestion.pipeline --loop 900   # cada 15 min (worker del EC2)
    uv run --extra bench python -m call_audit.ingestion.pipeline --host-key   # llave del servidor para .env
    uv run --extra bench python -m call_audit.ingestion.pipeline --list       # qué ve en el SFTP, sin procesar

Carpeta de entrada: la cuenta SFTP de S4P (SFTP_HOST, SFTP_USER, SFTP_PASSWORD, SFTP_HOST_KEY, SFTP_DIR) o, sin
SFTP_HOST, la carpeta local PIPELINE_LOCAL_DIR. En las dos:
    <raíz>   S4P deja los audios .mp3 y la metadata del lote en .xlsx o .csv: una fila por grabación, con el nombre
             del archivo (sin extensión) en la primera columna, como el Excel "Retenciones BECS".
    output/  la crea el pipeline: <grabación>.json con la transcripción y la metadata. Si existe, el audio ya se
             transcribió y no se vuelve a pagar el ASR.

Cada pasada:
    1. Cada audio que tiene fila de metadata y no tiene output/<grabación>.json se baja, se transcribe (mismo ASR
       del bench) y se escribe su output. Sin fila de metadata, el audio espera a la siguiente pasada.
    2. Si la metadata no trae TIPIFICACION, se asume RETENCION.
    3. Las grabaciones transcritas que aún no tienen corrida automática en la base se validan con el prompt vigente
       (real_calls.py: build anonimizado + run) y se importan con import_bench, igual que una corrida del bench.
       El audio se sube a S3 para que la app lo reproduzca.
    4. El audio transcrito y validado se mueve a output/, y el archivo de metadata cuando todas sus grabaciones
       terminaron: en la raíz quedan solo los pendientes.
Las grabaciones que ya estaban en la app (bench) se marcan como hechas sin gastar con --adopt <asr_bench>.

El trabajo de cada pasada (prompts, respuestas del modelo, errores) queda en PIPELINE_WORK_DIR, fuera del repo.
"""

import argparse
import csv
import importlib.util
import json
import logging
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import prompt_evaluation, prompt_registry
from call_audit.catalog import store as catalog_store
from call_audit.catalog import uploads
from call_audit.config import ROOT, Settings, get_settings
from call_audit.ingestion.import_bench import bench, import_run, real_calls
from call_audit.ingestion.sftp_store import Entry, LocalStore, SftpStore, server_key
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import Case, ModelRun
from call_audit.rubric import load_rubric

logger = logging.getLogger("call_audit.pipeline")
Store = LocalStore | SftpStore

AUDIO_EXT = ".mp3"  # la app firma audios/<grabación>.mp3
METADATA_EXT = (".xlsx", ".csv")
DEFAULT_TYPIFICATION = "RETENCION"
# Un archivo que se modificó hace menos que esto puede estar subiéndose todavía por SFTP.
MIN_AGE_SEC = 120
MAX_ASR_ATTEMPTS = 3
UPLOAD_POLL_SEC = 15
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
    if path.suffix.lower() == ".xlsx":
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


def load_metadata(store: Store, entries: list[Entry], sources: dict[str, set[str]] | None = None) -> dict[str, dict]:
    """Todas las filas de los .xlsx/.csv, por nombre de grabación. Un archivo más nuevo pisa al anterior.
    En `sources` deja qué grabaciones trae cada archivo (para moverlo a output/ cuando todas terminaron)."""
    out: dict[str, dict] = {}
    files = sorted((e for e in entries if Path(e.name).suffix.lower() in METADATA_EXT), key=lambda e: e.mtime)
    for entry in files:
        if not settled(entry):
            continue
        try:
            rows = read_rows(store.fetch(entry))
        except Exception:  # noqa: BLE001 - un archivo malo no frena a los demás
            logger.exception("No se pudo leer la metadata %s", entry.name)
            continue
        stems = set()
        for row in rows:
            stem = real_calls.clean(next(iter(row.values()))).removesuffix(AUDIO_EXT)
            out[stem] = row
            stems.add(stem)
        if sources is not None:
            sources[entry.name] = stems
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


def settled(entry: Entry) -> bool:
    return time.time() - entry.mtime >= MIN_AGE_SEC


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


def output_json(stem: str, row: dict, asr_dir: Path, asr_model: str) -> bytes:
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
    return json.dumps(output, ensure_ascii=False, indent=1, default=str).encode("utf-8")


def restore_asr(store: Store, stem: str, asr_dir: Path, asr_model: str) -> None:
    """Si se perdió el directorio de trabajo, el output basta para reconstruir lo que leen build e import."""
    target = asr_dir / stem
    if (target / f"{asr_model}.json").exists():
        return
    data = json.loads(store.read_output(stem))
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


def validate(
    stems: list[str], rows: dict[str, dict], audio: Callable[[str], Path], settings: Settings
) -> tuple[int, list[Path]]:
    """Una corrida del bench con las grabaciones pendientes, en work/runs/<fecha>, importada a la base. Devuelve
    cuántas se importaron y los audios locales que ya quedaron en S3."""
    work = settings.pipeline_work_dir
    out = work / "runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    asr_dir = work / "asr"
    model = settings.pipeline_model
    catalog = use_catalog(out)
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
        return 0, []
    use_active_prompt(out)
    (out / "calls.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    real_calls.run_models(SimpleNamespace(out=out, models=[model], force=False, workers=4), index)

    uploaded = []
    for item in index:
        try:
            path = audio(item["recording"])
            upload_audio(path, settings)
            uploaded.append(path)
        except Exception:  # noqa: BLE001 - sin audio la llamada igual se puede revisar
            logger.exception("No se pudo subir el audio de %s a S3", item["recording"])

    version = (out / "prompts" / "prompt_version.txt").read_text(encoding="utf-8").strip()
    rubric = load_rubric(settings.rubric_path)
    with get_sessionmaker()() as session, session.begin():
        count = import_run(
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
        record_catalog_refs(session, index, rows, catalog, model, f"v{version} {LABEL_SUFFIX}")
    return count, uploaded


def use_active_prompt(out: Path) -> None:
    """El system prompt de la versión vigente del registro (Cambio 12, D-33) reemplaza al del repo que escribió
    real_calls.build. Sin registro (desarrollo), queda el del repo."""
    with get_sessionmaker()() as session, session.begin():
        row = prompt_registry.ensure_bootstrap(session)
        version, system = row.version, row.system_text
    prompts = out / "prompts"
    (prompts / "system.txt").write_text(system.rstrip("\n") + "\n", encoding="utf-8")
    (prompts / "prompt_version.txt").write_text(f"{version}\n", encoding="utf-8")


def use_catalog(out: Path) -> dict:
    """Foto del catálogo vigente en la base (Cambio 11), guardada en la corrida y usada por render.py. Sin catálogo en
    la base (desarrollo), se usa data/catalog/products.json como antes."""
    with get_sessionmaker()() as session:
        catalog = catalog_store.snapshot(session)
    if not catalog["products"]:
        return json.loads(real_calls.render.CATALOG.read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    path = out / "catalog.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    real_calls.render.CATALOG = path
    return catalog


def record_catalog_refs(
    session: Session, index: list[dict], rows: dict[str, dict], catalog: dict, model: str, label: str
) -> None:
    """Qué ficha y qué versión usó cada validación (D-29, L-39): el mismo match que hizo real_calls.build."""
    for item in index:
        found, _, _ = real_calls.catalog_match.match_row(rows[item["recording"]], catalog)
        if not found or not found.get("catalog_id"):
            continue
        ref = {"productId": found["catalog_id"], "version": found["version"]}
        case = session.scalar(select(Case).where(Case.recording == item["recording"]))
        run = next((r for r in case.runs if r.model == model and r.run_label == label), None) if case else None
        if run is None:
            continue
        run.catalog_refs = [ref]
        if case.product_sheets:
            sheets = [dict(sheet) for sheet in case.product_sheets]
            sheets[0]["version"] = ref["version"]
            sheets[0]["catalogId"] = ref["productId"]
            case.product_sheets = sheets


# --- Pasada ----------------------------------------------------------------------------------


def open_store(settings: Settings) -> Store:
    if not settings.sftp_host:
        return LocalStore(settings.pipeline_local_dir)
    return SftpStore(
        settings.sftp_host,
        settings.sftp_port,
        settings.sftp_user,
        settings.sftp_password,
        settings.sftp_host_key,
        settings.sftp_dir,
        settings.pipeline_work_dir / "inbox",
    )


def run_once(settings: Settings | None = None) -> dict[str, int]:
    settings = settings or get_settings()
    bench.load_dotenv(ROOT / ".env")
    work = settings.pipeline_work_dir
    (work / "asr").mkdir(parents=True, exist_ok=True)
    asr_model = settings.pipeline_asr_model
    failures = Failures(work / "asr_failures.json")
    store = open_store(settings)
    try:
        entries = store.entries()
        sources: dict[str, set[str]] = {}
        rows = load_metadata(store, entries, sources)
        audios = {e.stem: e for e in entries if e.name.lower().endswith(AUDIO_EXT) and settled(e)}
        outputs = store.outputs()
        stats = {"audios": len(audios), "waiting_metadata": 0, "transcribed": 0, "asr_errors": 0, "validated": 0}

        for stem, entry in audios.items():
            if stem in outputs:
                restore_asr(store, stem, work / "asr", asr_model)
                continue
            row = rows.get(stem)
            if row is None:
                stats["waiting_metadata"] += 1
                continue
            if failures.blocked(stem):
                continue
            try:
                transcribe(store.fetch(entry), work / "asr", asr_model)
                store.write_output(stem, output_json(stem, row, work / "asr", asr_model))
            except Exception as exc:  # noqa: BLE001 - se registra y se reintenta en la próxima pasada
                logger.warning("Falló la transcripción de %s: %s", stem, exc)
                failures.add(stem, f"{type(exc).__name__}: {exc}")
                stats["asr_errors"] += 1
                continue
            failures.clear(stem)
            outputs.add(stem)
            stats["transcribed"] += 1

        with get_sessionmaker()() as session:
            done = validated(session, settings.pipeline_model)
        pending = [s for s in audios if s in outputs and s in rows and s not in done]
        if pending:
            stats["validated"], uploaded = validate(pending, rows, lambda s: store.fetch(audios[s]), settings)
            for path in uploaded:
                store.release(path)
            with get_sessionmaker()() as session:
                done = validated(session, settings.pipeline_model)
        stats["archived"] = archive_finished(store, audios, outputs & done)
        archive_metadata(store, entries, sources, outputs, waiting={e.name for e in store.entries()})
    finally:
        store.close()
    logger.info("Pasada: %s", stats)
    return stats


def archive_finished(store: Store, audios: dict[str, Entry], finished: set[str]) -> int:
    """Mueve a output/ los audios ya transcritos y validados: en la raíz quedan solo los pendientes."""
    count = 0
    for stem in sorted(finished & audios.keys()):
        try:
            store.archive(audios[stem])
            count += 1
        except OSError as exc:
            logger.warning("No se pudo mover %s a output/: %s", audios[stem].name, exc)
    return count


def archive_metadata(
    store: Store, entries: list[Entry], sources: dict[str, set[str]], outputs: set[str], waiting: set[str]
) -> None:
    """Mueve a output/ cada archivo de metadata cuyas grabaciones ya terminaron: tienen output y su audio ya no está
    en la raíz. Si queda alguna pendiente, el archivo se queda (la validación lo necesita)."""
    pending = {Path(name).stem for name in waiting if name.lower().endswith(AUDIO_EXT)}
    for entry in entries:
        stems = sources.get(entry.name)
        if not stems or not stems <= outputs or stems & pending:
            continue
        try:
            store.archive(entry)
        except OSError as exc:
            logger.warning("No se pudo mover %s a output/: %s", entry.name, exc)


def adopt(settings: Settings, asr_dir: Path) -> int:
    """Grabaciones que ya están en la app (transcritas y validadas en el bench): escribe su output con la
    transcripción del bench y mueve el audio a output/, sin llamar al ASR ni al LLM. El pipeline ya no las mira."""
    store = open_store(settings)
    try:
        entries = store.entries()
        sources: dict[str, set[str]] = {}
        rows = load_metadata(store, entries, sources)
        outputs = store.outputs()
        count = 0
        for entry in entries:
            stem = entry.stem
            if not entry.name.lower().endswith(AUDIO_EXT) or stem not in rows:
                continue
            if not (asr_dir / stem / f"{settings.pipeline_asr_model}.json").exists():
                logger.warning("Sin transcripción del bench para %s: queda pendiente", stem)
                continue
            if stem not in outputs:
                store.write_output(stem, output_json(stem, rows[stem], asr_dir, settings.pipeline_asr_model))
            store.archive(entry)
            outputs.add(stem)
            count += 1
        archive_metadata(store, entries, sources, outputs, waiting={e.name for e in store.entries()})
    finally:
        store.close()
    return count


def show_listing(settings: Settings) -> None:
    store = open_store(settings)
    try:
        entries = store.entries()
        outputs = store.outputs()
    finally:
        store.close()
    audios = [e for e in entries if e.name.lower().endswith(AUDIO_EXT)]
    metadata = [e for e in entries if Path(e.name).suffix.lower() in METADATA_EXT]
    others = len(entries) - len(audios) - len(metadata)
    print(f"{len(audios)} audios, {len(metadata)} de metadata, {others} otros, {len(outputs)} ya en output/")
    for e in metadata:
        print(f"  metadata: {e.name} ({datetime.fromtimestamp(e.mtime):%Y-%m-%d %H:%M})")
    pending = [e.name for e in audios if e.stem not in outputs]
    print(f"Sin transcribir: {len(pending)}" + (f" (ej. {', '.join(pending[:5])})" if pending else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--loop", type=int, metavar="SEG", help="repite cada SEG segundos (sin esto, una pasada)")
    parser.add_argument("--host-key", action="store_true", help="muestra la llave del servidor SFTP para .env")
    parser.add_argument("--list", action="store_true", help="muestra qué hay en el SFTP, sin procesar nada")
    parser.add_argument(
        "--adopt",
        type=Path,
        metavar="ASR_DIR",
        help="marca como hechas las grabaciones ya transcritas en el bench (ej. ../transcripts/asr_bench), sin gastar",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = get_settings()
    if args.host_key:
        key, fingerprint = server_key(settings.sftp_host, settings.sftp_port)
        print(f"Huella: {fingerprint}\nSFTP_HOST_KEY={key}")
        return
    if args.list:
        show_listing(settings)
        return
    if args.adopt:
        print(f"{adopt(settings, args.adopt)} grabaciones movidas a output/ sin procesar")
        return
    last_pass = 0.0
    while True:
        # Las cargas de Excel al catálogo se atienden cada UPLOAD_POLL_SEC: el supervisor espera la propuesta.
        try:
            uploads.process_pending(get_sessionmaker())
        except Exception:  # noqa: BLE001 - el worker no se cae por una carga fallida
            logger.exception("Falló el procesamiento de cargas del catálogo")
        # Pruebas de versiones del prompt contra la referencia (Cambio 12): las pide el admin desde la app.
        try:
            prompt_evaluation.process_pending(get_sessionmaker())
        except Exception:  # noqa: BLE001 - el worker no se cae por una prueba fallida
            logger.exception("Falló una prueba de prompt")
        if not args.loop or time.time() - last_pass >= args.loop:
            last_pass = time.time()
            try:
                run_once(settings)
            except Exception:  # noqa: BLE001 - el worker no se cae por una pasada fallida
                logger.exception("Falló la pasada")
                if not args.loop:
                    raise
        if not args.loop:
            return
        time.sleep(UPLOAD_POLL_SEC)


if __name__ == "__main__":
    main()
