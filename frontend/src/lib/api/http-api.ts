import type { ApiClient } from "./client";
import type { QueueFilters, User } from "./types";

/**
 * Adaptador contra la API FastAPI (src/call_audit/api). Mismo contrato que `mockApi`.
 *
 * Las rutas son relativas (`/api/...`): Next las reenvía al backend (rewrites en next.config.ts), así el
 * navegador ve un solo origen y la cookie de sesión no necesita CORS.
 *
 * Los errores se lanzan como `Error` con un código corto, igual que el mock: `unauthorized`, `forbidden`,
 * `not_found`, `conflict`, `not_available` (501) o `http_<status>`.
 */

const CODES: Record<number, string> = {
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  501: "not_available",
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(CODES[response.status] ?? `http_${response.status}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T = void>(path: string, body: unknown = {}) => request<T>("POST", path, body);

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

const filterQuery = (f?: QueueFilters) =>
  query({ agentId: f?.agentId, engineVerdict: f?.engineVerdict, blockId: f?.blockId });

export const httpApi: ApiClient = {
  login: (input) => {
    // El backend v0 no tiene SSO: las cuentas son de correo y contraseña.
    if ("sso" in input) return Promise.reject(new Error("not_available"));
    return post<User>("/api/auth/login", input);
  },
  logout: () => post("/api/auth/logout"),
  currentUser: () => get<User | null>("/api/auth/me"),

  getRubric: () => get("/api/rubric"),

  listQueue: (filters) => get(`/api/queue${filterQuery(filters)}`),
  listAgents: (q) => get(`/api/agents${query({ query: q })}`),
  takeNextCase: async (filters) =>
    (await post<{ caseId: string | null }>("/api/queue/next", filters ?? {})).caseId,
  getCase: (caseId) => get(`/api/cases/${encodeURIComponent(caseId)}`),
  submitReview: (caseId, input) => post(`/api/cases/${encodeURIComponent(caseId)}/review`, input),
  escalateCase: (caseId, input) => post(`/api/cases/${encodeURIComponent(caseId)}/escalate`, input),
  listMyReviews: () => get("/api/my-reviews"),

  addNote: (caseId, input) => post(`/api/cases/${encodeURIComponent(caseId)}/notes`, input),
  editNote: (noteId, text) => request("PATCH", `/api/notes/${encodeURIComponent(noteId)}`, { text }),
  getDayStats: () => get("/api/stats/day"),

  getKpis: () => get("/api/kpis"),
  listAlerts: (status) => get(`/api/alerts${query({ status })}`),
  handleAlert: (alertId, comment) => post(`/api/alerts/${encodeURIComponent(alertId)}/handle`, { comment }),
  listPendingApprovals: () => get("/api/approvals"),
  approveReviews: (caseIds, opts) => post("/api/approvals", { caseIds, batch: opts.batch }),
  undoApprovals: (caseIds) => post("/api/approvals/undo", { caseIds }),
  reopenCase: (caseId, input) => post(`/api/cases/${encodeURIComponent(caseId)}/reopen`, input),
  overrideReview: (caseId, input) => post(`/api/cases/${encodeURIComponent(caseId)}/override`, input),
  listAgentStats: (q) => get(`/api/agents/stats${query({ query: q })}`),
  getAgentDetail: (agentId) => get(`/api/agents/${encodeURIComponent(agentId)}/detail`),
  saveFeedback: (input) => post("/api/feedback", input),
  listCriterionStats: () => get("/api/criteria/stats"),
  getCriterionHeatmap: () => get("/api/criteria/heatmap"),
  listAuditorStats: () => get("/api/auditors/stats"),
  listAuditorAccounts: () => get("/api/auditors/accounts"),
  listActiveAuditors: () => get("/api/auditors/active"),
  inviteAuditor: (input) => post("/api/auditors/invite", input),
  setAccountStatus: (accountId, status) =>
    post(`/api/auditors/accounts/${encodeURIComponent(accountId)}/status`, { status }),
  exportFiltered: (input) => post("/api/export", input),

  listDiscrepancies: () => get("/api/discrepancies"),
  classifyDiscrepancy: (caseId, input) => post(`/api/discrepancies/${encodeURIComponent(caseId)}`, input),
  setPresentation: (caseId, presented) =>
    post(`/api/discrepancies/${encodeURIComponent(caseId)}/presentation`, { presented }),

  logAgentSearch: (agentId) => post(`/api/access-log/agent-search/${encodeURIComponent(agentId)}`),

  // Solo existe en la demo con datos mock.
  resetDemo: async () => undefined,
};
