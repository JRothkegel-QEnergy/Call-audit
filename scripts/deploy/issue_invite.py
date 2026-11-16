"""Crea una cuenta invitada e imprime el enlace de activación, sin mandar correo.

Sirve mientras EMAIL_BACKEND no esté configurado: el enlace no se escribe en logs y en la base solo queda su hash, así
que esta es la única oportunidad de verlo. Corre dentro del contenedor de la API (lo llama invite_link.sh):

    python - <correo> <nombre> [rol]

El registro de actividad queda a nombre del admin activo más antiguo.
"""

import sys

from sqlalchemy import select

from call_audit import accounts
from call_audit.config import get_settings
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import User

ROLES = ("auditor", "supervisor", "qubico_admin", "qubico_viewer", "qubico_verifier")


def main(email: str, name: str, role: str = "qubico_admin") -> None:
    if role not in ROLES:
        raise SystemExit(f"Rol inválido: {role}. Usa uno de {', '.join(ROLES)}.")
    address = email.strip().lower()
    settings = get_settings()
    with get_sessionmaker()() as session, session.begin():
        if session.scalar(select(User).where(User.email == address)) is not None:
            raise SystemExit(f"Ya existe {address}. No se creó nada.")
        inviter = session.scalar(
            select(User).where(User.role == "qubico_admin", User.status == "active").order_by(User.created_at)
        )
        if inviter is None:
            raise SystemExit("No hay ningún admin activo. Crea el primero con call_audit.admin create-user.")
        user = User(
            email=address,
            name=name.strip(),
            role=role,
            permissions=[],
            status="invited",
            password_hash=None,
            created_by_id=inviter.id,
        )
        session.add(user)
        session.flush()
        url, expires = accounts.issue_link(user, "invite", settings)
        accounts.log(session, inviter, "account_invited", address, f"Rol: {role} (enlace por consola)")
    print(f"Cuenta invitada: {address} · rol {role} · invitó {inviter.email}")
    print(f"Vence: {expires.isoformat()}")
    print(url)


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
