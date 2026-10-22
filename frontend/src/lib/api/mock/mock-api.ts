import type { ApiClient } from "../client";
import type {
  Alert,
  AuditorAccount,
  CallVerdict,
  CaseDetail,
  CaseSummary,
  DiscrepancyBranch,
  DiscrepancyClassification,
  DiscrepancyRow,
  Feedback,
  ItemReview,
  MyReviewRow,
  Note,
  PendingApproval,
  QueueFilters,
  Review,
  ReviewFlag,
  User,
} from "../types";
import { ACCOUNTS, AGENTS, AUDITORS, RUBRIC, USERS, buildCalibrationCases, buildCases } from "./data";

/**
 * Backend simulado en el navegador. Mantiene el estado en memoria y lo guarda en
 * sessionStorage para que sobreviva a recargas de la pestaña. Solo para la demo.
 */

const STORAGE_KEY = "call-audit-mock-v3";
const FAST_REVIEW_SECONDS = 60; // H-37

interface State {
  user: User | null;
  cases: CaseDetail[];
  myReviews: MyReviewRow[];
  alerts: Alert[];
  approvals: PendingApproval[];
  accounts: AuditorAccount[];
  feedback: Feedback[];
  reviewedToday: number;
  correctedToday: number;
  reviewSecondsToday: number;
  audioSecondsToday: number;
  accessLog: { at: string; userId: string; action: string; target: string }[];
  /** Clasificación de las discrepancias con el cliente, por caso (Cambio 09 §3.1). */
  discrepancy: Record<string, { classification: DiscrepancyClassification | null; criteria: number[]; presentation: "pending" | "presented" | null }>;
  /** Últimas aprobaciones, para el Deshacer del lote. */
  lastApproved: { approval: PendingApproval; caseStatus: CaseDetail["status"] | null; myStatus: MyReviewRow["status"] | null }[];
  /** Ajustes de la demo. */
  simulateErrors: boolean;
}

