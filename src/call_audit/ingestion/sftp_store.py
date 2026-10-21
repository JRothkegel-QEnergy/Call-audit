"""Carpeta de entrada del pipeline: el SFTP de S4P (SftpStore) o una carpeta local para desarrollo y tests
(LocalStore). Las dos tienen en la raíz los audios pendientes y la metadata, y en output/ el resultado de cada audio
(<grabación>.json) y el audio ya procesado, que se mueve ahí para que la raíz muestre solo lo que falta."""

import base64
import contextlib
import hashlib
import os
import stat
from dataclasses import dataclass
from pathlib import Path

OUTPUT_DIR = "output"


@dataclass(frozen=True)
class Entry:
    name: str
    mtime: float
    size: int

    @property
    def stem(self) -> str:
        return Path(self.name).stem


class LocalStore:
    def __init__(self, root: Path):
        self.root = root
        (root / OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    def entries(self) -> list[Entry]:
        return [Entry(p.name, p.stat().st_mtime, p.stat().st_size) for p in sorted(self.root.iterdir()) if p.is_file()]

    def outputs(self) -> set[str]:
        return {p.stem for p in (self.root / OUTPUT_DIR).glob("*.json")}

    def fetch(self, entry: Entry) -> Path:
        return self.root / entry.name

    def release(self, path: Path) -> None:
        """El archivo es el original: no se borra."""

    def read_output(self, stem: str) -> bytes:
        return (self.root / OUTPUT_DIR / f"{stem}.json").read_bytes()

    def write_output(self, stem: str, data: bytes) -> None:
        tmp = self.root / OUTPUT_DIR / f"{stem}.json.tmp"
        tmp.write_bytes(data)
        tmp.replace(self.root / OUTPUT_DIR / f"{stem}.json")

    def archive(self, entry: Entry) -> None:
        (self.root / entry.name).replace(self.root / OUTPUT_DIR / entry.name)

    def close(self) -> None:
        pass


class SftpStore:
    """Cuenta SFTP de S4P con usuario y contraseña. Los archivos se bajan a cache_dir solo cuando hacen falta, y el
    audio se borra del caché una vez que está en S3. La llave del servidor se fija con SFTP_HOST_KEY (se obtiene con
    `python -m call_audit.ingestion.pipeline --host-key`): sin ella no se conecta."""

    def __init__(self, host: str, port: int, user: str, password: str, host_key: str, remote_dir: str, cache_dir: Path):
        import paramiko

        if not host_key:
            raise RuntimeError("Falta SFTP_HOST_KEY: obténla con python -m call_audit.ingestion.pipeline --host-key")
        key_type, key_b64 = host_key.split()[:2]
        self.client = paramiko.SSHClient()
        name = host if port == 22 else f"[{host}]:{port}"
        self.client.get_host_keys().add(
            name, key_type, paramiko.PKey.from_type_string(key_type, base64.b64decode(key_b64))
        )
        self.client.set_missing_host_key_policy(paramiko.RejectPolicy())
        self.client.connect(
            host, port=port, username=user, password=password, look_for_keys=False, allow_agent=False, timeout=30
        )
        self.sftp = self.client.open_sftp()
        self.dir = remote_dir.rstrip("/") or "."
        self.out = f"{self.dir}/{OUTPUT_DIR}"
        with contextlib.suppress(OSError):
            self.sftp.mkdir(self.out)
        self.cache = cache_dir
        self.cache.mkdir(parents=True, exist_ok=True)

    def entries(self) -> list[Entry]:
        return [
            Entry(a.filename, float(a.st_mtime or 0), int(a.st_size or 0))
            for a in sorted(self.sftp.listdir_attr(self.dir), key=lambda a: a.filename)
            if a.st_mode is not None and stat.S_ISREG(a.st_mode)
        ]

    def outputs(self) -> set[str]:
        return {Path(a.filename).stem for a in self.sftp.listdir_attr(self.out) if a.filename.endswith(".json")}

    def fetch(self, entry: Entry) -> Path:
        local = self.cache / entry.name
        if not local.exists() or local.stat().st_size != entry.size or local.stat().st_mtime != entry.mtime:
            tmp = local.with_name(local.name + ".part")
            self.sftp.get(f"{self.dir}/{entry.name}", str(tmp))
            tmp.replace(local)
            # Se conserva la fecha del servidor: ordena la metadata y evita volver a bajar lo mismo.
            os.utime(local, (entry.mtime, entry.mtime))
        return local

    def release(self, path: Path) -> None:
        if path.parent == self.cache:
            path.unlink(missing_ok=True)

    def read_output(self, stem: str) -> bytes:
        with self.sftp.open(f"{self.out}/{stem}.json", "rb") as fh:
            return fh.read()

    def write_output(self, stem: str, data: bytes) -> None:
        target, tmp = f"{self.out}/{stem}.json", f"{self.out}/{stem}.json.tmp"
        with self.sftp.open(tmp, "wb") as fh:
            fh.write(data)
        self._rename(tmp, target)

    def archive(self, entry: Entry) -> None:
        """Mueve el audio a output/. Requiere escritura en la carpeta y que output/ esté en el mismo montaje."""
        self._rename(f"{self.dir}/{entry.name}", f"{self.out}/{entry.name}")

    def _rename(self, old: str, new: str) -> None:
        try:
            self.sftp.posix_rename(old, new)
        except OSError:  # servidores sin la extensión posix-rename
            with contextlib.suppress(OSError):
                self.sftp.remove(new)
            self.sftp.rename(old, new)

    def close(self) -> None:
        self.client.close()


def server_key(host: str, port: int) -> tuple[str, str]:
    """Llave pública del servidor (para SFTP_HOST_KEY) y su huella SHA256, para compararla con la que dé S4P."""
    import paramiko

    transport = paramiko.Transport((host, port))
    try:
        transport.start_client(timeout=30)
        key = transport.get_remote_server_key()
    finally:
        transport.close()
    fingerprint = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
    return f"{key.get_name()} {key.get_base64()}", f"SHA256:{fingerprint}"
