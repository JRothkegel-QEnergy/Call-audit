/**
 * Tipos del dominio que consume el front.
 *
 * Son el contrato con el backend (FastAPI): el adaptador mock y el HTTP devuelven
 * exactamente estas formas. Los nombres siguen el glosario de
 * docs/ux/call-audit/03-arquitectura-informacion.md §4.2 y el contrato de capas
 * (.claude/rules/layer-contract.md).
 */

export type Role = "auditor" | "supervisor";

/** Veredicto del contrato de capas. `not_applicable` se muestra como "Cumple" (D-20, H-48). */
export type Verdict = "compliant" | "non_compliant" | "uncertain" | "not_applicable";

/** Veredicto de una llamada completa (decisión del motor o veredicto final). */
export type CallVerdict = "compliant" | "non_compliant" | "uncertain";

/** Estado del caso (03 §4.3). `awaiting_approval` es nuevo y está pendiente de validar con pipeline-architect (H-34). */
export type CaseStatus =
  | "pending"
  | "in_review"
  | "awaiting_approval"
  | "escalated"
  | "reopened"
  | "overridden"
  | "closed";

export type Speaker = "agent" | "customer" | "other";

/** Permisos por cuenta que activa Qubico. `view_model_io`: ver el panel "Prompt y respuesta del modelo" (D-22). */
export type Permission = "view_model_io";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

export interface Agent {
  id: string;
  name: string;
  team: string;
}

export interface Criterion {
  /** Número del motivo en la pauta del cliente (ej. 28). */
  id: number;
  name: string;
  blockId: string;
  critical: boolean;
  /** Sección de la ficha del seguro relevante para este motivo (H-32: debe venir de la rúbrica). */
  productSheetSection?: ProductSheetSectionKey;
}

export interface RubricBlock {
  id: string;
  name: string;
  criterionIds: number[];
}

export interface Rubric {
  id: string;
  version: string;
  blocks: RubricBlock[];
  criteria: Record<number, Criterion>;
}

export interface TranscriptTurn {
  index: number;
  speaker: Speaker;
  startMs: number;
  endMs: number;
  /** Texto ya anonimizado (PII enmascarada en el pre-proceso). */
  text: string;
}

export interface Evidence {
  quote: string;
  startMs: number;
  endMs: number;
  /** false = la cita de la IA no aparece en la transcripción (regla 4 del proyecto). */
  quoteValidated: boolean;
}

/** Hallazgo propuesto por la IA para un motivo. Los motivos sin hallazgo se consideran `compliant`. */
export interface Finding {
  criterionId: number;
  verdict: Verdict;
  confidence: number;
  evidence: Evidence | null;
  comment: string;
}

export type ReviewAction = "confirmed" | "corrected" | "accepted_unchanged" | "added";

export const CORRECTION_REASONS = [
  "Evidencia mal interpretada",
  "Error de transcripción",
  "Criterio ambiguo en la pauta",
  "Evidencia fuera del fragmento",
  "La situación no se dio en la llamada",
  "La IA no detectó el incumplimiento",
  "Otro",
] as const;
export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

