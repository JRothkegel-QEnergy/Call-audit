/** Textos del análisis de discrepancias (Cambio 16 §7.5). Causa, dirección y estado van siempre como texto. */
import type {
  DiscrepancyAnalysisStatus,
  DiscrepancyCause,
  DiscrepancyDirection,
  DiscrepancyPattern,
  ProposalStatus,
  ProposalType,
} from "@/lib/api/admin-types";

export const CAUSE: Record<DiscrepancyCause, string> = {
  rule_text: "Texto de la regla",
  ai_application: "La IA aplica mal la regla",
  auditor: "Auditor",
  motive_overlap: "Frontera entre motivos",
  // Causas del prompt de análisis v1.0.0, que siguen en los análisis guardados.
  criterion: "Criterio del prompt",
  evaluator: "Evaluador de la planilla",
  transcript: "Transcripción",
  missing_data: "Dato faltante",
};

export const DIRECTION: Record<DiscrepancyDirection, string> = {
  fp: "Solo la IA detectó",
  fn: "Omitidos por la IA",
  uncertain: "IA dudosa",
  mixed: "Mixto",
};

export const PROPOSAL: Record<ProposalType, string> = {
  prompt_rule: "Regla del prompt",
  client_question: "Pregunta a la empresa",
  data_request: "Pedido de datos a la empresa",
  calibrate_auditor: "Calibrar con el auditor",
};

export const ANALYSIS_STATUS: Record<DiscrepancyAnalysisStatus, string> = {
  queued: "En cola",
  running: "En curso",
  done: "Terminado",
  stopped: "Detenido",
  failed: "Falló",
};

export const DISCARD_REASONS = [
  "No es un problema del prompt",
  "Ya está resuelto en otra versión",
  "La evidencia no alcanza",
  "Los casos no son del mismo tipo",
] as const;

export function statusLabel(p: Pick<DiscrepancyPattern, "status" | "decision">): string {
  const labels: Record<ProposalStatus, string> = {
    pending: "Pendiente",
    accepted: "Aceptada",
    discarded: "Descartada",
    included: `Incluida en v${p.decision?.includedInVersion ?? "?"}`,
    asked_client: "Preguntada",
    calibrated: "Calibrada",
  };
  return labels[p.status];
}

/** H-114: Alta (≥ 0,7) · Media (0,4–0,7) · Baja (< 0,4). */
export function confidenceLabel(value: number | null): string | null {
  if (value == null) return null;
  return value >= 0.7 ? "Confianza alta" : value >= 0.4 ? "Confianza media" : "Confianza baja";
}

export const usd = (v: number) => `${v.toFixed(2).replace(".", ",")} USD`;

/** Grupo de Seguimiento según el tipo de propuesta (D-70: las preguntas quedan solo acá). */
export function followUpGroup(type: ProposalType | undefined): "prompt" | "client" | "calibrate" {
  if (type === "prompt_rule") return "prompt";
  if (type === "calibrate_auditor") return "calibrate";
  return "client";
}
