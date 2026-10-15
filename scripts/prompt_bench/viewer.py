"""Genera un visor HTML para revisar a mano las respuestas de cada IA, llamada por llamada.

Uso:
    python scripts/prompt_bench/viewer.py              # usa results/
    python scripts/prompt_bench/viewer.py <carpeta>    # otra carpeta, ej. una de archive/
    python scripts/prompt_bench/viewer.py <resultados> --calls <carpeta_llamadas>   # llamadas reales (real_calls.py)

Escribe <carpeta>/viewer.html (autocontenido, se abre con doble clic en el navegador).
"""

import json
import sys
from pathlib import Path

from run import extract_audit

ROOT = Path(__file__).resolve().parents[2]
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

# Texto oficial de la "Pauta Calidad Actualizada" del cliente.
CRITERIA = {
    1: "Deja en espera por tiempo excesivo",
    2: "Descripción del seguro corresponde a otro seguro",
    3: "Excede 3 objeciones máximo para retención",
    4: "No indica ninguna característica del seguro a renunciar",
    5: "No informa que la permanencia la maneja cliente ante consulta directa",
    6: "No maneja información del producto o coberturas",
    7: "No realiza derivación correcta",
    8: "No responde de forma directa al cliente. Elude las preguntas",
    9: "Renuncia seguro irrenunciable en este canal",
    10: "Su atención no se ajusta a la política de BancoEstado",
    11: "Descalifica a los pares, a BancoEstado o a la competencia",
    12: "Induce a renuncia",
    13: "No indica número de seguro en protocolo de cierre",
    14: "No realiza ningún intento de retención del seguro retenible",
    15: "No se informa medio de pago en protocolo de cierre",
    16: "Realiza retención de seguro sin intención de renuncia",
    17: "Retiene seguro no retenible",
    18: "Tipifica motivo de renuncia incorrecto",
    19: "Tipifica renuncia y por grabación es retención",
    20: "Tipifica renuncia de seguro no mencionado",
    21: "Tipifica renuncia que corresponde a otro seguro",
    22: "Tipifica retención de seguro no mencionado",
    23: "Tipifica retención que corresponde a otro seguro",
    24: "Tipifica retención y por grabación es renuncia",
    25: "No tipifica todas las gestiones",
    26: "No se impactan todas las gestiones solicitadas por el cliente",
    27: "Entrega información a tercero, sin retomar protocolo de cierre con el titular",
    28: "Niega devolución de primas",
    29: "No realiza protocolo de cierre",
    30: "No reitera protocolo de cierre ante respuesta no permitida",
    31: "No valida correctamente al cliente (Rut, Nombre, Fecha Nacimiento)",
    32: "Predispone al cliente para la aceptación del seguro, condiciona la respuesta a un Si",
    33: "No valida correctamente al cliente (Email, Fono)",
}


def parse_response(text: str) -> dict | None:
    try:
        return extract_audit(text)
    except ValueError:
        return None


def collect() -> dict:
    calls = []
    models = sorted(d.name for d in RESULTS_DIR.iterdir() if d.is_dir()) if RESULTS_DIR.exists() else []
    for path in sorted(p for p in CALLS_DIR.glob("*.json") if p.stem.startswith(("synth_", "call_"))):
        call = json.loads(path.read_text(encoding="utf-8"))
        outputs = {}
        for model in models:
            base = RESULTS_DIR / model / path.stem
            entry: dict = {}
            if (base.with_suffix(".json")).exists():
                raw = base.with_suffix(".json").read_text(encoding="utf-8")
                entry["response"] = parse_response(raw)
                if entry["response"] is None:
                    entry["error"] = "Respuesta inválida: no trae una auditoría (¿devolvió el esquema?)"
                    entry["raw"] = raw[:4000]
            elif Path(f"{base}.error.txt").exists():
                entry["error"] = Path(f"{base}.error.txt").read_text(encoding="utf-8")[:500]
            if Path(f"{base}.meta.json").exists():
                entry["meta"] = json.loads(Path(f"{base}.meta.json").read_text(encoding="utf-8"))
            outputs[model] = entry
        calls.append({"stem": path.stem, "call": call, "outputs": outputs})
    try:
        source = str(RESULTS_DIR.relative_to(ROOT))
    except ValueError:
        source = str(RESULTS_DIR)
    return {"models": models, "criteria": CRITERIA, "calls": calls, "source": source}


