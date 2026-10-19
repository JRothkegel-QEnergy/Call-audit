import type { CallVerdict, CaseStatus, ReviewFlag, Role, Verdict } from "./api/types";

export type Tone = "fail" | "doubt" | "pass";

/** Resultado por MOTIVO (D-20): Cumple / Incumple / Dudoso. `not_applicable` se muestra como Cumple. */
export const ITEM_VERDICT: Record<Verdict, { label: string; tone: Tone }> = {
  non_compliant: { label: "Incumple", tone: "fail" },
  uncertain: { label: "Dudoso", tone: "doubt" },
  compliant: { label: "Cumple", tone: "pass" },
  not_applicable: { label: "Cumple", tone: "pass" },
};

/** Veredicto de LLAMADA: Cumple / No cumple / Dudosa. */
export const CALL_VERDICT: Record<CallVerdict, { label: string; tone: Tone }> = {
  non_compliant: { label: "No cumple", tone: "fail" },
  uncertain: { label: "Dudosa", tone: "doubt" },
  compliant: { label: "Cumple", tone: "pass" },
};

/** Estados del caso según el rol (03 §4.3). */
export function caseStatusLabel(
  status: CaseStatus,
  role: Role,
  opts?: { lockedByMe?: boolean; lockedByName?: string },
): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "in_review":
      if (role === "auditor") return opts?.lockedByMe ? "En revisión por ti" : `En revisión por ${opts?.lockedByName ?? "otra persona"}`;
      return `En revisión · ${opts?.lockedByName ?? ""}`.trim();
    case "awaiting_approval":
      return role === "auditor" ? "Esperando aprobación" : "Por aprobar";
    case "escalated":
      return "Escalado";
    case "reopened":
      return role === "auditor" ? "Reabierto por el supervisor" : "Reabierto";
    case "overridden":
      return role === "auditor" ? "Cambiado por el supervisor" : "Cambiado y cerrado";
    case "closed":
      return "Cerrado";
  }
}

export const REVIEW_FLAG_LABEL: Record<ReviewFlag, string> = {
  corrected_ai: "Corrigió a la IA",
  contradicted_critical: "Contradijo en un crítico",
  fast_review: "Revisión rápida (menos de 60 s)",
  escalated: "Escaló el caso",
};
