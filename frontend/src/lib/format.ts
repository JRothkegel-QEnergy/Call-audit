/** Formatos de la UI (06-ux-writing.md): coma decimal, minuto de llamada mm:ss, fechas cortas es-CL. */

export function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function pct(value: number, decimals = 1): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(decimals);
  return `${fixed.replace(".", ",")} %`;
}

export function pts(value: number): string {
  if (value === 0) return "=";
  const abs = Math.abs(value).toString().replace(".", ",");
  return `${value > 0 ? "+" : "−"}${abs} pts`;
}

export function int(value: number): string {
  return value.toLocaleString("es-CL");
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export function durationText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

export function minutesAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
