import type { Discrepancy, SortDirection, Tray, TraySort, VerificationScope } from "@/lib/api/admin-types";

/** Bandejas del verificador en la URL (18-verificador-bandeja-y-revisadas): `bandeja=pendientes|revisadas`. */
const TRAY_PARAM: Record<Tray, string> = { pending: "pendientes", reviewed: "revisadas" };
const DISCREPANCIES: Discrepancy[] = ["fn", "fp", "undecided", "criteria", "none"];

/** Orden por columna en la URL (19-resumen-avance-y-orden-bandejas, X4 A): `orden=…&dir=asc|desc`. */
export const SORT_PARAM: Record<TraySort, string> = {
  date: "fecha",
  reviewed: "revisada",
  ai: "qubyt",
  reviewer: "planilla",
  call: "llamada",
};

export const trayFromParam = (value: string | null): Tray | null =>
  value === "pendientes" ? "pending" : value === "revisadas" ? "reviewed" : null;

export const discrepancyFromParam = (value: string | null): Discrepancy | null =>
  DISCREPANCIES.includes(value as Discrepancy) ? (value as Discrepancy) : null;

export const sortFromParam = (value: string | null): TraySort | null =>
  (Object.entries(SORT_PARAM).find(([, v]) => v === value)?.[0] as TraySort | undefined) ?? null;

export const dirFromParam = (value: string | null): SortDirection | null =>
  value === "asc" || value === "desc" ? value : null;

/** La página de la bandeja: Por revisar es el inicio del verificador. */
export const trayPath = (tray: Tray) => (tray === "pending" ? "/verification" : "/verification/reviewed");

/**
 * Contexto de la verificación con verificadores (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md) en la
 * URL: `fuente=full` (corrida completa) y `asignadas=me|all|unassigned|<id>`; desde una bandeja del verificador (18),
 * también `bandeja`, `discrepancia` y el orden (`orden`, `dir`). Sin `fuente`, es la prueba de siempre.
 */
export function scopeFromParams(params: {
  get(name: string): string | null;
}): VerificationScope {
  const sort = sortFromParam(params.get("orden"));
  return {
    source: params.get("fuente") === "full" ? "full" : "test",
    assignee: params.get("asignadas"),
    tray: trayFromParam(params.get("bandeja")),
    discrepancy: discrepancyFromParam(params.get("discrepancia")),
    sort,
    dir: sort ? (dirFromParam(params.get("dir")) ?? "asc") : null,
  };
}

/** "&orden=…&dir=…" o vacío. */
export const sortQuery = (scope?: Pick<VerificationScope, "sort" | "dir"> | null) =>
  scope?.sort ? `&orden=${SORT_PARAM[scope.sort]}&dir=${scope.dir ?? "asc"}` : "";

/** "&fuente=full&asignadas=…" para sumar a un enlace que ya tiene `?`; vacío fuera de la corrida completa. */
export function scopeQuery(scope?: VerificationScope | null): string {
  if (!scope || scope.source !== "full") return "";
  return `&fuente=full${scope.assignee ? `&asignadas=${encodeURIComponent(scope.assignee)}` : ""}${
    scope.tray ? `&bandeja=${TRAY_PARAM[scope.tray]}` : ""
  }${scope.discrepancy ? `&discrepancia=${scope.discrepancy}` : ""}${sortQuery(scope)}`;
}

export const verificationHref = (version: string, assignee?: string | null) =>
  `/admin/prompts/${encodeURIComponent(version)}/verification${assignee ? `?asignadas=${encodeURIComponent(assignee)}` : ""}`;
