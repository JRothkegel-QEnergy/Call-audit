/**
 * Administrador Qubico en el modo demo (Cambio 12): cuentas, versiones del prompt con su prueba, stats y actividad.
 * Datos 100 % sintéticos y en memoria; con NEXT_PUBLIC_API_MODE=http todo viene de routes_admin.py.
 */
import type {
  ActivityLogEntry,
  AdminStats,
  EvaluationMetrics,
  InviteInfo,
  PromptVersion,
  PromptVersionDetail,
  UserAccount,
} from "../admin-types";
import { ApiError } from "../admin-types";
import type { ApiClient } from "../client";
import type { Role, User } from "../types";

type AdminApi = Pick<
  ApiClient,
  | "getInvite"
  | "acceptInvite"
  | "forgotPassword"
  | "listAccounts"
  | "inviteUser"
  | "setUserStatus"
  | "setAccountPermissions"
  | "resendInvite"
  | "sendPasswordReset"
  | "listModels"
  | "listPromptVersions"
  | "getPromptVersion"
  | "createPromptVersion"
  | "updatePromptDraft"
  | "discardPromptDraft"
  | "estimatePromptTest"
  | "startPromptTest"
  | "stopPromptTest"
  | "activatePromptVersion"
  | "exportPromptVersion"
  | "getActivePrompt"
  | "getAdminStats"
  | "listActivity"
>;

const MODELS = [
  { name: "gemini-demo", provider: "gemini" },
  { name: "sonnet-demo", provider: "anthropic" },
];

const BASE_PROMPT = [
  "Eres un auditor de calidad de llamadas de retención de seguros (texto sintético de la demo).",
  "1. Un motivo incumple solo si hay evidencia explícita en la transcripción.",
  "2. Si la evidencia es ambigua, marca el motivo como dudoso.",
].join("\n");

const metrics = (match: number, extra = 0): EvaluationMetrics => ({
  references: [
    { kind: "client", n: 100, matchRate: match, uncertainRate: 6 - extra, aiOnlyFail: 21 - 3 * extra, aiMissedFail: 9, unvalidatedQuoteRate: 3.1 },
    { kind: "app_auditors", n: 42, matchRate: match + 8, uncertainRate: 5, aiOnlyFail: 6, aiMissedFail: 3, unvalidatedQuoteRate: 2.4 },
  ],
  costPerCallUsd: 0.0041 + extra * 0.0002,
  latencyMsP50: 1700,
  latencyMsP95: 3200 + extra * 80,
  byCriterion: [
    { criterionId: 28, failCount: 22 - extra * 3 },
    { criterionId: 13, failCount: 14 },
    { criterionId: 18, failCount: 9 - extra },
  ],
});

interface Record_ {
  meta: PromptVersion;
  content: string;
  history: PromptVersionDetail["history"];
  run: { status: "running" | "done" | "stopped"; startedAt: number; total: number; metrics: EvaluationMetrics | null; stoppedBy?: string } | null;
}

const iso = (d = new Date()) => d.toISOString();
const meta = (version: string, status: PromptVersion["status"], changelog: string, extra: Partial<PromptVersion> = {}): PromptVersion => ({
  version,
  status,
  source: "yaml",
  model: "gemini-demo",
  changelog,
  rationale: null,
  createdBy: "Admin Qubico (demo)",
  createdAt: "2026-10-12T10:00:00",
  testedAt: status === "draft" ? null : "2026-10-12T11:00:00",
  activatedBy: null,
  activatedAt: null,
  activationReason: null,
  retiredAt: null,
  ...extra,
});

