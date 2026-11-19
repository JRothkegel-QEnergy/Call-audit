/** Cómo se lee la URL de Análisis de discrepancias (Cambio 20 §13.2), incluidos los enlaces anteriores a las pestañas. */

export type DiscrepancyTab = "summary" | "patterns" | "evaluators" | "followup" | "history";
export type MotiveSelection = number | "all" | "auto";
export type SetParams = (changes: Record<string, string | null>) => void;

type Params = Pick<URLSearchParams, "get">;

const TABS: DiscrepancyTab[] = ["summary", "patterns", "evaluators", "followup", "history"];

function motiveParam(params: Params): number | "all" | null {
  const raw = params.get("motivo");
  if (raw === "all") return "all";
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** Filtros que solo tienen sentido en la lista global. «Sin patrón» no filtra: se queda en Resumen. */
function hasGlobalFilter(params: Params): boolean {
  const action = params.get("action");
  return !!(params.get("quad") || params.get("right") || params.get("kind") || (action && action !== "unpatterned"));
}

/** Hay algo en la URL que, sin `tab`, llevaría a Patrones: Resumen tiene que pedirse explícitamente. */
export function hasPatternFilters(params: Params): boolean {
  return motiveParam(params) != null || !!params.get("cause") || !!params.get("type") || hasGlobalFilter(params);
}

export function resolveTab(params: Params): DiscrepancyTab {
  const tab = TABS.find((t) => t === params.get("tab"));
  if (tab) return tab;
  return hasPatternFilters(params) ? "patterns" : "summary";
}

/** "auto": el primer criterio con pendientes, sin escribirlo en la URL. Un enlace antiguo sin criterio era una lista global. */
export function resolveMotive(params: Params): MotiveSelection {
  const motive = motiveParam(params);
  if (motive != null) return motive;
  return params.get("tab") !== "patterns" || hasGlobalFilter(params) ? "all" : "auto";
}
