/**
 * «Calidad de la IA» en el modo demo (Cambio 15). 100 % sintético y determinístico: 4 modelos, dos corridas del mismo
 * modelo, una prueba desde la app y 4 llamadas sin marca por motivo, para cubrir los estados de §7.4.
 */
import type { AiQuality, QualityCall, QualitySeries } from "../admin-types";
import type { CallVerdict } from "../types";
import { RUBRIC } from "./data";

/** Casos que existen en la demo: la lista de desacuerdos abre uno de estos (el ID de llamada es sintético). */
const CASE_IDS = ["c-0412", "c-0431", "c-0445", "c-0477", "c-0502", "c-0511", "c-0519"];
const COMMON = [14, 28, 31, 33, 13, 15, 3, 9, 18, 21, 29, 6];
const CALLS = 80;

/** PRNG con semilla (mulberry32): la demo muestra siempre los mismos números. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Skill {
  series: Omit<QualitySeries, "calls">;
  /** Probabilidad de marcar No cumple una llamada No cumple, y de marcar cada motivo del cliente. */
  detect: number;
  /** Probabilidad de marcar No cumple una llamada Cumple. */
  falseAlarm: number;
  /** Probabilidad de agregar un motivo que el cliente no marcó. */
  extra: number;
  /** Llamadas sin resultado (error del modelo). */
  missing?: number[];
}

const base = {
  source: "run" as const,
  isCurrent: false,
  unvalidatedQuoteRate: 1.2,
};
const SKILLS: Skill[] = [
  {
    series: {
      ...base,
      id: "run:gemini-demo:v2.10",
      model: "gemini-demo",
      modelLabel: "Gemini (demo)",
      colorIndex: 0,
      promptVersion: "2.10",
      runLabel: "v2.10",
      isCurrent: true,
      ranAt: "2026-10-20T05:55:00",
      costPerCallUsd: 0.0041,
    },
    detect: 0.9,
    falseAlarm: 0.04,
    extra: 0.15,
  },
  {
    series: {
      ...base,
      id: "run:gemini-demo:v2.7",
      model: "gemini-demo",
      modelLabel: "Gemini (demo)",
      colorIndex: 0,
      promptVersion: "2.7",
      runLabel: "v2.7",
      ranAt: "2026-10-12T05:40:00",
      costPerCallUsd: 0.0039,
    },
    detect: 0.82,
    falseAlarm: 0.08,
    extra: 0.2,
  },
  {
    series: {
      ...base,
      id: "run:gemini-demo:v2.7 corrida 2",
      model: "gemini-demo",
      modelLabel: "Gemini (demo)",
      colorIndex: 0,
      promptVersion: "2.7",
      runLabel: "v2.7 corrida 2",
      ranAt: "2026-10-13T05:40:00",
      costPerCallUsd: 0.004,
    },
    detect: 0.8,
    falseAlarm: 0.1,
    extra: 0.2,
  },
  {
    series: {
      ...base,
      id: "run:sonnet-demo:v2.8",
      model: "sonnet-demo",
      modelLabel: "Sonnet (demo)",
      colorIndex: 1,
      promptVersion: "2.8",
      runLabel: "v2.8",
      ranAt: "2026-10-16T06:10:00",
      costPerCallUsd: 0.031,
      unvalidatedQuoteRate: 0.6,
    },
    detect: 0.88,
    falseAlarm: 0.06,
    extra: 0.1,
  },
  {
    series: {
      ...base,
      id: "run:luna-demo:v2.8",
      model: "luna-demo",
      modelLabel: "Luna (demo)",
      colorIndex: 2,
      promptVersion: "2.8",
      runLabel: "v2.8",
      ranAt: "2026-10-16T06:20:00",
      costPerCallUsd: 0.012,
      unvalidatedQuoteRate: 2.4,
    },
    detect: 0.8,
    falseAlarm: 0.1,
    extra: 0.25,
    missing: [7, 41],
  },
  {
    series: {
      ...base,
      id: "run:haiku-demo:v2.8",
      model: "haiku-demo",
      modelLabel: "Haiku (demo)",
      colorIndex: 3,
      promptVersion: "2.8",
      runLabel: "v2.8",
      ranAt: "2026-10-16T06:30:00",
      costPerCallUsd: 0.009,
      unvalidatedQuoteRate: 3.1,
    },
    detect: 0.84,
    falseAlarm: 0.22,
    extra: 0.3,
  },
  {
    series: {
      ...base,
      id: "test:demo-2-11",
      model: "gemini-demo",
      modelLabel: "Gemini (demo)",
      colorIndex: 0,
      promptVersion: "2.11",
      runLabel: "Prueba v2.11",
      source: "prompt_test",
      ranAt: "2026-10-28T15:02:00",
      costPerCallUsd: 0.0043,
      unvalidatedQuoteRate: 0.9,
    },
    detect: 0.92,
    falseAlarm: 0.04,
    extra: 0.12,
  },
];

function pick<T>(r: () => number, items: T[]): T {
  return items[Math.floor(r() * items.length)];
}

export function mockAiQuality(): AiQuality {
  const r = rng(15);
  const calls: QualityCall[] = Array.from({ length: CALLS }, (_, i) => {
    const bad = r() < 0.48;
    const fails = bad ? [...new Set(Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(r, COMMON)))].sort((a, b) => a - b) : [];
    return {
      caseId: CASE_IDS[i % CASE_IDS.length],
      callId: String(10400 + i * 7),
      callDate: `2026-10-${String(10 + (i % 18)).padStart(2, "0")}`,
      clientVerdict: bad ? "non_compliant" : "compliant",
      // 4 llamadas sin la marca por motivo en el Excel (D-55).
      clientFails: i % 20 === 19 ? null : fails,
      results: {},
    };
  });
  for (const [k, skill] of SKILLS.entries()) {
    const sr = rng(100 + k);
    calls.forEach((call, i) => {
      if (skill.missing?.includes(i)) {
        call.results[skill.series.id] = null;
        return;
      }
      const truth = call.clientFails ?? [];
      let failCriteria: number[] = [];
      if (call.clientVerdict === "non_compliant") {
        // Primero se decide si detecta la llamada; después, cuáles de los motivos del cliente encuentra.
        if (sr() < skill.detect) {
          failCriteria = truth.filter(() => sr() < skill.detect);
          if (failCriteria.length === 0) failCriteria = [truth[0] ?? pick(sr, COMMON)];
        }
      } else if (sr() < skill.falseAlarm) {
        failCriteria = [pick(sr, COMMON)];
      }
      if (failCriteria.length && sr() < skill.extra) failCriteria.push(pick(sr, COMMON));
      failCriteria = [...new Set(failCriteria)].sort((a, b) => a - b);
      const verdict: CallVerdict = failCriteria.length ? (sr() < 0.08 ? "uncertain" : "non_compliant") : "compliant";
      call.results[skill.series.id] = { verdict, failCriteria };
    });
  }
  return {
    series: SKILLS.map((s) => ({
      ...s.series,
      calls: calls.filter((c) => c.results[s.series.id]).length,
    })),
    calls,
    criteria: Object.values(RUBRIC.criteria)
      .map((c) => ({
        id: c.id,
        name: c.name,
        minor: false,
        byCode: c.id === 1,
        partial: c.id >= 19 && c.id <= 25,
      }))
      .sort((a, b) => a.id - b.id),
    goals: { falsePositivePct: 5, falseNegativePct: 20 },
    promptTestRunning: null,
  };
}
