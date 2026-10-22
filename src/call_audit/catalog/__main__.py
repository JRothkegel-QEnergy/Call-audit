"""Catálogo de seguros desde la terminal.

Uso (desde call-audit-rcv, con DATABASE_URL apuntando a la base):
    uv run python -m call_audit.catalog seed --file data/catalog/products.json   # carga inicial: 66 fichas como v1
    uv run python -m call_audit.catalog export --file catalogo.json               # foto vigente (formato products.json)
"""

import argparse
import json
from pathlib import Path

from call_audit.catalog import store
from call_audit.persistence.db import get_sessionmaker


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["seed", "export"])
    parser.add_argument("--file", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "seed":
        catalog = json.loads(args.file.read_text(encoding="utf-8"))
        with get_sessionmaker()() as session, session.begin():
            print(f"{store.seed(session, catalog)} seguros cargados como v1")
        return
    with get_sessionmaker()() as session:
        snap = store.snapshot(session)
    args.file.write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(snap['products'])} seguros en {args.file}")


if __name__ == "__main__":
    main()
