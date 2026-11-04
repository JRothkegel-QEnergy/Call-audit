/**
 * «Análisis de discrepancias» en el modo demo (Cambio 16 §7.7). 100 % sintético: los nombres de los motivos son
 * reales; conteos, patrones y textos son inventados. Cubre un análisis terminado con observaciones, uno detenido en el
 * historial, propuestas en varios estados y los motivos 1 y 25 como en producción, sin evaluador del cliente.
 */
import type {
  DiscrepancyAnalysisRun,
  DiscrepancyCase,
  DiscrepancyCriterionRow,
  DiscrepancyOverview,
  DiscrepancyPattern,
  DiscrepancyPatternDetail,
} from "../admin-types";
import { ApiError } from "../admin-types";
import type { ApiClient } from "../client";
import type { User } from "../types";

type DiscrepancyApi = Pick<
  ApiClient,
  | "getDiscrepancyOverview"
  | "getDiscrepancyPattern"
  | "estimateDiscrepancyAnalysis"
  | "startDiscrepancyAnalysis"
  | "stopDiscrepancyAnalysis"
  | "listDiscrepancyAnalyses"
  | "decideProposal"
  | "setProposalFollowUp"
  | "getDiscrepancyFollowUp"
>;

/** Casos que existen en la demo (mismos que «Calidad de la IA»). */
const CASE_IDS = ["c-0412", "c-0431", "c-0445", "c-0477", "c-0502", "c-0511", "c-0519"];
const SERIES = { model: "gemini-demo", promptVersion: "2.10", runLabel: "v2.10" };
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const row = (
  criterionId: number,
  name: string,
  fp: number,
  fn: number,
  matchFail: number,
  aiUncertain: number,
  manualItems: number,
): DiscrepancyCriterionRow => ({
  criterionId,
  name,
  clientFails: fn + matchFail,
  aiFails: fp + matchFail,
  matchFail,
  fp,
  fn,
  aiUncertain,
  disagreements: fp + fn + aiUncertain,
  manualItems,
  patterns: null,
  summary: null,
});

const CRITERIA: DiscrepancyCriterionRow[] = [
  row(25, "No tipifica todas las gestiones", 90, 0, 0, 20, 2),
  row(18, "Tipifica motivo de renuncia incorrecto", 36, 68, 22, 6, 3),
  row(1, "Deja en espera por tiempo excesivo", 48, 4, 14, 0, 1),
  row(6, "Entrega información errónea del producto", 21, 9, 5, 3, 1),
  row(32, "No ofrece alternativas de retención", 12, 15, 8, 2, 1),
  row(19, "Tipifica renuncia y es retención", 0, 2, 0, 0, 0),
];

function makeCases(n: number, kind: DiscrepancyCase["kind"], seed: number): DiscrepancyCase[] {
  return Array.from({ length: n }, (_, i) => {
    const manual = i % 4 === 0 ? (i % 8 === 0 ? "compliant" : "non_compliant") : null;
    return {
      caseId: CASE_IDS[(seed + i) % CASE_IDS.length],
      callId: String(230100 + seed * 37 + i * 11),
      callDate: `2026-10-${String(10 + ((seed + i) % 18)).padStart(2, "0")}`,
      kind,
      aiVerdict: kind === "fn" ? "compliant" : kind === "ai_uncertain" ? "uncertain" : "non_compliant",
      aiComment: kind === "fn" ? "No hay evidencia de incumplimiento." : "El ejecutivo no cierra según el guion (texto sintético).",
      aiQuote: kind === "fn" ? null : "le confirmo entonces la renuncia del seguro",
      aiQuoteMs: kind === "fn" ? null : 92_000 + i * 1000,
      clientFail: kind !== "fp",
      clientComment: i % 5 === 0 ? "Motivo principal es no uso (sintético)" : null,
      manualVerdict: manual,
      manualSidesWith: manual == null ? null : manual === "non_compliant" ? (kind === "fp" ? "ai" : "excel") : kind === "fp" ? "excel" : "ai",
      evaluator: null,
    };
  });
}

type MockPattern = DiscrepancyPatternDetail;

