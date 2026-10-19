"""Administración de cuentas. No hay registro abierto: las cuentas las crea Qubico.

Uso:
    uv run python -m call_audit.admin create-user --email E --name N --role auditor|supervisor [--model-io]
    uv run python -m call_audit.admin set-password --email E

La contraseña se pide por consola (no queda en el historial de la terminal). --model-io activa el permiso
view_model_io (ver el prompt y la respuesta del modelo, D-22).
"""

import argparse
import getpass

from argon2 import PasswordHasher
from sqlalchemy import select

from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import User

hasher = PasswordHasher()


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
    create.add_argument("--role", choices=["auditor", "supervisor"], required=True)
    create.add_argument("--model-io", action="store_true", help="permiso view_model_io")
    reset = sub.add_parser("set-password")
    reset.add_argument("--email", required=True)
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
                    permissions=["view_model_io"] if args.model_io else [],
                    password_hash=hasher.hash(ask_password()),
                )
            )
        else:
            if user is None:
                raise SystemExit(f"No existe {email}.")
            user.password_hash = hasher.hash(ask_password())
    print("Listo.")


if __name__ == "__main__":
    main()
