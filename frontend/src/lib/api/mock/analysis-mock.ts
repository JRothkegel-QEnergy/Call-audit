/**
 * «Calidad del servicio» en el modo demo (F-9). 100 % sintético: llamadas, ejecutivos y evaluadores inventados con
 * una semilla fija; los cálculos replican `src/call_audit/analysis/compute.py` para que la demo se lea igual.
 * Con 240 llamadas y 8 ejecutivos, Ejecutivos sí se abre (a diferencia de la base local, C-02).
 */
import type {
  AgentDetail,
  AgentMatrix,
  AgentRow,
  AgentsGate,
  AgentsTeam,
  AgentTrendPoint,
  AnalysisApi,
  AnalysisCall,
  AnalysisFilters,
  AnalysisPeriod,
  AnalysisSnapshotMeta,
  CriterionDetail,
  CriterionRow,
  EvaluatorDetail,
  EvaluatorMatrix,
  EvaluatorRow,
  Report,
  ReportMeta,
} from "../analysis-types";
import { ApiError } from "../admin-types";
import type { User } from "../types";
import { AGENTS, RUBRIC, buildCalibrationCases } from "./data";

const CONFIG = { u: 15, equal: 2, low: 10, minAgents: 5, pageSize: 50, topCriteria: 10 };
const CRITERIA = Array.from({ length: 33 }, (_, i) => i + 1);
const DATA_EXPLAINED: Record<number, string> = {
  25: "Parte de la diferencia viene de los datos de la gestión: el sistema registra una fila por grabación aunque en la llamada se gestionen varios seguros. No refleja solo el trabajo del ejecutivo.",
};
const TYPES = ["Vida y salud", "Accidentes personales", "Incendio Hogar", "Sale Seguro"];
const EVALUATORS = ["Rosa Muñoz", "Pedro Alarcón", "Inés Fuentes", "Hugo Tapia"];
const EXTRA_AGENTS = [
  { id: "ag-107", name: "Paula Reyes" },
  { id: "ag-108", name: "Martín Díaz" },
];

interface Call {
  caseId: string;
  callId: string;
  callDate: string;
  agentId: string;
  agentName: string;
  evaluator: string | null;
  insuranceType: string;
  flow: string;
  ai: Set<number>;
  sheet: Set<number> | null;
  evidenceMs: Record<number, number>;
  aiVerdict: AnalysisCall["aiVerdict"];
  sheetVerdict: AnalysisCall["sheetVerdict"];
  reference: AnalysisCall["reference"];
}