const pattern = (p: Partial<MockPattern> & Pick<MockPattern, "id" | "criterionId" | "title" | "cases">): MockPattern => ({
  analysisId: "an-2",
  criterionName: CRITERIA.find((c) => c.criterionId === p.criterionId)?.name ?? null,
  rank: 0,
  explanation: "",
  direction: "fp",
  cause: "criterion",
  quotes: [],
  confidence: 0.6,
  caseCount: p.cases.length,
  reviewerDisagreements: p.cases.filter((c) => c.manualVerdict && (c.manualVerdict === "non_compliant") !== c.clientFail).length,
  isObservation: false,
  proposal: null,
  status: "pending",
  decision: null,
  criterionSummary: null,
  readOnly: false,
  ...p,
});

const state = {
  analyses: [
    {
      id: "an-2",
      status: "done",
      createdBy: "Admin Demo",
      createdAt: iso(60 * 20),
      finishedAt: iso(60 * 20 - 6),
      model: "sonnet-demo",
      analysisPromptVersion: "1.0.0",
      layer2Series: SERIES,
      criteria: [25, 18, 1, 6, 32],
      doneCriteria: [25, 18, 1, 6, 32],
      failedCriteria: [],
      estimatedUsd: 3.2,
      costUsd: 3.1,
      error: null,
      stoppedBy: null,
    },
    {
      id: "an-1",
      status: "stopped",
      createdBy: "Admin Demo",
      createdAt: iso(60 * 48),
      finishedAt: iso(60 * 48 - 2),
      model: "sonnet-demo",
      analysisPromptVersion: "1.0.0",
      layer2Series: SERIES,
      criteria: [25, 18, 1],
      doneCriteria: [25],
      failedCriteria: [],
      estimatedUsd: 1.6,
      costUsd: 0.5,
      error: null,
      stoppedBy: "Admin Demo",
    },
  ] as DiscrepancyAnalysisRun[],
  summaries: {
    25: "Casi todos los desacuerdos vienen de que la IA no recibe la tipificación de cada gestión.",
    18: "La IA acepta la tipificación si calza con cualquiera de las razones; el cliente exige la principal.",
    1: "Las esperas anunciadas de 30 a 60 s son la mayoría de los desacuerdos: el umbral no está definido.",
    6: "No se ve un patrón claro: los desacuerdos parecen casos aislados.",
    32: "El cliente marca con distinto criterio llamadas parecidas.",
  } as Record<number, string>,
  patterns: [] as MockPattern[],
};

state.patterns = [
  pattern({
    id: "p-25-1",
    criterionId: 25,
    title: "La IA marca «no tipifica todas las gestiones» sin recibir la tipificación de cada gestión",
    explanation: "La metadata trae una sola fila por grabación. Cuando se gestionó más de un seguro, la IA ve una sola tipificación y supone que faltó el resto.",
    cause: "missing_data",
    confidence: 0.85,
    cases: makeCases(18, "fp", 1),
    quotes: [{ call_id: "230137", text: "le confirmo entonces la renuncia del seguro", validated: true }],
    proposal: { type: "client_question", text: "¿Pueden enviar en el Excel la tipificación de cada gestión, no solo la de la grabación?", editedText: null },
  }),
  pattern({
    id: "p-18-1",
    criterionId: 18,
    title: "Cuando el cliente da dos razones, la IA acepta la tipificación si calza con cualquiera",
    explanation: "El cliente exige el motivo principal. La regla del prompt no dice cuál elegir cuando hay más de uno.",
    direction: "fn",
    cause: "criterion",
    confidence: 0.6,
    cases: makeCases(9, "fn", 2),
    quotes: [
      { call_id: "230174", text: "es que me quedé sin pega y aparte no lo uso", validated: true },
      { call_id: "230185", text: "lo cancelo porque es muy caro", validated: false },
    ],
    proposal: { type: "prompt_rule", text: "Si el cliente da más de un motivo, la tipificación debe corresponder al primero que menciona como razón de la renuncia.", editedText: null },
  }),
  pattern({
    id: "p-1-1",
    criterionId: 1,
    title: "Esperas anunciadas de 30 a 60 s cuentan como excesivas para la IA",
    explanation: "El código marca las esperas sobre 30 s; el cliente no las marca si el ejecutivo avisó.",
    cause: "criterion",
    confidence: 0.75,
    cases: makeCases(12, "fp", 3),
    proposal: { type: "client_question", text: "¿Cuál es el umbral de espera excesiva cuando el ejecutivo avisa que va a dejar en espera?", editedText: null },
    status: "accepted",
    decision: { by: "Admin Demo", at: iso(60 * 19), reason: null, note: null, includedInVersion: null, versionStatus: null },
  }),
  pattern({
    id: "p-32-1",
    criterionId: 32,
    title: "Llamadas parecidas con marca distinta del cliente",
    explanation: "En 6 llamadas con la misma oferta de retención el cliente marca en 3 y no en las otras 3.",
    direction: "mixed",
    cause: "evaluator",
    confidence: 0.45,
    cases: makeCases(6, "fn", 4),
    proposal: { type: "calibrate_auditor", text: "Revisar con el evaluador si ofrecer una sola alternativa basta para cumplir el motivo 32.", editedText: null },
  }),
  pattern({
    id: "p-6-1",
    criterionId: 6,
    title: "La IA marca información errónea cuando el ejecutivo redondea la prima",
    cause: "criterion",
    confidence: 0.35,
    cases: makeCases(4, "fp", 5),
    proposal: { type: "prompt_rule", text: "No marcar información errónea por redondeos de la prima menores a 0,1 UF.", editedText: null },
    status: "discarded",
    decision: { by: "Admin Demo", at: iso(60 * 19), reason: "La evidencia no alcanza", note: null, includedInVersion: null, versionStatus: null },
  }),
  pattern({
    id: "p-6-obs",
    criterionId: 6,
    title: "Una llamada donde la transcripción cambia «UF» por «U de F».",
    cause: null,
    direction: null,
    isObservation: true,
    confidence: null,
    cases: makeCases(1, "fp", 6),
  }),
  pattern({
    id: "p-25-obs",
    criterionId: 25,
    title: "Dos llamadas cortadas antes del cierre.",
    cause: null,
    direction: null,
    isObservation: true,
    confidence: null,
    cases: makeCases(2, "ai_uncertain", 7),
  }),
];

