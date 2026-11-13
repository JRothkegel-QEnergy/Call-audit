/**
 * Tipos del Administrador Qubico (Cambio 12). Misma forma que las respuestas de src/call_audit/api/routes_admin.py.
 */
import type { AccountStatus, Permission, Role } from "./types";

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
  /** Contra la planilla de la corredora por motivo (golden_split.summary). Tasas como fracción 0-1. null si no hay marca por motivo. */
  criterionScores?: CriterionScores | null;
  /** Mosaico IA vs revisor (docs/ux/admin-prompt-metrics/02-mosaico-propuesta.md §11). null sin planilla por motivo. */
  agreement?: Agreement | null;
}

/** Conteos enteros; agree + undecided + promptFn + promptFp + reviewer = n. */
export interface AgreementBreakdown {
  n: number;
  agree: number;
  undecided: number;
  /** Rojo: IA Sí / Revisor No, no atribuido al revisor. */
  promptFn: number;
  /** Amarillo: IA No / Revisor Sí, no atribuido al revisor. */
  promptFp: number;
  /** Azul = reviewerFn + reviewerFp. */
  reviewer: number;
  reviewerFn: number;
  reviewerFp: number;
  /** Solo en byCall: llamadas que el revisor aprobó / rechazó (bases de FP y FN, 05-numeros-propuesta.md §3). */
  approved?: number;
  rejected?: number;
}

/** Desacuerdos por motivo de un motivo (05-numeros-propuesta.md §4.1-5). fn/fp sin el azul; el azul aparte. */
export interface AgreementCriterion {
  criterionId: number;
  fn: number;
  fp: number;
  reviewerFn: number;
  reviewerFp: number;
  undecided: number;
}

export interface CauseAnalysis {
  status: "none" | "running" | "done" | "failed";
  costUsd?: number | null;
  estimatedCostUsd?: number | null;
  finishedAt?: string | null;
  error?: string | null;
  /** Llamadas en desacuerdo con el revisor. */
  disagreements: number;
  /** false en pruebas anteriores al loop (no guardaron hallazgos) y en la vigente: no se puede analizar la causa. */
  findingsStored: boolean;
}

export interface Agreement {
  byCall: AgreementBreakdown;
  byCallCriterion: AgreementBreakdown;
  /** Motivos de la pauta (n de byCallCriterion = llamadas × criteria). */
  criteria: number;
  causeAnalysis: CauseAnalysis;
  /** Suma de lo verificado a mano por parte del mosaico (04-verificacion-propuesta.md §6.1). */
  verification?: Record<AgreementSegment, VerificationSummary>;
  /** Llamadas con al menos un desacuerdo por motivo, en total y por parte del mosaico (frase puente, §4.1-3). */
  bridge?: { calls: number } & Record<AgreementSegment, number>;
  byCriterion?: AgreementCriterion[];
  /** Universo a la vista (N-R1): llamadas de la prueba, medidas y por qué quedaron fuera. */
  scope?: { total: number; measured: number; errors: number; noReference: number };
}

/** Lista de llamadas: una parte del mosaico, un lado (falsas alarmas / rechazos no detectados) o todo desacuerdo. */
export type CallList = AgreementSegment | "fp" | "fn" | "disagree";

// --- Verificación caso a caso (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §9) ---

export type AgreementSegment = "promptFn" | "promptFp" | "reviewer" | "undecided" | "agree";
export type VerificationOutcome = "ai_error" | "reviewer_error" | "ambiguous" | "missing_info";
/** none: la llamada no tiene desacuerdos por motivo que verificar. */
export type CallVerification = "pending" | "confirmed" | "ai_wrong" | "inconclusive" | "none";
export type Verdict3 = "compliant" | "non_compliant" | "uncertain";

