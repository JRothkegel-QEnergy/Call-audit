"""Administración de cuentas. No hay registro abierto: las cuentas las crea Qubico.

Uso:
    uv run python -m call_audit.admin create-user --email E --name N --role auditor|supervisor|qubico_admin [--model-io]
    uv run python -m call_audit.admin set-password --email E
    uv run python -m call_audit.admin grant --email E --permission view_model_io|manage_catalog [--revoke]

La contraseña se pide por consola (no queda en el historial de la terminal). --model-io activa el permiso
view_model_io (ver el prompt y la respuesta del modelo, D-22). --manage-catalog activa manage_catalog (subir y
editar el catálogo de seguros; solo supervisores, D-28).
"""

import argparse
import getpass

from argon2 import PasswordHasher
from sqlalchemy import select

from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import User

hasher = PasswordHasher()
PERMISSIONS = ["view_model_io", "manage_catalog"]


def permissions(args) -> list[str]:
    if args.manage_catalog and args.role != "supervisor":
        raise SystemExit("manage_catalog es solo para supervisores.")
    return [p for p, on in (("view_model_io", args.model_io), ("manage_catalog", args.manage_catalog)) if on]


def ask_password() -> str:
    password = getpass.getpass("Contraseña (mínimo 12 caracteres): ")
    if len(password) < 12:
        raise SystemExit("La contraseña debe tener al menos 12 caracteres.")
    if getpass.getpass("Repítela: ") != password:
        raise SystemExit("Las contraseñas no coinciden.")
    return password


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-user")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--role", choices=["auditor", "supervisor", "qubico_admin"], required=True)
    create.add_argument("--model-io", action="store_true", help="permiso view_model_io")
    create.add_argument("--manage-catalog", action="store_true", help="permiso manage_catalog (solo supervisor)")
    reset = sub.add_parser("set-password")
    reset.add_argument("--email", required=True)
    grant = sub.add_parser("grant")
    grant.add_argument("--email", required=True)
    grant.add_argument("--permission", choices=PERMISSIONS, required=True)
    grant.add_argument("--revoke", action="store_true")
    args = parser.parse_args()

    email = args.email.strip().lower()
    with get_sessionmaker()() as session, session.begin():
        user = session.scalar(select(User).where(User.email == email))
        if args.command == "create-user":
            if user is not None:
                raise SystemExit(f"Ya existe {email}.")
            session.add(
                User(
                    email=email,
                    name=args.name,
                    role=args.role,
                    permissions=permissions(args),
                    password_hash=hasher.hash(ask_password()),
                )
            )
        elif args.command == "grant":
            if user is None:
                raise SystemExit(f"No existe {email}.")
            if args.permission == "manage_catalog" and user.role != "supervisor" and not args.revoke:
                raise SystemExit("manage_catalog es solo para supervisores.")
            current = [p for p in user.permissions or [] if p != args.permission]
            user.permissions = current if args.revoke else [*current, args.permission]
        else:
            if user is None:
                raise SystemExit(f"No existe {email}.")
            user.password_hash = hasher.hash(ask_password())
    print("Listo.")


if __name__ == "__main__":
    main()
