/** Textos de la verificación caso a caso (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §6). */

import type { AgreementSegment, CallVerification, Verdict3, VerificationOutcome, VerificationSummary } from "@/lib/api/admin-types";

export const SEGMENTS: AgreementSegment[] = ["promptFn", "promptFp", "reviewer", "undecided", "agree"];

/** Línea de apoyo de cada parte bajo el título de la lista. */
export const SEGMENT_SUPPORT: Record<AgreementSegment, string> = {
  promptFn: "la IA dice que cumple y el revisor que no: rechazo no detectado",
  promptFp: "la IA dice que no cumple y el revisor que sí: falsa alarma",
  reviewer: "según la IA de análisis, el error está en la planilla del revisor",
  undecided: "la IA quedó dudosa; pasan a revisión de un auditor",
  agree: "mismo veredicto que la planilla, aunque puede haber motivos en desacuerdo",
};

export const CALL_STATUS: Record<CallVerification, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  ai_wrong: "La IA se equivocó",
  inconclusive: "No concluyente",
  none: "Sin desacuerdos",
};

export const CALL_STATUS_LONG: Record<CallVerification, string> = { ...CALL_STATUS, confirmed: "Confirmada: error de planilla" };

export const VERDICT: Record<Verdict3, string> = { compliant: "Cumple", non_compliant: "No cumple", uncertain: "Dudosa" };
export const VERDICT_CLASS: Record<Verdict3, string> = { compliant: "vt vt-pass", non_compliant: "vt vt-fail", uncertain: "vt vt-doubt" };

/** Botones del registro, con IA dudosa los dos primeros cambian (§4.2). */
export function outcomeLabel(outcome: VerificationOutcome, aiUndecided: boolean): string {
  if (outcome === "ai_error") return aiUndecided ? "La planilla tiene razón" : "Error de la IA";
  if (outcome === "reviewer_error") return aiUndecided ? "La planilla se equivocó" : "Error de la planilla";
  return outcome === "ambiguous" ? "Ambiguo" : "Falta información";
}

export const OUTCOMES: VerificationOutcome[] = ["ai_error", "reviewer_error", "ambiguous", "missing_info"];

export const CAUSE: Record<string, string> = {
  auditor: "Error de la planilla",
  rule_text: "Regla del prompt",
  observation: "Observación",
  unknown: "Sin causa",
};

const p0 = (x: number) => `${Math.round(x * 100)}`;

/** Suma de la tarjeta de verificación (§6.2): azul y verde miden confirmadas; rojo, amarillo y gris, la IA. */
export function summaryLine(segment: AgreementSegment, s: VerificationSummary): string | null {
  if (!s.reviewed) return null;
  const margin = s.ci95 ? ` (margen ${p0(s.ci95[0])}-${p0(s.ci95[1])} %)` : "";
  if (segment === "reviewer" || segment === "agree")
    return `Error de planilla confirmado en ${s.confirmed} de ${s.reviewed} revisadas: ${p0(s.confirmed / s.reviewed)} %${margin}`;
  return `La IA se equivocó en ${s.aiWrong} de ${s.reviewed} revisadas: ${p0(s.aiWrong / s.reviewed)} %${margin}`;
}
