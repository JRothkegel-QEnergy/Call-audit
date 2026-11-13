import { MetricHelp } from "@/components/ui/metric-help";
import type { Typification } from "@/lib/api/types";

/**
 * Qué tipificó el ejecutivo (docs/ux/admin-prompt-metrics/09-info-llamada-y-tipificacion.md, T1 A): «Tipificó: Retención
 * · Motivo de renuncia: Problemas Económicos». «Motivo de renuncia» y no «Motivo» a secas: «motivo» es cada punto de la
 * pauta. Los casos de borde van en gris, no en color de alerta.
 */

const OUTCOME: Record<string, string> = { RETENCION: "Retención", RENUNCIA: "Renuncia", RETENIDO: "Retenido" };

/** «PROBLEMAS ECONOMICOS» → «Problemas economicos»; lo que ya viene con mayúsculas y minúsculas queda igual. */
function tidy(text: string): string {
  const t = text.trim();
  if (t !== t.toUpperCase()) return t;
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export function typificationLabel(t: Typification | null | undefined, opts: { short?: boolean } = {}): string {
  if (!t) return opts.short ? "—" : "Tipificación: no viene en el lote";
  const outcome = t.outcome ? (OUTCOME[t.outcome.toUpperCase()] ?? tidy(t.outcome)) : null;
  const what = outcome ? `${outcome}${t.assumed ? " (asumida)" : ""}` : "no informado";
  const reason = t.reason ? tidy(t.reason) : "no informado";
  if (opts.short) return t.reason ? `${what} · ${reason}` : what;
  return `Tipificó: ${what} · Motivo de renuncia: ${reason}`;
}

export function TypificationLine({ t, className }: { t: Typification | null | undefined; className?: string }) {
  const help = !t
    ? null
    : t.assumed
      ? "El lote no trae la gestión tipificada; el sistema asume Retención."
      : !t.outcome
        ? "El lote no trae la gestión tipificada: los motivos 19 a 25 de tipificación no se evalúan."
        : null;
  const muted = !t || t.assumed || !t.outcome || !t.reason;
  return (
    <span className={className}>
      <span className={muted ? "text-muted-foreground" : undefined}>{typificationLabel(t)}</span>
      {help && <MetricHelp title="Tipificación">{help}</MetricHelp>}
    </span>
  );
}
