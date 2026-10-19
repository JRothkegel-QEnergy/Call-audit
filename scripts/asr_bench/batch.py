"""Corre el benchmark de ASR sobre varios audios en paralelo y arma un índice HTML.

Uso:
    python scripts/asr_bench/batch.py --audios DIR --metadata XLSX --names a,b,c [--out DIR] [--workers N]
    python scripts/asr_bench/batch.py --audios DIR --metadata XLSX --names-file lista.txt

Al final genera un viewer.html por audio y un index.html con todos los audios de --out.
Todo queda fuera del repo: contiene PII.
"""

import argparse
import html
import json
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import run  # noqa: E402
import viewer  # noqa: E402

LOCK = threading.Lock()


def log(msg: str) -> None:
    with LOCK:
        print(msg, flush=True)


def build_index(out_root: Path, metadata: Path | None) -> Path:
    rows = []
    providers: list[str] = []
    for d in sorted(p for p in out_root.iterdir() if p.is_dir()):
        summary_path = d / "_summary.json"
        if not summary_path.exists():
            continue
        summary = {x["provider"]: x for x in json.loads(summary_path.read_text(encoding="utf-8"))}
        for name in summary:
            if name not in providers:
                providers.append(name)
        meta = viewer.load_metadata(metadata, d.name) if metadata else {}
        seconds = next((x.get("audio_seconds") for x in summary.values() if x.get("audio_seconds")), None)
        rows.append((d.name, meta, seconds, summary))

    # Solo los modelos que separan ejecutivo/cliente y entregan timestamps.
    providers = [p for p in run.DEFAULT_PROVIDERS if p in providers]
    totals = dict.fromkeys(providers, 0.0)
    total_minutes = 0.0
    body = []
    for name, meta, seconds, summary in rows:
        cells = []
        for p in providers:
            item = summary.get(p)
            if not item:
                cells.append('<td class="na">—</td>')
            elif item.get("error"):
                cells.append(f'<td class="err" title="{html.escape(item["error"])}">error</td>')
            else:
                cost = item.get("cost_usd")
                totals[p] += cost or 0
                result_path = out_root / name / f"{p}.json"
                complete = result_path.exists() and json.loads(result_path.read_text(encoding="utf-8")).get("segments")
                flag = "" if complete else '<small class="err">incompleta (JSON cortado)</small>'
                cost_txt = f"US${cost:.4f}" if cost is not None else "sin precio"
                cells.append(f"<td>{cost_txt}<small>{item.get('seconds', '')}s</small>{flag}</td>")
        total_minutes += (seconds or 0) / 60
        body.append(
            f'<tr><td><a href="{html.escape(name)}/viewer.html">{html.escape(name)}</a></td>'
            f"<td>{html.escape(meta.get('ESTADO_CALIDAD', ''))}</td>"
            f"<td>{html.escape(meta.get('MOTIVO RENUNCIA', ''))}</td>"
            f"<td>{html.escape(meta.get('EJECUTIVO', ''))}</td>"
            f"<td>{(seconds or 0) / 60:.1f}</td>" + "".join(cells) + "</tr>"
        )
    foot = "".join(
        f"<td><b>US${totals[p]:.4f}</b><small>US${totals[p] / total_minutes:.4f}/min</small></td>"
        if total_minutes
        else "<td></td>"
        for p in providers
    )
    head = "".join(f"<th>{html.escape(viewer.LABELS.get(p, p))}</th>" for p in providers)
    page = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Benchmark ASR</title>
<style>
  :root {{ --bg:#f6f7f9; --panel:#fff; --text:#1d2330; --muted:#667085; --border:#e3e6eb; --accent:#2f6fde; --err:#c0362c; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg:#12151b; --panel:#1b1f27; --text:#e6e9ef; --muted:#98a2b3; --border:#2c323d; --accent:#6a9cff; --err:#f87171; }} }}
  body {{ margin:0; padding:16px; background:var(--bg); color:var(--text); font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }}
  h1 {{ font-size:16px; margin:0 0 4px; }} p {{ color:var(--muted); margin:0 0 12px; font-size:13px; }}
  .wrap {{ overflow-x:auto; background:var(--panel); border:1px solid var(--border); border-radius:8px; }}
  table {{ border-collapse:collapse; width:100%; font-size:13px; }}
  th, td {{ padding:6px 10px; border-bottom:1px solid var(--border); text-align:left; white-space:nowrap; vertical-align:top; }}
  th {{ font-weight:600; color:var(--muted); }}
  td small {{ display:block; color:var(--muted); font-size:11px; }}
  tfoot td {{ border-bottom:0; }}
  a {{ color:var(--accent); }} .err {{ color:var(--err); }} .na {{ color:var(--muted); }}
</style></head><body>
<h1>Benchmark ASR</h1>
<p>{len(rows)} llamadas · {total_minutes:.1f} min de audio. Costo por modelo y tiempo de respuesta. Clic en una llamada para comparar las transcripciones.</p>
<div class="wrap"><table>
<thead><tr><th>Grabación</th><th>Calidad</th><th>Motivo renuncia</th><th>Ejecutivo</th><th>Min</th>{head}</tr></thead>
<tbody>{"".join(body)}</tbody>
<tfoot><tr><td colspan="5"><b>Total</b></td>{foot}</tr></tfoot>
</table></div></body></html>"""
    out = out_root / "index.html"
    out.write_text(page, encoding="utf-8")
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audios", type=Path, required=True)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--names", default="")
    parser.add_argument("--names-file", type=Path)
    parser.add_argument("--out", type=Path, default=run.DEFAULT_OUT)
    parser.add_argument("--only", default="")
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    run.load_env(run.REPO_ROOT / ".env")
    names = [n for n in args.names.split(",") if n]
    if args.names_file:
        names += [n.strip() for n in args.names_file.read_text(encoding="utf-8").splitlines() if n.strip()]
    providers = [p for p in args.only.split(",") if p] or run.DEFAULT_PROVIDERS

    def job(name: str) -> None:
        audio = args.audios / f"{name}.mp3"
        run.run_providers(audio, providers, args.out / name, log=log)
        cmd = [sys.executable, str(Path(viewer.__file__)), str(args.out / name), str(audio)]
        if args.metadata:
            cmd += ["--metadata", str(args.metadata)]
        subprocess.run(cmd, check=True, capture_output=True)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(job, names))

    print(build_index(args.out, args.metadata))


if __name__ == "__main__":
    main()
