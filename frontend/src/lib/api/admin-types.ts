/**
 * Tipos del Administrador Qubico (Cambio 12). Misma forma que las respuestas de src/call_audit/api/routes_admin.py.
 */
import type { AccountStatus, CallVerdict, Permission, Role } from "./types";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** "invite_expired": invitada y el enlace venció (Cambio 12 §4.1). */
  status: AccountStatus | "invite_expired";
  loginMethod: "password";
  permissions: Permission[];
  lastLoginAt: string | null;
  createdBy: string;
  createdAt: string | null;
}

export type PromptVersionStatus = "draft" | "testing" | "test_failed" | "tested" | "active" | "retired";
export type PromptSource = "yaml" | "text" | "bench" | "repo";

export interface ReferenceMetrics {
  kind: "client" | "app_auditors";
  n: number;
  matchRate: number;
  uncertainRate: number;
  aiOnlyFail: number;
  aiMissedFail: number;
  unvalidatedQuoteRate: number;
}

export interface EvaluationMetrics {
  references: ReferenceMetrics[];
  costPerCallUsd: number;
  latencyMsP50: number;
  latencyMsP95: number;
  /** Cuántas llamadas marcó incumplidas cada motivo. */
  byCriterion: { criterionId: number; failCount: number }[];
}

export interface PromptEvaluation {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "stopped";
  model: string;
  total: number;
  done: number;
  estimatedCostUsd: number | null;
  costUsd: number;
  requestedBy: string | null;
  stoppedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  metrics: EvaluationMetrics | null;
}

export interface PromptVersion {
  version: string;
  status: PromptVersionStatus;
  source: PromptSource;
  model: string;
  changelog: string;
  rationale: string | null;
  createdBy: string;
  createdAt: string | null;
  testedAt: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  activationReason: string | null;
  retiredAt: string | null;
  evaluation?: PromptEvaluation | null;
}

export type PromptDiff =
  | { kind: "text"; base: string; next: string }
  | {
      kind: "rules";
      rules: { id: string; title: string; before: string | null; after: string | null; origin: string | null; note: string | null }[];
    };

export interface PromptVersionDetail {
  meta: PromptVersion;
  /** Lo editable: el prompt.yaml o el texto del system prompt sin la instrucción de salida. */
  content: string;
  systemText: string;
  activeVersion: string;
  diff: PromptDiff | null;
  evaluation: PromptEvaluation | null;
  /** La vigente medida con sus corridas actuales sobre el mismo conjunto (sin gastar). */
  activeMetrics: EvaluationMetrics | null;
  history: { at: string; actor: string; action: string }[];
}

export interface PromptEstimate {
  calls: number;
  model: string;
  perCallUsd: number | null;
  totalUsd: number | null;
  minutes: number | null;
}

export interface ModelOption {
  name: string;
  provider: string;
}

export interface AdminStats {
  operation: {
    callsProcessed: number;
    minutesProcessed: number;
    medianHoursToResult: number | null;
    batchesWithError: number;
    humanQueue: number;
    oldestQueueHours: number;
    reviewedPerDay: number;
    daily: { date: string; calls: number }[];
    failedBatches: { batchId: string; at: string | null; stage: string; calls: number }[];
  };
  cost: {
    model: string;
    promptVersion: string;
    calls: number;
    totalUsd: number;
    perCallUsd: number;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMsAvg: number;
    latencyMsP95: number;
  }[];
}

/** Una corrida comparable en «Calidad de la IA» (Cambio 15, D-54): modelo + versión + run_label, o una prueba. */
export interface QualitySeries {
  id: string;
  model: string;
  modelLabel: string;
  /** Color fijo por modelo (--series-1..6), en el orden de models.toml (H-100). */
  colorIndex: number;
  promptVersion: string;
  runLabel: string;
  source: "run" | "prompt_test";
  isCurrent: boolean;
  ranAt: string | null;
  calls: number;
  costPerCallUsd: number | null;
  unvalidatedQuoteRate: number;
}

export interface QualityCall {
  caseId: string;
  callId: string;
  callDate: string;
  clientVerdict: CallVerdict;
  /** Motivos que el cliente marcó NO CUMPLE; null si el Excel no los trae (D-55). */
  clientFails: number[] | null;
  /** Por id de serie; null = la corrida no tiene resultado para esta llamada. Sin la clave = no la corrió. */
  results: Record<string, { verdict: CallVerdict; failCriteria: number[] } | null>;
}