export const ESCALATION_REASONS = [
  "Duda de criterio",
  "Posible incumplimiento crítico",
  "Audio inaudible",
  "Otro",
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const OVERRIDE_REASONS = ["Criterio mal aplicado", "Evidencia mal interpretada", "Otro"] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

/** Decisión del auditor sobre un motivo. */
export interface ItemReview {
  criterionId: number;
  action: ReviewAction;
  verdict: Verdict;
  correctionReason?: CorrectionReason;
  comment?: string;
  /** Solo para `added`: minuto donde el auditor detectó el hallazgo. */
  atMs?: number;
}

export interface Review {
  caseId: string;
  auditorId: string;
  auditorName: string;
  items: ItemReview[];
  /** Turnos marcados como mal transcritos. */
  badTranscriptTurns: number[];
  finalVerdict: CallVerdict;
  reviewSeconds: number;
  submittedAt: string;
}

/**
 * Una corrida del modelo sobre la llamada (prompt único con metadatos, Cambio 09).
 * Reemplaza a las capas. Todo lo que trae es lo que efectivamente salió al modelo, ya anonimizado.
 */
export interface ModelRun {
  id: string;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  runAt: string;
  latencyMs: number;
  costUsd: number;
  verdict: CallVerdict;
  appliedRule: string;
  /** Metadatos del caso y fichas de seguro tal como entraron al prompt, en columnas. */
  inputData: { section: string; rows: { field: string; value: string }[] }[];
  /** Prompt enviado, por secciones (system, reglas de revisión, mensaje de usuario). */
  promptSections: { title: string; text: string }[];
  /** Respuesta cruda del modelo (JSON). */
  rawResponse: unknown;
}

export interface Note {
  id: string;
  caseId: string;
  scope: "case" | "finding";
  criterionId: number | null;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
  editedAt: string | null;
}

/** Veredicto del cliente (ESTADO_CALIDAD): APROBADA → compliant, RECHAZADA → non_compliant. No tiene "Dudosa". */
export type ExternalVerdict = "compliant" | "non_compliant";

export type ProductSheetSectionKey = "call" | "category" | "premium" | "refund" | "withdrawal" | "coverages";

export interface ProductSheet {
  productId: string;
  name: string;
  insurer: string;
  /** Datos de esta llamada (enmascarados). */
  callData: { label: string; value: string }[];
  category: "RETENIBLE" | "NO RETENIBLE" | "IRRENUNCIABLE";
  categoryRule: string;
  premiumType: string;
  premiumRefund: string;
  withdrawal: string;
  coverages: { name: string; detail: string }[];
}

export interface CaseSummary {
  id: string;
  callId: string;
  callDate: string;
  agent: Agent;
  products: string[];
  engineVerdict: CallVerdict;
  /** Muestra "cumple" incluida al azar como control (HU-AUD-07). */
  sampleCompliant: boolean;
  nonCompliantCount: number;
  uncertainCount: number;
  durationMs: number;
  queuedAt: string;
  status: CaseStatus;
  lockedBy: { id: string; name: string } | null;
  assignedAuditorId: string | null;
  hasCritical: boolean;
  /** Veredicto del cliente a nivel de llamada (D-25). Opcional; el backend no lo envía al rol auditor (D-24, H-58). */
  externalQualityVerdict: ExternalVerdict | null;
}

export interface CaseDetail extends CaseSummary {
  audioUrl: string | null;
  transcript: TranscriptTurn[];
  findings: Finding[];
  productSheets: ProductSheet[];
  /** Corridas del modelo; la primera es la vigente. Comparar modelos (más de una) queda para después. */
  modelRuns: ModelRun[];
  rubricId: string;
  rubricVersion: string;
  review: Review | null;
  notes: Note[];
  /** Veredicto del cliente por motivo (a futuro, D-25). `null` = no vino. Solo para supervisor. */
  externalItemVerdicts: { criterionId: number; verdict: ExternalVerdict }[] | null;
  /** Comentario libre del cliente, ya enmascarado. Solo para supervisor. */
  externalComment: string | null;
}

export interface MyReviewRow {
  caseId: string;
  callId: string;
  submittedAt: string;
  status: CaseStatus;
  myVerdict: CallVerdict | null;
  note: string;
}

export type AlertKind = "escalation" | "critical_confirmed";
export type AlertStatus = "new" | "seen" | "handled";

export interface Alert {
  id: string;
  kind: AlertKind;
  status: AlertStatus;
  caseId: string;
  callId: string;
  criterionId: number | null;
  atMs: number | null;
  reason: string;
  comment: string | null;
  raisedBy: string;
  createdAt: string;
  handledComment?: string;
}

export type ReviewFlag = "corrected_ai" | "contradicted_critical" | "fast_review" | "escalated";

export interface PendingApproval {
  caseId: string;
  callId: string;
  auditorId: string;
  auditorName: string;
  submittedAt: string;
  finalVerdict: CallVerdict;
  reviewSeconds: number;
  flags: ReviewFlag[];
  correctionReasons: CorrectionReason[];
}

export interface Kpis {
  processed: number;
  engineCompliantPct: number;
  engineNonCompliantPct: number;
  engineUncertainPct: number;
  finalCompliancePct: number;
  pendingCases: number;
  oldestPendingHours: number;
  criticalConfirmed: number;
  criticalUnhandled: number;
  dailyCompliance: { date: string; pct: number }[];
  topCriteria: { criterionId: number; pct: number }[];
}

export interface AgentStats {
  agent: Agent;
  audited: number;
  finalCompliancePct: number;
  topCriteria: number[];
  trendPts: number;
  pendingFollowUps: number;
}

export type FollowUpStatus = "pending" | "with_feedback" | "handled";

export interface AgentCallRow {
  caseId: string;
  callId: string;
  criterionId: number;
  followUp: FollowUpStatus;
}

export interface Feedback {
  id: string;
  agentId: string;
  supervisorName: string;
  createdAt: string;
  text: string;
  commitment: string;
  followUpDate: string | null;
  caseIds: string[];
}

export interface AgentDetail {
  stats: AgentStats;
  confirmedCalls: AgentCallRow[];
  aiOnlyCalls: { caseId: string; callId: string; engineVerdict: CallVerdict }[];
  feedback: Feedback[];
}

export interface CriterionStats {
  criterionId: number;
  count: number;
  pct: number;
  deltaPts: number;
}

export interface AuditorStats {
  auditorId: string;
  name: string;
  casesPerDay: number;
  avgReviewSeconds: number;
  correctsAiPct: number;
  reopenedOrChangedPct: number;
  escalationsPct: number;
}

export type AccountStatus = "invited" | "active" | "deactivated";
export type LoginMethod = "sso" | "password";

export interface AuditorAccount {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  loginMethod: LoginMethod;
}

/** Ramas del árbol de discrepancias (09 §4). */
export type DiscrepancyBranch = "ai_only_fail" | "ai_missed_fail" | "ai_uncertain" | "match";
export type DiscrepancyClassification = "ai_correct" | "ai_wrong";

export interface DiscrepancyRow {
  caseId: string;
  callId: string;
  callDate: string;
  agentName: string;
  aiVerdict: CallVerdict;
  clientVerdict: ExternalVerdict;
  appAuditorVerdict: CallVerdict | null;
  branch: DiscrepancyBranch;
  /** Motivos que la IA marcó Incumple. */
  aiFailCriteria: number[];
  classification: DiscrepancyClassification | null;
  classifiedCriteria: number[];
  presentation: "pending" | "presented" | null;
  notesCount: number;
}

export interface QueueFilters {
  agentId?: string;
  engineVerdict?: CallVerdict | "sample";
  blockId?: string;
}
