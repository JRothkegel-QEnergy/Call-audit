/**
 * «Calidad de la IA» en el modo demo (05-numeros-propuesta.md §5): la vigente y una prueba de versión, medidas sobre
 * las mismas llamadas de validación con el bloque `agreement` del mosaico. 100 % sintético.
 */
import type { Agreement, AiQuality, AgreementCriterion } from "../admin-types";
import { RUBRIC } from "./data";

function agreement(
  c: { agree: number; undecided: number; promptFn: number; promptFp: number; reviewerFn: number; reviewerFp: number; approved: number },
  byCriterion: AgreementCriterion[],
  analyzed: boolean,
): Agreement {
  const n = c.agree + c.undecided + c.promptFn + c.promptFp + c.reviewerFn + c.reviewerFp;
  const items = byCriterion.reduce(
    (t, x) => ({ fn: t.fn + x.fn, fp: t.fp + x.fp, rfn: t.rfn + x.reviewerFn, rfp: t.rfp + x.reviewerFp, u: t.u + x.undecided }),
    { fn: 0, fp: 0, rfn: 0, rfp: 0, u: 0 },
  );
  const criteria = 33;
  const total = n * criteria;
  return {
    byCall: { n, ...c, reviewer: c.reviewerFn + c.reviewerFp, rejected: n - c.approved },
    byCallCriterion: {
      n: total,
      agree: total - items.fn - items.fp - items.rfn - items.rfp - items.u,
      undecided: items.u,
      promptFn: items.fn,
      promptFp: items.fp,
      reviewer: items.rfn + items.rfp,
      reviewerFn: items.rfn,
      reviewerFp: items.rfp,
    },
    criteria,
    // Acuerdo en motivos (sintético, 15-acuerdo-en-motivos-brief.md): suma byCall.agree.
    reasonMatch: {
      n: c.agree,
      bothPass: Math.round(c.agree * 0.43),
      same: Math.round(c.agree * 0.19),
      partial: Math.round(c.agree * 0.22),
      none: c.agree - Math.round(c.agree * 0.43) - Math.round(c.agree * 0.19) - Math.round(c.agree * 0.22),
    },
    causeAnalysis: { status: analyzed ? "done" : "none", disagreements: n - c.agree - c.undecided, findingsStored: analyzed },
    bridge: { calls: 0, promptFn: 0, promptFp: 0, reviewer: 0, undecided: 0, agree: 0 },
    byCriterion,
    scope: { total: 220, measured: n, errors: 220 - n, noReference: 0 },
  };
}

const crit = (criterionId: number, fn: number, fp: number, reviewerFn = 0, reviewerFp = 0, undecided = 0): AgreementCriterion => ({
  criterionId,
  fn,
  fp,
  reviewerFn,
  reviewerFp,
  undecided,
});

export const mockAiQuality: AiQuality = {
  series: [
    {
      id: "current",
      model: "gemini",
      modelLabel: "Gemini",
      colorIndex: 0,
      promptVersion: "2.10",
      runLabel: "Vigente",
      source: "run",
      isCurrent: true,
      ranAt: null,
      costPerCallUsd: 0.004,
      listVersion: null,
      progress: null,
      agreement: agreement(
        { agree: 112, undecided: 6, promptFn: 41, promptFp: 59, reviewerFn: 0, reviewerFp: 0, approved: 109 },
        [crit(14, 12, 20, 0, 0, 3), crit(31, 9, 14), crit(3, 6, 11, 0, 0, 2), crit(28, 8, 4)],
        false,
      ),
    },
    {
      id: "test:demo",
      model: "claude",
      modelLabel: "Claude",
      colorIndex: 1,
      promptVersion: "2.15",
      runLabel: "Prueba v2.15",
      source: "prompt_test",
      isCurrent: false,
      ranAt: "2026-11-11T18:00:00Z",
      costPerCallUsd: 0.012,
      listVersion: "2.15",
      progress: null,
      agreement: agreement(
        { agree: 126, undecided: 3, promptFn: 13, promptFp: 19, reviewerFn: 27, reviewerFp: 32, approved: 110 },
        [crit(14, 4, 7, 9, 10, 2), crit(31, 3, 5, 6, 8), crit(3, 2, 4, 5, 6, 1), crit(28, 4, 3, 7, 8)],
        true,
      ),
    },
  ],
  criteria: Object.values(RUBRIC.criteria).map((c) => ({ id: c.id, name: c.name, minor: false })),
  goals: { falsePositivePct: 5, falseNegativePct: 20 },
  promptTestRunning: null,
  fullRunRunning: null,
};
