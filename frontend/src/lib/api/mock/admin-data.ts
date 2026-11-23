/**
 * Datos sintéticos del Administrador Qubico (Cambio 10): cuentas de todos los roles,
 * registro de versiones del prompt y estadísticas del sistema. Nada sale de datos reales.
 */
import type { AdminStats, PromptEvaluation, PromptSection, PromptVersion, UserAccount } from "../types";

export const CLIENT = { id: "becs", name: "BancoEstado Corredores de Seguros" };

export const USER_ACCOUNTS: UserAccount[] = [
  { id: "u-adm-1", name: "Admin Qubico (demo)", email: "admin@qubico-ejemplo.cl", role: "qubico_admin", status: "active", loginMethod: "password", mfa: "active", permissions: [], lastLoginAt: "2026-10-22T08:10:00", createdBy: "Script inicial", createdAt: "2026-10-01T09:00:00" },
  { id: "u-sup-1", name: "Jorge Lagos", email: "jorge.lagos@empresa-ejemplo.cl", role: "supervisor", status: "active", loginMethod: "password", mfa: "active", permissions: [], lastLoginAt: "2026-10-21T17:40:00", createdBy: "Admin Qubico (demo)", createdAt: "2026-10-02T10:00:00" },
  { id: "u-aud-1", name: "Ana Pérez", email: "ana.perez@empresa-ejemplo.cl", role: "auditor", status: "active", loginMethod: "password", mfa: "active", permissions: ["view_model_io"], lastLoginAt: "2026-10-22T08:30:00", createdBy: "Jorge Lagos", createdAt: "2026-10-03T09:00:00" },
  { id: "u-aud-2", name: "Luis Muñoz", email: "luis.munoz@empresa-ejemplo.cl", role: "auditor", status: "active", loginMethod: "password", mfa: "pending", permissions: [], lastLoginAt: "2026-10-21T12:05:00", createdBy: "Jorge Lagos", createdAt: "2026-10-03T09:05:00" },
  { id: "u-aud-3", name: "Sofía Reyes", email: "sofia.reyes@empresa-ejemplo.cl", role: "auditor", status: "invited", loginMethod: "password", mfa: "pending", permissions: [], lastLoginAt: null, createdBy: "Jorge Lagos", createdAt: "2026-10-20T15:00:00" },
  { id: "u-aud-4", name: "Pablo Torres", email: "pablo.torres@empresa-ejemplo.cl", role: "auditor", status: "deactivated", loginMethod: "password", mfa: "active", permissions: [], lastLoginAt: "2026-10-10T11:00:00", createdBy: "Jorge Lagos", createdAt: "2026-10-03T09:10:00" },
];

const BASE_SECTIONS: PromptSection[] = [
  {
    title: "System",
    text: [
      "Eres un auditor de calidad de llamadas de retención de seguros.",
      "Evalúas la transcripción contra la pauta de 33 motivos de no calidad.",
      "Respondes solo con JSON válido según el esquema.",
      "Cada hallazgo lleva una cita literal de la transcripción con su minuto.",
      "(Texto sintético de la demo.)",
    ].join("\n"),
  },
  {
    title: "Reglas de revisión",
    text: [
      "1. Un motivo incumple solo si hay evidencia explícita en la transcripción.",
      "2. Si la evidencia es ambigua, marca el motivo como dudoso y explica por qué.",
      "3. Verifica las frases exactas del protocolo de cierre.",
      "4. Para la retención, evalúa el contexto de los turnos siguientes antes de decidir.",
      "5. Compara lo dicho por el ejecutivo con la ficha del seguro.",
    ].join("\n"),
  },
  {
    title: "Plantilla del mensaje",
    text: ["Metadatos: {metadatos_del_caso}", "Seguros: {fichas_de_seguro}", "Transcripción (anonimizada): {transcripcion}"].join("\n"),
  },
];

function withRule(extra: string[]): PromptSection[] {
  return BASE_SECTIONS.map((s) => (s.title === "Reglas de revisión" ? { ...s, text: [s.text, ...extra].join("\n") } : s));
}

export function evaluation(version: string, match: number, extra = 0): PromptEvaluation {
  return {
    version,
    status: "done",
    startedAt: "2026-10-18T10:00:00",
    finishedAt: "2026-10-18T10:20:00",
    references: [
      { kind: "client", n: 100, matchRate: match, uncertainRate: 6 - extra, aiOnlyFail: 21 - extra * 3, aiMissedFail: 9, unvalidatedQuoteRate: 3.1 },
      { kind: "app_auditors", n: 42, matchRate: match + 8, uncertainRate: 5, aiOnlyFail: 6, aiMissedFail: 3, unvalidatedQuoteRate: 2.4 },
    ],
    costPerCallUsd: 0.0041 + extra * 0.0002,
    latencyMsP50: 1700 + extra * 50,
    latencyMsP95: 3200 + extra * 80,
    byCriterion: [
      { criterionId: 28, matchRate: match - 6 + extra * 2 },
      { criterionId: 13, matchRate: match + 9 },
      { criterionId: 3, matchRate: match - 2 + extra },
      { criterionId: 18, matchRate: match - 12 + extra * 3 },
    ],
  };
}

export interface PromptRecord {
  meta: PromptVersion;
  sections: PromptSection[];
  evaluation: PromptEvaluation | null;
  history: { at: string; actor: string; action: string }[];
}

