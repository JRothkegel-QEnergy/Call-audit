/**
 * «Calidad del servicio» (docs/ux/vistas-supervisor/08-alta-fidelidad.md §4.3). Solo lectura sobre la foto vigente.
 * Contrato de `src/call_audit/api/routes_analysis.py`.
 */

export type AnalysisSource = "ai" | "sheet" | "mismatch";
export type CriterionStatus = "consistent" | "divergent" | "data_explained" | "na";
export type ReportAudience = "company" | "internal";

export interface AnalysisFilters {
  /** Tipo de seguro; vacío = Todos. */
  type?: string;
  /** Flujo; vacío = Todos. */
  flow?: string;
}

export interface AnalysisSnapshotMeta {
  id: string;
  /** ISO; "Datos al {fecha}". */
  createdAt: string;
  periodFrom: string;
  periodTo: string;
  periodDays: number;
  /** Tramos de la evolución (D-36): 3 de 30 días hacia atrás; vacío si la foto cubre menos de 60 días. */
  periods: AnalysisPeriod[];
  /** null → sin planilla (S-02). */
  sheetUntil: string | null;
  /** D-31: llamadas cuya referencia es una revisión del auditor en la app, y las que usan la planilla. */
  reference: { auditor: number; sheet: number };
  /** Distintas → S-07. */
  runs: { perCall: string; perCriterion: string };
  lastProcessedAt: string | null;
  filters: { insuranceTypes: string[]; flows: string[] };
  config: { u: number; equal: number; low: number; minAgents: number; pageSize: number; topCriteria: number };
}

export interface AnalysisPeriod {
  id: string;
  from: string;
  to: string;
}

export interface AnalysisStatus {
  hasSnapshot: boolean;
  lastProcessedAt: string | null;
}

export interface CriterionRow {
  criterionId: number;
  blockId: string;
  aiPct: number;
  sheetPct: number | null;
  gapPts: number | null;
  mismatchPct: number | null;
  mismatchCalls: number;
  status: CriterionStatus;
  dataExplainedNote: string | null;
  base: { withRun: number; evaluated: number };
}

export interface AgentsGate {
  open: boolean;
  agentsWithEnough: number;
  totalAgents: number;
}

export interface CriterionDetail extends CriterionRow {
  byInsuranceType: {
    insuranceType: string;
    calls: number;
    aiPct: number;
    sheetPct: number | null;
    mismatchPct: number | null;
    lowSample: boolean;
  }[];
  /** Vacío si Ejecutivos está cerrado por volumen. */
  deviatingAgents: { agentId: string; name: string; deviationPts: number }[];
  agentsGate: AgentsGate;
}

export interface AgentRow {
  agentId: string;
  name: string;
  calls: number;
  evaluated: number;
  aiPct: number;
  sheetPct: number | null;
  deviationPts: number;
  lowSample: boolean;
}

export interface AgentsTeam {
  calls: number;
  evaluated: number;
  aiPct: number;
  sheetPct: number | null;
  /** Ejecutivos con suficientes llamadas a ±equal pts del promedio. */
  withinRange: number;
  agentsWithEnough: number;
}

export interface AgentsPage {
  gate: AgentsGate;
  rows: AgentRow[];
  total: number;
  page: number;
  pageSize: number;
  team: AgentsTeam;
}

export interface AgentTrendPoint {
  periodId: string;
  calls: number;
  evaluated: number;
  aiPct: number;
  sheetPct: number | null;
  teamAiPct: number;
  lowSample: boolean;
}

export interface AgentDetail {
  agent: AgentRow;
  criteria: { criterionId: number; aiPct: number; sheetPct: number | null; deviationPts: number }[];
  showingAll: boolean;
  trend: AgentTrendPoint[];
}

export interface AgentMatrixCell {
  criterionId: number;
  aiPct: number;
  sheetPct: number | null;
  evaluated: number;
  deviationPts: number;
}