export interface AiQuality {
  series: QualitySeries[];
  calls: QualityCall[];
  criteria: { id: number; name: string; minor: boolean; byCode: boolean; partial: boolean }[];
  goals: { falsePositivePct: number; falseNegativePct: number };
  promptTestRunning: { version: string; done: number; total: number } | null;
  /** Patrones por motivo del último análisis de discrepancias de la corrida vigente (Cambio 16, D-62). */
  currentSeriesPatternCounts?: Record<string, number> | null;
}

export interface ActivityLogEntry {
  id: string;
  at: string | null;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  target: string;
  details: string;
}

export interface InviteInfo {
  state: "valid" | "expired" | "used" | "revoked";
  kind?: "invite" | "reset";
  name?: string;
  email?: string;
  role?: Role;
  invitedBy?: string | null;
  expiresAt?: string | null;
}

/** Error de la API con la lista de errores de validación (prompt.yaml inválido). */
export class ApiError extends Error {
  errors: string[];
  constructor(code: string, errors: string[] = []) {
    super(code);
    this.errors = errors;
  }
}

/** Procesamiento (Cambio 14): estado del worker y avance de la pasada. Misma forma que /api/admin/processing. */
export type WorkerState = "running" | "idle" | "stale" | "last_failed" | "no_data";
export type PipelineStage = "listing" | "transcribing" | "validating" | "archiving";

export interface PipelineRun {
  id: number;
  startedAt: string | null;
  finishedAt: string | null;
  status: "running" | "done" | "failed" | "interrupted";
  stage: PipelineStage | null;
  audios: number;
  waitingMetadata: number;
  batchSize: number;
  remaining: number;
  transcribeTotal: number;
  transcribed: number;
  asrErrors: number;
  asrRateLimited: number;
  validateTotal: number;
  validated: number;
  archived: number;
  error: string | null;
}

export interface AsrFailure {
  stem: string;
  error: string;
  attempts: number;
  lastAttemptAt: string | null;
}

export interface ProcessingStatus {
  state: WorkerState;
  stage: PipelineStage | null;
  lastHeartbeatAt: string | null;
  nextRunAt: string | null;
  loopSeconds: number | null;
  currentRun: PipelineRun | null;
  lastRun: PipelineRun | null;
  otherTasks: {
    catalogUploadsQueued: number;
    promptEvaluation: { version: string; processed: number; n: number } | null;
    /** Análisis de discrepancias en curso (Cambio 16): motivos terminados de los pedidos. */
    discrepancyAnalysis?: { id: string; done: number; total: number } | null;
  };
}

/** Análisis de discrepancias (Cambio 16). Misma forma que src/call_audit/api/routes_discrepancies.py. */
/** criterion y evaluator vienen del prompt de análisis v1.0.0; la v1.1.0 usa rule_text, ai_application, auditor y
 * motive_overlap. */
export type DiscrepancyCause =
  | "rule_text"
  | "ai_application"
  | "auditor"
  | "motive_overlap"
  | "criterion"
  | "evaluator"
  | "transcript"
  | "missing_data";
export type DiscrepancyDirection = "fp" | "fn" | "uncertain" | "mixed";
export type ProposalType = "prompt_rule" | "client_question" | "calibrate_auditor" | "data_request";
export type ProposalAction = "append" | "replace";
/** Resultado de aplicar una regla al criterio (Cambio 18 §8.4). */
export type RuleApplyState = "applied" | "manual" | "free_text" | "review";
export type ProposalStatus = "pending" | "accepted" | "discarded" | "included" | "asked_client" | "calibrated";
export type DiscrepancyAnalysisStatus = "queued" | "running" | "done" | "stopped" | "failed";

export interface Layer2Series {
  model: string;
  promptVersion: string;
  runLabel: string;
}

export interface DiscrepancyCriterionRow {
  criterionId: number;
  name: string;
  clientFails: number;
  aiFails: number;
  matchFail: number;
  fp: number;
  fn: number;
  aiUncertain: number;
  disagreements: number;
  manualItems: number;
  /** null = el análisis mostrado no incluyó este motivo («sin analizar»). */
  patterns: number | null;
  summary: string | null;
}

export interface DiscrepancyEvaluatorRow {
  evaluator: string;
  calls: number;
  clientCallFails: number;
  callMatch: number;
  clientFails: number;
  fp: number;
  fn: number;
}

