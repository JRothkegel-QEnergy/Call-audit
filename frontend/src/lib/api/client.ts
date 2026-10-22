import type {
  Agent,
  AgentDetail,
  AgentStats,
  Alert,
  AlertStatus,
  AuditorAccount,
  AuditorStats,
  CaseDetail,
  CaseSummary,
  CorrectionReason,
  CriterionStats,
  DiscrepancyClassification,
  DiscrepancyRow,
  EscalationReason,
  Feedback,
  ItemReview,
  Kpis,
  LoginMethod,
  MyReviewRow,
  Note,
  OverrideReason,
  PendingApproval,
  QueueFilters,
  Role,
  Rubric,
  User,
} from "./types";
import type {
  CatalogProduct,
  CatalogUpload,
  CatalogUploadSummary,
  FieldChange,
  ProductDetail,
  ProductFilters,
  ProductStatus,
  ProductSummary,
  ProductVersion,
  UploadAction,
  UploadItem,
} from "./catalog-types";

/**
 * Interfaz única entre el front y el backend.
 *
 * Hoy la implementa `MockApi` (datos sintéticos en memoria). Cuando exista el backend
 * se agrega `HttpApi` contra FastAPI con la misma interfaz y se elige por
 * NEXT_PUBLIC_API_MODE, sin tocar las pantallas.
 */
export interface ApiClient {
  // Sesión
  login(input: { email: string; password: string } | { sso: true; role?: Role }): Promise<User>;
  logout(): Promise<void>;
  currentUser(): Promise<User | null>;

  // Pauta
  getRubric(): Promise<Rubric>;

  // Auditor
  listQueue(filters?: QueueFilters): Promise<{ rows: CaseSummary[]; total: number; reviewedToday: number }>;
  listAgents(query?: string): Promise<Agent[]>;
  takeNextCase(filters?: QueueFilters): Promise<string | null>;
  getCase(caseId: string): Promise<CaseDetail>;
  submitReview(
    caseId: string,
    input: { items: ItemReview[]; badTranscriptTurns: number[]; reviewSeconds: number },
  ): Promise<void>;
  escalateCase(
    caseId: string,
    input: { reason: EscalationReason; comment: string; criterionId: number | null; atMs: number },
  ): Promise<void>;
  listMyReviews(): Promise<MyReviewRow[]>;

  // Notas por caso y por motivo (Cambio 09 §3.3)
  addNote(caseId: string, input: { scope: "case" | "finding"; criterionId: number | null; text: string }): Promise<Note>;
  editNote(noteId: string, text: string): Promise<Note>;
  getDayStats(): Promise<{ reviewed: number; corrected: number; reviewSeconds: number; audioSeconds: number }>;

  // Supervisor
  getKpis(): Promise<Kpis>;
  listAlerts(status?: AlertStatus): Promise<Alert[]>;
  handleAlert(alertId: string, comment?: string): Promise<void>;
  listPendingApprovals(): Promise<PendingApproval[]>;
  approveReviews(caseIds: string[], opts: { batch: boolean }): Promise<void>;
  undoApprovals(caseIds: string[]): Promise<void>;
  reopenCase(caseId: string, input: { auditorId: string; comment: string }): Promise<void>;
  overrideReview(
    caseId: string,
    input: { items: { criterionId: number; verdict: "compliant" | "non_compliant" }[]; reason: OverrideReason; comment: string },
  ): Promise<void>;
  listAgentStats(query?: string): Promise<AgentStats[]>;
  getAgentDetail(agentId: string): Promise<AgentDetail>;
  saveFeedback(input: Omit<Feedback, "id" | "createdAt" | "supervisorName">): Promise<void>;
  listCriterionStats(): Promise<CriterionStats[]>;
  getCriterionHeatmap(): Promise<{ agents: Agent[]; rows: { criterionId: number; counts: number[] }[] }>;
  listAuditorStats(): Promise<AuditorStats[]>;
  listAuditorAccounts(): Promise<AuditorAccount[]>;
  /** Auditores activos (para reabrir un caso). */
  listActiveAuditors(): Promise<{ id: string; name: string }[]>;
  inviteAuditor(input: { name: string; email: string; loginMethod: LoginMethod }): Promise<void>;
  setAccountStatus(accountId: string, status: "active" | "deactivated"): Promise<void>;
  exportFiltered(input: { format: "csv" | "xlsx"; includePii: boolean; piiReason?: string }): Promise<void>;

  // Discrepancias con el cliente (Cambio 09 §3.1, solo supervisor)
  listDiscrepancies(): Promise<DiscrepancyRow[]>;
  classifyDiscrepancy(
    caseId: string,
    input: { classification: DiscrepancyClassification | null; criterionIds: number[]; note?: string },
  ): Promise<void>;
  setPresentation(caseId: string, presented: boolean): Promise<void>;

  // Catálogo de seguros (Cambio 11 §9, permiso manage_catalog)
  listProducts(filters?: ProductFilters): Promise<ProductSummary[]>;
  getProduct(productId: string): Promise<ProductDetail>;
  listProductVersions(productId: string): Promise<ProductVersion[]>;
  getProductVersion(
    productId: string,
    version: number,
  ): Promise<{ version: ProductVersion; product: CatalogProduct; changes: FieldChange[] }>;
  updateProduct(productId: string, input: { product: CatalogProduct; baseVersion: number; note?: string }): Promise<ProductDetail>;
  setProductStatus(productId: string, status: ProductStatus): Promise<void>;
  restoreProductVersion(productId: string, version: number, note?: string): Promise<ProductDetail>;
  uploadCatalog(file: File): Promise<{ uploadId: string }>;
  listCatalogUploads(): Promise<CatalogUploadSummary[]>;
  getCatalogUpload(uploadId: string): Promise<CatalogUpload>;
  retryCatalogUpload(uploadId: string): Promise<void>;
  updateUploadItem(uploadId: string, itemId: string, proposed: CatalogProduct): Promise<UploadItem>;
  decideUploadItem(
    uploadId: string,
    itemId: string,
    input: { action: UploadAction; fieldChoices?: Record<string, "keep" | "proposed">; note?: string; reason?: string },
  ): Promise<UploadItem>;
  createUploadItemsBatch(uploadId: string, itemIds: string[]): Promise<void>;
  discardCatalogUpload(uploadId: string): Promise<void>;
  getCatalogUploadFileUrl(uploadId: string): Promise<string>;

  // Registro de accesos (D-13, L-18)
  logAgentSearch(agentId: string): Promise<void>;

  // Solo para la demo
  resetDemo(): Promise<void>;
}

export type { CorrectionReason };
