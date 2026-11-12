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
  MyReviewRow,
  Note,
  OverrideReason,
  PendingApproval,
  Permission,
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
import type {
  ActivityLogEntry,
  AgreementSegment,
  CaseComparison,
  SegmentCalls,
  VerificationOutcome,
  VerificationRecord,
  AdminStats,
  AdminStatsFilters,
  AiQuality,
  AsrFailure,
  DiscrepancyAnalysisRun,
  DiscrepancyEstimate,
  DiscrepancyOverview,
  DiscrepancyPattern,
  DiscrepancyPatternDetail,
  FollowUpPromptPreview,
  CauseEstimate,
  InviteInfo,
  ModelOption,
  PipelineRun,
  ProcessingStatus,
  PromptEstimate,
  PromptVersion,
  PromptVersionDetail,
  UserAccount,
} from "./admin-types";

/**
 * Interfaz única entre el front y el backend.
 *
 * Hoy la implementa `MockApi` (datos sintéticos en memoria). Cuando exista el backend
 * se agrega `HttpApi` contra FastAPI con la misma interfaz y se elige por
 * NEXT_PUBLIC_API_MODE, sin tocar las pantallas.
 */
export interface ApiClient {
  // Sesión
  /** `demoRole` existe solo en el mock (enlaces de la demo en el login). */
  login(input: { email: string; password: string } | { demoRole: Role }): Promise<User>;
  // Invitación y restablecimiento de contraseña con enlace de un solo uso (Cambio 12, D-36)
  getInvite(token: string): Promise<InviteInfo>;
  acceptInvite(token: string, input: { password: string; acceptTerms: boolean }): Promise<User>;
  forgotPassword(email: string): Promise<void>;
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
  inviteAuditor(input: { name: string; email: string }): Promise<void>;
  resendAuditorInvite(accountId: string): Promise<void>;
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

  // Administrador Qubico (Cambio 12)
  listAccounts(): Promise<UserAccount[]>;
  inviteUser(input: { name: string; email: string; role: Role; permissions: Permission[] }): Promise<void>;
  setUserStatus(accountId: string, status: "active" | "deactivated"): Promise<void>;
  setAccountPermissions(accountId: string, permissions: Permission[]): Promise<void>;
  resendInvite(accountId: string): Promise<void>;
  sendPasswordReset(accountId: string): Promise<void>;
  listModels(): Promise<ModelOption[]>;
  listPromptVersions(): Promise<PromptVersion[]>;
  getPromptVersion(version: string): Promise<PromptVersionDetail>;
  createPromptVersion(input: {
    source: "yaml" | "text";
    content: string;
    version?: string;
    model: string;
    changelog: string;
    rationale: string | null;
  }): Promise<PromptVersion>;
  /** Cambio 18: la comparación por motivo con las reglas aceptadas aplicadas. No guarda nada ni gasta. */
  previewPromptFromFollowUp(input: { proposalIds: string[]; overrides?: Record<number, string> }): Promise<FollowUpPromptPreview>;
  /** Cambio 18: crea el borrador con las reglas aplicadas; 409 si cambió la vigente o alguna regla. */
  createPromptFromFollowUp(input: {
    baseVersion: string;
    proposalIds: string[];
    overrides: Record<number, string>;
    model: string;
    changelog: string;
    rationale: string | null;
  }): Promise<PromptVersion>;
  updatePromptDraft(
    version: string,
    input: { content: string; model: string; changelog: string; rationale: string | null },
  ): Promise<void>;
  discardPromptDraft(version: string): Promise<void>;
  estimatePromptTest(version: string, model?: string): Promise<PromptEstimate>;
  startPromptTest(version: string, model?: string): Promise<void>;
  stopPromptTest(version: string): Promise<void>;
  /** Mosaico (E1): costo estimado y lanzamiento del análisis de causa de la prueba de la versión. */
  estimateCauseAnalysis(version: string): Promise<CauseEstimate>;
  startCauseAnalysis(version: string): Promise<void>;
  /** Verificación caso a caso (04-verificacion-propuesta.md §9). */
  getSegmentCalls(version: string, segment: AgreementSegment): Promise<SegmentCalls>;
  getCaseComparison(version: string, caseId: string, segment?: AgreementSegment): Promise<CaseComparison>;
  saveVerification(
    caseId: string,
    criterionId: number,
    input: { outcome: VerificationOutcome; note?: string | null; version: string; seenFirst: boolean },
  ): Promise<VerificationRecord>;
  deleteVerification(caseId: string, criterionId: number): Promise<void>;
  activatePromptVersion(version: string, reason: string): Promise<void>;
  /** «Descargar para el repo»: el zip con prompt.yaml, system.txt, lock y la entrada del CHANGELOG. */
  exportPromptVersion(version: string): Promise<Blob>;
  getActivePrompt(): Promise<{ version: string; since: string | null; changedInApp: boolean }>;
  getAdminStats(filters?: AdminStatsFilters): Promise<AdminStats>;
  /** Calidad de la IA por corrida contra el cliente (Cambio 15). */
  getAiQuality(): Promise<AiQuality>;
  listActivity(): Promise<ActivityLogEntry[]>;

  // Procesamiento (Cambio 14)
  getProcessingStatus(): Promise<ProcessingStatus>;
  listPipelineRuns(limit?: number): Promise<PipelineRun[]>;
  listAsrFailures(): Promise<AsrFailure[]>;

  // Análisis de discrepancias (Cambio 16, solo qubico_admin)
  getDiscrepancyOverview(analysisId?: string): Promise<DiscrepancyOverview>;
  getDiscrepancyPattern(patternId: string): Promise<DiscrepancyPatternDetail>;
  estimateDiscrepancyAnalysis(input: { criteria: number[]; model: string }): Promise<DiscrepancyEstimate>;
  startDiscrepancyAnalysis(input: { criteria: number[]; model: string }): Promise<DiscrepancyAnalysisRun>;
  stopDiscrepancyAnalysis(analysisId: string): Promise<void>;
  listDiscrepancyAnalyses(): Promise<DiscrepancyAnalysisRun[]>;
  decideProposal(
    patternId: string,
    input: { decision: "accepted" | "discarded" | "pending"; text?: string; reason?: string; note?: string },
  ): Promise<DiscrepancyPattern>;
  discardObservations(input: { ids: string[]; reason: string }): Promise<DiscrepancyPattern[]>;
  setProposalFollowUp(patternId: string, status: "asked_client" | "calibrated" | "accepted"): Promise<DiscrepancyPattern>;
  getDiscrepancyFollowUp(): Promise<DiscrepancyPattern[]>;

  // Solo para la demo
  resetDemo(): Promise<void>;
}

export type { CorrectionReason };
