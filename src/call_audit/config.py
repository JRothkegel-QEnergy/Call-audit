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

    # Cliente de esta instalación (un solo cliente en el MVP, H-62).
    client_name: str = "BancoEstado Corredores de Seguros"

    # Correos de invitación y restablecimiento (Cambio 12, D-36). console = no envía (desarrollo).
    email_backend: Literal["console", "smtp", "ses"] = "console"
    email_from: str = "Call Audit · Qubico <no-responder@qubicoenergy.com>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # URL pública del front, para armar los enlaces de los correos.
    app_base_url: str = "http://localhost:3000"

    # Audio desde S3 con URL prefirmada. Sin bucket, el caso viaja sin audio.
    s3_bucket: str = ""
    s3_prefix: str = "audios/"
    aws_region: str = "sa-east-1"
    audio_url_ttl_sec: int = 3600

    # Pipeline automático (python -m call_audit.ingestion.pipeline). Lee del SFTP de S4P si hay SFTP_HOST; si no, de
    # una carpeta local con la misma forma (audios y metadata en la raíz, resultados en output/).
    sftp_host: str = ""
    sftp_port: int = 22
    sftp_user: str = ""
    sftp_password: str = ""
    sftp_host_key: str = ""  # "ssh-ed25519 AAAA...": se obtiene con --host-key
    sftp_dir: str = "."  # carpeta de los audios en el servidor, relativa al inicio de la cuenta
    pipeline_local_dir: Path = ROOT.parent / "sftp"
    pipeline_work_dir: Path = ROOT.parent / "transcripts" / "pipeline"
    pipeline_model: str = "gemini-3-8-flash"  # nombre en scripts/prompt_bench/models.toml
    pipeline_asr_model: str = "gemini_3.8-flash"  # proveedor de scripts/asr_bench/run.py, el mismo del bench


@lru_cache
def get_settings() -> Settings:
    return Settings()
