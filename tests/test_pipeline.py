"""Pipeline SFTP → ASR → validación → base, con dobles del ASR y del modelo (no llama APIs)."""

import json
import os
import time
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.config import Settings
from call_audit.ingestion import pipeline
from call_audit.ingestion.import_bench import bench, real_calls
from call_audit.persistence.models import Case
from tests.conftest import CATALOG

RECORDING = "10000001_20261015_300001"
SEGMENTS = [
    {"speaker": "EJECUTIVO", "start": "00:00", "end": "00:04", "text": "Buenos días, le habla la ejecutiva."},
    {"speaker": "CLIENTE", "start": "00:04", "end": "00:08", "text": "Quiero renunciar al seguro."},
]
CSV = (
    "GRABACION;EJECUTIVO;NOMBRE_DEL_SEGURO;MOTIVO RENUNCIA;NUM_MUS_ANETO;FECHA_GESTION;PRIMA_SEGURO\n"
    f"{RECORDING};Ejecutivo Ficticio;Seguro Ficticio;Problemas Económicos;999;15-10-2026;0,5\n"
)


# Mismo formato que data/catalog/products.json (extract_catalog.py), que no está en el repo.
SYNTHETIC_CATALOG = {
    "products": [
        CATALOG["products"][0]
        | {
            "system_names": ["Seguro Ficticio"],
            "channels": [],
            "premium_type": "mensual",
            "policies": "",
            "assistances": [],
            "premiums": [],
            "claims": [],
            "temporary_disability_table": [],
            "observations": [],
        }
    ],
    "payment_methods": {},
}


def age(path: Path) -> None:
    """Marca el archivo como subido hace rato (el pipeline ignora lo que puede estar subiéndose)."""
    old = time.time() - pipeline.MIN_AGE_SEC - 5
    os.utime(path, (old, old))


@pytest.fixture
def env(tmp_path: Path, db: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch) -> dict:
    settings = Settings(
        pipeline_local_dir=tmp_path / "sftp", pipeline_work_dir=tmp_path / "work", s3_bucket="", sftp_host=""
    )
    inbox = settings.pipeline_local_dir
    inbox.mkdir(parents=True)
    catalog = tmp_path / "products.json"
    catalog.write_text(json.dumps(SYNTHETIC_CATALOG), encoding="utf-8")
    monkeypatch.setattr(real_calls.render, "CATALOG", catalog)
    monkeypatch.setattr(pipeline, "get_sessionmaker", lambda: db)
    calls = {"asr": 0, "llm": 0}

    def fake_transcribe(audio: Path, asr_dir: Path, asr_model: str) -> None:
        calls["asr"] += 1
        target = asr_dir / audio.stem
        target.mkdir(parents=True, exist_ok=True)
        (target / f"{asr_model}.json").write_text(json.dumps({"segments": SEGMENTS}), encoding="utf-8")
        summary = [{"provider": asr_model, "audio_seconds": 8.0, "error": None}]
        (target / "_summary.json").write_text(json.dumps(summary), encoding="utf-8")

    def fake_run_one(cfg: dict, stem: str, system: str, force: bool) -> str:
        calls["llm"] += 1
        out = bench.RESULTS_DIR / cfg["name"]
        out.mkdir(parents=True, exist_ok=True)
        audit = {
            "criterios": [
                {
                    "id": 30,
                    "estado": "incumple",
                    "confianza": 0.9,
                    "comentario": "No cerró la gestión.",
                    "evidencia": [{"t": "00:04", "hablante": "CLIENTE", "cita": "Quiero renunciar al seguro."}],
                }
            ]
        }
        (out / f"{stem}.json").write_text(json.dumps(audit, ensure_ascii=False), encoding="utf-8")
        return "ok"

    monkeypatch.setattr(pipeline, "transcribe", fake_transcribe)
    monkeypatch.setattr(bench, "run_one", fake_run_one)
    return {"settings": settings, "inbox": inbox, "calls": calls, "db": db}


def drop(inbox: Path, name: str, content: bytes | str) -> None:
    path = inbox / name
    path.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
    age(path)


