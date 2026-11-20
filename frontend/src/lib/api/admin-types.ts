/**
 * Tipos del Administrador Qubico (Cambio 12). Misma forma que las respuestas de src/call_audit/api/routes_admin.py.
 */
import type { AccountStatus, Permission, Role, SuggestedReason, Typification } from "./types";

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
  /** Cuántas llamadas marcó incumplidas cada criterio. */
  byCriterion: { criterionId: number; failCount: number }[];
  /** Contra la planilla de la corredora por criterio (golden_split.summary). Tasas como fracción 0-1. null si no hay marca por criterio. */
  criterionScores?: CriterionScores | null;
  /** Mosaico IA vs revisor (docs/ux/admin-prompt-metrics/02-mosaico-propuesta.md §11). null sin planilla por criterio. */
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

/** Desacuerdos por criterio de un criterio (05-numeros-propuesta.md §4.1-5). fn/fp sin el azul; el azul aparte. */
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
  /** Criterios de la pauta (n de byCallCriterion = llamadas × criteria). */
  criteria: number;
  causeAnalysis: CauseAnalysis;
  /** Suma de lo verificado a mano por parte del mosaico (04-verificacion-propuesta.md §6.1). */
  verification?: Record<AgreementSegment, VerificationSummary>;
  /** Llamadas con al menos un desacuerdo por criterio, en total y por parte del mosaico (frase puente, §4.1-3). */
  bridge?: { calls: number } & Record<AgreementSegment, number>;
  byCriterion?: AgreementCriterion[];
  /** Universo a la vista (N-R1): llamadas de la prueba, medidas y por qué quedaron fuera. */
  scope?: { total: number; measured: number; errors: number; noReference: number };
  /** Reglas incluidas en esta versión que salen de un análisis de causa: de estas mismas llamadas (aviso N8 A). */
  sameCallRules?: number;
  /** Dentro de "agree": si también coinciden los criterios de rechazo (15-acuerdo-en-motivos-brief.md §8). n = byCall.agree. */
  reasonMatch?: { n: number } & Record<ReasonMatch, number>;
}

/** Tramos de las llamadas que coinciden con el revisor según sus criterios de rechazo. */
export type ReasonMatch = "bothPass" | "same" | "partial" | "none";

/** Análisis por caso de una versión (06-ajustes-feedback.md §2): solo los criterios que no coinciden. */
export interface QualityGrid {
  listVersion: string | null;
  criteria: number[];
  calls: {
    caseId: string;
    callId: string;
    typification?: Typification | null;
    segment: AgreementSegment;
    reviewerVerdict: "compliant" | "non_compliant";
    aiVerdict: Verdict3;
    items: [number, "fn" | "fp" | "undecided" | "both", boolean][];
  }[];
}

/** Lista de llamadas: una parte del mosaico, un lado (falsas alarmas / rechazos no detectados) o todo desacuerdo. */
export type CallList = AgreementSegment | AgreeList | "fp" | "fn" | "disagree" | "changed" | "all";

/** Listas de cada tramo de «¿Coinciden también en los criterios?». */
export type AgreeList = "agreePass" | "agreeSame" | "agreePartial" | "agreeNone";

/** Cifras del Resumen de Discrepancias (10-resumen-mas-informacion.md), de la misma fuente que el mosaico. */
export interface Concentration {
  total: number;
  criteria: number;
  to50: number | null;
  to80: number | null;
  top: { criterionId: number; n: number }[];
}

export interface DiscrepancyInsights {
  disagreements: number;
  promptSide: {
    n: number;
    fn: number;
    fp: number;
    concentration: Concentration;
    /** Desacuerdos rojo + amarillo por destino de su patrón: prompt_rule, observation, unpatterned, calibrate_auditor… */
    coverage: Record<string, number>;
    pendingRules: number;
    ceiling: { calls: number; agree: number; n: number };
  };
  reviewerSide: { n: number; concentration: Concentration; withCalibration: number; pendingCalibration: number };
  byAction: Record<string, number>;
  chronic: { n: number; of: number; versions: string[]; new: number } | null;
  chronicByCriterion: Record<string, number>;
  evolution: { version: string; calls: number; toAgree: number; fromAgree: number; p: number } | null;
  stability: { repeated: number; changed: number; versions: string[] } | null;
  sample: { size: number; reviewed: number; confirmed: number };
}

// --- Verificación caso a caso (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §9) ---

