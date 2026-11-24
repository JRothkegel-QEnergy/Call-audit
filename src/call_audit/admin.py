"""Administración de cuentas. No hay registro abierto: las cuentas las crea Qubico.

Uso:
    uv run python -m call_audit.admin create-user --email E --name N --role ROLE [--model-io]
    (ROLE: auditor, supervisor, qubico_admin, qubico_viewer (solo lectura) o qubico_verifier (calibrador))
    uv run python -m call_audit.admin set-password --email E
    uv run python -m call_audit.admin grant --email E --permission view_model_io|manage_catalog [--revoke]
    uv run python -m call_audit.admin distribute --version V --calls ARCHIVO --verifiers E1,E2,... --by E [--apply]

`distribute` reparte entre calibradores solo las llamadas de ARCHIVO (un .xlsx con la columna «Llamada», p. ej. el
de divergencias, o un .txt con un id de llamada por línea), estratificado como «Repartir llamadas» y sin mover lo ya
asignado. Sin --apply solo muestra cuántas le tocan a cada uno.

La contraseña se pide por consola (no queda en el historial de la terminal). --model-io activa el permiso
view_model_io (ver el prompt y la respuesta del modelo, D-22). --manage-catalog activa manage_catalog (subir y
editar el catálogo de seguros; solo supervisores, D-28).
"""

import argparse
import getpass
from pathlib import Path

from argon2 import PasswordHasher
from sqlalchemy import select

from call_audit import assignments, prompt_evaluation
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import Case, User

hasher = PasswordHasher()
PERMISSIONS = ["view_model_io", "manage_catalog"]


ROLES = ["auditor", "supervisor", "qubico_admin", "qubico_viewer", "qubico_verifier"]


def permissions(args) -> list[str]:
    if args.manage_catalog and args.role != "supervisor":
        raise SystemExit("manage_catalog es solo para supervisores.")
    return [p for p, on in (("view_model_io", args.model_io), ("manage_catalog", args.manage_catalog)) if on]


ROLES = ["auditor", "supervisor", "qubico_admin", "qubico_viewer", "qubico_verifier"]


def ask_password() -> str:
    password = getpass.getpass("Contraseña (mínimo 12 caracteres): ")
    if len(password) < 12:
        raise SystemExit("La contraseña debe tener al menos 12 caracteres.")
    if getpass.getpass("Repítela: ") != password:
        raise SystemExit("Las contraseñas no coinciden.")
    return password


ROLES = ["auditor", "supervisor", "qubico_admin", "qubico_viewer", "qubico_verifier"]


def read_call_ids(path: Path) -> list[str]:
    """Ids de llamada de un .xlsx (columna «Llamada» de la primera hoja que la tenga, sin repetir) o de un .txt."""
    if path.suffix.lower() == ".xlsx":
        import openpyxl

        workbook = openpyxl.load_workbook(path, read_only=True)
        for sheet in workbook.worksheets:
            rows = sheet.iter_rows(values_only=True)
            header = [str(h).strip() if h is not None else "" for h in next(rows, ())]
            if "Llamada" in header:
                col = header.index("Llamada")
                values = [str(r[col]).strip() for r in rows if r and r[col] is not None]
                return list(dict.fromkeys(v for v in values if v))
        raise SystemExit(f"{path.name}: ninguna hoja tiene la columna «Llamada».")
    lines = path.read_text(encoding="utf-8").splitlines()
    return list(dict.fromkeys(v.strip() for v in lines if v.strip()))


def distribute(args) -> None:
    call_ids = read_call_ids(Path(args.calls))
    emails = [e.strip().lower() for e in args.verifiers.split(",") if e.strip()]
    with get_sessionmaker()() as session, session.begin():
        actor = session.scalar(select(User).where(User.email == args.by.strip().lower()))
        if actor is None or actor.role != "qubico_admin":
            raise SystemExit(f"--by debe ser una cuenta qubico_admin ({args.by}).")
        people = []
        for email in emails:
            user = session.scalar(select(User).where(User.email == email))
            if user is None or user.role != assignments.VERIFIER or user.status != "active":
                raise SystemExit(f"{email} no es una cuenta calibrador activa.")
            people.append(user)
        evaluation = prompt_evaluation.latest_full(session, args.version)
        if evaluation is None:
            raise SystemExit(f"v{args.version} no tiene corrida completa.")
        by_call = dict(session.execute(select(Case.call_id, Case.id).where(Case.call_id.in_(call_ids))).all())
        in_run = {r["caseId"] for r in evaluation.results or []}
        missing = [c for c in call_ids if c not in by_call]
        outside = [c for c in call_ids if c in by_call and by_call[c] not in in_run]
        only = {by_call[c] for c in call_ids if c in by_call and by_call[c] in in_run}
        found = assignments.assignment_map(session, list(only))
        user_ids = [u.id for u in people]
        result = (assignments.distribute if args.apply else assignments.plan)(
            session, evaluation, user_ids, *((actor,) if args.apply else ()), only=only
        )
        print(f"Llamadas en el archivo: {len(call_ids)}")
        print(f"  no existen en la base: {len(missing)}{' · ' + ', '.join(missing[:10]) if missing else ''}")
        print(f"  fuera de la corrida completa v{args.version}: {len(outside)}")
        print(f"  ya asignadas antes: {len(found)}")
        print(f"  ya revisadas sin asignar (no se reparten): {len(only) - len(found) - result['calls']}")
        print(f"{'Repartidas' if args.apply else 'Se repartirían'}: {result['calls']}")
        for p in result["people"]:
            print(f"  {p['name']}: {p['calls']}")
        if not args.apply:
            print("Vista previa: no se guardó nada. Agrega --apply para repartir.")
            session.rollback()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-user")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--role", choices=ROLES, required=True)
    create.add_argument("--model-io", action="store_true", help="permiso view_model_io")
    create.add_argument("--manage-catalog", action="store_true", help="permiso manage_catalog (solo supervisor)")
    reset = sub.add_parser("set-password")
    reset.add_argument("--email", required=True)
    grant = sub.add_parser("grant")
    grant.add_argument("--email", required=True)
    grant.add_argument("--permission", choices=PERMISSIONS, required=True)
    grant.add_argument("--revoke", action="store_true")
    dist = sub.add_parser("distribute", help="repartir entre calibradores las llamadas de un archivo")
    dist.add_argument("--version", required=True, help="versión del prompt con corrida completa, p. ej. 3.0")
    dist.add_argument("--calls", required=True, help=".xlsx con columna «Llamada» o .txt con un id por línea")
    dist.add_argument("--verifiers", required=True, help="correos de los calibradores, separados por coma")
    dist.add_argument("--by", required=True, help="correo del admin que reparte (queda en la bitácora)")
    dist.add_argument("--apply", action="store_true", help="guardar el reparto (sin esto, solo vista previa)")
    args = parser.parse_args()
    if args.command == "distribute":
        distribute(args)
        return

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