export interface VerificationSummary {
  /** Llamadas de la parte con algo que verificar. */
  calls: number;
  reviewed: number;
  confirmed: number;
  aiWrong: number;
  inconclusive: number;
  pending: number;
  /** Wilson 95 % (proporción) de confirmed/reviewed (azul, verde) o aiWrong/reviewed (rojo, amarillo, gris). */
  ci95: [number, number] | null;
  /** Registros hechos con la explicación de la IA de análisis a la vista. */
  seenFirst: number;
}

export interface SegmentDisagreement {
  criterionId: number;
  kind: "fn" | "fp" | "undecided";
  blue: boolean;
  outcome: VerificationOutcome | null;
}

export interface SegmentCall {
  caseId: string;
  callId: string;
  callDate: string;
  /** Posición en el orden aleatorio fijo (1 = primera). */
  order: number;
  aiVerdict: Verdict3;
  reviewerVerdict: "compliant" | "non_compliant";
  disagreements: SegmentDisagreement[];
  verification: CallVerification;
}

export interface SegmentCalls {
  version: string;
  evaluationId: string;
  /** Llamadas medibles de la prueba (el n del mosaico). */
  n: number;
  segment: CallList;
  criterion: number | null;
  items: SegmentCall[];
  summary: VerificationSummary;
}

export interface VerificationRecord {
  outcome: VerificationOutcome;
  correct: "compliant" | "non_compliant" | null;
  note: string | null;
  by: string;
  at: string | null;
  seenFirst: boolean;
  versionAt: string;
  /** La planilla cambió después de registrar: hay que verificar de nuevo. */
  stale: boolean;
}

export interface CaseComparisonCriterion {
  criterionId: number;
  description: string;
  block: string;
  kind: "agree" | "fn" | "fp" | "undecided";
  blue: boolean;
  ai: {
    verdict: Verdict3;
    comment: string | null;
    evidence: { quote: string; startMs: number | null; quoteValidated?: boolean }[];
  };
  reviewerFail: boolean;
  analysis: { patternId: string; title: string; cause: string; explanation: string } | null;
  verification: VerificationRecord | null;
}

export interface CaseComparison {
  caseId: string;
  callId: string;
  callDate: string;
  durationMs: number;
  version: string;
  model: string;
  segment: AgreementSegment;
  listSegment: CallList;
  listCriterion: number | null;
  aiVerdict: Verdict3;
  reviewer: { verdict: "compliant" | "non_compliant"; comment: string | null; evaluator: string | null };
  findingsAvailable: boolean;
  verification: CallVerification;
  criteria: CaseComparisonCriterion[];
  position: {
    index: number | null;
    total: number;
    pending: number;
    prevCaseId: string | null;
    nextCaseId: string | null;
    nextPendingCaseId: string | null;
  };
}

export interface PromptLoopChain {
  id: string;
  status: string;
  rounds: { round: number; version: string; parentVersion: string | null; agreement: Agreement | null }[];
}

export interface CauseEstimate {
  model: string;
  criteria: number[];
  totalUsd: number | null;
}

export interface CriterionScore {
  criterionId: number;
  /** Llamadas en que la corredora marcó el motivo. */
  support: number;
  tp: number;
  fp: number;
  fn: number;
}