HTML = r"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visor prompt bench</title>
<style>
:root {
  --bg: #f7f7f5; --panel: #ffffff; --text: #1d1d1b; --muted: #6b6b66; --line: #e3e3de;
  --accent: #2f5bd3; --bad: #c2341f; --bad-bg: #fbe9e6; --warn: #9a6a00; --warn-bg: #fdf3d8;
  --ok: #2e7d4f; --ok-bg: #e7f4ec; --na: #8a8a84; --na-bg: #f0f0ec; --hit: #2e7d4f; --miss: #c2341f;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161615; --panel: #1f1f1d; --text: #ecece8; --muted: #a0a09a; --line: #34342f;
    --accent: #7ea2ff; --bad: #ff8a75; --bad-bg: #3a1f1a; --warn: #f0c45a; --warn-bg: #3a3018;
    --ok: #7fd3a1; --ok-bg: #1b3326; --na: #8c8c86; --na-bg: #2a2a27;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
nav { border-right: 1px solid var(--line); background: var(--panel); padding: 16px 12px; position: sticky; top: 0; height: 100vh; overflow: auto; }
nav h1 { font-size: 15px; margin: 0 0 4px; }
nav .src { color: var(--muted); font-size: 12px; margin-bottom: 12px; word-break: break-all; }
nav button { display: block; width: 100%; text-align: left; border: 0; background: none; color: var(--text); padding: 8px 10px; border-radius: 6px; cursor: pointer; font: inherit; }
nav button:hover { background: var(--na-bg); }
nav button.active { background: var(--accent); color: #fff; }
nav button small { display: block; opacity: .75; font-size: 12px; }
main { padding: 20px 24px 60px; min-width: 0; }
h2 { margin: 0 0 4px; font-size: 20px; }
.desc { color: var(--muted); margin: 0 0 16px; max-width: 900px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 16px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.card h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.card ul { margin: 0; padding-left: 18px; }
.toolbar { display: flex; gap: 16px; align-items: center; margin: 8px 0 10px; flex-wrap: wrap; }
.toolbar label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.tablewrap { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: var(--panel); font-size: 12px; white-space: nowrap; }
td.crit { min-width: 260px; }
td.crit b { display: inline-block; width: 26px; color: var(--muted); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; border: 1px solid transparent; }
.s-non_compliant { background: var(--bad-bg); color: var(--bad); }
.s-uncertain { background: var(--warn-bg); color: var(--warn); }
.s-compliant { background: var(--ok-bg); color: var(--ok); }
.s-not_applicable, .s-missing { background: var(--na-bg); color: var(--na); }
.hit { border-color: var(--hit); }
.miss { border-color: var(--miss); border-style: dashed; }
.badge.sel { outline: 2px solid var(--accent); outline-offset: 1px; }
.detail { margin-top: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-height: 60px; }
.detail .q { border-left: 3px solid var(--accent); padding: 4px 10px; margin: 6px 0; background: var(--bg); }
.detail .q.notfound { border-left-color: var(--bad); }
.detail .tag { font-size: 12px; color: var(--muted); }
.transcript { max-height: 520px; overflow: auto; }
.turn { display: grid; grid-template-columns: 48px 70px 1fr; gap: 8px; padding: 3px 0; }
.turn .t { color: var(--muted); font-variant-numeric: tabular-nums; }
.turn .who { font-weight: 600; font-size: 12px; }
.turn.agent .who { color: var(--accent); }
.turn.hl { background: var(--warn-bg); border-radius: 4px; }
.err { color: var(--bad); white-space: pre-wrap; }
.legend { color: var(--muted); font-size: 12px; }
details summary { cursor: pointer; font-weight: 600; margin: 14px 0 8px; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } nav { position: static; height: auto; } }
</style>
</head>
<body>
<div class="layout">
  <nav id="nav"></nav>
  <main id="main"></main>
</div>
<script>
const DATA = __DATA__;
const LABEL = { non_compliant: "incumple", uncertain: "indet.", compliant: "cumple", not_applicable: "no aplica", missing: "—" };
const MAP = { incumple: "non_compliant", cumple: "compliant", no_aplica: "not_applicable", indeterminado: "uncertain" };
let current = 0, onlyDiff = true, selected = null;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

// Llamadas reales: el Excel solo trae el veredicto de la llamada (findings = null), no los motivos.
const isReal = call => call.expected.findings == null;
function realVerdict(call, out) {
  const crit = (out?.response?.criterios || []).filter(c => !(call.expected.unevaluable || []).includes(Number(c.id)));
  if (!out?.response) return "ERROR";
  if (crit.some(c => c.estado === "incumple")) return "RECHAZADA";
  const infoOk = (out.response.informacion_seguro?.estado || "OK") === "OK";
  return crit.some(c => c.estado === "indeterminado") || !infoOk ? "DUDOSA" : "APROBADA";
}
const VCLS = { RECHAZADA: "s-non_compliant", DUDOSA: "s-uncertain", APROBADA: "s-compliant", ERROR: "s-missing" };
function verdictBadge(call, out) {
  const v = realVerdict(call, out), real = call.expected.call_verdict;
  const mark = v === "APROBADA" || v === "RECHAZADA" ? (v === real ? " ✓" : " ✗") : "";
  return `<span class="badge ${VCLS[v]} ${mark === " ✓" ? "hit" : mark ? "miss" : ""}">${v === "DUDOSA" ? "POR REVISAR" : v}${mark}</span>`;
}
function expectedStatus(call, id) {
  if (isReal(call)) return { status: "unknown", note: "" };
  const f = call.expected.findings.find(f => f.criterion_id === id);
  if (!f) return { status: "ok_or_na", note: "" };
  return { status: f.status === "non_compliant" ? "non_compliant" : "uncertain", note: f.note };
}
function modelCrit(out, id) {
  const c = out?.response?.criterios?.find(c => Number(c.id) === id);
  if (!c) return null;
  return { ...c, status: MAP[String(c.estado).toLowerCase()] || "missing" };
}
function quoteFound(call, quote) {
  const q = norm(quote);
  if (!q) return false;
  return call.transcript.some(t => norm(t.text).includes(q));
}

function renderNav() {
  document.getElementById("nav").innerHTML =
    `<h1>Visor prompt bench</h1><div class="src">${esc(DATA.source)} · ${DATA.models.length} modelos</div>` +
    DATA.calls.map((c, i) => {
      const extra = isReal(c.call) ? ` · ${DATA.models.map(n => { const v = realVerdict(c.call, c.outputs[n]); return v === c.call.expected.call_verdict ? "✓" : v === "DUDOSA" ? "?" : "✗"; }).join("")}` : "";
      return `<button class="${i === current ? "active" : ""}" onclick="go(${i})">${esc(c.call.call_id)}<small>${esc(c.call.title)}${extra}</small></button>`;
    }).join("");
}
function go(i) { current = i; selected = null; renderNav(); renderMain(); window.scrollTo(0, 0); }

function renderMain() {
  const { call, outputs } = DATA.calls[current];
  const m = call.metadata;
  const exp = call.expected;
  const policies = m.policies.map(p => `<li>${esc(p.name)} · N° de seguro <b>${esc(p.mus_a_neto)}</b> · medio de pago: ${esc(p.payment_method)}</li>`).join("");
  const typ = m.typification.length ? m.typification.map(t => `<li>${esc(t.mus_a_neto)}: ${esc(t.outcome)} · ${esc(t.reason)}</li>`).join("") : "<li>(sin tipificación)</li>";
  const expList = isReal(call) ? `<li>Excel: <b>${esc(exp.call_verdict)}</b> (sin detalle de motivos)</li>` : exp.findings.length ? exp.findings.map(f => `<li><b>${f.criterion_id}</b> ${esc(f.status)}: ${esc(f.note)}</li>`).join("") : "<li>Ninguno: la llamada cumple.</li>";
  const outcomes = (exp.outcomes || []).map(o => `<li>${esc(o.mus_a_neto)}: ${esc(o.outcome)} · ${esc((o.cancellation_reasons || []).join(" / ") || "sin motivo")} · ${o.objections} objeciones</li>`).join("");

  // Gestiones según cada modelo
  const gestRows = DATA.models.map(name => {
    const out = outputs[name];
    if (!out?.response) return `<tr><td>${esc(name)}</td><td colspan="5" class="err">${esc(out?.error || "sin respuesta")}</td></tr>`;
    const g = out.response.gestiones || [];
    return g.map((x, k) => {
      const e = (exp.outcomes || []).find(o => o.mus_a_neto === String(x.mus_a_neto));
      const ok = (a, b) => e ? (a === b ? "" : ` style="color:var(--bad);font-weight:600"`) : "";
      const reasons = (x.motivos_renuncia || []).join(" / ");
      const args = (x.argumentos_retencion || []).map(a => a.tipo).join(" → ");
      return `<tr>${k === 0 ? `<td rowspan="${g.length}">${esc(name)}</td>` : ""}<td>${esc(x.mus_a_neto)}</td><td${ok(x.resultado_grabacion, e?.outcome)}>${esc(x.resultado_grabacion)}</td><td>${esc(reasons)}</td><td${ok(x.n_objeciones, e?.objections)}>${esc(x.n_objeciones)}</td><td>${esc(args)}</td></tr>`;
    }).join("");
  }).join("");

  // Grilla de motivos
  const rows = Object.entries(DATA.criteria).map(([idStr, name]) => {
    const id = Number(idStr);
    const e = expectedStatus(call, id);
    const cells = DATA.models.map(model => {
      const c = modelCrit(outputs[model], id);
      if (!c) return { model, status: "missing", html: `<span class="badge s-missing">—</span>` };
      const expBad = e.status === "non_compliant", gotBad = c.status === "non_compliant";
      let cls = "";
      if (expBad && gotBad) cls = "hit";
      else if (expBad !== gotBad && e.status !== "uncertain") cls = "miss";
      const isSel = selected && selected.model === model && selected.id === id;
      return { model, status: c.status, cls, html: `<span class="badge s-${c.status} ${cls} ${isSel ? "sel" : ""}" onclick="pick('${model}',${id})" title="${esc(c.comentario)}">${LABEL[c.status]}</span>` };
    });
    const interesting = !["ok_or_na", "unknown"].includes(e.status) || cells.some(x => x.status === "non_compliant" || x.status === "uncertain");
    if (onlyDiff && !interesting) return "";
    const expBadge = e.status === "unknown" ? `<span class="badge s-not_applicable">sin dato</span>` : e.status === "ok_or_na" ? `<span class="badge s-not_applicable">cumple / n.a.</span>` : `<span class="badge s-${e.status}" title="${esc(e.note)}">${LABEL[e.status]}</span>`;
    const unev = (exp.unevaluable || []).includes(id) ? ` <span class="tag">(no cuenta: falta la gestión tipificada)</span>` : "";
    return `<tr><td class="crit"><b>${id}</b>${esc(name)}${unev}</td><td>${expBadge}</td>${cells.map(x => `<td>${x.html}</td>`).join("")}</tr>`;
  }).join("");

  const transcript = call.transcript.map((t, i) => {
    const s = Math.floor(t.start_ms / 1000);
    return `<div class="turn ${t.channel}" id="turn-${i}"><span class="t">${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}</span><span class="who">${t.channel === "agent" ? "AGENTE" : t.channel === "customer" ? "CLIENTE" : "OTRO"}</span><span>${esc(t.text)}</span></div>`;
  }).join("");

  const summaries = DATA.models.map(name => {
    const out = outputs[name];
    const meta = out?.meta;
    const info = meta ? `${esc(meta.returned_model)} · ${(meta.latency_ms / 1000).toFixed(1)} s${meta.cost_usd != null ? ` · ${meta.cost_usd.toFixed(4)} USD` : ""}` : "";
    const vb = isReal(call) ? verdictBadge(call, out) + " " : "";
    const info = out?.response?.informacion_seguro;
    const infoNote = info && info.estado && info.estado !== "OK" ? `<br><span class="badge s-uncertain">${esc(info.estado)}</span> ${esc(info.comentario)}` : "";
    return `<li>${vb}<b>${esc(name)}</b> <span class="tag">${info}</span><br>${out?.response ? esc(out.response.resumen) + infoNote : `<span class="err">${esc(out?.error || "sin respuesta")}</span>`}</li>`;
  }).join("");

  document.getElementById("main").innerHTML = `
    <h2>${esc(call.call_id)} · ${esc(call.title)}</h2>
    <p class="desc">${esc(call.description)}${call.audio_href ? ` · <a href="${esc(call.audio_href)}" target="_blank">Escuchar el audio</a>` : ""}</p>
    ${isReal(call) ? `<div class="card" style="margin-bottom:12px"><h3>Veredicto de cada IA vs. Excel (${esc(exp.call_verdict)})</h3>${DATA.models.map(n => `<div style="margin:4px 0">${verdictBadge(call, outputs[n])} ${esc(n)}</div>`).join("")}<div class="tag" style="margin-top:6px">RECHAZADA = al menos un incumple · POR REVISAR = solo indeterminados o sin información del seguro · motivos ${(exp.unevaluable || []).join(", ")} no cuentan</div></div>` : ""}
    <div class="cards">
      <div class="card"><h3>Metadatos</h3><ul>${policies}</ul><div class="tag" style="margin-top:6px">Agente ${esc(m.agent_id)} · ${m.duration_sec} s · esperas: ${JSON.stringify(m.holds_sec)}</div></div>
      <div class="card"><h3>Tipificación registrada</h3><ul>${typ}</ul></div>
      <div class="card"><h3>Esperado (${esc(exp.call_verdict)})</h3><ul>${expList}</ul>${outcomes ? `<h3 style="margin-top:10px">Gestiones esperadas</h3><ul>${outcomes}</ul>` : ""}</div>
    </div>
    <div class="toolbar">
      <label><input type="checkbox" ${onlyDiff ? "checked" : ""} onchange="onlyDiff=this.checked;renderMain()"> Solo motivos con hallazgos</label>
      <span class="legend">Borde verde: acierto · borde rojo punteado: no coincide con lo esperado · clic en un estado para ver comentario y citas</span>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th>Motivo</th><th>${isReal(call) ? "Excel" : "Esperado"}</th>${DATA.models.map(n => `<th>${esc(n)}</th>`).join("")}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${DATA.models.length + 2}">Ningún modelo ni el esperado marcan hallazgos.</td></tr>`}</tbody>
    </table></div>
    <div class="detail" id="detail">${renderDetail()}</div>
    <details open><summary>Resumen de cada modelo</summary><ul>${summaries}</ul></details>
    <details><summary>Gestiones según cada modelo (en rojo lo que no coincide)</summary>
      <div class="tablewrap"><table><thead><tr><th>Modelo</th><th>N° de seguro</th><th>Resultado</th><th>Motivos renuncia</th><th>Objeciones</th><th>Argumentos</th></tr></thead><tbody>${gestRows}</tbody></table></div>
    </details>
    <details open><summary>Transcripción</summary><div class="card transcript">${transcript}</div></details>`;
  highlightQuotes();
}

function renderDetail() {
  if (!selected) return `<span class="tag">Haz clic en un estado de la grilla para ver el comentario y las citas del modelo.</span>`;
  const { call, outputs } = DATA.calls[current];
  const c = modelCrit(outputs[selected.model], selected.id);
  if (!c) return "";
  const ev = (c.evidencia || []).map(x => {
    const found = quoteFound(call, x.cita);
    return `<div class="q ${found ? "" : "notfound"}"><span class="tag">${esc(x.t)} · ${esc(x.hablante)} · ${found ? "cita encontrada en la transcripción" : "cita NO encontrada en la transcripción"}</span><br>“${esc(x.cita)}”</div>`;
  }).join("");
  return `<b>${esc(selected.model)} · motivo ${selected.id}: ${esc(DATA.criteria[selected.id])}</b>
    <div class="tag">estado: ${esc(c.estado)} · confianza: ${esc(c.confianza)}</div>
    <p>${esc(c.comentario) || "<i>sin comentario</i>"}</p>${ev || `<span class="tag">Sin citas.</span>`}`;
}

function pick(model, id) { selected = { model, id }; renderMain(); document.getElementById("detail").scrollIntoView({ behavior: "smooth", block: "nearest" }); }

function highlightQuotes() {
  if (!selected) return;
  const { call, outputs } = DATA.calls[current];
  const c = modelCrit(outputs[selected.model], selected.id);
  (c?.evidencia || []).forEach(x => {
    const q = norm(x.cita);
    call.transcript.forEach((t, i) => { if (q && norm(t.text).includes(q)) document.getElementById(`turn-${i}`)?.classList.add("hl"); });
  });
}

renderNav();
renderMain();
</script>
</body>
</html>
"""


def main() -> None:
    global RESULTS_DIR, CALLS_DIR
    args = sys.argv[1:]
    if "--calls" in args:
        i = args.index("--calls")
        CALLS_DIR = Path(args[i + 1]).resolve()
        del args[i : i + 2]
    if args:
        RESULTS_DIR = Path(args[0]).resolve()
    data = collect()
    out = RESULTS_DIR / "viewer.html"
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    out.write_text(HTML.replace("__DATA__", payload), encoding="utf-8")
    print(f"Visor: {out}")


if __name__ == "__main__":
    main()
