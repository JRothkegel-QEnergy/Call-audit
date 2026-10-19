"""Sesión por cookie firmada y permisos por rol."""

from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from call_audit.config import Settings, get_settings
from call_audit.persistence.db import get_session
from call_audit.persistence.models import User

COOKIE = "ca_session"
hasher = PasswordHasher()

DbSession = Annotated[Session, Depends(get_session)]


def serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="session")


def verify_password(user: User, password: str) -> bool:
    if not user.password_hash:
        return False
    try:
        return hasher.verify(user.password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def set_session(response: Response, user: User, settings: Settings) -> None:
    response.set_cookie(
        COOKIE,
        serializer(settings).dumps({"uid": user.id}),
        max_age=settings.session_max_age_sec,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def clear_session(response: Response, settings: Settings) -> None:
    response.delete_cookie(COOKIE, httponly=True, secure=settings.cookie_secure, samesite=settings.cookie_samesite)


def optional_user(
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings)],
    ca_session: Annotated[str | None, Cookie()] = None,
) -> User | None:
    if not ca_session:
        return None
    try:
        data = serializer(settings).loads(ca_session, max_age=settings.session_max_age_sec)
    except BadSignature:
        return None
    user = session.get(User, data.get("uid"))
    return user if user is not None and user.status == "active" else None


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(401, "Sesión no iniciada")
    return user


def supervisor(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "supervisor":
        raise HTTPException(403, "Solo para supervisores")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
Supervisor = Annotated[User, Depends(supervisor)]
