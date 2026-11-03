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
  };
}
