"""Estado del worker en la base (Cambio 14): la pasada en curso con sus contadores, el latido y las fallas de ASR.

La vista Procesamiento del admin lee estas tablas. Escribir acá nunca frena una pasada: si la base falla, se loguea
y el pipeline sigue igual que antes.
"""

import json
import logging
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session, sessionmaker

from call_audit.persistence.models import AsrFailure, PipelineRun, WorkerHeartbeat

logger = logging.getLogger("call_audit.pipeline")
Sessions = sessionmaker[Session]

HEARTBEAT_SEC = 30
KEEP_RUNS = 200  # la vista pide 20; el resto queda para mirar a mano


def now() -> datetime:
    return datetime.now(UTC)


def safely(action: Callable[[Session], None], sessions: Sessions, what: str) -> None:
    try:
        with sessions() as session, session.begin():
            action(session)
    except Exception:  # noqa: BLE001 - el estado es para mirar; no frena la pasada
        logger.exception("No se pudo guardar %s", what)


class Progress:
    """Una fila de pipeline_runs por pasada. Los contadores se suman por audio desde varios hilos."""

    def __init__(self, sessions: Sessions):
        self.sessions = sessions
        self.run_id: int | None = None
        self.lock = threading.Lock()

    def start(self) -> None:
        def create(session: Session) -> None:
            run = PipelineRun()
            session.add(run)
            session.flush()
            self.run_id = run.id
            keep = select(PipelineRun.id).order_by(PipelineRun.id.desc()).limit(KEEP_RUNS).scalar_subquery()
            session.execute(delete(PipelineRun).where(PipelineRun.id.not_in(keep)))

        safely(create, self.sessions, "el inicio de la pasada")

    def set(self, **fields: object) -> None:
        if self.run_id is None:
            return
        with self.lock:
            stmt = update(PipelineRun).where(PipelineRun.id == self.run_id).values(**fields)
            safely(lambda session: session.execute(stmt), self.sessions, "el avance de la pasada")

    def add(self, **deltas: int) -> None:
        values = {name: getattr(PipelineRun, name) + delta for name, delta in deltas.items()}
        self.set(**values)

    def finish(self, archived: int, validated: int) -> None:
        self.set(status="done", stage=None, archived=archived, validated=validated, finished_at=now())

    def fail(self, exc: BaseException) -> None:
        # Solo el tipo y la primera línea: los mensajes de las librerías pueden traer rutas con nombres de archivo.
        message = f"{type(exc).__name__}: {str(exc).splitlines()[0] if str(exc) else ''}"[:300]
        self.set(status="failed", stage=None, error=message, finished_at=now())


def interrupt_orphans(sessions: Sessions) -> None:
    """Al arrancar el worker: una pasada que quedó en running murió con el proceso anterior (H-85)."""
    stmt = (
        update(PipelineRun)
        .where(PipelineRun.status == "running")
        .values(status="interrupted", stage=None, finished_at=now())
    )
    safely(lambda session: session.execute(stmt), sessions, "las pasadas interrumpidas")


class Heartbeat:
    """Escribe el latido cada HEARTBEAT_SEC desde un hilo propio, también en medio de una transcripción larga (H-81)."""

    def __init__(self, sessions: Sessions, loop_seconds: int | None):
        self.sessions = sessions
        self.loop_seconds = loop_seconds
        self.state = "idle"
        self.next_run_at: datetime | None = None
        self.stop = threading.Event()

    def beat(self) -> None:
        def write(session: Session) -> None:
            row = session.get(WorkerHeartbeat, 1) or WorkerHeartbeat(id=1)
            row.last_seen_at = now()
            row.state = self.state
            row.next_run_at = self.next_run_at
            row.loop_seconds = self.loop_seconds
            session.add(row)

        safely(write, self.sessions, "el latido")

    def update(self, state: str, next_run_at: datetime | None = None) -> None:
        self.state, self.next_run_at = state, next_run_at
        self.beat()

    def start(self) -> None:
        def loop() -> None:
            while not self.stop.wait(HEARTBEAT_SEC):
                self.beat()

        self.beat()
        threading.Thread(target=loop, name="heartbeat", daemon=True).start()


class Failures:
    """Intentos fallidos de ASR por grabación, en la tabla asr_failures: tras `max_attempts` se deja de reintentar
    (cada intento se paga). `legacy` es el work/asr_failures.json de antes del Cambio 14: se importa una vez.
    `transient` son marcas de error que no son culpa del audio (cuota, falta de saldo): esas fallas no bloquean, y
    las que quedaron registradas de antes (ej. los 402 del 2 nov) se borran al cargar."""

    def __init__(
        self, sessions: Sessions, max_attempts: int, legacy: Path | None = None, transient: tuple[str, ...] = ()
    ):
        self.sessions = sessions
        self.max_attempts = max_attempts
        if legacy is not None and legacy.exists():
            self.import_legacy(legacy)
        with sessions() as session, session.begin():
            rows = session.scalars(select(AsrFailure)).all()
            stale = [row.stem for row in rows if any(marker in row.error for marker in transient)]
            if stale:
                session.execute(delete(AsrFailure).where(AsrFailure.stem.in_(stale)))
                logger.info("Fallas por cuota o saldo descartadas (no bloquean): %d", len(stale))
            self.attempts = {row.stem: row.attempts for row in rows if row.stem not in set(stale)}

    def import_legacy(self, path: Path) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        with self.sessions() as session, session.begin():
            for stem, entry in data.items():
                if session.get(AsrFailure, stem) is None:
                    at = datetime.fromisoformat(entry["at"]) if entry.get("at") else now()
                    session.add(
                        AsrFailure(
                            stem=stem,
                            error=entry.get("error", ""),
                            attempts=entry.get("attempts", 0),
                            last_attempt_at=at if at.tzinfo else at.replace(tzinfo=UTC),
                        )
                    )
        path.rename(path.with_suffix(".json.imported"))

    def blocked(self, stem: str) -> bool:
        return self.attempts.get(stem, 0) >= self.max_attempts

    def add(self, stem: str, error: str) -> None:
        self.attempts[stem] = self.attempts.get(stem, 0) + 1

        def write(session: Session) -> None:
            row = session.get(AsrFailure, stem) or AsrFailure(stem=stem)
            row.attempts, row.error, row.last_attempt_at = self.attempts[stem], error[:500], now()
            session.add(row)

        safely(write, self.sessions, "una falla de ASR")

    def clear(self, stem: str) -> None:
        if self.attempts.pop(stem, None) is not None:
            safely(lambda s: s.execute(delete(AsrFailure).where(AsrFailure.stem == stem)), self.sessions, "una falla")