function initialState(): State {
  const now = new Date();
  const cases = [...buildCases(now), ...buildCalibrationCases()];
  // Notas de ejemplo en el lote de calibración.
  cases.find((c) => c.id === "c-k211")?.notes.push({
    id: "n-1",
    caseId: "c-k211",
    scope: "finding",
    criterionId: 28,
    text: "El cliente no preguntó por la devolución: la IA infirió la negativa de un turno posterior.",
    authorId: "u-sup-1",
    authorName: "Jorge Lagos",
    authorRole: "supervisor",
    createdAt: "2026-10-18T10:00:00",
    editedAt: null,
  });
  const approvals: PendingApproval[] = [
    ...Array.from({ length: 12 }, (_, i): PendingApproval => ({
      caseId: `c-r${300 + i * 7}`,
      callId: `LL-1014-0${300 + i * 7}`,
      auditorId: AUDITORS[i % 3].id,
      auditorName: AUDITORS[i % 3].name,
      submittedAt: `2026-10-14T${String(9 + (i % 8)).padStart(2, "0")}:${String((10 + i * 3) % 60).padStart(2, "0")}:00`,
      finalVerdict: i % 4 ? "compliant" : "non_compliant",
      reviewSeconds: 70 + ((i * 53) % 220),
      flags: [],
      correctionReasons: [],
    })),
    { caseId: "c-r288", callId: "LL-1014-0288", auditorId: "u-aud-2", auditorName: "Luis Muñoz", submittedAt: "2026-10-14T15:02:00", finalVerdict: "compliant", reviewSeconds: 242, flags: ["corrected_ai"], correctionReasons: ["Evidencia mal interpretada"] },
    { caseId: "c-r291", callId: "LL-1014-0291", auditorId: "u-aud-1", auditorName: "Ana Pérez", submittedAt: "2026-10-14T15:20:00", finalVerdict: "non_compliant", reviewSeconds: 41, flags: ["fast_review"], correctionReasons: [] },
    { caseId: "c-r299", callId: "LL-1014-0299", auditorId: "u-aud-3", auditorName: "Sofía Reyes", submittedAt: "2026-10-14T16:05:00", finalVerdict: "compliant", reviewSeconds: 330, flags: ["contradicted_critical", "corrected_ai"], correctionReasons: ["Error de transcripción"] },
  ];
  return {
    user: null,
    cases,
    myReviews: [
      { caseId: "c-r221", callId: "LL-1014-0221", submittedAt: "2026-10-14T16:02:00", status: "reopened", myVerdict: "compliant", note: "Jorge Lagos reabrió este caso: «Revisa el motivo 3: el cliente pidió la renuncia dos veces.»" },
      { caseId: "c-r230", callId: "LL-1014-0230", submittedAt: "2026-10-14T16:20:00", status: "overridden", myVerdict: "non_compliant", note: "Tu decisión: No cumple → Supervisor: Cumple (motivo 32 · criterio ambiguo)" },
      { caseId: "c-r244", callId: "LL-1014-0244", submittedAt: "2026-10-14T16:41:00", status: "escalated", myVerdict: null, note: "Esperando respuesta del supervisor" },
      { caseId: "c-r101", callId: "LL-1015-0101", submittedAt: "2026-10-15T08:55:00", status: "awaiting_approval", myVerdict: "non_compliant", note: "" },
      { caseId: "c-r190", callId: "LL-1013-0190", submittedAt: "2026-10-13T11:10:00", status: "closed", myVerdict: "compliant", note: "" },
    ],
    alerts: [
      { id: "al-1", kind: "escalation", status: "new", caseId: "c-r388", callId: "LL-1015-0388", criterionId: 3, atMs: 252_000, reason: "Duda de criterio", comment: "No sé si el primer argumento cuenta como objeción.", raisedBy: "Ana Pérez", createdAt: "2026-10-15T08:40:00" },
      { id: "al-2", kind: "critical_confirmed", status: "new", caseId: "c-r405", callId: "LL-1015-0405", criterionId: 28, atMs: 470_000, reason: "Crítico confirmado", comment: null, raisedBy: "Luis Muñoz", createdAt: "2026-10-15T08:52:00" },
      { id: "al-3", kind: "escalation", status: "handled", caseId: "c-r201", callId: "LL-1014-0201", criterionId: null, atMs: 125_000, reason: "Audio inaudible", comment: "No se escucha al cliente desde el minuto 2.", raisedBy: "Sofía Reyes", createdAt: "2026-10-14T12:10:00", handledComment: "Se reprocesa el audio." },
    ],
    approvals,
    accounts: ACCOUNTS.map((a) => ({ ...a })),
    feedback: [
      { id: "fb-1", agentId: "ag-104", supervisorName: "Jorge Lagos", createdAt: "2026-10-08T10:00:00", text: "Revisamos cómo informar la devolución de primas.", commitment: "Informar la regla del seguro.", followUpDate: "2026-10-22", caseIds: ["c-r170"] },
    ],
    reviewedToday: 12,
    correctedToday: 3,
    reviewSecondsToday: 6480,
    audioSecondsToday: 19800,
    accessLog: [],
    discrepancy: {
      "c-k200": { classification: "ai_correct", criteria: [28], presentation: "pending" },
      "c-k211": { classification: "ai_wrong", criteria: [28], presentation: null },
    },
    lastApproved: [],
    simulateErrors: false,
  };
}

let state: State | null = null;

function load(): State {
  if (state) return state;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw) as State;
        return state;
      }
    } catch {
      // sessionStorage no disponible: se usa el estado inicial.
    }
  }
  state = initialState();
  return state;
}

function save() {
  if (typeof window === "undefined" || !state) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin persistencia; la demo sigue funcionando en memoria.
  }
}

/** Latencia simulada para ver los estados de carga. */
async function delay<T>(fn: () => T, ms = 280): Promise<T> {
  await new Promise((r) => setTimeout(r, ms));
  const st = load();
  if (st.simulateErrors) throw new Error("network");
  const result = fn();
  save();
  return structuredClone(result);
}