/** Generador determinista (mulberry32): la demo muestra siempre las mismas cifras. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cache: Call[] | null = null;
function calls(): Call[] {
  if (cache) return cache;
  const rand = rng(17);
  const caseIds = buildCalibrationCases().map((c) => c.id);
  const agents = [...AGENTS.map((a) => ({ id: a.id, name: a.name })), ...EXTRA_AGENTS];
  // Tasa base por criterio, y criterios donde la planilla marca distinto (como el 18 y el 1 de la Fase 7).
  const base: Record<number, number> = Object.fromEntries(CRITERIA.map((c) => [c, 0.002 + rand() * 0.02]));
  base[25] = 0.12;
  base[18] = 0.08;
  base[1] = 0.07;
  // Cada auditor tiene su sesgo: dónde marca No cumple de más (estricto) o de menos (permisivo), para que el mapa
  // auditor × criterio tenga filas y columnas que leer (D-34).
  const strictOn: Record<string, number[]> = { "Pedro Alarcón": [6, 14, 31], "Hugo Tapia": [9], "Ana Pérez": [] };
  const lenientOn: Record<string, number[]> = { "Inés Fuentes": [13, 15], "Hugo Tapia": [27] };
  const out: Call[] = [];
  for (let i = 0; i < 240; i++) {
    const agent = agents[Math.floor(rand() * agents.length)];
    const agentBias = (agents.indexOf(agent) - 3) * 0.004;
    const evaluated = rand() < 0.7;
    // D-31: una parte de las evaluadas la revisó un auditor en la app; esas mandan sobre la planilla.
    const byAuditor = evaluated && rand() < 0.25;
    const evaluator = byAuditor ? "Ana Pérez" : evaluated ? EVALUATORS[Math.floor(rand() * EVALUATORS.length)] : null;
    // 90 días hacia atrás desde el 14 nov: los 3 tramos de la evolución tienen llamadas (D-36).
    const daysBack = (i * 37) % 90;
    const ai = new Set<number>();
    const sheet = new Set<number>();
    for (const c of CRITERIA) {
      // Las llamadas más antiguas traen algo más de No cumple: la evolución tiene algo que mostrar.
      const p = Math.max(0, base[c] + agentBias + (daysBack / 90) * 0.008);
      const aiFail = rand() < p;
      if (aiFail) ai.add(c);
      // La planilla coincide la mayoría de las veces; en el 18 y el 25 se separa bastante más.
      const flip = c === 18 || c === 25 ? 0.3 : c === 1 ? 0.2 : 0.008;
      let sheetFail = rand() < flip ? !aiFail : aiFail;
      if (evaluator && strictOn[evaluator]?.includes(c) && rand() < 0.3) sheetFail = true;
      if (evaluator && lenientOn[evaluator]?.includes(c) && aiFail && rand() < 0.7) sheetFail = false;
      if (sheetFail && !(c === 1 && rand() < 0.75)) sheet.add(c);
    }
    const date = new Date(Date.UTC(2026, 10, 14) - daysBack * 86_400_000);
    out.push({
      caseId: caseIds[i % caseIds.length],
      callId: `D-${String(2001 + i)}`,
      callDate: date.toISOString().slice(0, 10),
      agentId: agent.id,
      agentName: agent.name,
      evaluator,
      insuranceType: TYPES[Math.floor(rand() * TYPES.length)],
      flow: rand() < 0.8 ? "Entrante" : "Saliente",
      ai,
      sheet: evaluated ? sheet : null,
      evidenceMs: Object.fromEntries([...ai].map((c) => [c, Math.floor(20 + rand() * 200) * 1000])),
      aiVerdict: ai.size ? "non_compliant" : "compliant",
      sheetVerdict: evaluated ? (sheet.size ? "non_compliant" : "compliant") : null,
      reference: byAuditor ? "auditor" : evaluated ? "sheet" : null,
    });
  }
  cache = out;
  return out;
}

const pct = (part: number, whole: number) => (whole ? Math.round((1000 * part) / whole) / 10 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

function scoped(f: AnalysisFilters) {
  return calls().filter((c) => (!f.type || c.insuranceType === f.type) && (!f.flow || c.flow === f.flow));
}

const mismatch = (c: Call, cid: number) => c.ai.has(cid) !== c.sheet!.has(cid);

function numbers(cs: Call[], cid: number) {
  const ev = cs.filter((c) => c.sheet);
  const ai = pct(cs.filter((c) => c.ai.has(cid)).length, cs.length) ?? 0;
  const sheet = pct(ev.filter((c) => c.sheet!.has(cid)).length, ev.length);
  const mm = ev.filter((c) => mismatch(c, cid)).length;
  return {
    aiPct: ai,
    sheetPct: sheet,
    gapPts: sheet == null ? null : round1(sheet - ai),
    mismatchPct: pct(mm, ev.length),
    mismatchCalls: mm,
    base: { withRun: cs.length, evaluated: ev.length },
  };
}

function status(cs: Call[], cid: number, n: ReturnType<typeof numbers>): CriterionRow["status"] {
  if (DATA_EXPLAINED[cid]) return "data_explained";
  if (!n.base.evaluated) return "na";
  const byEval = new Map<string, Call[]>();
  for (const c of cs) if (c.sheet && c.evaluator) byEval.set(c.evaluator, [...(byEval.get(c.evaluator) ?? []), c]);
  const enough = [...byEval.values()].filter((x) => x.length >= CONFIG.low);
  if (enough.length) {
    const high = enough.filter((x) => (100 * x.filter((c) => mismatch(c, cid)).length) / x.length >= CONFIG.u).length;
    return high > enough.length / 2 ? "divergent" : "consistent";
  }
  return (n.mismatchPct ?? 0) >= CONFIG.u ? "divergent" : "consistent";
}

const blockOf = (cid: number) => RUBRIC.criteria[cid]?.blockId ?? "";

function criterionRow(cs: Call[], cid: number): CriterionRow {
  const n = numbers(cs, cid);
  return { criterionId: cid, blockId: blockOf(cid), ...n, status: status(cs, cid, n), dataExplainedNote: DATA_EXPLAINED[cid] ?? null };
}

const failsOn = (c: Call, cid?: number) => (cid == null ? c.ai.size > 0 : c.ai.has(cid));
const sheetFailsOn = (c: Call, cid?: number) => (cid == null ? c.sheet!.size > 0 : c.sheet!.has(cid));

function agentRows(cs: Call[], cid?: number): AgentRow[] {
  const team = pct(cs.filter((c) => failsOn(c, cid)).length, cs.length) ?? 0;
  const by = new Map<string, Call[]>();
  for (const c of cs) by.set(c.agentId, [...(by.get(c.agentId) ?? []), c]);
  return [...by.entries()]
    .map(([agentId, mine]) => {
      const ev = mine.filter((c) => c.sheet);
      const ai = pct(mine.filter((c) => failsOn(c, cid)).length, mine.length) ?? 0;
      return {
        agentId,
        name: mine[0].agentName,
        calls: mine.length,
        evaluated: ev.length,
        aiPct: ai,
        sheetPct: pct(ev.filter((c) => sheetFailsOn(c, cid)).length, ev.length),
        deviationPts: round1(ai - team),
        lowSample: mine.length < CONFIG.low,
      };
    })
    .sort((a, b) => Number(a.lowSample) - Number(b.lowSample) || b.deviationPts - a.deviationPts || a.name.localeCompare(b.name));
}

function gate(cs: Call[]): AgentsGate {
  const counts = new Map<string, number>();
  for (const c of cs) counts.set(c.agentId, (counts.get(c.agentId) ?? 0) + 1);
  const enough = [...counts.values()].filter((n) => n >= CONFIG.low).length;
  return { open: enough >= CONFIG.minAgents, agentsWithEnough: enough, totalAgents: counts.size };
}

function kappa(pairs: [boolean, boolean][]): number | null {
  const n = pairs.length;
  if (!n) return null;
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pa = pairs.filter(([a]) => a).length / n;
  const pb = pairs.filter(([, b]) => b).length / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  return pe >= 1 ? null : Math.round(((po - pe) / (1 - pe)) * 100) / 100;
}

let currentUser: () => User | null = () => null;
export function bindAnalysisUser(fn: () => User | null) {
  currentUser = fn;
}
const isQubico = () => ["qubico_admin", "qubico_viewer"].includes(currentUser()?.role ?? "");
function onlyQubico() {
  if (!isQubico()) throw new ApiError("not_found");
}

const REPORTS: Report[] = [
  {
    slug: "patrones-menos-rechazo",
    title: "Qué hacen distinto los ejecutivos con menos No cumple",
    date: "2026-11-17",
    run: "v2.10",
    audience: "company",
    bodyMd:
      "## Resumen\n\nInforme de ejemplo para la demo, con datos sintéticos.\n\n- **Siguen el guion** de acreditación y cierre sin saltarse pasos.\n- **Validan la información** del seguro antes de ofrecer alternativas.\n- **Indagan** el criterio mientras el sistema carga.\n- **Piden confirmar el resumen** del cierre.\n\n> Son hallazgos para conversar con el equipo, no una evaluación individual.",
  },
  {
    slug: "calibracion-evaluadores",
    title: "Calibración de evaluadores · notas internas",
    date: "2026-11-16",
    run: "v2.9",
    audience: "internal",
    bodyMd: "## Notas internas\n\nSolo para Qubico. Datos sintéticos de la demo.",
  },
];

const wait = <T,>(fn: () => T, ms = 200) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(structuredClone(fn()));
      } catch (e) {
        reject(e);
      }
    }, ms),
  );

/** Igual que `compute.periods_of`: 3 tramos de 30 días hacia atrás desde el fin de la foto. */
function periodsOf(periodTo: string, periodDays: number): AnalysisPeriod[] {
  if (periodDays < 60) return [];
  const end = Date.parse(`${periodTo.slice(0, 10)}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return [2, 1, 0].map((i, k) => {
    const to = end - 30 * i * 86_400_000;
    return { id: `p${k + 1}`, from: iso(to - 29 * 86_400_000), to: iso(to) };
  });
}

const inPeriod = (cs: Call[], p: AnalysisPeriod) => cs.filter((c) => p.from <= c.callDate && c.callDate <= p.to);
const periods = () => meta().periods;

const reviewed = (cs: Call[]) => cs.filter((c) => c.sheet && c.evaluator);
const disagreementPerCall = (cs: Call[]) =>
  cs.length ? cs.reduce((s, c) => s + CRITERIA.filter((cid) => mismatch(c, cid)).length, 0) / cs.length : 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

function evaluatorCell(cs: Call[], cid: number) {
  const pairs = cs.map((c) => [c.ai.has(cid), c.sheet!.has(cid)] as [boolean, boolean]);
  const sheetOnly = pairs.filter(([a, b]) => b && !a).length;
  const aiOnly = pairs.filter(([a, b]) => a && !b).length;
  return {
    criterionId: cid,
    mismatchCalls: sheetOnly + aiOnly,
    evaluated: cs.length,
    disagreementPct: pct(sheetOnly + aiOnly, cs.length) ?? 0,
    severityPts: cs.length ? round1((100 * (sheetOnly - aiOnly)) / cs.length) : 0,
    kappa: kappa(pairs),
  };
}
const teamDisagreementPct = (team: Call[], cid: number) => pct(team.filter((c) => mismatch(c, cid)).length, team.length) ?? 0;

function evaluatorRows(cs: Call[]): EvaluatorRow[] {
  const ev = reviewed(cs);
  const perCall = (x: Call[]) => {
    const severity =
      x.reduce((s, c) => s + [...c.sheet!].filter((k) => !c.ai.has(k)).length - [...c.ai].filter((k) => !c.sheet!.has(k)).length, 0) / x.length;
    return [disagreementPerCall(x), severity] as const;
  };
  const team = disagreementPerCall(ev);
  const by = new Map<string, Call[]>();
  for (const c of ev) by.set(c.evaluator!, [...(by.get(c.evaluator!) ?? []), c]);
  return [...by.entries()]
    .map(([name, x]) => {
      const [d, s] = perCall(x);
      return { name, evaluated: x.length, disagreementPerCall: round2(d), severityPerCall: round2(s), vsTeam: round2(d - team), lowSample: x.length < CONFIG.low };
    })
    .sort((a, b) => Number(a.lowSample) - Number(b.lowSample) || b.disagreementPerCall - a.disagreementPerCall || a.name.localeCompare(b.name));
}

function agentsTeam(cs: Call[], cid?: number): AgentsTeam {
  const ev = cs.filter((c) => c.sheet);
  const rows = agentRows(cs, cid).filter((r) => !r.lowSample);
  return {
    calls: cs.length,
    evaluated: ev.length,
    aiPct: pct(cs.filter((c) => failsOn(c, cid)).length, cs.length) ?? 0,
    sheetPct: pct(ev.filter((c) => sheetFailsOn(c, cid)).length, ev.length),
    withinRange: rows.filter((r) => Math.abs(r.deviationPts) <= CONFIG.equal).length,
    agentsWithEnough: rows.length,
  };
}

function agentTrend(cs: Call[], agentId: string): AgentTrendPoint[] {
  return periods().map((p) => {
    const everyone = inPeriod(cs, p);
    const mine = everyone.filter((c) => c.agentId === agentId);
    const ev = mine.filter((c) => c.sheet);
    return {
      periodId: p.id,
      calls: mine.length,
      evaluated: ev.length,
      aiPct: pct(mine.filter((c) => c.ai.size).length, mine.length) ?? 0,
      sheetPct: pct(ev.filter((c) => c.sheet!.size).length, ev.length),
      teamAiPct: pct(everyone.filter((c) => c.ai.size).length, everyone.length) ?? 0,
      lowSample: mine.length < CONFIG.low,
    };
  });
}

const meta = (): AnalysisSnapshotMeta => {
  const cs = calls();
  const dates = cs.map((c) => c.callDate).sort();
  return {
    id: "demo",
    createdAt: "2026-11-17T09:00:00-03:00",
    periodFrom: dates[0],
    periodTo: dates[dates.length - 1],
    periodDays: 90,
    periods: periodsOf(dates[dates.length - 1], 90),
    sheetUntil: dates[dates.length - 1],
    reference: { auditor: cs.filter((c) => c.reference === "auditor").length, sheet: cs.filter((c) => c.reference === "sheet").length },
    runs: { perCall: "v2.10", perCriterion: "v2.10" },
    lastProcessedAt: "2026-11-17T08:40:00-03:00",
    filters: { insuranceTypes: [...TYPES].sort(), flows: ["Entrante", "Saliente"] },
    config: CONFIG,
  };
};

export const analysisMock: AnalysisApi = {
  getAnalysisStatus: () => wait(() => ({ hasSnapshot: true, lastProcessedAt: meta().lastProcessedAt })),
  getAnalysisSnapshot: () => wait(meta),
  listAnalysisCriteria: (f) =>
    wait(() => {
      onlyQubico(); // D-41
      const cs = scoped(f);
      if (!cs.length) return [];
      return CRITERIA.map((cid) => criterionRow(cs, cid)).sort(
        (a, b) => (b.mismatchPct ?? -1) - (a.mismatchPct ?? -1) || a.criterionId - b.criterionId,
      );
    }),
  getAnalysisCriterion: (id, f) =>
    wait((): CriterionDetail => {
      onlyQubico();
      if (!CRITERIA.includes(id)) throw new ApiError("not_found");
      const cs = scoped(f);
      const types = [...new Set(cs.map((c) => c.insuranceType))].sort();
      const g = gate(cs);
      const deviating = g.open
        ? agentRows(cs, id)
            .filter((r) => !r.lowSample && Math.abs(r.deviationPts) > CONFIG.equal)
            .sort((a, b) => Math.abs(b.deviationPts) - Math.abs(a.deviationPts))
            .slice(0, 10)
            .map(({ agentId, name, deviationPts }) => ({ agentId, name, deviationPts }))
        : [];
      return {
        ...criterionRow(cs, id),
        byInsuranceType: types.map((t) => {
          const sub = cs.filter((c) => c.insuranceType === t);
          const n = numbers(sub, id);
          return { insuranceType: t, calls: sub.length, aiPct: n.aiPct, sheetPct: n.sheetPct, mismatchPct: n.mismatchPct, lowSample: sub.length < CONFIG.low };
        }),
        deviatingAgents: deviating,
        agentsGate: g,
      };
    }),
  listAnalysisAgents: (f) =>
    wait(() => {
      const cs = scoped(f);
      const rows = agentRows(cs, f.criterion);
      const page = Math.max(1, f.page ?? 1);
      const start = (page - 1) * CONFIG.pageSize;
      return {
        gate: gate(cs),
        rows: rows.slice(start, start + CONFIG.pageSize),
        total: rows.length,
        page,
        pageSize: CONFIG.pageSize,
        team: agentsTeam(cs, f.criterion),
      };
    }),
  getAnalysisAgentMatrix: (f) =>
    wait((): AgentMatrix => {
      const cs = scoped(f);
      const g = gate(cs);
      const rows = agentRows(cs);
      const teamAi = Object.fromEntries(CRITERIA.map((cid) => [cid, pct(cs.filter((c) => c.ai.has(cid)).length, cs.length) ?? 0]));
      const cells = new Map(
        rows.map((r) => {
          const mine = cs.filter((c) => c.agentId === r.agentId);
          const ev = mine.filter((c) => c.sheet);
          return [
            r.agentId,
            CRITERIA.map((cid) => {
              const ai = pct(mine.filter((c) => c.ai.has(cid)).length, mine.length) ?? 0;
              return {
                criterionId: cid,
                aiPct: ai,
                sheetPct: pct(ev.filter((c) => c.sheet!.has(cid)).length, ev.length),
                evaluated: ev.length,
                deviationPts: round1(ai - teamAi[cid]),
              };
            }),
          ];
        }),
      );
      const enough = rows.filter((r) => !r.lowSample);
      const page = Math.max(1, f.page ?? 1);
      const start = (page - 1) * CONFIG.pageSize;
      return {
        gate: g,
        criteria: CRITERIA.map((cid, i) => ({
          criterionId: cid,
          blockId: blockOf(cid),
          teamAiPct: teamAi[cid],
          agentsOutside: enough.filter((r) => Math.abs(cells.get(r.agentId)![i].deviationPts) > CONFIG.equal).length,
          dataExplained: !!DATA_EXPLAINED[cid],
        })),
        rows: g.open
          ? rows.slice(start, start + CONFIG.pageSize).map((r) => ({
              agentId: r.agentId,
              name: r.name,
              calls: r.calls,
              lowSample: r.lowSample,
              cells: cells.get(r.agentId)!,
            }))
          : [],
        total: rows.length,
        page,
        pageSize: CONFIG.pageSize,
      };
    }),
  getAnalysisAgent: (id, f) =>
    wait((): AgentDetail => {
      const cs = scoped(f);
      const mine = cs.filter((c) => c.agentId === id);
      if (!mine.length) throw new ApiError("not_found");
      const agent = agentRows(cs).find((r) => r.agentId === id)!;
      const ev = mine.filter((c) => c.sheet);
      const criteria = CRITERIA.map((cid) => {
        const team = pct(cs.filter((c) => c.ai.has(cid)).length, cs.length) ?? 0;
        const ai = pct(mine.filter((c) => c.ai.has(cid)).length, mine.length) ?? 0;
        return { criterionId: cid, aiPct: ai, sheetPct: pct(ev.filter((c) => c.sheet!.has(cid)).length, ev.length), deviationPts: round1(ai - team) };
      }).sort(
        (a, b) =>
          Number(!!DATA_EXPLAINED[a.criterionId]) - Number(!!DATA_EXPLAINED[b.criterionId]) ||
          b.deviationPts - a.deviationPts ||
          a.criterionId - b.criterionId,
      );
      return {
        agent,
        criteria: f.all ? criteria : criteria.slice(0, CONFIG.topCriteria),
        showingAll: !!f.all,
        trend: agentTrend(cs, id),
      };
    }),
  listAnalysisEvaluators: (f) =>
    wait((): EvaluatorRow[] => {
      onlyQubico();
      return evaluatorRows(scoped(f));
    }),
  getAnalysisEvaluatorMatrix: (f) =>
    wait((): EvaluatorMatrix => {
      onlyQubico();
      const cs = scoped(f);
      const team = reviewed(cs);
      const rows = evaluatorRows(cs).map((r) => {
        const mine = team.filter((c) => c.evaluator === r.name);
        return {
          name: r.name,
          evaluated: r.evaluated,
          disagreementPerCall: r.disagreementPerCall,
          lowSample: r.lowSample,
          cells: CRITERIA.map((cid) => {
            const { criterionId, mismatchCalls, disagreementPct, severityPts } = evaluatorCell(mine, cid);
            return { criterionId, mismatchCalls, disagreementPct, severityPts, lowSample: r.lowSample };
          }),
        };
      });
      const enough = rows.filter((r) => !r.lowSample);
      return {
        criteria: CRITERIA.map((cid, i) => {
          const high = enough.filter((r) => r.cells[i].disagreementPct >= CONFIG.u).length;
          return {
            criterionId: cid,
            blockId: blockOf(cid),
            markedDifferent: enough.length > 0 && high > enough.length / 2 && !DATA_EXPLAINED[cid],
            teamDisagreementPct: teamDisagreementPct(team, cid),
          };
        }),
        team: { evaluated: team.length, disagreementPerCall: round2(disagreementPerCall(team)) },
        rows,
      };
    }),
  getAnalysisEvaluator: (name, f) =>
    wait((): EvaluatorDetail => {
      onlyQubico();
      const team = reviewed(scoped(f));
      const cs = team.filter((c) => c.evaluator === name);
      if (!cs.length) throw new ApiError("not_found");
      const criteria = CRITERIA.map((cid) => ({ ...evaluatorCell(cs, cid), teamDisagreementPct: teamDisagreementPct(team, cid) })).sort(
        (a, b) => b.disagreementPct - b.teamDisagreementPct - (a.disagreementPct - a.teamDisagreementPct) || a.criterionId - b.criterionId,
      );
      const trend = periods().map((p) => {
        const mine = inPeriod(cs, p);
        return {
          periodId: p.id,
          evaluated: mine.length,
          disagreementPerCall: round2(disagreementPerCall(mine)),
          teamDisagreementPerCall: round2(disagreementPerCall(inPeriod(team, p))),
          lowSample: mine.length < CONFIG.low,
        };
      });
      return { name, evaluated: cs.length, criteria, trend };
    }),
  listAnalysisReports: () =>
    wait((): ReportMeta[] =>
      REPORTS.filter((r) => isQubico() || r.audience === "company").map(({ slug, title, date, run, audience }) => ({ slug, title, date, run, audience })),
    ),
  getAnalysisReport: (slug) =>
    wait(() => {
      const r = REPORTS.find((x) => x.slug === slug);
      if (!r || (r.audience !== "company" && !isQubico())) throw new ApiError("not_found");
      return r;
    }),
  listAnalysisCalls: (q) =>
    wait(() => {
      if (q.evaluator) onlyQubico();
      let rows = scoped(q);
      if (q.agent) rows = rows.filter((c) => c.agentId === q.agent);
      if (q.evaluator) rows = rows.filter((c) => c.evaluator === q.evaluator);
      const cid = q.criterion;
      if (cid != null) {
        if (q.source === "sheet") rows = rows.filter((c) => c.sheet?.has(cid));
        else if (q.source === "mismatch") rows = rows.filter((c) => c.sheet && mismatch(c, cid));
        else rows = rows.filter((c) => c.ai.has(cid));
      }
      rows = [...rows].sort((a, b) => b.callDate.localeCompare(a.callDate) || b.callId.localeCompare(a.callId));
      const page = Math.max(1, q.page ?? 1);
      const start = (page - 1) * CONFIG.pageSize;
      return {
        rows: rows.slice(start, start + CONFIG.pageSize).map(
          (c): AnalysisCall => ({
            caseId: c.caseId,
            callId: c.callId,
            callDate: c.callDate,
            agentName: c.agentName,
            insuranceType: c.insuranceType,
            aiVerdict: c.aiVerdict,
            sheetVerdict: c.sheetVerdict,
            reference: c.reference,
            aiFails: cid != null && c.ai.has(cid),
            sheetFails: c.sheet == null || cid == null ? null : c.sheet.has(cid),
            evidenceMs: cid != null ? (c.evidenceMs[cid] ?? null) : null,
          }),
        ),
        total: rows.length,
        page,
        pageSize: CONFIG.pageSize,
      };
    }),
};
