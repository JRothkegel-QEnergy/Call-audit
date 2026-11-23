/** Textos de la verificación caso a caso (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §6). */

import type { AgreeList, AgreementSegment, CallList, ReasonMatch, CallVerification, Verdict3, VerificationOutcome, VerificationSummary } from "@/lib/api/admin-types";

export const SEGMENTS: AgreementSegment[] = ["promptFn", "promptFp", "reviewer", "undecided", "agree"];
export const AGREE_LISTS: AgreeList[] = ["agreePass", "agreeSame", "agreePartial", "agreeNone"];
/** Tramo de «¿Coinciden también en los criterios?» de cada lista. */
export const AGREE_LIST_PART: Record<AgreeList, ReasonMatch> = {
  agreePass: "bothPass",
  agreeSame: "same",
  agreePartial: "partial",
  agreeNone: "none",
};
export const LISTS: CallList[] = [...SEGMENTS, ...AGREE_LISTS, "fp", "fn", "disagree", "changed", "all"];

/** Nombre de cada lista (05-numeros-propuesta.md §3): las partes del mosaico y los lados de las metas. */
export const LIST_NAME: Record<CallList, string> = {
  promptFn: "IA Sí / Revisor No",
  promptFp: "IA No / Revisor Sí",
  reviewer: "Posible error del revisor",
  undecided: "Sin decisión de la IA",
  agree: "Coincide con el revisor",
  agreePass: "Coincide · Ambos aprueban",
  agreeSame: "Coincide · Mismos criterios",
  agreePartial: "Coincide · Desacuerdo parcial en criterios",
  agreeNone: "Coincide · Desacuerdo total en criterios",
  fp: "Falsas alarmas",
  fn: "Rechazos no detectados",
  disagree: "Desacuerdos por criterio",
  changed: "Llamadas que cambian",
  all: "Todas las llamadas",
};

/** Color de la lista para su muestra; los lados usan el de la IA (rojo o amarillo). */
export const LIST_SWATCH: Record<CallList, AgreementSegment | ReasonMatch | null> = {
  promptFn: "promptFn",
  promptFp: "promptFp",
  reviewer: "reviewer",
  undecided: "undecided",
  agree: "agree",
  agreePass: "bothPass",
  agreeSame: "same",
  agreePartial: "partial",
  agreeNone: "none",
  fp: "promptFp",
  fn: "promptFn",
  disagree: null,
  changed: null,
  all: null,
};

/** Con un criterio, la lista es por criterio (05-numeros-propuesta.md §2): «Solo el revisor lo marca · criterio 18». */
export function listTitle(list: CallList, criterion: number | null, extra: { vs?: string | null; sample?: number | null } = {}): string {
  if (list === "changed") return `Llamadas que cambian frente a v${extra.vs ?? "—"}`;
  if (extra.sample) return `${LIST_NAME[list]} · muestra de ${extra.sample}`;
  if (criterion == null) return LIST_NAME[list];
  const side = list === "fn" ? "Solo el revisor lo marca" : list === "fp" ? "Solo la IA lo marca" : "Desacuerdos";
  return `${side} · criterio ${criterion}`;
}

export const listHref = (version: string, list: CallList, criterion?: number | null, extra: { vs?: string; sample?: number } = {}) =>
  `/admin/prompts/${encodeURIComponent(version)}/calls?segment=${list}${criterion != null ? `&motivo=${criterion}` : ""}${
    extra.vs ? `&vs=${encodeURIComponent(extra.vs)}` : ""
  }${extra.sample ? `&muestra=${extra.sample}` : ""}`;

/** Línea de apoyo de cada parte bajo el título de la lista. */
export const SEGMENT_SUPPORT: Record<CallList, string> = {
  promptFn: "la IA dice que cumple y el revisor que no: rechazo no detectado",
  promptFp: "la IA dice que no cumple y el revisor que sí: falsa alarma",
  reviewer: "según la IA de análisis, se equivocó el revisor",
  undecided: "la IA quedó dudosa; pasan a revisión de un auditor",
  agree: "mismo veredicto que la planilla, aunque puede haber criterios en desacuerdo",
  agreePass: "la IA y el revisor dicen que cumple: no hay criterios que comparar",
  agreeSame: "ambos rechazan y marcan exactamente los mismos criterios",
  agreePartial: "ambos rechazan; comparten al menos un criterio, pero no todos",
  agreeNone: "ambos rechazan, pero sin ningún criterio en común",
  fp: "la IA rechaza y el revisor aprueba: a corregir o posible error del revisor",
  fn: "la IA aprueba y el revisor rechaza: a corregir o posible error del revisor",
  disagree: "llamadas con al menos un criterio en que la IA y el revisor no marcan lo mismo",
  changed: "pasan a coincidir o dejan de coincidir con el revisor frente a la versión anterior",
  all: "todas las llamadas de la corrida, en el orden aleatorio fijo",
};

export const CALL_STATUS: Record<CallVerification, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  ai_wrong: "Qubyt se equivocó",
  inconclusive: "No concluyente",
  none: "Sin desacuerdos",
};

export const CALL_STATUS_LONG: Record<CallVerification, string> = { ...CALL_STATUS, confirmed: "Confirmada: error del revisor" };

export const VERDICT: Record<Verdict3, string> = { compliant: "Cumple", non_compliant: "No cumple", uncertain: "Dudosa" };
export const VERDICT_CLASS: Record<Verdict3, string> = { compliant: "vt vt-pass", non_compliant: "vt vt-fail", uncertain: "vt vt-doubt" };

/** Botones del registro, con IA dudosa los dos primeros cambian (§4.2). */
export function outcomeLabel(outcome: VerificationOutcome, aiUndecided: boolean): string {
  if (outcome === "ai_error") return aiUndecided ? "El revisor tiene razón" : "Error de Qubyt";
  if (outcome === "reviewer_error") return aiUndecided ? "El revisor se equivocó" : "Error del revisor";
  if (outcome === "both_right") return "Ambos tienen razón";
  if (outcome === "both_wrong") return "Ambos se equivocaron";
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
  return `Qubyt se equivocó en ${s.aiWrong} de ${s.reviewed} revisadas: ${p0(s.aiWrong / s.reviewed)} %${margin}`;
}