function isSupervisor() {
  return load().user?.role === "supervisor";
}

/** El veredicto y el comentario del cliente solo viajan al supervisor (D-24, H-58). */
function forRole<T extends CaseSummary>(c: T): T {
  if (isSupervisor()) return c;
  const out = { ...c, externalQualityVerdict: null } as T & Partial<CaseDetail>;
  if ("externalComment" in out) {
    out.externalComment = null;
    out.externalItemVerdicts = null;
  }
  return out;
}

function branchOf(ai: CallVerdict, client: CallVerdict): DiscrepancyBranch {
  if (ai === "uncertain") return "ai_uncertain";
  if (ai === client) return "match";
  return ai === "non_compliant" ? "ai_only_fail" : "ai_missed_fail";
}

function summary(c: CaseDetail): CaseSummary {
  return {
    id: c.id,
    callId: c.callId,
    callDate: c.callDate,
    agent: c.agent,
    products: c.products,
    engineVerdict: c.engineVerdict,
    sampleCompliant: c.sampleCompliant,
    nonCompliantCount: c.nonCompliantCount,
    uncertainCount: c.uncertainCount,
    durationMs: c.durationMs,
    queuedAt: c.queuedAt,
    status: c.status,
    lockedBy: c.lockedBy,
    assignedAuditorId: c.assignedAuditorId,
    hasCritical: c.hasCritical,
    externalQualityVerdict: c.externalQualityVerdict,
  };
}

const SEVERITY: Record<CallVerdict, number> = { non_compliant: 0, uncertain: 1, compliant: 2 };

function inQueue(c: CaseDetail) {
  return c.status === "pending" || c.status === "in_review" || c.status === "reopened";
}

function matches(c: CaseDetail, f?: QueueFilters) {
  if (!f) return true;
  if (f.agentId && c.agent.id !== f.agentId) return false;
  if (f.engineVerdict === "sample" && !c.sampleCompliant) return false;
  if (f.engineVerdict && f.engineVerdict !== "sample" && (c.sampleCompliant || c.engineVerdict !== f.engineVerdict)) return false;
  if (f.blockId) {
    const ids = RUBRIC.blocks.find((b) => b.id === f.blockId)?.criterionIds ?? [];
    if (!c.findings.some((x) => ids.includes(x.criterionId) && x.verdict !== "compliant")) return false;
  }
  return true;
}

function sortQueue(a: CaseDetail, b: CaseDetail) {
  if (a.status === "reopened" !== (b.status === "reopened")) return a.status === "reopened" ? -1 : 1;
  const sa = a.sampleCompliant ? 3 : SEVERITY[a.engineVerdict];
  const sb = b.sampleCompliant ? 3 : SEVERITY[b.engineVerdict];
  if (Number(b.hasCritical) - Number(a.hasCritical)) return Number(b.hasCritical) - Number(a.hasCritical);
  if (sa !== sb) return sa - sb;
  return a.queuedAt.localeCompare(b.queuedAt);
}

function finalVerdictOf(c: CaseDetail, items: ItemReview[]): CallVerdict {
  const byId = new Map(items.map((i) => [i.criterionId, i.verdict]));
  const verdicts = Object.keys(RUBRIC.criteria).map((id) => {
    const n = Number(id);
    return byId.get(n) ?? c.findings.find((f) => f.criterionId === n)?.verdict ?? "compliant";
  });
  if (verdicts.includes("non_compliant")) return "non_compliant";
  if (verdicts.includes("uncertain")) return "uncertain";
  return "compliant";
}

