"""Servidor local de los dashboards de revisión: sirve los archivos como `python -m http.server` y guarda "Mi
revisión" (veredicto, ¿acertó cada IA?, notas) en un CSV junto a cada dashboard.

Uso (desde "Qubico Develop", para que los audios y los dashboards queden bajo la raíz):
    python call-audit/scripts/prompt_bench/review_server.py [--port 8765] [--root .]

API (solo 127.0.0.1):
    GET /api/review?dir=<carpeta del dashboard, relativa a la raíz>   → {"rows": [...]} leído de revision_capa2.csv
    PUT /api/review?dir=<carpeta>  body {"columns": [...], "rows": [[...]]} → reescribe revision_capa2.csv

El CSV contiene notas sobre llamadas reales: vive fuera del repo, junto al dashboard.
"""

import argparse
import csv
import io
import json
import os
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

REVIEW_FILE = "revision_capa2.csv"
MAX_BODY = 5_000_000


class ReviewHandler(SimpleHTTPRequestHandler):
    def _review_path(self) -> Path | None:
        """CSV de la carpeta pedida, solo si está bajo la raíz y tiene un dashboard (evita escribir en cualquier lado)."""
        rel = parse_qs(urlparse(self.path).query).get("dir", [""])[0].strip("/")
        root = Path(self.directory).resolve()
        folder = (root / rel).resolve()
        if folder != root and root not in folder.parents:
            return None
        if not (folder / "dashboard.html").is_file():
            return None
        return folder / REVIEW_FILE

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802 - nombre de la API de http.server
        if urlparse(self.path).path != "/api/review":
            return super().do_GET()
        path = self._review_path()
        if path is None:
            return self._json(404, {"error": "carpeta sin dashboard"})
        if not path.exists():
            return self._json(200, {"rows": [], "file": path.name})
        with path.open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        return self._json(200, {"rows": rows, "file": path.name})

    def do_PUT(self):  # noqa: N802
        if urlparse(self.path).path != "/api/review":
            return self._json(404, {"error": "no existe"})
        path = self._review_path()
        length = int(self.headers.get("Content-Length") or 0)
        if path is None or not 0 < length <= MAX_BODY:
            return self._json(400, {"error": "carpeta o cuerpo inválido"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            columns, rows = data["columns"], data["rows"]
        except (ValueError, KeyError):
            return self._json(400, {"error": "JSON inválido"})
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        writer.writerows(rows)
        # Escritura atómica: si el proceso muere a mitad, el CSV anterior queda intacto. BOM para que Excel lea UTF-8.
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".revision_", suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as f:
            f.write(buf.getvalue())
        os.replace(tmp, path)
        return self._json(200, {"ok": True, "rows": len(rows), "file": path.name})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    handler = partial(ReviewHandler, directory=str(args.root.resolve()))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Sirviendo {args.root.resolve()} en http://127.0.0.1:{args.port} (revisiones en {REVIEW_FILE})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
