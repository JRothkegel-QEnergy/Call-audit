import { ApiError } from "./admin-types";
import type { ApiClient } from "./client";
import type { QueueFilters, User } from "./types";

/**
 * Adaptador contra la API FastAPI (src/call_audit/api). Mismo contrato que `mockApi`.
 *
 * Las rutas son relativas (`/api/...`): Next las reenvía al backend (rewrites en next.config.ts), así el
 * navegador ve un solo origen y la cookie de sesión no necesita CORS.
 *
 * Los errores se lanzan como `Error` con un código corto, igual que el mock: `unauthorized`, `forbidden`,
 * `not_found`, `conflict`, `not_available` (501) o `http_<status>`. Si el backend manda un código propio en
 * `detail` (ej. `duplicate_key`, `version_conflict` del catálogo), se usa ese.
 */

const CODES: Record<number, string> = {
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  501: "not_available",
};

async function apiError(response: Response): Promise<ApiError> {
  try {
    const detail = ((await response.json()) as { detail?: unknown }).detail;
    if (typeof detail === "string" && /^[a-z_]+$/.test(detail)) return new ApiError(detail);
    // Validación del prompt (Cambio 12): {"code": "invalid_prompt", "errors": [...]}.
    if (detail && typeof detail === "object" && "code" in detail) {
      const d = detail as { code: string; errors?: string[] };
      return new ApiError(d.code, d.errors ?? []);
    }
  } catch {
    // sin cuerpo JSON: se usa el código por estado
  }
  return new ApiError(CODES[response.status] ?? `http_${response.status}`);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response);
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
  query({ agentId: f?.agentId, engineVerdict: f?.engineVerdict, blockId: f?.blockId, callId: f?.callId });

export const httpApi: ApiClient = {
  login: (input) => {
    // Los atajos de rol son solo de la demo; el backend tiene cuentas de correo y contraseña (D-28).
    if ("demoRole" in input) return Promise.reject(new Error("not_available"));
    return post<User>("/api/auth/login", input);
  },
  getInvite: (token) => get(`/api/auth/invite/${encodeURIComponent(token)}`),
  acceptInvite: (token, input) => post(`/api/auth/invite/${encodeURIComponent(token)}`, input),
  forgotPassword: (email) => post("/api/auth/forgot", { email }),
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
  resendAuditorInvite: (accountId) => post(`/api/auditors/accounts/${encodeURIComponent(accountId)}/resend`),
  setAccountStatus: (accountId, status) =>
    post(`/api/auditors/accounts/${encodeURIComponent(accountId)}/status`, { status }),
  exportFiltered: (input) => post("/api/export", input),

  listDiscrepancies: () => get("/api/discrepancies"),
  classifyDiscrepancy: (caseId, input) => post(`/api/discrepancies/${encodeURIComponent(caseId)}`, input),
  setPresentation: (caseId, presented) =>
    post(`/api/discrepancies/${encodeURIComponent(caseId)}/presentation`, { presented }),

  listProducts: (f) =>
    get(
      `/api/catalog/products${query({
        query: f?.query,
        insurer: f?.insurer,
        category: f?.category,
        status: f?.status,
        incomplete: f?.incomplete === undefined ? undefined : String(f.incomplete),
      })}`,
    ),
  getProduct: (id) => get(`/api/catalog/products/${encodeURIComponent(id)}`),
  listProductVersions: (id) => get(`/api/catalog/products/${encodeURIComponent(id)}/versions`),
  getProductVersion: (id, version) => get(`/api/catalog/products/${encodeURIComponent(id)}/versions/${version}`),
  updateProduct: (id, input) => request("PUT", `/api/catalog/products/${encodeURIComponent(id)}`, input),
  setProductStatus: (id, status) => post(`/api/catalog/products/${encodeURIComponent(id)}/status`, { status }),
  restoreProductVersion: (id, version, note) =>
    post(`/api/catalog/products/${encodeURIComponent(id)}/versions/${version}/restore`, { note }),
  uploadCatalog: async (file) => {
    // Binario directo con el nombre en un encabezado: el backend no necesita multipart.
    const response = await fetch("/api/catalog/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    });
    if (!response.ok) throw await apiError(response);
    return (await response.json()) as { uploadId: string };
  },
  listCatalogUploads: () => get("/api/catalog/uploads"),
  getCatalogUpload: (id) => get(`/api/catalog/uploads/${encodeURIComponent(id)}`),
  retryCatalogUpload: (id) => post(`/api/catalog/uploads/${encodeURIComponent(id)}/retry`),
  updateUploadItem: (id, itemId, proposed) =>
    request("PUT", `/api/catalog/uploads/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, { proposed }),
  decideUploadItem: (id, itemId, input) =>
    post(`/api/catalog/uploads/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/decision`, input),
  createUploadItemsBatch: (id, itemIds) => post(`/api/catalog/uploads/${encodeURIComponent(id)}/batch`, { itemIds }),
  discardCatalogUpload: (id) => post(`/api/catalog/uploads/${encodeURIComponent(id)}/discard`),
  getCatalogUploadFileUrl: async (id) =>
    (await get<{ url: string }>(`/api/catalog/uploads/${encodeURIComponent(id)}/file-url`)).url,

  logAgentSearch: (agentId) => post(`/api/access-log/agent-search/${encodeURIComponent(agentId)}`),

  // Solo existe en la demo con datos mock.
  listAccounts: () => get("/api/admin/accounts"),
  inviteUser: (input) => post("/api/admin/accounts/invite", input),
  setUserStatus: (accountId, status) => post(`/api/admin/accounts/${encodeURIComponent(accountId)}/status`, { status }),
  setAccountPermissions: (accountId, permissions) =>
    post(`/api/admin/accounts/${encodeURIComponent(accountId)}/permissions`, { permissions }),
  resendInvite: (accountId) => post(`/api/admin/accounts/${encodeURIComponent(accountId)}/resend`),
  sendPasswordReset: (accountId) => post(`/api/admin/accounts/${encodeURIComponent(accountId)}/reset-password`),
  listModels: () => get("/api/admin/models"),
  listPromptVersions: () => get("/api/admin/prompts"),
  getPromptVersion: (version) => get(`/api/admin/prompts/${encodeURIComponent(version)}`),
  createPromptVersion: (input) => post("/api/admin/prompts", input),
  updatePromptDraft: (version, input) => request("PUT", `/api/admin/prompts/${encodeURIComponent(version)}`, input),
  discardPromptDraft: (version) => post(`/api/admin/prompts/${encodeURIComponent(version)}/discard`),
  estimatePromptTest: (version, model) =>
    get(`/api/admin/prompts/${encodeURIComponent(version)}/estimate${query({ model })}`),
  startPromptTest: (version, model) =>
    post(`/api/admin/prompts/${encodeURIComponent(version)}/evaluation`, { model, confirm: true }),
  stopPromptTest: (version) => post(`/api/admin/prompts/${encodeURIComponent(version)}/evaluation/stop`),
  activatePromptVersion: (version, reason) => post(`/api/admin/prompts/${encodeURIComponent(version)}/activate`, { reason }),
  exportPromptVersion: async (version) => {
    const response = await fetch(`/api/admin/prompts/${encodeURIComponent(version)}/export`, { credentials: "same-origin" });
    if (!response.ok) throw await apiError(response);
    return response.blob();
  },
  getActivePrompt: () => get("/api/prompts/active"),
  getAdminStats: () => get("/api/admin/stats"),
  listActivity: () => get("/api/admin/activity"),

  resetDemo: async () => undefined,
};
