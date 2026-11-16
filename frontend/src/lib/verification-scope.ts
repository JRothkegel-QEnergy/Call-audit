import type { VerificationScope } from "@/lib/api/admin-types";

/**
 * Contexto de la verificación con verificadores (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md) en la
 * URL: `fuente=full` (corrida completa) y `asignadas=me|all|unassigned|<id>`. Sin `fuente`, es la prueba de siempre.
 */
export function scopeFromParams(params: {
  get(name: string): string | null;
}): VerificationScope {
  return {
    source: params.get("fuente") === "full" ? "full" : "test",
    assignee: params.get("asignadas"),
  };
}

/** "&fuente=full&asignadas=…" para sumar a un enlace que ya tiene `?`; vacío fuera de la corrida completa. */
export function scopeQuery(scope?: VerificationScope | null): string {
  if (!scope || scope.source !== "full") return "";
  return `&fuente=full${scope.assignee ? `&asignadas=${encodeURIComponent(scope.assignee)}` : ""}`;
}

export const verificationHref = (version: string, assignee?: string | null) =>
  `/admin/prompts/${encodeURIComponent(version)}/verification${assignee ? `?asignadas=${encodeURIComponent(assignee)}` : ""}`;