const impact = (p: MockPattern) => p.caseCount;
state.patterns
  .filter((p) => !p.isObservation)
  .sort((a, b) => impact(b) - impact(a))
  .forEach((p, i) => (p.rank = i + 1));

let currentUser: () => User | null = () => null;
export function bindDiscrepancyUser(fn: () => User | null) {
  currentUser = fn;
}

const wait = <T>(fn: () => T, ms = 220) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(structuredClone(fn()));
      } catch (e) {
        reject(e);
      }
    }, ms),
  );

const find = (id: string) => {
  const p = state.patterns.find((x) => x.id === id);
  if (!p) throw new ApiError("not_found");
  return p;
};

const summary = (p: MockPattern): DiscrepancyPattern => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cases, criterionSummary, readOnly, ...rest } = p;
  return rest;
};

/** El análisis en curso avanza solo: un motivo cada 5 s. */
function tick() {
  const run = state.analyses.find((a) => a.status === "running");
  if (!run) return;
  const done = Math.min(run.criteria.length, Math.floor((Date.now() - new Date(run.createdAt!).getTime()) / 5000));
  run.doneCriteria = run.criteria.slice(0, done);
  run.costUsd = Math.round(done * 0.26 * 100) / 100;
  if (done === run.criteria.length) {
    run.status = "done";
    run.finishedAt = new Date().toISOString();
    state.patterns.forEach((p) => {
      if (run.criteria.includes(p.criterionId)) p.analysisId = run.id;
    });
  }
}

const latest = () => state.analyses.find((a) => a.status !== "running" && a.doneCriteria.length > 0) ?? null;