export interface DiscrepancyAnalysisRun {
  id: string;
  status: DiscrepancyAnalysisStatus;
  createdBy: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  model: string;
  analysisPromptVersion: string;
  layer2Series: Layer2Series | null;
  criteria: number[];
  doneCriteria: number[];
  failedCriteria: { criterionId: number; error: string }[];
  estimatedUsd: number | null;
  costUsd: number;
  error: string | null;
  stoppedBy: string | null;
  /** Solo en el historial: patrones (sin observaciones). */
  patterns?: number;
}

export interface DiscrepancyQuote {
  call_id: string;
  text: string;
  validated?: boolean;
}

export interface DiscrepancyPattern {
  id: string;
  analysisId: string;
  criterionId: number;
  criterionName: string | null;
  rank: number;
  title: string;
  explanation: string;
  direction: DiscrepancyDirection | null;
  cause: DiscrepancyCause | null;
  quotes: DiscrepancyQuote[];
  confidence: number | null;
  caseCount: number;
  reviewerDisagreements: number;
  isObservation: boolean;
  proposal: {
    type: ProposalType;
    /** Cómo se aplica una regla del prompt (análisis v1.3.0, Cambio 18). null = texto libre (propuestas anteriores). */
    action?: ProposalAction | null;
    /** Frase literal del criterio que reemplaza, con action "replace". */
    find?: string | null;
    text: string;
    editedText: string | null;
  } | null;
  status: ProposalStatus;
  decision: {
    by: string | null;
    at: string | null;
    reason: string | null;
    note: string | null;
    includedInVersion: string | null;
    versionStatus: PromptVersionStatus | null;
  } | null;
}

export interface DiscrepancyCase {
  caseId: string | null;
  callId: string;
  callDate: string | null;
  kind: "fp" | "fn" | "ai_uncertain" | "match_fail";
  aiVerdict: string;
  aiComment: string;
  aiQuote: string | null;
  aiQuoteMs: number | null;
  clientFail: boolean;
  clientComment: string | null;
  manualVerdict: string | null;
  manualSidesWith: "ai" | "excel" | "none" | null;
  evaluator: string | null;
}

export interface DiscrepancyPatternDetail extends DiscrepancyPattern {
  cases: DiscrepancyCase[];
  criterionSummary: string | null;
  readOnly: boolean;
}

export interface DiscrepancyModelOption {
  name: string;
  label: string;
  /** El servidor tiene la API key del proveedor. */
  available: boolean;
  priced: boolean;
}

export interface DiscrepancyOverview {
  currentSeries: Layer2Series | null;
  calls: number;
  cases: number;
  manualCases: number;
  /** Llamadas fuera de la tabla, por razón («sin corrida vigente», «la corrida vigente terminó con error», «sin marca por motivo del cliente»). */
  callsOutside: Record<string, number>;
  callMatch: { agree: number; total: number };
  criteria: DiscrepancyCriterionRow[];
  evaluators: DiscrepancyEvaluatorRow[] | null;
  analysis: DiscrepancyAnalysisRun | null;
  readOnly: boolean;
  running: DiscrepancyAnalysisRun | null;
  stale: { currentSeriesChanged: boolean; currentSeries: Layer2Series | null; newReviews: number } | null;
  patterns: DiscrepancyPattern[];
  models: DiscrepancyModelOption[];
  defaultModel: string;
}

export interface DiscrepancyEstimate {
  model: string;
  criteria: number[];
  cases: number;
  discardedProposals: number;
  totalUsd: number | null;
  minutes: number | null;
}

/** Versión del prompt desde Seguimiento (Cambio 18 §8.8). Misma forma que src/call_audit/prompt_followup.py. */
export interface FollowUpRuleResult {
  proposalId: string;
  patternRank: number;
  patternTitle: string;
  action: ProposalAction | null;
  find: string | null;
  text: string;
  state: RuleApplyState;
  reviewReason: string | null;
  historyNote: string;
  acceptedBy: string;
  acceptedAt: string;
  note: string | null;
}

export interface FollowUpCriterionChange {
  criterionId: number;
  title: string;
  before: string;
  /** El texto que sale de aplicar las reglas, sin la edición manual («Volver al texto generado»). */
  generated: string;
  /** El texto final: el generado o el editado a mano. */
  after: string;
  manual: boolean;
  rules: FollowUpRuleResult[];
}

export interface FollowUpPromptPreview {
  baseVersion: string;
  version: string;
  model: string;
  changelog: string;
  rationale: string;
  criteria: FollowUpCriterionChange[];
}