/** Casos que no están en la cola (revisiones antiguas): se arman desde una plantilla para poder abrirlos. */
function synthCase(caseId: string): CaseDetail {
  const st = load();
  const approval = st.approvals.find((a) => a.caseId === caseId);
  const alert = st.alerts.find((a) => a.caseId === caseId);
  const mine = st.myReviews.find((m) => m.caseId === caseId);
  const base = structuredClone(st.cases[0]);
  const callId = approval?.callId ?? alert?.callId ?? mine?.callId ?? caseId.toUpperCase();
  const corrected = approval?.flags.includes("corrected_ai");
  const items: ItemReview[] = base.findings.map((f) => {
    if (f.verdict === "compliant") return { criterionId: f.criterionId, action: "accepted_unchanged", verdict: f.verdict };
    if (f.verdict === "uncertain" || corrected) return { criterionId: f.criterionId, action: "corrected", verdict: "compliant", correctionReason: approval?.correctionReasons[0] ?? "Criterio ambiguo en la pauta" };
    return { criterionId: f.criterionId, action: "confirmed", verdict: f.verdict };
  });
  const review: Review = {
    caseId,
    auditorId: approval?.auditorId ?? "u-aud-1",
    auditorName: approval?.auditorName ?? "Ana Pérez",
    items,
    badTranscriptTurns: [],
    finalVerdict: approval?.finalVerdict ?? finalVerdictOf(base, items),
    reviewSeconds: approval?.reviewSeconds ?? 252,
    submittedAt: approval?.submittedAt ?? "2026-10-14T15:00:00",
  };
  return {
    ...base,
    id: caseId,
    callId,
    status: approval ? "awaiting_approval" : (mine?.status ?? (alert ? "escalated" : "closed")),
    lockedBy: null,
    review,
    notes: [],
    externalQualityVerdict: null,
    externalItemVerdicts: null,
    externalComment: null,
  };
}

function findCase(caseId: string) {
  const st = load();
  return st.cases.find((c) => c.id === caseId);
}

function upsertMyReview(row: MyReviewRow) {
  const st = load();
  st.myReviews = [row, ...st.myReviews.filter((r) => r.caseId !== row.caseId)];
}

