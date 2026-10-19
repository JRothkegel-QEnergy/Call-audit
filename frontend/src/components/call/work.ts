import type { CorrectionReason, Finding, ItemReview, Rubric, Verdict } from "@/lib/api/types";

/** Decisión en curso del auditor sobre un motivo (antes de guardar). */
export interface ItemWork {
  choice: "confirm" | "compliant" | "non_compliant";
  /** true cuando la decisión quedó resuelta (confirmada, o corregida con motivo). */
  done: boolean;
  correctionReason?: CorrectionReason;
  comment?: string;
}

export interface AddedFinding {
  criterionId: number;
  atMs: number;
  comment: string;
}

export type DetailMode = "auditor" | "supervisor" | "readonly";

export const NO_FINDING: Omit<Finding, "criterionId"> = {
  verdict: "compliant",
  confidence: 0.9,
  evidence: null,
  comment: "No se detectó en la llamada.",
};

export function findingFor(findings: Finding[], criterionId: number): Finding {
  return findings.find((f) => f.criterionId === criterionId) ?? { criterionId, ...NO_FINDING };
}

/** El motivo pide acción del auditor: la IA lo marcó Incumple o Dudoso (O-02, D-18). */
export function isActionable(f: Finding) {
  return f.verdict === "non_compliant" || f.verdict === "uncertain";
}

export function finalVerdictOf(f: Finding, work: ItemWork | undefined, added: AddedFinding[]): Verdict {
  if (added.some((a) => a.criterionId === f.criterionId)) return "non_compliant";
  if (!work) return f.verdict;
  if (work.choice === "confirm") return f.verdict;
  return work.choice;
}

/** Motivos que piden acción en el orden de la pauta (para J/K y foco inicial). */
export function actionableOrder(rubric: Rubric, findings: Finding[]) {
  return rubric.blocks.flatMap((b) => b.criterionIds).filter((id) => isActionable(findingFor(findings, id)));
}

export function pendingUncertain(findings: Finding[], work: Record<number, ItemWork>) {
  return findings.filter((f) => f.verdict === "uncertain" && !work[f.criterionId]?.done).length;
}

/** Arma los ítems de la revisión. Lo que la IA marcó Cumple y nadie tocó queda "aceptado sin cambios" (D-18). */
export function buildReviewItems(
  rubric: Rubric,
  findings: Finding[],
  work: Record<number, ItemWork>,
  added: AddedFinding[],
): ItemReview[] {
  const items: ItemReview[] = rubric.blocks
    .flatMap((b) => b.criterionIds)
    .map((id) => {
      const f = findingFor(findings, id);
      const w = work[id];
      if (!w || !w.done) return { criterionId: id, action: "accepted_unchanged", verdict: f.verdict };
      if (w.choice === "confirm") return { criterionId: id, action: "confirmed", verdict: f.verdict };
      return { criterionId: id, action: "corrected", verdict: w.choice, correctionReason: w.correctionReason, comment: w.comment };
    });
  for (const a of added) {
    const idx = items.findIndex((i) => i.criterionId === a.criterionId);
    const item: ItemReview = { criterionId: a.criterionId, action: "added", verdict: "non_compliant", comment: a.comment, atMs: a.atMs };
    if (idx >= 0) items[idx] = item;
    else items.push(item);
  }
  return items;
}