const v = (
  version: string,
  status: PromptVersion["status"],
  changelog: string,
  createdAt: string,
  extra: Partial<PromptVersion> = {},
): PromptVersion => ({
  version,
  status,
  model: "Gemini (demo)",
  changelog,
  rationale: null,
  createdBy: "Admin Qubico (demo)",
  createdAt,
  testedAt: status === "draft" ? null : createdAt,
  activatedBy: null,
  activatedAt: null,
  activationReason: null,
  retiredAt: null,
  ...extra,
});

export const PROMPTS: PromptRecord[] = [
  {
    meta: v("2.6.0", "retired", "Agrega la ficha del seguro como contexto.", "2026-10-08T10:00:00", { activatedAt: "2026-10-09T09:00:00", activatedBy: "Admin Qubico (demo)", activationReason: "Mejor coincidencia en motivo 28.", retiredAt: "2026-10-13T09:00:00" }),
    sections: withRule([]),
    evaluation: evaluation("2.6.0", 64),
    history: [
      { at: "2026-10-08T10:00:00", actor: "Admin Qubico (demo)", action: "Publicó la versión" },
      { at: "2026-10-09T09:00:00", actor: "Admin Qubico (demo)", action: "Activó la versión" },
      { at: "2026-10-13T09:00:00", actor: "Admin Qubico (demo)", action: "Retirada al activar v2.7.0" },
    ],
  },
  {
    meta: v("2.7.0", "active", "Exige frases exactas en el cierre y revisa el contexto de los turnos siguientes.", "2026-10-12T10:00:00", { activatedAt: "2026-10-13T09:00:00", activatedBy: "Admin Qubico (demo)", activationReason: "Sube la coincidencia con el cliente de 64 % a 70 %." }),
    sections: withRule(["6. Para el motivo 28, cita la pregunta del cliente sobre la devolución."]),
    evaluation: evaluation("2.7.0", 70, 1),
    history: [
      { at: "2026-10-12T10:00:00", actor: "Admin Qubico (demo)", action: "Publicó la versión" },
      { at: "2026-10-12T11:00:00", actor: "Admin Qubico (demo)", action: "Probó contra la referencia" },
      { at: "2026-10-13T09:00:00", actor: "Admin Qubico (demo)", action: "Activó la versión" },
    ],
  },
  {
    meta: v("2.8.0", "draft", "Pide a la IA el motivo de renuncia correcto en la tipificación.", "2026-10-21T16:00:00", { rationale: "Discrepancias del 19-10: tipificaciones incorrectas." }),
    sections: withRule([
      "6. Para el motivo 28, cita la pregunta del cliente sobre la devolución.",
      "7. En los motivos 18–25, indica el motivo de renuncia correcto de la lista cerrada.",
    ]),
    evaluation: null,
    history: [{ at: "2026-10-21T16:00:00", actor: "Admin Qubico (demo)", action: "Creó el borrador" }],
  },
];

export const MODELS = ["Gemini (demo)", "Sonnet (demo)"];

export const ADMIN_STATS: AdminStats = {
  operation: {
    callsProcessed: 8420,
    minutesProcessed: 81_340,
    medianHoursToResult: 9.5,
    batchesWithError: 2,
    humanQueue: 142,
    oldestQueueHours: 3,
    reviewedPerDay: 181,
    daily: [1180, 1240, 1205, 1190, 1260, 1170, 1175].map((calls, i) => ({ date: `2026-10-${String(15 + i).padStart(2, "0")}`, calls })),
    failedBatches: [
      { batchId: "LOTE-1018-03", at: "2026-10-18T06:10:00", stage: "ASR", calls: 12 },
      { batchId: "LOTE-1020-01", at: "2026-10-20T05:55:00", stage: "salida inválida", calls: 1 },
    ],
  },
  aiQuality: [
    { promptVersion: "2.6.0", model: "Gemini (demo)", reference: "client", n: 100, matchRate: 64, uncertainRate: 6, unvalidatedQuoteRate: 3.4, distribution: { compliant: 58, non_compliant: 34, uncertain: 8 } },
    { promptVersion: "2.7.0", model: "Gemini (demo)", reference: "client", n: 100, matchRate: 70, uncertainRate: 5, unvalidatedQuoteRate: 3.1, distribution: { compliant: 61, non_compliant: 32, uncertain: 7 } },
    { promptVersion: "2.7.0", model: "Sonnet (demo)", reference: "client", n: 100, matchRate: 68, uncertainRate: 4, unvalidatedQuoteRate: 2.2, distribution: { compliant: 59, non_compliant: 35, uncertain: 6 } },
    { promptVersion: "2.7.0", model: "Gemini (demo)", reference: "app_auditors", n: 42, matchRate: 78, uncertainRate: 5, unvalidatedQuoteRate: 2.4, distribution: { compliant: 60, non_compliant: 33, uncertain: 7 } },
  ],
  cost: [
    { model: "Gemini (demo)", promptVersion: "2.7.0", calls: 6200, totalUsd: 25.4, perCallUsd: 0.0041, tokensIn: 41_000_000, tokensOut: 6_100_000, latencyMsAvg: 1750, latencyMsP95: 3280 },
    { model: "Sonnet (demo)", promptVersion: "2.7.0", calls: 100, totalUsd: 1.9, perCallUsd: 0.019, tokensIn: 660_000, tokensOut: 98_000, latencyMsAvg: 2900, latencyMsP95: 5100 },
  ],
};