const state = {
  accounts: [
    { id: "u-adm-1", name: "Admin Qubico (demo)", email: "admin@qubico-ejemplo.cl", role: "qubico_admin", status: "active", loginMethod: "password", permissions: [], lastLoginAt: "2026-10-22T08:10:00", createdBy: "Script inicial", createdAt: "2026-10-01T09:00:00" },
    { id: "u-sup-1", name: "Jorge Lagos", email: "jorge.lagos@empresa-ejemplo.cl", role: "supervisor", status: "active", loginMethod: "password", permissions: ["manage_catalog"], lastLoginAt: "2026-10-21T17:40:00", createdBy: "Admin Qubico (demo)", createdAt: "2026-10-02T10:00:00" },
    { id: "u-aud-1", name: "Ana Pérez", email: "ana.perez@empresa-ejemplo.cl", role: "auditor", status: "active", loginMethod: "password", permissions: ["view_model_io"], lastLoginAt: "2026-10-22T08:30:00", createdBy: "Jorge Lagos", createdAt: "2026-10-03T09:00:00" },
    { id: "u-aud-3", name: "Sofía Reyes", email: "sofia.reyes@empresa-ejemplo.cl", role: "auditor", status: "invite_expired", loginMethod: "password", permissions: [], lastLoginAt: null, createdBy: "Jorge Lagos", createdAt: "2026-10-15T15:00:00" },
  ] as UserAccount[],
  prompts: [
    { meta: meta("2.9", "retired", "Criterio de Johannes para el motivo 32.", { activatedAt: "2026-10-20T09:00:00", retiredAt: "2026-10-22T09:00:00" }), content: BASE_PROMPT, history: [], run: { status: "done", startedAt: 0, total: 100, metrics: metrics(68) } },
    { meta: meta("2.10", "active", "Exige frases exactas en el cierre.", { activatedAt: "2026-10-22T09:00:00", activationReason: "Sube la coincidencia con el cliente." }), content: `${BASE_PROMPT}\n3. Verifica las frases exactas del protocolo de cierre.`, history: [], run: { status: "done", startedAt: 0, total: 100, metrics: metrics(70, 1) } },
  ] as Record_[],
  activity: [
    { id: "a-1", at: "2026-10-22T09:00:00", actorId: "u-adm-1", actorName: "Admin Qubico (demo)", actorRole: "qubico_admin", action: "prompt_activated", target: "Prompt v2.10", details: "Sube la coincidencia con el cliente." },
  ] as ActivityLogEntry[],
  changedInApp: false,
};

let currentUser: () => User | null = () => null;
export function bindUser(fn: () => User | null) {
  currentUser = fn;
}

const wait = <T>(fn: () => T, ms = 220) => new Promise<T>((resolve, reject) => setTimeout(() => {
  try {
    resolve(structuredClone(fn()));
  } catch (e) {
    reject(e);
  }
}, ms));

function log(action: string, target: string, details = "") {
  const u = currentUser();
  state.activity.unshift({ id: `a-${Date.now()}`, at: iso(), actorId: u?.id ?? "?", actorName: u?.name ?? "?", actorRole: (u?.role ?? "qubico_admin") as Role, action, target, details });
}