export interface CriterionScores {
  n: number;
  callMatchRate: number | null;
  callFpRate: number | null;
  callFnRate: number | null;
  callUncertainRate: number | null;
  fpGoal: number;
  fnGoal: number;
  nCalls?: number;
  nApproved?: number;
  nRejected?: number;
  fpCount?: number;
  fnCount?: number;
  uncertainCount?: number;
  minSupport: number;
  byCriterion: CriterionScore[];
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
  /** Cadena del loop de mejora al que pertenece la versión (E4); null si no es de un loop. */
  loop?: PromptLoopChain | null;
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

export type StatsPeriod = "7d" | "30d";

export interface AdminStatsFilters {
  period?: StatsPeriod;
  model?: string;
  prompt?: string;
}

export interface AdminStats {
  filters: {
    models: { id: string; label: string }[];
    promptVersions: string[];
    /** Periodo elegido o, en todo el historial, primera y última corrida. Null si no hay corridas. */
    range: { from: string; to: string } | null;
    lastRunAt: string | null;
  };
  operation: {
    callsProcessed: number;
    minutesProcessed: number;
    medianHoursToResult: number | null;
    batchesWithError: number;
    humanQueue: number;
    oldestQueueHours: number;
    reviewedPerDay: number;
    daily: { date: string; calls: number }[];
    dailyBucket: "day" | "week";
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
  costPerCallUsd: number | null;
  /** Versión cuya lista de llamadas (/admin/prompts/[v]/calls) es esta prueba; null si no hay lista. */
  listVersion: string | null;
  /** Medida sobre las llamadas de validación, con las mismas cifras del mosaico (05-numeros-propuesta.md §5). */
  agreement: Agreement;
}

export interface AiQuality {
  series: QualitySeries[];
  criteria: { id: number; name: string; minor: boolean }[];
  goals: { falsePositivePct: number; falseNegativePct: number };
  promptTestRunning: { version: string; done: number; total: number } | null;
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
  /** Casos del motivo que quedaron en un patrón (Cambio 19); null = sin analizar. */
  explained: KindCounts | null;
  /** fp + fn + IA dudosa del motivo enviados al análisis; null = sin analizar. */
  analyzedCases: number | null;
  summary: string | null;
}

export interface KindCounts {
  fp: number;
  fn: number;
  uncertain: number;
}

/** Qué campos del prompt de análisis v1.1+ trae el análisis (Cambio 19 §7.9). */
export interface DiscrepancyCapabilities {
  whoIsRight: boolean;
  expectedFix: boolean;
  sideEffects: boolean;
  concentration: boolean;
  tentative: boolean;
}

export type WhoIsRight = "auditor" | "ia" | "ambiguo";
export type ActionGroup = "prompt_rule" | "calibrate_auditor" | "company" | "none" | "observation" | "unpatterned";

/** Cifras del resumen (Cambio 19 §7.3), en casos (motivo × llamada), sin IA. */
export interface DiscrepancySummary {
  disagreements: number;
  criteriaWithDisagreements: number;
  criteriaNotAnalyzed: number | null;
  analyzedCases: number;
  explainedCases: number;
  byAction: Record<ActionGroup, number>;
  byWhoIsRight: Record<WhoIsRight | "unpatterned", number> | null;
  pendingProposals: number;
  pendingCases: number;
  staleCases: number;
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
  /** Solo en el overview. */
  capabilities?: DiscrepancyCapabilities;
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
  /** Texto base de una observación (Cambio 20, D-94); null en los patrones. */
  observationText: string | null;
  kindCounts: KindCounts;
  /** Campos del prompt de análisis v1.1+; null = sin dato en este análisis. */
  whoIsRight: WhoIsRight | null;
  expectedFix: string[] | null;
  sideEffects: string | null;
  concentration: string | null;
  tentative: boolean | null;
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
  /** La propuesta lo corregiría, según el análisis; null = sin dato. */
  expectedFix: boolean | null;
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
  summary: DiscrepancySummary;
  followUp: { accepted: number; resolved: number; discarded: number };
  readOnly: boolean;
  running: DiscrepancyAnalysisRun | null;
  stale: { currentSeriesChanged: boolean; currentSeries: Layer2Series | null; newReviews: number } | null;
  patterns: DiscrepancyPattern[];
  models: DiscrepancyModelOption[];
  defaultModel: string;
  /** Última prueba de versión sobre validación: cabecera, mosaico y desacuerdos por motivo del Resumen (§4). */
  quality?: {
    version: string;
    model: string;
    finishedAt: string | null;
    listVersion: string | null;
    agreement: Agreement;
  } | null;
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
  /** false cuando las reglas salen del loop de mejora y la base es la versión probada. */
  baseIsActive: boolean;
  version: string;
  model: string;
  changelog: string;
  rationale: string;
  criteria: FollowUpCriterionChange[];
}