/** Mapa ejecutivo × criterio (E-2): mismo orden y página que la tabla de Ejecutivos. */
export interface AgentMatrix {
  gate: AgentsGate;
  criteria: { criterionId: number; blockId: string; teamAiPct: number; agentsOutside: number; dataExplained: boolean }[];
  rows: { agentId: string; name: string; calls: number; lowSample: boolean; cells: AgentMatrixCell[] }[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EvaluatorRow {
  name: string;
  evaluated: number;
  /** Criterios por llamada, promedio, en que no coincide con la IA (C-05). */
  disagreementPerCall: number;
  /** + estricto, − permisivo; criterios por llamada. */
  severityPerCall: number;
  vsTeam: number;
  lowSample: boolean;
}

export interface EvaluatorDetail {
  name: string;
  evaluated: number;
  /** Ordenados por cuánto más que el equipo no coincide con la IA (FA-2). */
  criteria: {
    criterionId: number;
    disagreementPct: number;
    severityPts: number;
    kappa: number | null;
    mismatchCalls: number;
    evaluated: number;
    teamDisagreementPct: number;
  }[];
  trend: { periodId: string; evaluated: number; disagreementPerCall: number; teamDisagreementPerCall: number; lowSample: boolean }[];
}

export interface EvaluatorMatrixCell {
  criterionId: number;
  mismatchCalls: number;
  disagreementPct: number;
  severityPts: number;
  lowSample: boolean;
}

/** Mapa auditor × criterio (A-2), solo Qubico (D-33). */
export interface EvaluatorMatrix {
  criteria: { criterionId: number; blockId: string; markedDifferent: boolean; teamDisagreementPct: number }[];
  team: { evaluated: number; disagreementPerCall: number };
  rows: { name: string; evaluated: number; disagreementPerCall: number; lowSample: boolean; cells: EvaluatorMatrixCell[] }[];
}

export interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  run: string;
  audience: ReportAudience;
}

export interface Report extends ReportMeta {
  bodyMd: string;
}

export interface AnalysisCall {
  caseId: string;
  callId: string;
  callDate: string;
  agentName: string;
  insuranceType: string;
  aiVerdict: "compliant" | "non_compliant" | "uncertain";
  sheetVerdict: "compliant" | "non_compliant" | null;
  /** De dónde sale «Según el auditor» en esta llamada (D-31). */
  reference: "auditor" | "sheet" | null;
  /** Con criterio: si cada fuente lo marcó No cumple. */
  aiFails: boolean;
  sheetFails: boolean | null;
  /** Minuto de la evidencia de la IA en el criterio pedido; null → sin evidencia. */
  evidenceMs: number | null;
}

export interface CallsPage {
  rows: AnalysisCall[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CallsQuery extends AnalysisFilters {
  criterion?: number;
  source?: AnalysisSource;
  agent?: string;
  evaluator?: string;
  page?: number;
}

export interface AnalysisApi {
  getAnalysisStatus(): Promise<AnalysisStatus>;
  getAnalysisSnapshot(): Promise<AnalysisSnapshotMeta>;
  listAnalysisCriteria(filters: AnalysisFilters): Promise<CriterionRow[]>;
  getAnalysisCriterion(id: number, filters: AnalysisFilters): Promise<CriterionDetail>;
  listAnalysisAgents(filters: AnalysisFilters & { criterion?: number; page?: number }): Promise<AgentsPage>;
  getAnalysisAgent(id: string, filters: AnalysisFilters & { all?: boolean }): Promise<AgentDetail>;
  listAnalysisEvaluators(filters: AnalysisFilters): Promise<EvaluatorRow[]>;
  getAnalysisEvaluator(name: string, filters: AnalysisFilters): Promise<EvaluatorDetail>;
  getAnalysisEvaluatorMatrix(filters: AnalysisFilters): Promise<EvaluatorMatrix>;
  getAnalysisAgentMatrix(filters: AnalysisFilters & { page?: number }): Promise<AgentMatrix>;
  listAnalysisReports(): Promise<ReportMeta[]>;
  getAnalysisReport(slug: string): Promise<Report>;
  listAnalysisCalls(query: CallsQuery): Promise<CallsPage>;
}
