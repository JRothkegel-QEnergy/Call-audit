"""Cuentas: invitaciones y restablecimiento de contraseña con enlace de un solo uso (Cambio 12, D-36).

El enlace lleva un token opaco; en la base solo queda su SHA-256. Vence a las 72 h (H-71). Reenviar genera un token
nuevo y anula el anterior. El token nunca se escribe en logs.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.config import Settings
from call_audit.notify import email as mail
from call_audit.persistence.models import AccessLog, User

INVITE_TTL = timedelta(hours=72)
MIN_PASSWORD = 12
hasher = PasswordHasher()


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=UTC)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def log(session: Session, actor: User, action: str, target: str, details: str = "") -> None:
    session.add(AccessLog(user_id=actor.id, action=action, target=target[:100], details=details))


def issue_link(user: User, kind: str, settings: Settings) -> tuple[str, datetime]:
    """Genera un token nuevo (anula el anterior) y devuelve la URL del enlace y su vencimiento."""
    token = secrets.token_urlsafe(32)
    user.invite_token_hash = token_hash(token)
    user.invite_kind = kind
    user.invite_expires_at = now() + INVITE_TTL
    user.invite_used_at = None
    return f"{settings.app_base_url.rstrip('/')}/invite/{token}", user.invite_expires_at


def expires_text(value: datetime) -> str:
    local = value.astimezone()
    return local.strftime("%d-%m-%Y a las %H:%M")


def send_invitation(session: Session, user: User, inviter: User, settings: Settings) -> None:
    url, expires = issue_link(user, "invite", settings)
    message = mail.invitation(
        to=user.email,
        name=user.name,
        inviter=inviter.name,
        client=settings.client_name,
        role=user.role,
        url=url,
        expires=expires_text(expires),
        settings=settings,
    )
    mail.send(message, settings)


def send_reset(session: Session, user: User, settings: Settings) -> None:
    url, _ = issue_link(user, "reset", settings)
    mail.send(mail.password_reset(to=user.email, url=url, settings=settings), settings)


def invite(
    session: Session,
    *,
    inviter: User,
    name: str,
    email: str,
    role: str,
    permissions: list[str],
    settings: Settings,
) -> User:
    address = email.strip().lower()
    if session.scalar(select(User).where(User.email == address)) is not None:
        raise ValueError("duplicate_email")
    user = User(
        email=address,
        name=name.strip(),
        role=role,
        permissions=permissions,
        status="invited",
        password_hash=None,
        created_by_id=inviter.id,
    )
    session.add(user)
    session.flush()
    send_invitation(session, user, inviter, settings)
    log(session, inviter, "account_invited", address, f"Rol: {role}")
    return user


def link_state(user: User | None) -> str:
    """valid | expired | used | revoked, para la pantalla /invite/[token]."""
    if user is None or user.status == "deactivated":
        return "revoked"
    if user.invite_used_at is not None:
        return "used"
    if aware(user.invite_expires_at) is None or aware(user.invite_expires_at) < now():
        return "expired"
    return "valid"


def find_by_token(session: Session, token: str) -> User | None:
    return session.scalar(select(User).where(User.invite_token_hash == token_hash(token)))


def accept(session: Session, token: str, password: str) -> User:
    user = find_by_token(session, token)
    state = link_state(user)
    if state != "valid":
        raise ValueError(state)
    if len(password) < MIN_PASSWORD:
        raise ValueError("short_password")
    assert user is not None
    user.password_hash = hasher.hash(password)
    user.invite_used_at = now()
    user.invite_token_hash = None
    if user.status == "invited":
        user.status = "active"
    session.add(
        AccessLog(
            user_id=user.id,
            action="account_activated" if user.invite_kind == "invite" else "password_reset",
            target=user.email[:100],
        )
    )
    return user
