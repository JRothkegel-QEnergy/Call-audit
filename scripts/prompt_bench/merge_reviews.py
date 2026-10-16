"""Junta las revisiones de varias personas (revision_capa2_<nombre>.csv de review_server.py --revisor) en un CSV.

Uso:
    python scripts/prompt_bench/merge_reviews.py <carpeta con los CSV> [--out revision_consolidada.csv]

Agrega la columna `revisor` (sacada del nombre del archivo) y deja una fila por persona y llamada, ordenadas por
llamada, para comparar lo que anotó cada uno. Contiene notas sobre llamadas reales: no se commitea.
"""

import argparse
import csv
from pathlib import Path

PATTERN = "revision_capa2_*.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--out", type=Path, help="por defecto <carpeta>/revision_consolidada.csv")
    args = parser.parse_args()

    files = sorted(args.folder.glob(PATTERN))
    if not files:
        raise SystemExit(f"No hay archivos {PATTERN} en {args.folder}")

    columns, rows = ["revisor"], []
    for path in files:
        reviewer = path.stem.removeprefix("revision_capa2_")
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            columns += [c for c in reader.fieldnames or [] if c not in columns]
            rows += [{"revisor": reviewer, **row} for row in reader]
        print(f"  {path.name}: {sum(r['revisor'] == reviewer for r in rows)} llamadas")

    rows.sort(key=lambda r: (r.get("stem", ""), r["revisor"]))
    out = args.out or args.folder / "revision_consolidada.csv"
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{out}  ({len(rows)} filas de {len(files)} revisores)")


if __name__ == "__main__":
    main()
