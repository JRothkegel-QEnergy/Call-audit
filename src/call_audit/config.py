"""Configuración desde variables de entorno (y .env en desarrollo)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
DEV_SECRET = "dev-only-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore", env_ignore_empty=True)

    # SQLite sirve para desarrollo y tests; en AWS va el Postgres de RDS (postgresql+psycopg://...).
    database_url: str = f"sqlite:///{(ROOT / 'call_audit.db').as_posix()}"
    # Firma la cookie de sesión. Obligatoria fuera de desarrollo.
    session_secret: str = DEV_SECRET
    session_max_age_sec: int = 12 * 3600
    # true detrás de HTTPS (AWS); false en localhost.
    cookie_secure: bool = False
    # "lax" si el front y la API comparten dominio; "none" (con cookie_secure) si van en dominios distintos.
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    # Orígenes del front que pueden llamar a la API con cookie (coma separada).
    cors_origins: str = "http://localhost:3000"

    rubric_path: Path = ROOT / "rubrics" / "bancoestado_retention" / "v1.0.1.yaml"

    # Audio desde S3 con URL prefirmada. Sin bucket, el caso viaja sin audio.
    s3_bucket: str = ""
    s3_prefix: str = "audios/"
    aws_region: str = "sa-east-1"
    audio_url_ttl_sec: int = 3600

    # Pipeline automático (python -m call_audit.ingestion.pipeline). En el EC2 el SFTP se monta en el worker.
    pipeline_sftp_dir: Path = ROOT.parent / "sftp" / "bancoestado"
    pipeline_work_dir: Path = ROOT.parent / "transcripts" / "pipeline"
    pipeline_model: str = "gemini-3-8-flash"  # nombre en scripts/prompt_bench/models.toml
    pipeline_asr_model: str = "gemini_3.8-flash"  # proveedor de scripts/asr_bench/run.py, el mismo del bench


@lru_cache
def get_settings() -> Settings:
    return Settings()
