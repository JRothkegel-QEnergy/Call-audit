/**
 * «Calidad de la IA» (docs/ux/admin-prompt-metrics/05-numeros-propuesta.md §5): cada versión llega con el bloque
 * `agreement` del mosaico, medido sobre las llamadas de validación. Aquí solo queda qué versión se muestra y su nombre.
 */
import type { QualitySeries } from "./api/admin-types";

/**
 * Corrida por defecto (G9 de docs/ux/admin-prompt-metrics/03-orden-y-detalle-brief.md): solo la última prueba de
 * versión terminada; la vigente y las demás se suman con «Agregar versión». Sin pruebas, la vigente.
 */
export function defaultSeries(series: QualitySeries[]): string[] {
  const latestTest = series
    .filter((s) => s.source === "prompt_test")
    .reduce<QualitySeries | null>((best, s) => (!best || (s.ranAt ?? "") > (best.ranAt ?? "") ? s : best), null);
  const pick = latestTest ?? series.find((s) => s.isCurrent) ?? series[0];
  return pick ? [pick.id] : [];
}

export const MAX_SERIES = 6;

export function seriesName(s: QualitySeries): string {
  return [s.modelLabel, `v${s.promptVersion}`, s.isCurrent ? "vigente" : "prueba"].join(" · ");
}