def test_new_audio_is_transcribed_validated_and_imported(env: dict) -> None:
    drop(env["inbox"], f"{RECORDING}.mp3", b"ID3 audio sintetico")
    drop(env["inbox"], "lote.csv", CSV)

    stats = pipeline.run_once(env["settings"])

    assert stats["transcribed"] == 1 and stats["validated"] == 1 and stats["archived"] == 1
    # El audio procesado pasa a output/: en la raíz quedan solo los pendientes.
    root = env["settings"].pipeline_local_dir
    assert not (root / f"{RECORDING}.mp3").exists() and (root / "output" / f"{RECORDING}.mp3").exists()
    # Todas las filas del lote terminaron: el archivo de metadata también pasa a output/.
    assert not (root / "lote.csv").exists() and (root / "output" / "lote.csv").exists()
    output = json.loads((env["settings"].pipeline_local_dir / "output" / f"{RECORDING}.json").read_text("utf-8"))
    assert output["segments"] == SEGMENTS
    # Sin columna TIPIFICACION se asume retención; ID y fecha salen del nombre del archivo.
    assert output["metadata"]["TIPIFICACION"] == "RETENCION"
    with env["db"]() as session:
        case = session.scalar(select(Case).where(Case.recording == RECORDING))
        assert case.call_id == "300001" and case.call_date == "2026-10-15"
        assert case.external_verdict is None
        [run] = case.runs
        assert run.model == "gemini-3-8-flash" and run.is_current
        assert run.run_label.endswith(" automático")
        assert run.verdict == "non_compliant"
        # Al modelo le llega la transcripción anonimizada; la app muestra la original.
        assert case.transcript[1]["text"] == "Quiero renunciar al seguro."


def test_second_pass_does_not_repeat_work(env: dict) -> None:
    drop(env["inbox"], f"{RECORDING}.mp3", b"ID3 audio sintetico")
    drop(env["inbox"], "lote.csv", CSV)
    pipeline.run_once(env["settings"])

    stats = pipeline.run_once(env["settings"])

    assert stats["audios"] == 0 and stats["transcribed"] == 0 and stats["validated"] == 0
    assert env["calls"] == {"asr": 1, "llm": 1}


def test_audio_without_metadata_waits(env: dict) -> None:
    drop(env["inbox"], f"{RECORDING}.mp3", b"ID3 audio sintetico")

    stats = pipeline.run_once(env["settings"])

    assert stats["waiting_metadata"] == 1 and env["calls"]["asr"] == 0
    drop(env["inbox"], "lote.csv", CSV)
    assert pipeline.run_once(env["settings"])["validated"] == 1


def test_file_still_uploading_is_skipped(env: dict) -> None:
    (env["inbox"] / f"{RECORDING}.mp3").write_bytes(b"subiendo")
    drop(env["inbox"], "lote.csv", CSV)

    assert pipeline.run_once(env["settings"])["audios"] == 0


def test_asr_failures_stop_after_max_attempts(env: dict, monkeypatch: pytest.MonkeyPatch) -> None:
    drop(env["inbox"], f"{RECORDING}.mp3", b"ID3 audio sintetico")
    drop(env["inbox"], "lote.csv", CSV)
    attempts = []

    def failing(audio: Path, asr_dir: Path, asr_model: str) -> None:
        attempts.append(audio.stem)
        raise RuntimeError("proveedor caído")

    monkeypatch.setattr(pipeline, "transcribe", failing)
    for _ in range(pipeline.MAX_ASR_ATTEMPTS + 2):
        pipeline.run_once(env["settings"])

    assert len(attempts) == pipeline.MAX_ASR_ATTEMPTS
    assert not (env["settings"].pipeline_local_dir / "output" / f"{RECORDING}.json").exists()


def test_csv_dates_and_defaults() -> None:
    row = {"FECHA_GESTION": pipeline.parse_date("15/10/2026 10:30")}
    pipeline.complete_row("1_20261001_42", row)
    assert row["FECHA_GESTION"].day == 15 and row["ID"] == "42" and row["TIPIFICACION"] == "RETENCION"
    row = {"TIPIFICACION": "OTRA GESTION"}
    pipeline.complete_row("1_20261001_42", row)
    assert row["TIPIFICACION"] == "OTRA GESTION" and row["FECHA_GESTION"].month == 10


