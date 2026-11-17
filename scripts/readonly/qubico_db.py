"""Consulta y vuelca la base de producción en solo lectura, por la API del visor https://<dominio>/db/ (pgweb).

Usa la misma clave web del visor (usuario `consulta`) y, detrás, el usuario de Postgres `qubico_readonly`: no puede
escribir, cada consulta se corta a los 60 s y `users` no trae credenciales. No necesita SSH, la llave del servidor ni
dependencias: solo Python 3.10+. Guía: docs/db-readonly-access.md § Desde un script.

    export QUBICO_DB_PASSWORD=...          # la clave del visor
    python qubico_db.py query "SELECT count(*) FROM cases"
    python qubico_db.py query "SELECT ..." --out resultado.csv     # o .json
    python qubico_db.py dump --out ~/qubico-dump                   # tablas (jsonl + qubico.db) + fichas .md
"""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://audit.qubicoenergy.com/db"
PAGE_SIZE = 200  # filas por consulta: model_runs pesa ~20 KB por fila y cada consulta tiene 60 s
SPEAKERS = {"agent": "Ejecutivo", "customer": "Cliente"}


class Client:
    def __init__(self, base_url: str, user: str, password: str) -> None:
        self.url = base_url.rstrip("/") + "/api/query"
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.headers = {"Authorization": f"Basic {token}", "Content-Type": "application/x-www-form-urlencoded"}

    def query(self, sql: str) -> tuple[list[str], list[list]]:
        body = urllib.parse.urlencode({"query": sql}).encode()
        request = urllib.request.Request(self.url, data=body, headers=self.headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 401:
                sys.exit("Clave incorrecta: revisa QUBICO_DB_PASSWORD (es la del visor /db/).")
            detail = error.read().decode(errors="replace")
            try:
                detail = json.loads(detail).get("error", detail)
            except ValueError:
                pass
            raise SystemExit(f"Error de la base ({error.code}): {detail}") from None
        return data.get("columns") or [], data.get("rows") or []

    def records(self, sql: str) -> list[dict]:
        columns, rows = self.query(sql)
        return [dict(zip(columns, row, strict=True)) for row in rows]


def parse_json(value):
    """pgweb devuelve las columnas json como texto."""
    if isinstance(value, str) and value[:1] in "[{":
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


# --- query ---------------------------------------------------------------------------------------------------------


def cmd_query(client: Client, args: argparse.Namespace) -> None:
    columns, rows = client.query(args.sql)
    out = Path(args.out) if args.out else None
    if out and out.suffix == ".json":
        records = [{c: parse_json(v) for c, v in zip(columns, row, strict=True)} for row in rows]
        out.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    else:
        handle = out.open("w", newline="", encoding="utf-8-sig") if out else sys.stdout
        writer = csv.writer(handle)
        writer.writerow(columns)
        writer.writerows(rows)
        if out:
            handle.close()
    if out:
        print(f"{len(rows)} filas -> {out}", file=sys.stderr)


# --- dump ----------------------------------------------------------------------------------------------------------

TABLES_SQL = """
SELECT c.table_name, string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) AS cols,
       json_agg(c.column_name ORDER BY c.ordinal_position) AS names
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND has_column_privilege(format('public.%I', c.table_name), c.column_name, 'SELECT')
GROUP BY c.table_name ORDER BY c.table_name
"""

PKEYS_SQL = """
SELECT t.relname AS table_name, string_agg(quote_ident(a.attname), ', ') AS pk
FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
WHERE i.indisprimary AND n.nspname = 'public' GROUP BY t.relname
"""


def dump_table(client: Client, table: str, cols: str, order: str, path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("w", encoding="utf-8") as handle:
        offset = 0
        while True:
            page = client.records(
                f'SELECT {cols} FROM public."{table}" ORDER BY {order} LIMIT {PAGE_SIZE} OFFSET {offset}'
            )
            for record in page:
                record = {k: parse_json(v) for k, v in record.items()}
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                rows.append(record)
            offset += len(page)
            if len(page) < PAGE_SIZE:
                return rows


def sqlite_value(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return int(value)
    return value


def write_sqlite(path: Path, columns: dict[str, list[str]], data: dict[str, list[dict]]) -> None:
    """Una tabla SQLite por tabla de Postgres; las columnas json quedan como texto (se leen con json_extract)."""
    path.unlink(missing_ok=True)
    with sqlite3.connect(path) as db:
        for table, names in columns.items():
            cols = ", ".join(f'"{n}"' for n in names)
            db.execute(f'CREATE TABLE "{table}" ({cols})')
            marks = ", ".join("?" for _ in names)
            db.executemany(
                f'INSERT INTO "{table}" VALUES ({marks})',
                ([sqlite_value(row.get(n)) for n in names] for row in data[table]),
            )
            for key in ("case_id", "call_id"):
                if key in names:
                    db.execute(f'CREATE INDEX "ix_{table}_{key}" ON "{table}" ("{key}")')
    with sqlite3.connect(path) as db:
        db.execute("VACUUM")


def mmss(ms) -> str:
    seconds = int(ms or 0) // 1000
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


EVAL_COLUMNS = ["evaluation_id", "version", "model", "finished_at", "case_id", "external_verdict", "verdict",
                "fail_criteria", "uncertain_criteria", "findings"]


def evaluation_runs(evaluations: list[dict]) -> list[dict]:
    """Aplana las pruebas completas de prompt (purpose = full): una fila por llamada, como model_runs.

    Esas corridas viven solo en prompt_evaluations.results (JSON); acá quedan consultables y entran a las fichas.
    """
    rows = []
    for ev in sorted(evaluations, key=lambda e: str(e.get("finished_at")), reverse=True):
        if ev.get("purpose") != "full" or ev.get("status") != "done":
            continue
        for result in ev.get("results") or []:
            rows.append({
                "evaluation_id": ev["id"], "version": ev.get("version"), "model": ev.get("model"),
                "finished_at": ev.get("finished_at"), "case_id": result.get("caseId"),
                "external_verdict": result.get("external"), "verdict": result.get("verdict"),
                "fail_criteria": result.get("failCriteria"), "uncertain_criteria": result.get("uncertainCriteria"),
                "findings": result.get("findings"),
            })
    return rows


def finding_lines(findings) -> list[str]:
    lines = []
    for finding in findings or []:
        if finding.get("verdict") in ("compliant", "not_applicable"):
            continue
        quote = (finding.get("evidence") or {}).get("quote")
        cite = f" · cita: «{quote}»" if quote else ""
        lines.append(
            f"- Motivo {finding.get('criterionId')}: {finding.get('verdict')}"
            f" ({finding.get('confidence')}) — {finding.get('comment') or ''}{cite}"
        )
    return lines


def call_card(case: dict, runs: list[dict], reviews: list[dict], evals: list[dict] = ()) -> str:
    meta = case.get("call_metadata") or {}
    lines = [
        f"# Llamada {case['call_id']}",
        "",
        f"- Caso: `{case['id']}` · estado: {case.get('status')}",
        f"- Fecha: {case.get('call_date')} · ejecutivo: {case.get('agent_id')}"
        f" · duración: {mmss(case.get('duration_ms'))}",
        f"- Veredicto de la corredora: {case.get('external_verdict') or '—'}"
        f" · motivos que falla: {case.get('external_item_fails') or '—'}",
    ]
    if case.get("external_comment"):
        lines.append(f"- Comentario de la corredora: {case['external_comment']}")
    if meta:
        lines += ["", "## Metadatos", "", "```json", json.dumps(meta, ensure_ascii=False, indent=1), "```"]

    for run in sorted(runs, key=lambda r: (not r.get("is_current"), str(r.get("run_at")))):
        current = " (vigente)" if run.get("is_current") in (True, "true") else ""
        lines += [
            "",
            f"## IA · {run.get('run_label') or run.get('model')}{current}",
            "",
            f"Modelo {run.get('model')} · prompt {run.get('prompt_version')} · rúbrica {run.get('rubric_version')}"
            f" · veredicto **{run.get('verdict')}**",
        ]
        if run.get("error"):
            lines.append(f"Error: {run['error']}")
        lines += finding_lines(run.get("findings"))

    for ev in evals:
        lines += [
            "",
            f"## IA · prueba completa del prompt {ev['version']} (no vigente)",
            "",
            f"Modelo {ev['model']} · prompt {ev['version']} · terminó {ev['finished_at']}"
            f" · veredicto **{ev['verdict']}**",
        ]
        lines += finding_lines(ev.get("findings"))

    for review in reviews:
        lines += ["", f"## Revisión del auditor · {review.get('final_verdict')} · {review.get('submitted_at')}", ""]
        lines += ["```json", json.dumps(review.get("items"), ensure_ascii=False, indent=1), "```"]

    lines += ["", "## Transcripción", ""]
    for turn in case.get("transcript") or []:
        who = SPEAKERS.get(turn.get("speaker"), turn.get("speaker"))
        lines.append(f"[{mmss(turn.get('startMs'))}] **{who}:** {turn.get('text')}")
    return "\n".join(lines) + "\n"


def cmd_dump(client: Client, args: argparse.Namespace) -> None:
    out = Path(args.out).expanduser() / dt.date.today().isoformat()
    (out / "tables").mkdir(parents=True, exist_ok=True)
    pkeys = {r["table_name"]: r["pk"] for r in client.records(PKEYS_SQL)}
    data: dict[str, list[dict]] = {}
    columns: dict[str, list[str]] = {}
    for table in client.records(TABLES_SQL):
        name = table["table_name"]
        columns[name] = parse_json(table["names"])
        order = pkeys.get(name) or table["cols"].split(", ")[0]
        data[name] = dump_table(client, name, table["cols"], order, out / "tables" / f"{name}.jsonl")
        print(f"{name}: {len(data[name])} filas", file=sys.stderr)

    data["evaluation_runs"] = evaluation_runs(data.get("prompt_evaluations", []))
    columns["evaluation_runs"] = EVAL_COLUMNS
    print(f"evaluation_runs: {len(data['evaluation_runs'])} filas (pruebas completas)", file=sys.stderr)
    evals_by_case: dict[str, list[dict]] = {}
    for row in data["evaluation_runs"]:
        evals_by_case.setdefault(row["case_id"], []).append(row)

    calls = out / "calls"
    calls.mkdir(exist_ok=True)
    runs_by_case: dict[str, list[dict]] = {}
    for run in data.get("model_runs", []):
        runs_by_case.setdefault(run["case_id"], []).append(run)
    reviews_by_case: dict[str, list[dict]] = {}
    for review in data.get("reviews", []):
        reviews_by_case.setdefault(review["case_id"], []).append(review)
    for case in data.get("cases", []):
        name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in str(case["call_id"]))
        card = call_card(
            case, runs_by_case.get(case["id"], []), reviews_by_case.get(case["id"], []),
            evals_by_case.get(case["id"], []),
        )
        (calls / f"{name}.md").write_text(card, encoding="utf-8")
    print(f"{len(data.get('cases', []))} fichas en {calls}", file=sys.stderr)
    write_sqlite(out / "qubico.db", columns, data)
    print(f"Base SQLite: {out / 'qubico.db'}", file=sys.stderr)
    print(f"Listo: {out}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=os.environ.get("QUBICO_DB_URL", DEFAULT_URL))
    parser.add_argument("--user", default=os.environ.get("QUBICO_DB_USER", "consulta"))
    sub = parser.add_subparsers(dest="command", required=True)
    query = sub.add_parser("query", help="corre una consulta SELECT y la imprime como CSV")
    query.add_argument("sql")
    query.add_argument("--out", help="archivo .csv o .json; sin esto, CSV por pantalla")
    dump = sub.add_parser("dump", help="vuelca las tablas visibles (jsonl + SQLite) y arma una ficha .md por llamada")
    dump.add_argument("--out", default="~/qubico-dump", help="carpeta base; se crea una subcarpeta con la fecha")
    args = parser.parse_args()

    password = os.environ.get("QUBICO_DB_PASSWORD")
    if not password:
        sys.exit("Falta QUBICO_DB_PASSWORD (la clave del visor /db/).")
    client = Client(args.url, args.user, password)
    {"query": cmd_query, "dump": cmd_dump}[args.command](client, args)


if __name__ == "__main__":
    main()