export const discrepancyMock: DiscrepancyApi = {
  getDiscrepancyOverview: (analysisId) =>
    wait((): DiscrepancyOverview => {
      tick();
      const last = latest();
      const shown = analysisId ? state.analyses.find((a) => a.id === analysisId) : last;
      if (analysisId && !shown) throw new ApiError("not_found");
      const patterns = shown ? state.patterns.filter((p) => shown.doneCriteria.includes(p.criterionId) && (shown.id === last?.id || p.criterionId === 25)) : [];
      const cases = CRITERIA.reduce((n, c) => n + c.disagreements, 0);
      return {
        currentSeries: SERIES,
        calls: 480,
        cases,
        manualCases: 8,
        callsOutside: { "sin corrida vigente": 73 },
        callMatch: { agree: 280, total: 480 },
        criteria: CRITERIA.map((c) => ({
          ...c,
          patterns: shown?.doneCriteria.includes(c.criterionId) ? patterns.filter((p) => p.criterionId === c.criterionId && !p.isObservation).length : null,
          summary: shown?.doneCriteria.includes(c.criterionId) ? (state.summaries[c.criterionId] ?? null) : null,
        })),
        evaluators: null,
        analysis: shown ?? null,
        readOnly: !!shown && !!last && shown.id !== last.id,
        running: state.analyses.find((a) => a.status === "running") ?? null,
        stale: shown && shown.id === last?.id ? { currentSeriesChanged: false, currentSeries: null, newReviews: 4 } : null,
        patterns: patterns.map(summary),
        models: [
          { name: "sonnet-demo", label: "Sonnet (demo)", available: true, priced: true },
          { name: "gemini-demo", label: "Gemini (demo)", available: true, priced: true },
        ],
        defaultModel: "sonnet-demo",
      };
    }),
  getDiscrepancyPattern: (id) =>
    wait(() => {
      const p = find(id);
      const last = latest();
      return { ...p, criterionSummary: state.summaries[p.criterionId] ?? null, readOnly: !!last && p.analysisId !== last.id };
    }),
  estimateDiscrepancyAnalysis: ({ criteria, model }) =>
    wait(() => ({
      model,
      criteria,
      cases: criteria.length * 40,
      discardedProposals: state.patterns.filter((p) => p.status === "discarded" && criteria.includes(p.criterionId)).length,
      totalUsd: model === "sonnet-demo" ? Math.round(criteria.length * 0.26 * 100) / 100 : Math.round(criteria.length * 0.04 * 100) / 100,
      minutes: Math.ceil(criteria.length / 4),
    })),
  startDiscrepancyAnalysis: ({ criteria, model }) =>
    wait(() => {
      if (state.analyses.some((a) => a.status === "running")) throw new ApiError("already_running");
      const run: DiscrepancyAnalysisRun = {
        id: `an-${state.analyses.length + 1}`,
        status: "running",
        createdBy: currentUser()?.name ?? "Admin Demo",
        createdAt: new Date().toISOString(),
        finishedAt: null,
        model,
        analysisPromptVersion: "1.0.0",
        layer2Series: SERIES,
        criteria,
        doneCriteria: [],
        failedCriteria: [],
        estimatedUsd: Math.round(criteria.length * 0.26 * 100) / 100,
        costUsd: 0,
        error: null,
        stoppedBy: null,
      };
      state.analyses.unshift(run);
      return run;
    }),
  stopDiscrepancyAnalysis: (id) =>
    wait(() => {
      tick();
      const run = state.analyses.find((a) => a.id === id);
      if (!run || run.status !== "running") throw new ApiError("not_running");
      run.status = "stopped";
      run.stoppedBy = currentUser()?.name ?? "Admin Demo";
      run.finishedAt = new Date().toISOString();
    }),
  listDiscrepancyAnalyses: () =>
    wait(() => {
      tick();
      return state.analyses.map((a) => ({
        ...a,
        patterns: state.patterns.filter((p) => !p.isObservation && a.doneCriteria.includes(p.criterionId)).length,
      }));
    }),
  decideProposal: (id, input) =>
    wait(() => {
      const p = find(id);
      if (p.isObservation) throw new ApiError("observation");
      if (input.decision === "discarded" && !input.reason?.trim()) throw new ApiError("reason_required");
      p.status = input.decision;
      if (input.decision === "pending") {
        p.decision = null;
        if (p.proposal) p.proposal.editedText = null;
      } else {
        const edited = input.text?.trim();
        if (p.proposal && input.decision === "accepted") p.proposal.editedText = edited && edited !== p.proposal.text ? edited : null;
        p.decision = {
          by: currentUser()?.name ?? "Admin Demo",
          at: new Date().toISOString(),
          reason: input.decision === "discarded" ? input.reason!.trim() : null,
          note: input.note?.trim() || null,
          includedInVersion: null,
          versionStatus: null,
        };
      }
      return summary(p);
    }),
  setProposalFollowUp: (id, status) =>
    wait(() => {
      const p = find(id);
      if (!["accepted", "asked_client", "calibrated"].includes(p.status)) throw new ApiError("not_accepted");
      p.status = status;
      return summary(p);
    }),
  getDiscrepancyFollowUp: () => wait(() => state.patterns.filter((p) => p.status !== "pending").map(summary)),
};

/** Al guardar una versión del prompt con propuestas marcadas (D-68). */
export function includeProposals(ids: string[], version: string) {
  for (const id of ids) {
    const p = state.patterns.find((x) => x.id === id);
    if (p && p.status === "accepted" && p.decision) {
      p.status = "included";
      p.decision.includedInVersion = version;
      p.decision.versionStatus = "draft";
    }
  }
}