export const mockApi: ApiClient = {
  login: (input) =>
    delay(() => {
      const st = load();
      const role = "sso" in input ? (input.role ?? "auditor") : input.email.toLowerCase().includes("sup") ? "supervisor" : "auditor";
      st.user = USERS[role];
      return st.user;
    }, 400),
  logout: () =>
    delay(() => {
      load().user = null;
    }, 100),
  currentUser: async () => {
    // Sin latencia ni errores simulados: la sesión se resuelve al cargar la app.
    return structuredClone(load().user);
  },

  getRubric: () => delay(() => RUBRIC, 50),

  listQueue: (filters) =>
    delay(() => {
      const st = load();
      const all = st.cases.filter(inQueue);
      const rows = all.filter((c) => matches(c, filters)).sort(sortQueue).map(summary).map(forRole);
      return { rows, total: all.length, reviewedToday: st.reviewedToday };
    }),
  listAgents: (query) =>
    delay(() => {
      const q = (query ?? "").trim().toLowerCase();
      return AGENTS.filter((a) => !q || a.name.toLowerCase().includes(q));
    }, 120),
  takeNextCase: (filters) =>
    delay(() => {
      const st = load();
      const next = st.cases
        .filter(inQueue)
        .filter((c) => !c.lockedBy || c.lockedBy.id === st.user?.id)
        .filter((c) => matches(c, filters))
        .sort(sortQueue)[0];
      return next?.id ?? null;
    }),
  getCase: (caseId) =>
    delay(() => {
      const st = load();
      let c = findCase(caseId);
      if (!c) {
        // Se guarda para que conserve su ID de llamada y su estado después de aprobarla o reabrirla.
        c = synthCase(caseId);
        st.cases.push(c);
      }
      if (st.user?.role === "auditor" && inQueue(c) && !c.lockedBy) {
        c.status = "in_review";
        c.lockedBy = { id: st.user.id, name: st.user.name };
      }
      return forRole(c);
    }, 350),
  submitReview: (caseId, input) =>
    delay(() => {
      const st = load();
      const c = findCase(caseId);
      if (!c || !st.user) throw new Error("not_found");
      const finalVerdict = finalVerdictOf(c, input.items);
      c.review = { caseId, auditorId: st.user.id, auditorName: st.user.name, items: input.items, badTranscriptTurns: input.badTranscriptTurns, finalVerdict, reviewSeconds: input.reviewSeconds, submittedAt: new Date().toISOString() };
      c.status = "awaiting_approval";
      c.lockedBy = null;
      const corrected = input.items.filter((i) => i.action === "corrected");
      const flags: ReviewFlag[] = [];
      if (corrected.length) flags.push("corrected_ai");
      if (corrected.some((i) => RUBRIC.criteria[i.criterionId]?.critical)) flags.push("contradicted_critical");
      if (input.reviewSeconds < FAST_REVIEW_SECONDS) flags.push("fast_review");
      st.approvals.push({ caseId, callId: c.callId, auditorId: st.user.id, auditorName: st.user.name, submittedAt: c.review.submittedAt, finalVerdict, reviewSeconds: input.reviewSeconds, flags, correctionReasons: corrected.flatMap((i) => (i.correctionReason ? [i.correctionReason] : [])) });
      const critical = input.items.find((i) => i.verdict === "non_compliant" && RUBRIC.criteria[i.criterionId]?.critical && i.action === "confirmed");
      if (critical) {
        const f = c.findings.find((x) => x.criterionId === critical.criterionId);
        st.alerts.unshift({ id: `al-${Date.now()}`, kind: "critical_confirmed", status: "new", caseId, callId: c.callId, criterionId: critical.criterionId, atMs: f?.evidence?.startMs ?? null, reason: "Crítico confirmado", comment: null, raisedBy: st.user.name, createdAt: new Date().toISOString() });
      }
      upsertMyReview({ caseId, callId: c.callId, submittedAt: c.review.submittedAt, status: "awaiting_approval", myVerdict: finalVerdict, note: "" });
      st.reviewedToday += 1;
      if (corrected.length) st.correctedToday += 1;
      st.reviewSecondsToday += input.reviewSeconds;
      st.audioSecondsToday += Math.round(c.durationMs / 1000);
    }, 400),
  escalateCase: (caseId, input) =>
    delay(() => {
      const st = load();
      const c = findCase(caseId);
      if (!c || !st.user) throw new Error("not_found");
      c.status = "escalated";
      c.lockedBy = null;
      st.alerts.unshift({ id: `al-${Date.now()}`, kind: "escalation", status: "new", caseId, callId: c.callId, criterionId: input.criterionId, atMs: input.atMs, reason: input.reason, comment: input.comment || null, raisedBy: st.user.name, createdAt: new Date().toISOString() });
      upsertMyReview({ caseId, callId: c.callId, submittedAt: new Date().toISOString(), status: "escalated", myVerdict: null, note: "Esperando respuesta del supervisor" });
    }),
  listMyReviews: () =>
    delay(() => {
      const rows = [...load().myReviews];
      return rows.sort((a, b) => (a.status === "reopened" ? -1 : b.status === "reopened" ? 1 : b.submittedAt.localeCompare(a.submittedAt)));
    }),
  addNote: (caseId, input) =>
    delay(() => {
      const st = load();
      const c = findCase(caseId);
      if (!c || !st.user) throw new Error("not_found");
      const note: Note = {
        id: `n-${Date.now()}`,
        caseId,
        scope: input.scope,
        criterionId: input.criterionId,
        text: input.text,
        authorId: st.user.id,
        authorName: st.user.name,
        authorRole: st.user.role,
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      c.notes.push(note);
      return note;
    }, 150),
  editNote: (noteId, text) =>
    delay(() => {
      const st = load();
      const note = st.cases.flatMap((c) => c.notes).find((n) => n.id === noteId);
      if (!note) throw new Error("not_found");
      if (note.authorId !== st.user?.id) throw new Error("forbidden");
      note.text = text;
      note.editedAt = new Date().toISOString();
      return note;
    }, 150),
  getDayStats: () =>
    delay(() => {
      const st = load();
      return { reviewed: st.reviewedToday, corrected: st.correctedToday, reviewSeconds: st.reviewSecondsToday, audioSeconds: st.audioSecondsToday };
    }),

  getKpis: () =>
    delay(() => {
      const st = load();
      return {
        processed: 8420,
        engineCompliantPct: 71,
        engineNonCompliantPct: 18,
        engineUncertainPct: 11,
        finalCompliancePct: 76.4,
        pendingCases: 135 + st.cases.filter(inQueue).length,
        oldestPendingHours: 3,
        criticalConfirmed: 6,
        criticalUnhandled: st.alerts.filter((a) => a.kind === "critical_confirmed" && a.status !== "handled").length,
        dailyCompliance: [74, 75, 77, 76, 78, 77, 76].map((pct, i) => ({ date: `2026-10-${String(9 + i).padStart(2, "0")}`, pct })),
        topCriteria: [
          { criterionId: 28, pct: 4.1 },
          { criterionId: 13, pct: 3.2 },
          { criterionId: 3, pct: 2.7 },
        ],
      };
    }),
  listAlerts: (status) => delay(() => load().alerts.filter((a) => !status || a.status === status)),
  handleAlert: (alertId, comment) =>
    delay(() => {
      const a = load().alerts.find((x) => x.id === alertId);
      if (a) {
        a.status = "handled";
        a.handledComment = comment;
      }
    }),
  listPendingApprovals: () => delay(() => [...load().approvals].sort((x, y) => x.submittedAt.localeCompare(y.submittedAt))),
  approveReviews: (caseIds) =>
    delay(() => {
      const st = load();
      st.lastApproved = [];
      for (const id of caseIds) {
        const approval = st.approvals.find((a) => a.caseId === id);
        const c = findCase(id);
        const mine = st.myReviews.find((m) => m.caseId === id);
        if (approval) st.lastApproved.push({ approval, caseStatus: c?.status ?? null, myStatus: mine?.status ?? null });
        if (c) c.status = "closed";
        if (mine) mine.status = "closed";
      }
      st.approvals = st.approvals.filter((a) => !caseIds.includes(a.caseId));
    }),
  undoApprovals: (caseIds) =>
    delay(() => {
      const st = load();
      for (const entry of st.lastApproved.filter((e) => caseIds.includes(e.approval.caseId))) {
        if (!st.approvals.some((a) => a.caseId === entry.approval.caseId)) st.approvals.push(entry.approval);
        const c = findCase(entry.approval.caseId);
        if (c && entry.caseStatus) c.status = entry.caseStatus;
        const mine = st.myReviews.find((m) => m.caseId === entry.approval.caseId);
        if (mine && entry.myStatus) mine.status = entry.myStatus;
      }
      st.lastApproved = [];
    }),
  reopenCase: (caseId, input) =>
    delay(() => {
      const st = load();
      st.approvals = st.approvals.filter((a) => a.caseId !== caseId);
      const c = findCase(caseId);
      if (c) {
        c.status = "reopened";
        c.assignedAuditorId = input.auditorId;
      }
      const mine = st.myReviews.find((m) => m.caseId === caseId);
      if (mine) {
        mine.status = "reopened";
        mine.note = `${st.user?.name ?? "El supervisor"} reabrió este caso: «${input.comment}»`;
      }
    }),
  overrideReview: (caseId, input) =>
    delay(() => {
      const st = load();
      st.approvals = st.approvals.filter((a) => a.caseId !== caseId);
      const c = findCase(caseId);
      if (c) c.status = "closed";
      const mine = st.myReviews.find((m) => m.caseId === caseId);
      if (mine) {
        mine.status = "overridden";
        mine.note = `Cambiado por el supervisor · ${input.reason}`;
      }
    }),
  listAgentStats: (query) =>
    delay(() => {
      const q = (query ?? "").trim().toLowerCase();
      const base = [
        [212, 82, [28, 13, 3], 2, 1],
        [198, 79, [13, 15, 29], 0, 3],
        [205, 88, [3, 32], 1, 0],
        [190, 74, [28, 3, 13], -3, 2],
        [201, 81, [15, 28], 0, 0],
        [87, 85, [13], 0, 0],
      ] as const;
      return AGENTS.map((agent, i) => ({ agent, audited: base[i][0], finalCompliancePct: base[i][1], topCriteria: [...base[i][2]], trendPts: base[i][3], pendingFollowUps: base[i][4] })).filter((r) => !q || r.agent.name.toLowerCase().includes(q));
    }),
  getAgentDetail: (agentId) =>
    delay(() => {
      const st = load();
      const agent = AGENTS.find((a) => a.id === agentId);
      if (!agent) throw new Error("not_found");
      const fb = st.feedback.filter((f) => f.agentId === agentId);
      const withFb = new Set(fb.flatMap((f) => f.caseIds));
      const confirmed = [
        { caseId: "c-r405", callId: "LL-1015-0405", criterionId: 28 },
        { caseId: "c-r170", callId: "LL-1013-0170", criterionId: 3 },
      ].map((r) => ({ ...r, followUp: withFb.has(r.caseId) ? ("with_feedback" as const) : ("pending" as const) }));
      return {
        stats: { agent, audited: 190, finalCompliancePct: 74, topCriteria: [28, 3, 13], trendPts: -3, pendingFollowUps: confirmed.filter((c) => c.followUp === "pending").length },
        confirmedCalls: confirmed,
        aiOnlyCalls: st.cases.filter((c) => c.agent.id === agentId && inQueue(c)).map((c) => ({ caseId: c.id, callId: c.callId, engineVerdict: c.engineVerdict })),
        feedback: fb,
      };
    }),
  saveFeedback: (input) =>
    delay(() => {
      const st = load();
      st.feedback.unshift({ ...input, id: `fb-${Date.now()}`, createdAt: new Date().toISOString(), supervisorName: st.user?.name ?? "Supervisor" });
    }),
  listCriterionStats: () =>
    delay(() => [
      { criterionId: 28, count: 61, pct: 4.1, deltaPts: 0.6 },
      { criterionId: 13, count: 48, pct: 3.2, deltaPts: -0.2 },
      { criterionId: 3, count: 40, pct: 2.7, deltaPts: 0.1 },
      { criterionId: 15, count: 22, pct: 1.5, deltaPts: 0 },
      { criterionId: 1, count: 14, pct: 0.9, deltaPts: -0.3 },
    ]),
  getCriterionHeatmap: () =>
    delay(() => ({
      agents: AGENTS.slice(0, 5),
      rows: [
        { criterionId: 28, counts: [3, 1, 0, 6, 2] },
        { criterionId: 13, counts: [1, 5, 2, 2, 1] },
        { criterionId: 3, counts: [2, 0, 4, 3, 0] },
      ],
    })),
  listAuditorStats: () =>
    delay(() => [
      { auditorId: "u-aud-1", name: "Ana Pérez", casesPerDay: 58, avgReviewSeconds: 220, correctsAiPct: 14, reopenedOrChangedPct: 3, escalationsPct: 2 },
      { auditorId: "u-aud-2", name: "Luis Muñoz", casesPerDay: 71, avgReviewSeconds: 125, correctsAiPct: 6, reopenedOrChangedPct: 9, escalationsPct: 1 },
      { auditorId: "u-aud-3", name: "Sofía Reyes", casesPerDay: 52, avgReviewSeconds: 250, correctsAiPct: 17, reopenedOrChangedPct: 2, escalationsPct: 4 },
    ]),
  listAuditorAccounts: () => delay(() => load().accounts),
  listActiveAuditors: () => delay(() => load().accounts.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name })), 100),
  inviteAuditor: (input) =>
    delay(() => {
      const st = load();
      if (st.accounts.some((a) => a.email.toLowerCase() === input.email.toLowerCase())) throw new Error("duplicate_email");
      st.accounts.push({ id: `u-aud-${Date.now()}`, name: input.name, email: input.email, status: "invited", loginMethod: input.loginMethod });
    }),
  setAccountStatus: (accountId, status) =>
    delay(() => {
      const a = load().accounts.find((x) => x.id === accountId);
      if (a) a.status = status;
    }),
  exportFiltered: () => delay(() => undefined, 500),

  listDiscrepancies: () =>
    delay(() => {
      const st = load();
      if (!isSupervisor()) throw new Error("forbidden");
      return st.cases
        .filter((c) => c.externalQualityVerdict)
        .map((c): DiscrepancyRow => {
          const ai = c.modelRuns[0]?.verdict ?? c.engineVerdict;
          const d = st.discrepancy[c.id];
          return {
            caseId: c.id,
            callId: c.callId,
            callDate: c.callDate,
            agentName: c.agent.name,
            aiVerdict: ai,
            clientVerdict: c.externalQualityVerdict!,
            appAuditorVerdict: c.review?.finalVerdict ?? null,
            branch: branchOf(ai, c.externalQualityVerdict!),
            aiFailCriteria: c.findings.filter((f) => f.verdict === "non_compliant").map((f) => f.criterionId),
            classification: d?.classification ?? null,
            classifiedCriteria: d?.criteria ?? [],
            presentation: d?.presentation ?? null,
            notesCount: c.notes.length,
          };
        })
        .sort((a, b) => a.callDate.localeCompare(b.callDate));
    }),
  classifyDiscrepancy: (caseId, input) =>
    delay(() => {
      const st = load();
      if (!isSupervisor() || !st.user) throw new Error("forbidden");
      st.discrepancy[caseId] = {
        classification: input.classification,
        criteria: input.criterionIds,
        presentation: input.classification === "ai_correct" ? (st.discrepancy[caseId]?.presentation ?? "pending") : null,
      };
      const c = findCase(caseId);
      if (c && input.note) {
        c.notes.push({ id: `n-${Date.now()}`, caseId, scope: "case", criterionId: null, text: input.note, authorId: st.user.id, authorName: st.user.name, authorRole: st.user.role, createdAt: new Date().toISOString(), editedAt: null });
      }
    }),
  setPresentation: (caseId, presented) =>
    delay(() => {
      const d = load().discrepancy[caseId];
      if (d && d.classification === "ai_correct") d.presentation = presented ? "presented" : "pending";
    }, 120),

  // Catálogo de seguros (Cambio 11): la demo con datos sintéticos no lo trae; solo existe contra la API real.
  listProducts: async () => [],
  getProduct: () => Promise.reject(new Error("not_available")),
  listProductVersions: async () => [],
  getProductVersion: () => Promise.reject(new Error("not_available")),
  updateProduct: () => Promise.reject(new Error("not_available")),
  setProductStatus: () => Promise.reject(new Error("not_available")),
  restoreProductVersion: () => Promise.reject(new Error("not_available")),
  uploadCatalog: () => Promise.reject(new Error("not_available")),
  listCatalogUploads: async () => [],
  getCatalogUpload: () => Promise.reject(new Error("not_available")),
  retryCatalogUpload: () => Promise.reject(new Error("not_available")),
  updateUploadItem: () => Promise.reject(new Error("not_available")),
  decideUploadItem: () => Promise.reject(new Error("not_available")),
  createUploadItemsBatch: () => Promise.reject(new Error("not_available")),
  discardCatalogUpload: () => Promise.reject(new Error("not_available")),
  getCatalogUploadFileUrl: () => Promise.reject(new Error("not_available")),

  logAgentSearch: (agentId) =>
    delay(() => {
      const st = load();
      st.accessLog.push({ at: new Date().toISOString(), userId: st.user?.id ?? "?", action: "agent_filter", target: agentId });
    }, 0),

  resetDemo: async () => {
    const user = load().user;
    state = initialState();
    state.user = user;
    save();
  },
};

/** Ajustes de la demo (no forman parte de ApiClient). */
export const mockControls = {
  getSimulateErrors: () => load().simulateErrors,
  setSimulateErrors: (v: boolean) => {
    load().simulateErrors = v;
    save();
  },
};