const key = (v: string) => v.split(".").map(Number);
const greater = (a: string, b: string) => {
  const [x, y] = [key(a), key(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};
const active = () => state.prompts.find((p) => p.meta.status === "active")!;
const find = (version: string) => {
  const p = state.prompts.find((x) => x.meta.version === version);
  if (!p) throw new ApiError("not_found");
  return p;
};

/** La prueba de la demo avanza sola: ~1 llamada cada 100 ms. */
function settle(p: Record_) {
  if (!p.run || p.run.status !== "running") return;
  if (Date.now() - p.run.startedAt > p.run.total * 100) {
    p.run.status = "done";
    p.run.metrics = metrics(73, 2);
    p.meta.status = "tested";
    p.meta.testedAt = iso();
    p.history.push({ at: iso(), actor: "Sistema", action: `Terminó la prueba · ${p.run.total} llamadas` });
  }
}

function evaluationOf(p: Record_): PromptVersionDetail["evaluation"] {
  if (!p.run) return null;
  settle(p);
  const done = p.run.status === "done" ? p.run.total : Math.min(p.run.total, Math.floor((Date.now() - p.run.startedAt) / 100));
  return {
    id: `ev-${p.meta.version}`,
    status: p.run.status,
    model: p.meta.model,
    total: p.run.total,
    done,
    estimatedCostUsd: +(p.run.total * 0.0041).toFixed(4),
    costUsd: +(done * 0.0041).toFixed(4),
    requestedBy: "Admin Qubico (demo)",
    stoppedBy: p.run.stoppedBy ?? null,
    startedAt: p.run.startedAt ? iso(new Date(p.run.startedAt)) : null,
    finishedAt: p.run.status === "running" ? null : iso(),
    error: null,
    metrics: p.run.metrics,
  };
}

export const adminMock: AdminApi = {
  getInvite: (token) =>
    wait((): InviteInfo => (token === "vencido" ? { state: "expired", expiresAt: "2026-10-20T10:00:00" } : { state: "valid", kind: "invite", name: "Persona Invitada", email: "invitada@empresa-ejemplo.cl", role: "auditor", invitedBy: "Jorge Lagos", expiresAt: iso(new Date(Date.now() + 72 * 3600_000)) })),
  acceptInvite: (_token, input) =>
    wait(() => {
      if (input.password.length < 12) throw new ApiError("short_password");
      if (!input.acceptTerms) throw new ApiError("terms_required");
      return { id: "u-aud-new", name: "Persona Invitada", email: "invitada@empresa-ejemplo.cl", role: "auditor", permissions: [] } as User;
    }),
  forgotPassword: () => wait(() => undefined),

  listAccounts: () => wait(() => state.accounts),
  inviteUser: (input) =>
    wait(() => {
      if (state.accounts.some((a) => a.email === input.email.toLowerCase())) throw new ApiError("duplicate_email");
      state.accounts.push({ id: `u-${Date.now()}`, name: input.name, email: input.email.toLowerCase(), role: input.role, status: "invited", loginMethod: "password", permissions: input.permissions, lastLoginAt: null, createdBy: currentUser()?.name ?? "?", createdAt: iso() });
      log("account_invited", input.email, `Rol: ${input.role}`);
    }),
  setUserStatus: (id, status) =>
    wait(() => {
      const a = state.accounts.find((x) => x.id === id);
      if (!a) throw new ApiError("not_found");
      if (a.id === currentUser()?.id) throw new ApiError("self");
      if (a.role === "qubico_admin" && status === "deactivated" && state.accounts.filter((x) => x.role === "qubico_admin" && x.status === "active").length <= 1)
        throw new ApiError("last_admin");
      a.status = status;
      log(status === "active" ? "account_reactivated" : "account_deactivated", a.email);
    }),
  setAccountPermissions: (id, permissions) =>
    wait(() => {
      const a = state.accounts.find((x) => x.id === id)!;
      a.permissions = permissions;
      log("permission_changed", a.email, permissions.join(", ") || "sin permisos");
    }),
  resendInvite: (id) =>
    wait(() => {
      const a = state.accounts.find((x) => x.id === id)!;
      a.status = "invited";
      log("invite_resent", a.email);
    }),
  sendPasswordReset: (id) => wait(() => log("password_reset_sent", state.accounts.find((x) => x.id === id)!.email)),

  listModels: () => wait(() => MODELS),
  listPromptVersions: () =>
    wait(() =>
      [...state.prompts].sort((a, b) => (greater(a.meta.version, b.meta.version) ? -1 : 1)).map((p) => ({ ...p.meta, evaluation: evaluationOf(p) })),
    ),
  getPromptVersion: (version) =>
    wait((): PromptVersionDetail => {
      const p = find(version);
      const cur = active();
      return {
        meta: p.meta,
        content: p.content,
        systemText: p.content,
        activeVersion: cur.meta.version,
        diff: cur === p ? null : { kind: "text", base: cur.content, next: p.content },
        evaluation: evaluationOf(p),
        activeMetrics: cur.run?.metrics ?? null,
        history: p.history,
      };
    }),
  createPromptVersion: (input) =>
    wait(() => {
      const version = input.source === "yaml" ? (/^version:\s*"?([\d.]+)"?/m.exec(input.content)?.[1] ?? "") : (input.version ?? "");
      const errors: string[] = [];
      if (!/^\d+\.\d+$/.test(version)) errors.push("Escribe la versión como X.Y, por ejemplo 2.11.");
      else if (!greater(version, active().meta.version)) errors.push(`La versión debe ser mayor que la vigente (v${active().meta.version}).`);
      if (state.prompts.some((p) => p.meta.version === version)) errors.push(`Ya existe la versión v${version}.`);
      if (!input.changelog.trim()) errors.push("Cuenta qué cambió en esta versión.");
      if (errors.length) throw new ApiError("invalid_prompt", errors);
      const record: Record_ = {
        meta: meta(version, "draft", input.changelog.trim(), { source: input.source, model: input.model, rationale: input.rationale, createdBy: currentUser()?.name ?? "?", createdAt: iso() }),
        content: input.content,
        history: [{ at: iso(), actor: currentUser()?.name ?? "?", action: "Creó el borrador" }],
        run: null,
      };
      state.prompts.push(record);
      log("prompt_published", `Prompt v${version}`, input.changelog);
      return record.meta;
    }),
  updatePromptDraft: (version, input) =>
    wait(() => {
      const p = find(version);
      if (p.meta.status !== "draft") throw new ApiError("invalid_prompt", ["La versión ya no se puede editar: crea una versión nueva."]);
      Object.assign(p.meta, { model: input.model, changelog: input.changelog, rationale: input.rationale });
      p.content = input.content;
    }),
  discardPromptDraft: (version) =>
    wait(() => {
      state.prompts = state.prompts.filter((p) => !(p.meta.version === version && p.meta.status === "draft"));
    }),
  estimatePromptTest: (_version, model) =>
    wait(() => ({ calls: 100, model: model ?? "gemini-demo", perCallUsd: model === "sonnet-demo" ? 0.019 : 0.0041, totalUsd: model === "sonnet-demo" ? 1.9 : 0.41, minutes: 0.2 })),
  startPromptTest: (version) =>
    wait(() => {
      const p = find(version);
      p.meta.status = "testing";
      p.run = { status: "running", startedAt: Date.now(), total: 100, metrics: null };
      p.history.push({ at: iso(), actor: currentUser()?.name ?? "?", action: "Inició la prueba (la versión queda inmutable)" });
      log("prompt_tested", `Prompt v${version}`, "100 llamadas");
    }),
  stopPromptTest: (version) =>
    wait(() => {
      const p = find(version);
      if (p.run) Object.assign(p.run, { status: "stopped", stoppedBy: currentUser()?.name });
      p.meta.status = "test_failed";
      log("prompt_test_stopped", `Prompt v${version}`);
    }),
  activatePromptVersion: (version, reason) =>
    wait(() => {
      const p = find(version);
      const rollback = p.meta.status === "retired";
      if (!reason.trim()) throw new ApiError("invalid_prompt", ["Escribe el motivo de la activación."]);
      const cur = active();
      if (cur !== p) Object.assign(cur.meta, { status: "retired", retiredAt: iso() });
      Object.assign(p.meta, { status: "active", activatedAt: iso(), activatedBy: currentUser()?.name ?? null, activationReason: reason, retiredAt: null });
      state.changedInApp = true;
      log(rollback ? "prompt_rolled_back" : "prompt_activated", `Prompt v${version}`, reason);
    }),
  exportPromptVersion: (version) => wait(() => new Blob([find(version).content], { type: "text/plain" })),
  getActivePrompt: () => wait(() => ({ version: active().meta.version, since: active().meta.activatedAt, changedInApp: state.changedInApp })),
  getAdminStats: () =>
    wait((): AdminStats => ({
      operation: {
        callsProcessed: 8420,
        minutesProcessed: 81_340,
        medianHoursToResult: null,
        batchesWithError: 2,
        humanQueue: 142,
        oldestQueueHours: 3,
        reviewedPerDay: 181,
        daily: [1180, 1240, 1205, 1190, 1260, 1170, 1175].map((calls, i) => ({ date: `2026-10-${String(15 + i).padStart(2, "0")}`, calls })),
        failedBatches: [{ batchId: "v2.10 automático", at: "2026-10-20T05:55:00", stage: "modelo", calls: 1 }],
      },
      aiQuality: [
        { promptVersion: "2.9", model: "gemini-demo", reference: "client", n: 100, matchRate: 68, uncertainRate: 6, unvalidatedQuoteRate: 3.4, distribution: { compliant: 58, non_compliant: 34, uncertain: 8 } },
        { promptVersion: "2.10", model: "gemini-demo", reference: "client", n: 100, matchRate: 70, uncertainRate: 5, unvalidatedQuoteRate: 3.1, distribution: { compliant: 61, non_compliant: 32, uncertain: 7 } },
      ],
      cost: [
        { model: "gemini-demo", promptVersion: "2.10", calls: 6200, totalUsd: 25.4, perCallUsd: 0.0041, tokensIn: null, tokensOut: null, latencyMsAvg: 1750, latencyMsP95: 3280 },
      ],
    })),
  listActivity: () => wait(() => state.activity),
};