export type AgreementSegment = "promptFn" | "promptFp" | "reviewer" | "undecided" | "agree";
export type VerificationOutcome = "ai_error" | "reviewer_error" | "ambiguous" | "missing_info";
/** none: la llamada no tiene desacuerdos por criterio que verificar. */
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
  typification?: Typification | null;
  /** Lista «changed»: pasa a coincidir o deja de coincidir frente a `vs`. */
  group?: "toAgree" | "fromAgree";
  /** Corrida completa (13-rol-verificador): a quién está asignada y si se marcó «Sin observaciones». */
  assigneeName?: string | null;
  reviewedAt?: string | null;
  /** Bandejas del verificador (18): último registro de la llamada y su tipo de discrepancia. */
  lastReviewedAt?: string | null;
  discrepancy?: Discrepancy;
}

export interface SegmentCalls {
  version: string;
  evaluationId: string;
  /** Llamadas medibles de la prueba (el n del mosaico). */
  n: number;
  segment: CallList;
  criterion: number | null;
  /** Lista «changed»: la versión contra la que se compara. */
  vs?: string | null;
  /** Muestra fija: las primeras N en el orden aleatorio. */
  sample?: number | null;
  items: SegmentCall[];
  summary: VerificationSummary;
  /** Lista «all»: por criterio, llamadas del alcance con algo que verificar en él (incluye dudosas) y cuántas siguen
   * pendientes, sin aplicar el criterio filtrado. Más llamadas primero (16-lista-verificador-por-motivo, L2 A). */
  criterionCounts?: CriterionCount[];
  /** Corrida completa: llamadas por tipo de discrepancia, sin aplicar ese filtro (18, W6 A). */
  discrepancyCounts?: Record<Discrepancy, number>;
}

/** Bandeja del verificador (18, W1-W4): Por revisar o Revisadas. */
export type Tray = "pending" | "reviewed";

/** Tipo de discrepancia de la llamada (18, W6 A). «Posible error del revisor» cae en el lado de su veredicto. */
export type Discrepancy = "fn" | "fp" | "undecided" | "criteria" | "none";

export interface CriterionCount {
  criterionId: number;
  calls: number;
  pending: number;
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
    /** Criterio 18: motivos de renuncia que sugiere la IA (prompt v2.8+). Vacío en los demás. */
    suggestedReasons?: SuggestedReason[];
  };
  reviewerFail: boolean;
  analysis: { patternId: string; title: string; cause: string; explanation: string } | null;
  verification: (VerificationRecord & { canChange?: boolean }) | null;
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
  /** Corrida completa (13-rol-verificador): asignación de la llamada y si quien mira puede registrar. */
  assignment?: CaseAssignment;
  canRecord?: boolean;
  source?: VerificationSource;
  /** Solo para el admin en la corrida completa: a quién se puede reasignar. */
  verifiers?: { id: string; name: string }[];
}

/** «test»: la prueba de la versión (validación). «full»: la corrida completa para los verificadores. */
export type VerificationSource = "test" | "full";

/** Filtro «Asignadas a» (V3): "me", "all", "unassigned" o el id de un verificador. */
export interface VerificationScope {
  source: VerificationSource;
  assignee: string | null;
  /** Bandeja de origen y filtro por discrepancia (18): Anterior/Siguiente recorren esa lista. */
  tray?: Tray | null;
  discrepancy?: Discrepancy | null;
}

export interface VerifierSummary {
  assigned: number;
  pending: number;
  reviewed: number;
  reviewedToday: number;
  nextCaseId: string | null;
}

