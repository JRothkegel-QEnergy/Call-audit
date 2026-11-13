/** Textos de la verificación caso a caso (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §6). */

import type { AgreementSegment, CallList, CallVerification, Verdict3, VerificationOutcome, VerificationSummary } from "@/lib/api/admin-types";

export const SEGMENTS: AgreementSegment[] = ["promptFn", "promptFp", "reviewer", "undecided", "agree"];
export const LISTS: CallList[] = [...SEGMENTS, "fp", "fn", "disagree"];

/** Nombre de cada lista (05-numeros-propuesta.md §3): las partes del mosaico y los lados de las metas. */
export const LIST_NAME: Record<CallList, string> = {
  promptFn: "IA Sí / Revisor No",
  promptFp: "IA No / Revisor Sí",
  reviewer: "Posible error del revisor",
  undecided: "Sin decisión de la IA",
  agree: "Coincide con el revisor",
  fp: "Falsas alarmas",
  fn: "Rechazos no detectados",
  disagree: "Desacuerdos por motivo",
};

/** Color de la lista para su muestra; los lados usan el de la IA (rojo o amarillo). */
export const LIST_SWATCH: Record<CallList, AgreementSegment | null> = {
  promptFn: "promptFn",
  promptFp: "promptFp",
  reviewer: "reviewer",
  undecided: "undecided",
  agree: "agree",
  fp: "promptFp",
  fn: "promptFn",
  disagree: null,
};

/** Con un motivo, la lista es por motivo (05-numeros-propuesta.md §2): «Solo el revisor lo marca · motivo 18». */
export function listTitle(list: CallList, criterion: number | null): string {
  if (criterion == null) return LIST_NAME[list];
  const side = list === "fn" ? "Solo el revisor lo marca" : list === "fp" ? "Solo la IA lo marca" : "Desacuerdos";
  return `${side} · motivo ${criterion}`;
}

export const listHref = (version: string, list: CallList, criterion?: number | null) =>
  `/admin/prompts/${encodeURIComponent(version)}/calls?segment=${list}${criterion != null ? `&motivo=${criterion}` : ""}`;

/** Línea de apoyo de cada parte bajo el título de la lista. */
export const SEGMENT_SUPPORT: Record<CallList, string> = {
  promptFn: "la IA dice que cumple y el revisor que no: rechazo no detectado",
  promptFp: "la IA dice que no cumple y el revisor que sí: falsa alarma",
  reviewer: "según la IA de análisis, se equivocó el revisor",
  undecided: "la IA quedó dudosa; pasan a revisión de un auditor",
  agree: "mismo veredicto que la planilla, aunque puede haber motivos en desacuerdo",
  fp: "la IA rechaza y el revisor aprueba: a corregir o posible error del revisor",
  fn: "la IA aprueba y el revisor rechaza: a corregir o posible error del revisor",
  disagree: "llamadas con al menos un motivo en que la IA y el revisor no marcan lo mismo",
};

export const CALL_STATUS: Record<CallVerification, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  ai_wrong: "La IA se equivocó",
  inconclusive: "No concluyente",
  none: "Sin desacuerdos",
};

export const CALL_STATUS_LONG: Record<CallVerification, string> = { ...CALL_STATUS, confirmed: "Confirmada: error del revisor" };

export const VERDICT: Record<Verdict3, string> = { compliant: "Cumple", non_compliant: "No cumple", uncertain: "Dudosa" };
export const VERDICT_CLASS: Record<Verdict3, string> = { compliant: "vt vt-pass", non_compliant: "vt vt-fail", uncertain: "vt vt-doubt" };

/** Botones del registro, con IA dudosa los dos primeros cambian (§4.2). */
export function outcomeLabel(outcome: VerificationOutcome, aiUndecided: boolean): string {
  if (outcome === "ai_error") return aiUndecided ? "El revisor tiene razón" : "Error de la IA";
  if (outcome === "reviewer_error") return aiUndecided ? "El revisor se equivocó" : "Error del revisor";
  return outcome === "ambiguous" ? "Ambiguo" : "Falta información";
}

export const OUTCOMES: VerificationOutcome[] = ["ai_error", "reviewer_error", "ambiguous", "missing_info"];

export const CAUSE: Record<string, string> = {
  auditor: "Error del revisor",
  rule_text: "Regla del prompt",
  observation: "Observación",
  unknown: "Sin causa",
};

const p0 = (x: number) => `${Math.round(x * 100)}`;

/** Suma de la tarjeta de verificación (§6.2): azul y verde miden confirmadas; rojo, amarillo y gris, la IA. */
export function summaryLine(segment: CallList, s: VerificationSummary): string | null {
  if (!s.reviewed) return null;
  const margin = s.ci95 ? ` (margen ${p0(s.ci95[0])}-${p0(s.ci95[1])} %)` : "";
  if (segment === "reviewer" || segment === "agree")
    return `Error del revisor confirmado en ${s.confirmed} de ${s.reviewed} revisadas: ${p0(s.confirmed / s.reviewed)} %${margin}`;
  return `La IA se equivocó en ${s.aiWrong} de ${s.reviewed} revisadas: ${p0(s.aiWrong / s.reviewed)} %${margin}`;
}
