/**
 * Métricas de «Calidad de la IA» (Cambio 15, H-99): se calculan en el front desde los datos por llamada, igual que el
 * dashboard local. Referencia: el veredicto y la marca por motivo del auditor del cliente (H-94).
 * Una llamada Dudosa de la IA cuenta como No cumple: en operación igual llega a un auditor (H-87).
 */
import type { AiQuality, QualityCall, QualitySeries } from "./api/admin-types";

/** Meta de detección: equivale a falsos negativos ≤ 20 % (H-101). */
export const detectionGoal = (q: AiQuality) => 100 - q.goals.falseNegativePct;

export interface SeriesMetrics {
  /** Llamadas con resultado de esta corrida. */
  n: number;
  /** Llamadas que la corrida no tiene (sin resultado o no las corrió). */
  missing: number;
  bad: number;
  ok: number;
  detected: number;
  missed: number;
  falsePositives: number;
  trueNegatives: number;
  uncertain: number;
  detectionPct: number;
  falsePositivePct: number;
  falseNegativePct: number;
  balancedPct: number;
  agreementPct: number;
}

const rate = (k: number, n: number) => (n ? (100 * k) / n : 0);
export const rejects = (verdict: string) => verdict !== "compliant";

export function seriesMetrics(series: QualitySeries, calls: QualityCall[]): SeriesMetrics {
  let bad = 0,
    ok = 0,
    detected = 0,
    falsePositives = 0,
    uncertain = 0,
    missing = 0;
  for (const c of calls) {
    const r = c.results[series.id];
    if (!r) {
      missing += 1;
      continue;
    }
    if (r.verdict === "uncertain") uncertain += 1;
    if (c.clientVerdict === "non_compliant") {
      bad += 1;
      if (rejects(r.verdict)) detected += 1;
    } else {
      ok += 1;
      if (rejects(r.verdict)) falsePositives += 1;
    }
  }
  const detectionPct = rate(detected, bad);
  const falsePositivePct = rate(falsePositives, ok);
  return {
    n: bad + ok,
    missing,
    bad,
    ok,
    detected,
    missed: bad - detected,
    falsePositives,
    trueNegatives: ok - falsePositives,
    uncertain,
    detectionPct,
    falsePositivePct,
    falseNegativePct: bad ? 100 - detectionPct : 0,
    balancedPct: (detectionPct + (100 - falsePositivePct)) / 2,
    agreementPct: rate(detected + ok - falsePositives, bad + ok),
  };
}

/** Lo que el cliente marcó por motivo. Una llamada Cumple no tiene motivos incumplidos aunque el Excel no traiga
 * las columnas; una No cumple sin marca por motivo queda sin referencia (null). */
export function clientMarks(call: QualityCall): number[] | null {
  if (call.clientFails) return call.clientFails;
  return call.clientVerdict === "compliant" ? [] : null;
}

export interface CallDiff {
  call: QualityCall;
  aiVerdict: string;
  verdictDiffers: boolean;
  /** La IA marca un motivo que el cliente no marcó. */
  aiOnly: number[];
  /** El cliente marcó un motivo que la IA no marcó. */
  missed: number[];
}

export function callDiff(call: QualityCall, seriesId: string): CallDiff | null {
  const r = call.results[seriesId];
  if (!r) return null;
  const truth = clientMarks(call);
  const ai = new Set(r.failCriteria);
  return {
    call,
    aiVerdict: r.verdict,
    verdictDiffers: rejects(r.verdict) !== (call.clientVerdict === "non_compliant"),
    aiOnly: truth ? r.failCriteria.filter((c) => !truth.includes(c)) : [],
    missed: truth ? truth.filter((c) => !ai.has(c)) : [],
  };
}

export interface CriterionCell {
  /** Cumple según el cliente: llamadas donde la IA marca el motivo. */
  aiOnlyOnCompliant: number;
  /** No cumple según el cliente (con marca por motivo): marcas del cliente que la IA también marca. */
  detected: number;
  /** No cumple: la IA lo marca y el cliente no («+n»). */
  extra: number;
}

export interface CriterionRow {
  id: number;
  /** Llamadas No cumple (con marca por motivo) donde el cliente marcó el motivo. */
  clientCount: number;
  cells: Record<string, CriterionCell>;
}

export function criterionRows(q: AiQuality, series: QualitySeries[]): CriterionRow[] {
  return q.criteria
    .map((crit) => {
      const cells: Record<string, CriterionCell> = {};
      for (const s of series) cells[s.id] = { aiOnlyOnCompliant: 0, detected: 0, extra: 0 };
      let clientCount = 0;
      for (const c of q.calls) {
        const marked = c.clientFails?.includes(crit.id) ?? false;
        if (c.clientVerdict === "non_compliant" && c.clientFails && marked) clientCount += 1;
        for (const s of series) {
          const r = c.results[s.id];
          if (!r) continue;
          const ai = r.failCriteria.includes(crit.id);
          if (c.clientVerdict === "compliant") {
            if (ai) cells[s.id].aiOnlyOnCompliant += 1;
          } else if (c.clientFails) {
            if (ai && marked) cells[s.id].detected += 1;
            if (ai && !marked) cells[s.id].extra += 1;
          }
        }
      }
      return { id: crit.id, clientCount, cells };
    })
    .filter((row) => row.clientCount > 0 || Object.values(row.cells).some((c) => c.aiOnlyOnCompliant + c.detected + c.extra > 0));
}

/** Corridas por defecto (H-93): la vigente y la más reciente de cada otro modelo, hasta 6. */
export function defaultSeries(series: QualitySeries[]): string[] {
  const current = series.find((s) => s.isCurrent);
  const picked = current ? [current.id] : [];
  const byModel = new Map<string, QualitySeries>();
  for (const s of series) {
    if (s.source !== "run" || s.model === current?.model) continue;
    const prev = byModel.get(s.model);
    if (!prev || (s.ranAt ?? "") > (prev.ranAt ?? "")) byModel.set(s.model, s);
  }
  picked.push(...[...byModel.values()].map((s) => s.id));
  if (picked.length === 0 && series[0]) picked.push(series[0].id);
  return picked.slice(0, MAX_SERIES);
}

export const MAX_SERIES = 6;

export function seriesName(s: QualitySeries): string {
  const run = s.source === "prompt_test" ? s.runLabel : s.runLabel.replace(/^v[\d.]+\s*/, "") || null;
  return [s.modelLabel, `v${s.promptVersion}`, s.source === "prompt_test" ? "prueba" : run].filter(Boolean).join(" · ");
}