export interface CaseAssignment {
  assigneeId: string | null;
  assigneeName: string | null;
  mine: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface VerificationOverview {
  version: string;
  evaluationId: string;
  model: string;
  assignee: string;
  n: number;
  agreement: Agreement | null;
  me: VerifierSummary | null;
  verifiers: { id: string; name: string }[];
}

export interface ProgressCell {
  assigned: number;
  reviewed: number;
  pending: number;
}

export interface ProgressBlock extends ProgressCell {
  bySegment: Record<string, ProgressCell>;
  bySplit: Record<string, ProgressCell>;
}

export interface VerificationProgress {
  version: string;
  evaluationId: string;
  people: (ProgressBlock & { id: string; name: string; active: boolean; lastActivityAt: string | null })[];
  unassigned: ProgressBlock;
  total: ProgressBlock;
}

export interface DistributionPlan {
  calls: number;
  people: { id: string; name: string; calls: number; bySegment: Record<string, number> }[];
}

export interface FullRun {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "stopped";
  model: string;
  done: number;
  n: number;
  estimatedCostUsd: number | null;
  costUsd: number;
  errors: number;
  createdAt: string | null;
  finishedAt: string | null;
}

export interface FullRunStatus {
  run: FullRun | null;
  estimate: {
    version: string;
    model: string;
    calls: number;
    reused: number;
    missing: number;
    perCallUsd: number | null;
    totalUsd: number | null;
    minutes: number | null;
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
  /** Llamadas en que la corredora marcó el criterio. */
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

export interface PromptReaderItem {
  id: string;
  /** Solo los criterios de la pauta: traen number, official y (opcional) criterion en vez de text. */
  number: number | null;
  text: string | null;
  official: string | null;
  criterion: string | null;
  /** Pregunta abierta con la corredora; no va en el prompt. */
  pending: string | null;
  /** origin ya viene con su label («Texto oficial», «Script del cliente», ...). */
  history: { version: string; origin: string; note: string | null }[];
}

export interface PromptReaderSpec {
  version: string;
  date: string | null;
  /** heading sin los «#»; null en la intro. level 2 o 3 según «##» / «###». */
  sections: { id: string; heading: string | null; level: 2 | 3; items: PromptReaderItem[] }[];
  jsonOutputInstruction: string | null;
}

export interface PromptVersionDetail {
  meta: PromptVersion;
  /** Lo editable: el prompt.yaml o el texto del system prompt sin la instrucción de salida. */
  content: string;
  systemText: string;
  /** El prompt.yaml ordenado para la pestaña «Leer»; null si se subió como texto o el yaml no se pudo leer. */
  spec: PromptReaderSpec | null;
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
  /** `full_run`: corrida completa para verificación, medida solo en sus llamadas de validación. */
  source: "run" | "prompt_test" | "full_run";
  isCurrent: boolean;
  ranAt: string | null;
  costPerCallUsd: number | null;
  /** Versión cuya lista de llamadas (/admin/prompts/[v]/calls) es esta prueba; null si no hay lista. */
  listVersion: string | null;
  /** Medida sobre las llamadas de validación, con las mismas cifras del mosaico (05-numeros-propuesta.md §5). */
  agreement: Agreement;
  /** Solo en la corrida completa en curso: llamadas de validación con resultado (`done`) de las que trae (`total`). */
  progress: { done: number; total: number } | null;
}

export interface AiQuality {
  series: QualitySeries[];
  criteria: { id: number; name: string; minor: boolean }[];
  goals: { falsePositivePct: number; falseNegativePct: number };
  promptTestRunning: { version: string; done: number; total: number } | null;
  /** Corrida completa en curso (14-corrida-en-curso.md): avance total y en validación; `seriesId` si ya tiene cifras. */
  fullRunRunning: { version: string; seriesId: string | null; done: number; total: number; validation: { done: number; total: number } } | null;
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
    /** Análisis de discrepancias en curso (Cambio 16): criterios terminados de los pedidos. */
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
  /** null = el análisis mostrado no incluyó este criterio («sin analizar»). */
  patterns: number | null;
  /** Casos del criterio que quedaron en un patrón (Cambio 19); null = sin analizar. */
  explained: KindCounts | null;
  /** fp + fn + IA dudosa del criterio enviados al análisis; null = sin analizar. */
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

/** Cifras del resumen (Cambio 19 §7.3), en casos (criterio × llamada), sin IA. */
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
  /** Fuente única con el Resumen (R1 A): desacuerdos del criterio 1 (capa 1) que quedan fuera de las cifras. */
  layer1Cases?: number;
  sameSource?: boolean;
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
  sourceEvaluationId?: string | null;
  /** null: antiguo (sobre la vigente); "rules": del loop; "attribution": análisis de causa de una prueba. */
  purpose?: "rules" | "attribution" | null;
  /** Versión y set de la prueba de donde salió (solo en el análisis que se muestra). */
  sourceVersion?: string | null;
  sourceSplit?: string | null;
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
  /** Llamadas fuera de la tabla, por razón («sin corrida vigente», «la corrida vigente terminó con error», «sin marca por criterio del cliente»). */
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
  /** Última prueba de versión sobre validación: cabecera, mosaico y desacuerdos por criterio del Resumen (§4). */
  /** Cifras del Resumen según el análisis elegido (06-ajustes-feedback.md §4.1). `missing`: la versión del análisis
   * no tiene prueba en validación. `isCurrent`: la vigente medida en validación (análisis antiguos). */
  quality?:
    | {
        version: string;
        model: string;
        finishedAt: string | null;
        listVersion: string | null;
        isCurrent?: boolean;
        evaluationId?: string;
        agreement: Agreement;
        insights?: DiscrepancyInsights | null;
        missing?: undefined;
      }
    | { version: string; missing: true }
    | null;
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