class FakeSftp:
    """Lo que SftpStore usa de paramiko.SFTPClient, sobre una carpeta local."""

    def __init__(self, root: Path):
        self.root = root
        self.downloads: list[str] = []

    def path(self, remote: str) -> Path:
        return self.root / remote

    def listdir_attr(self, remote: str) -> list:
        import paramiko

        return [paramiko.SFTPAttributes.from_stat(p.stat(), p.name) for p in self.path(remote).iterdir()]

    def mkdir(self, remote: str) -> None:
        self.path(remote).mkdir()

    def get(self, remote: str, local: str) -> None:
        self.downloads.append(remote)
        Path(local).write_bytes(self.path(remote).read_bytes())

    def open(self, remote: str, mode: str):
        return self.path(remote).open(mode)

    def posix_rename(self, old: str, new: str) -> None:
        self.path(old).replace(self.path(new))


def test_pipeline_over_sftp_store(env: dict, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from call_audit.ingestion.sftp_store import SftpStore

    remote = tmp_path / "s4p"
    remote.mkdir()
    drop(remote, f"{RECORDING}.mp3", b"ID3 audio sintetico")
    drop(remote, "lote.csv", CSV)
    fake = FakeSftp(remote)

    def open_store(settings: Settings) -> SftpStore:
        store = SftpStore.__new__(SftpStore)
        store.client = type("Client", (), {"close": lambda self: None})()
        store.sftp, store.dir, store.out = fake, ".", "./output"
        (remote / "output").mkdir(exist_ok=True)
        store.cache = tmp_path / "inbox"
        store.cache.mkdir(exist_ok=True)
        return store

    monkeypatch.setattr(pipeline, "open_store", open_store)
    stats = pipeline.run_once(env["settings"])

    assert stats["transcribed"] == 1 and stats["validated"] == 1
    assert json.loads((remote / "output" / f"{RECORDING}.json").read_text("utf-8"))["recording"] == RECORDING
    assert (remote / "output" / f"{RECORDING}.mp3").exists() and not (remote / f"{RECORDING}.mp3").exists()
    # Con el audio en S3, se borra del caché; la metadata queda para no bajarla de nuevo.
    assert not (tmp_path / "inbox" / f"{RECORDING}.mp3").exists()
    assert (tmp_path / "inbox" / "lote.csv").exists()
    pipeline.run_once(env["settings"])
    assert fake.downloads.count("./lote.csv") == 1


def test_adopt_moves_bench_calls_without_spending(env: dict, tmp_path: Path) -> None:
    drop(env["inbox"], f"{RECORDING}.mp3", b"ID3 audio sintetico")
    drop(env["inbox"], "otra_20261015_300002.mp3", b"ID3 sin transcripcion del bench")
    drop(env["inbox"], "lote.csv", CSV + "otra_20261015_300002;Ejecutivo;Seguro Ficticio;Retracto;1;15-10-2026;1\n")
    asr_dir = tmp_path / "asr_bench"
    target = asr_dir / RECORDING
    target.mkdir(parents=True)
    (target / "gemini_3.8-flash.json").write_text(json.dumps({"segments": SEGMENTS}), encoding="utf-8")
    (target / "_summary.json").write_text(json.dumps([{"audio_seconds": 8.0}]), encoding="utf-8")

    assert pipeline.adopt(env["settings"], asr_dir) == 1

    root = env["settings"].pipeline_local_dir
    assert (root / "output" / f"{RECORDING}.mp3").exists()
    assert json.loads((root / "output" / f"{RECORDING}.json").read_text("utf-8"))["segments"] == SEGMENTS
    # La que no tiene transcripción del bench queda pendiente; nada llamó al ASR ni al LLM.
    assert (root / "otra_20261015_300002.mp3").exists()
    # El lote tiene una grabación pendiente: la metadata se queda en la raíz.
    assert (root / "lote.csv").exists()
    assert env["calls"] == {"asr": 0, "llm": 0}
