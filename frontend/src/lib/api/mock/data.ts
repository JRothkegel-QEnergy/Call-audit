/**
 * Datos 100 % sintéticos para el front dummy (L-19).
 * Nada de esto sale de llamadas reales: nombres, RUT, montos y fichas son inventados.
 */
import type {
  Agent,
  AuditorAccount,
  CaseDetail,
  Criterion,
  ExternalVerdict,
  Finding,
  ModelRun,
  ProductSheet,
  Rubric,
  TranscriptTurn,
  User,
} from "../types";

// ---------- Pauta (33 motivos en 5 bloques; textos de docs/context.md) ----------

const CRITERIA_NAMES: Record<number, string> = {
  31: "No valida correctamente al cliente (RUT, nombre, fecha de nacimiento)",
  33: "No valida correctamente al cliente (email, fono)",
  29: "No realiza protocolo de cierre",
  30: "No reitera protocolo de cierre ante respuesta no permitida",
  13: "No indica número de seguro en protocolo de cierre",
  15: "No se informa medio de pago en protocolo de cierre",
  27: "Entrega información a tercero, sin retomar protocolo de cierre con el titular",
  4: "No indica ninguna característica del seguro a renunciar",
  2: "Descripción del seguro corresponde a otro seguro",
  6: "No maneja información del producto o coberturas",
  5: "No informa que la permanencia la maneja cliente ante consulta directa",
  28: "Niega devolución de primas",
  14: "No realiza ningún intento de retención del seguro retenible",
  17: "Retiene seguro no retenible",
  9: "Renuncia seguro irrenunciable en este canal",
  16: "Realiza retención de seguro sin intención de renuncia",
  3: "Excede 3 objeciones máximo para retención",
  12: "Induce a renuncia",
  32: "Predispone al cliente para la aceptación del seguro",
  7: "No realiza derivación correcta",
  26: "No se impactan todas las gestiones solicitadas por el cliente",
  1: "Deja en espera por tiempo excesivo",
  8: "No responde de forma directa al cliente",
  11: "Descalifica a los pares, a BancoEstado o a la competencia",
  10: "Su atención no se ajusta a la política de BancoEstado",
  18: "Tipifica motivo de renuncia incorrecto",
  19: "Tipifica renuncia y por grabación es retención",
  24: "Tipifica retención y por grabación es renuncia",
  20: "Tipifica renuncia de seguro no mencionado",
  21: "Tipifica renuncia que corresponde a otro seguro",
  22: "Tipifica retención de seguro no mencionado",
  23: "Tipifica retención que corresponde a otro seguro",
  25: "No tipifica todas las gestiones",
};

const BLOCKS = [
  { id: "A", name: "Acreditación y protocolo de cierre", criterionIds: [31, 33, 29, 30, 13, 15, 27] },
  { id: "B", name: "Conocimiento del producto", criterionIds: [4, 2, 6, 5, 28] },
  { id: "C", name: "Gestión de la retención", criterionIds: [14, 17, 9, 16, 3, 12, 32, 7, 26] },
  { id: "D", name: "Trato", criterionIds: [1, 8, 11, 10] },
  { id: "E", name: "Tipificación", criterionIds: [18, 19, 24, 20, 21, 22, 23, 25] },
];

/** Gravedad por motivo: TBD con el cliente (docs/client-open-questions.md #1). Estos críticos son solo para la demo. */
const DEMO_CRITICAL = new Set([28, 9, 17, 12]);

/** Motivo → sección de la ficha (H-32: en el backend vendrá de la rúbrica). */
const SHEET_SECTION: Partial<Record<number, Criterion["productSheetSection"]>> = {
  28: "refund",
  17: "category",
  14: "category",
  9: "category",
  2: "coverages",
  6: "coverages",
  4: "coverages",
  15: "call",
  13: "call",
};

export const RUBRIC: Rubric = {
  id: "bancoestado_retention",
  version: "1.2.0",
  blocks: BLOCKS,
  criteria: Object.fromEntries(
    BLOCKS.flatMap((b) =>
      b.criterionIds.map((id) => [
        id,
        {
          id,
          name: CRITERIA_NAMES[id],
          blockId: b.id,
          critical: DEMO_CRITICAL.has(id),
          productSheetSection: SHEET_SECTION[id],
        } satisfies Criterion,
      ]),
    ),
  ),
};

// ---------- Personas (ficticias) ----------

export const USERS: Record<"auditor" | "supervisor", User> = {
  // La auditora de la demo tiene `view_model_io`, como Vero y el equipo externo (D-22).
  auditor: { id: "u-aud-1", name: "Ana Pérez", email: "ana.perez@empresa-ejemplo.cl", role: "auditor", permissions: ["view_model_io"] },
  supervisor: { id: "u-sup-1", name: "Jorge Lagos", email: "jorge.lagos@empresa-ejemplo.cl", role: "supervisor", permissions: [] },
};

export const AUDITORS = [
  { id: "u-aud-1", name: "Ana Pérez" },
  { id: "u-aud-2", name: "Luis Muñoz" },
  { id: "u-aud-3", name: "Sofía Reyes" },
];

export const AGENTS: Agent[] = [
  { id: "ag-101", name: "Camila Vera", team: "Retención · equipo 1" },
  { id: "ag-102", name: "Diego Paz", team: "Retención · equipo 1" },
  { id: "ag-103", name: "Lucía Rojas", team: "Retención · equipo 2" },
  { id: "ag-104", name: "Rubén Soto", team: "Retención · equipo 2" },
  { id: "ag-105", name: "Tomás Ibarra", team: "Retención · equipo 3" },
  { id: "ag-106", name: "Camila Vargas", team: "Retención · equipo 3" },
];

export const ACCOUNTS: AuditorAccount[] = [
  { id: "u-aud-1", name: "Ana Pérez", email: "ana.perez@empresa-ejemplo.cl", status: "active", loginMethod: "sso" },
  { id: "u-aud-2", name: "Luis Muñoz", email: "luis.munoz@empresa-ejemplo.cl", status: "active", loginMethod: "password" },
  { id: "u-aud-3", name: "Sofía Reyes", email: "sofia.reyes@empresa-ejemplo.cl", status: "invited", loginMethod: "sso" },
  { id: "u-aud-4", name: "Pablo Torres", email: "pablo.torres@empresa-ejemplo.cl", status: "deactivated", loginMethod: "sso" },
];

// ---------- Fichas de seguro (sintéticas) ----------

const PRODUCTS: Record<string, Omit<ProductSheet, "callData">> = {
  desempleo: {
    productId: "P-DES",
    name: "Seguro Desempleo Consumo",
    insurer: "Aseguradora Ejemplo S.A.",
    category: "RETENIBLE",
    categoryRule: "Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.",
    premiumType: "Mensual",
    premiumRefund: "Prima mensual: no hay devolución de meses pagados; se informa la regla y el canal de requerimiento (dato sintético).",
    withdrawal: "Sí, dentro del plazo indicado en la póliza (dato sintético).",
    coverages: [
      { name: "Desempleo", detail: "Hasta 6 cuotas del crédito (sintético)." },
      { name: "Incapacidad temporal", detail: "Hasta 6 cuotas del crédito (sintético)." },
    ],
  },
  hogar: {
    productId: "P-HOG",
    name: "Seguro Incendio Hogar",
    insurer: "Aseguradora Ejemplo S.A.",
    category: "RETENIBLE",
    categoryRule: "Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.",
    premiumType: "Anual",
    premiumRefund: "Prima anual: devolución proporcional al periodo no cubierto (dato sintético).",
    withdrawal: "Sí, dentro del plazo indicado en la póliza (dato sintético).",
    coverages: [
      { name: "Incendio", detail: "Hasta UF 1.000 (sintético)." },
      { name: "Sismo", detail: "Adicional opcional (sintético)." },
    ],
  },
  proteccion: {
    productId: "P-PRO",
    name: "Seguro Protección Global",
    insurer: "Compañía Ficticia de Seguros",
    category: "NO RETENIBLE",
    categoryRule: "Si el cliente pide renunciar, el ejecutivo no debe intentar retenerlo.",
    premiumType: "Mensual",
    premiumRefund: "No aplica devolución de primas pagadas (dato sintético).",
    withdrawal: "No (dato sintético).",
    coverages: [{ name: "Muerte accidental", detail: "UF 300 a beneficiarios (sintético)." }],
  },
  sale: {
    productId: "P-SAL",
    name: "Sale Seguro",
    insurer: "Compañía Ficticia de Seguros",
    category: "IRRENUNCIABLE",
    categoryRule: "Este seguro no se puede renunciar por este canal; se deriva.",
    premiumType: "Única",
    premiumRefund: "Según condiciones de la póliza (dato sintético).",
    withdrawal: "No (dato sintético).",
    coverages: [{ name: "Desgravamen", detail: "Saldo insoluto del crédito (sintético)." }],
  },
};

function sheet(key: keyof typeof PRODUCTS, seed: number): ProductSheet {
  const p = PRODUCTS[key];
  return {
    ...p,
    callData: [
      { label: "N° de seguro", value: `•••• ${String(5600 + seed * 7).slice(-4)}` },
      { label: "N° de póliza", value: `•••• ${String(1200 + seed * 3).slice(-4)}` },
      { label: "Inicio de vigencia", value: "03 mar 2026" },
      { label: "Medio de pago", value: key === "hogar" ? "Cargo en CuentaRUT" : "Cargo en el crédito (CRE)" },
    ],
  };
}

// ---------- Llamadas ----------

const s = (sec: number) => sec * 1000;

function turns(raw: [number, "agent" | "customer" | "other", string][], durationSec: number): TranscriptTurn[] {
  return raw.map(([start, speaker, text], i) => ({
    index: i,
    speaker,
    startMs: s(start),
    endMs: s(raw[i + 1]?.[0] ?? durationSec),
    text,
  }));
}

const TRANSCRIPT_DESEMPLEO = (agentFirst: string) =>
  turns(
    [
      [4, "agent", `Buenos días, le habla ${agentFirst}, ejecutivo de retención. ¿Con quién tengo el gusto?`],
      [9, "customer", "Hola, con [nombre del cliente]."],
      [15, "agent", "Para validar, ¿me indica su RUT y su fecha de nacimiento?"],
      [22, "customer", "Sí, es ••••••-K, y nací el [fecha]."],
      [40, "customer", "Llamo porque quiero renunciar al seguro de desempleo del crédito."],
      [58, "agent", "Entiendo. ¿Me cuenta el motivo de la renuncia?"],
      [66, "customer", "Es que ahora tengo contrato indefinido y no lo necesito."],
      [95, "agent", "Le comento que el seguro le cubre hasta seis cuotas del crédito si queda cesante."],
      [140, "customer", "Sí, pero igual prefiero no pagarlo."],
      [190, "agent", "¿Y si lo mantiene unos meses más mientras se asienta en el trabajo nuevo?"],
      [250, "customer", "No, gracias."],
      [310, "agent", "Además tiene asistencia de orientación laboral sin costo."],
      [328, "customer", "No, de verdad no me interesa."],
      [400, "agent", "Muy bien, procedo con la renuncia."],
      [462, "customer", "¿Y me devuelven lo que ya pagué este mes?"],
      [470, "agent", "No, eso no se devuelve en ningún caso."],
      [560, "agent", "Queda renunciado el seguro terminado en •••• 5678, con cargo al crédito."],
      [640, "agent", "¿Algo más en que le pueda ayudar? Que tenga buen día."],
    ],
    663,
  );

const TRANSCRIPT_HOGAR = (agentFirst: string) =>
  turns(
    [
      [3, "agent", `Buenas tardes, mi nombre es ${agentFirst}. ¿Con quién hablo?`],
      [8, "customer", "Con [nombre del cliente]."],
      [12, "agent", "¿Me confirma su RUT, por favor?"],
      [17, "customer", "••••••-3."],
      [30, "customer", "Quiero dar de baja el seguro de incendio de la casa."],
      [44, "agent", "Claro. Antes, ¿me cuenta por qué lo quiere dar de baja?"],
      [52, "customer", "Lo tengo repetido con otro seguro del banco del crédito hipotecario."],
      [80, "agent", "Entiendo. Este seguro cubre también sismo si lo tiene contratado."],
      [120, "customer", "No, ya lo tengo cubierto, gracias."],
      [160, "agent", "Perfecto, lo dejo en espera un momento mientras reviso."],
      [161, "other", "[música de espera]"],
      [330, "agent", "Gracias por esperar. Procedo con la renuncia."],
      [380, "agent", "Queda renunciado su seguro, con cargo en CuentaRUT."],
      [420, "customer", "Gracias."],
      [470, "agent", "Que tenga buena tarde."],
    ],
    521,
  );

const TRANSCRIPT_PROTECCION = (agentFirst: string) =>
  turns(
    [
      [5, "agent", `Bienvenido, le atiende ${agentFirst}. ¿En qué le puedo ayudar?`],
      [11, "customer", "Quiero renunciar a un seguro que me aparece en la cartola."],
      [20, "agent", "Para validar, ¿me indica su RUT y fecha de nacimiento?"],
      [27, "customer", "••••••-5, nací el [fecha]."],
      [45, "agent", "Veo un Seguro Protección Global. ¿Es ese?"],
      [52, "customer", "Sí, ese."],
      [70, "agent", "Le comento que tiene cobertura de muerte accidental, ¿seguro que no lo quiere mantener?"],
      [92, "customer", "Seguro, no lo quiero."],
      [130, "agent", "¿Y si le bajamos el plan a uno más económico?"],
      [150, "customer", "No, ya le dije que no."],
      [200, "agent", "Bueno, procedo con la renuncia del seguro."],
      [300, "agent", "Queda renunciado. ¿Algo más?"],
      [312, "customer", "No, gracias."],
    ],
    340,
  );

interface CaseSeed {
  id: string;
  callId: string;
  callDate: string;
  agentId: string;
  products: (keyof typeof PRODUCTS)[];
  template: "desempleo" | "hogar" | "proteccion";
  queuedMinutesAgo: number;
  sampleCompliant?: boolean;
  lockedBy?: { id: string; name: string };
  findings: Finding[];
  external?: { verdict: ExternalVerdict; comment?: string };
}

const F = (
  criterionId: number,
  verdict: Finding["verdict"],
  confidence: number,
  atSec: number | null,
  quote: string | null,
  comment: string,
  quoteValidated = true,
): Finding => ({
  criterionId,
  verdict,
  confidence,
  comment,
  evidence: atSec == null || !quote ? null : { quote, startMs: s(atSec), endMs: s(atSec + 6), quoteValidated },
});

const FINDINGS_DESEMPLEO: Finding[] = [
  F(28, "non_compliant", 0.86, 470, "No, eso no se devuelve en ningún caso.", "El cliente pregunta por la devolución y el ejecutivo la niega sin informar la regla del seguro de prima mensual."),
  F(3, "uncertain", 0.54, 190, "¿Y si lo mantiene unos meses más mientras se asienta en el trabajo nuevo?", "No es claro si el primer argumento cuenta como objeción."),
  F(32, "uncertain", 0.48, 310, "Además tiene asistencia de orientación laboral gratis.", "Posible predisposición a mantener el seguro.", false),
  F(13, "compliant", 0.93, 560, "Queda renunciado el seguro terminado en •••• 5678", "Indica el número de seguro en el cierre."),
];

const FINDINGS_HOGAR: Finding[] = [
  F(1, "non_compliant", 0.81, 161, "[música de espera]", "La espera dura cerca de 3 minutos (umbral de espera excesiva: TBD con el cliente)."),
  F(13, "non_compliant", 0.77, 380, "Queda renunciado su seguro, con cargo en CuentaRUT.", "No indica el número de seguro en el protocolo de cierre."),
  F(14, "uncertain", 0.58, 80, "Este seguro cubre también sismo si lo tiene contratado.", "Hay una mención de cobertura, pero no queda claro si es un intento de retención."),
  F(15, "compliant", 0.9, 380, "con cargo en CuentaRUT", "Informa el medio de pago."),
];

const FINDINGS_PROTECCION: Finding[] = [
  F(17, "non_compliant", 0.88, 70, "¿seguro que no lo quiere mantener?", "Intenta retener un seguro no retenible."),
  F(16, "uncertain", 0.51, 130, "¿Y si le bajamos el plan a uno más económico?", "Insiste después de una negativa explícita; revisar si corresponde al motivo 3 o al 17."),
  F(13, "non_compliant", 0.72, 300, "Queda renunciado. ¿Algo más?", "No indica número de seguro ni medio de pago en el cierre."),
];

const FINDINGS_SAMPLE: Finding[] = [F(13, "compliant", 0.92, 560, "Queda renunciado el seguro terminado en •••• 5678", "Indica el número de seguro en el cierre.")];

const TEMPLATES = {
  desempleo: { transcript: TRANSCRIPT_DESEMPLEO, durationSec: 663 },
  hogar: { transcript: TRANSCRIPT_HOGAR, durationSec: 521 },
  proteccion: { transcript: TRANSCRIPT_PROTECCION, durationSec: 340 },
};

const SEEDS: CaseSeed[] = [
  { id: "c-0412", callId: "LL-1015-0412", callDate: "2026-10-15T09:14:00", agentId: "ag-104", products: ["desempleo"], template: "desempleo", queuedMinutesAgo: 32, findings: FINDINGS_DESEMPLEO, external: { verdict: "compliant", comment: "Ejecutivo gestiona correctamente la renuncia." } },
  { id: "c-0431", callId: "LL-1015-0431", callDate: "2026-10-15T09:20:00", agentId: "ag-101", products: ["hogar"], template: "hogar", queuedMinutesAgo: 26, findings: FINDINGS_HOGAR, external: { verdict: "non_compliant", comment: "Espera excesiva sin retomar." } },
  { id: "c-0445", callId: "LL-1015-0445", callDate: "2026-10-15T09:28:00", agentId: "ag-105", products: ["proteccion"], template: "proteccion", queuedMinutesAgo: 22, findings: FINDINGS_PROTECCION },
  { id: "c-0477", callId: "LL-1015-0477", callDate: "2026-10-15T09:41:00", agentId: "ag-102", products: ["proteccion"], template: "proteccion", queuedMinutesAgo: 5, findings: FINDINGS_PROTECCION.slice(1), lockedBy: { id: "u-aud-2", name: "Luis Muñoz" } },
  { id: "c-0502", callId: "LL-1015-0502", callDate: "2026-10-15T09:55:00", agentId: "ag-103", products: ["desempleo"], template: "desempleo", queuedMinutesAgo: 3, findings: FINDINGS_DESEMPLEO.slice(1) },
  { id: "c-0511", callId: "LL-1015-0511", callDate: "2026-10-15T09:58:00", agentId: "ag-104", products: ["hogar"], template: "hogar", queuedMinutesAgo: 2, findings: FINDINGS_HOGAR.slice(2) },
  { id: "c-0519", callId: "LL-1015-0519", callDate: "2026-10-15T10:02:00", agentId: "ag-105", products: ["desempleo"], template: "desempleo", queuedMinutesAgo: 1, sampleCompliant: true, findings: FINDINGS_SAMPLE },
];

export function engineVerdict(findings: Finding[]) {
  if (findings.some((f) => f.verdict === "non_compliant")) return "non_compliant" as const;
  if (findings.some((f) => f.verdict === "uncertain")) return "uncertain" as const;
  return "compliant" as const;
}

const APPLIED_RULE = {
  non_compliant: "un motivo incumple → no cumple",
  uncertain: "confianza bajo el umbral → dudosa",
  compliant: "sin incumplimientos → cumple",
} as const;

/** Corrida sintética del prompt único: datos enviados, prompt por secciones y JSON de respuesta. */
function modelRun(id: string, callId: string, agent: Agent, sheets: ProductSheet[], findings: Finding[], model: string): ModelRun {
  const verdict = engineVerdict(findings);
  return {
    id: `run-${id}`,
    model,
    promptVersion: "2.7",
    rubricVersion: RUBRIC.version,
    runAt: "2026-10-15T07:30:00",
    latencyMs: 1800,
    costUsd: 0.004,
    verdict,
    appliedRule: APPLIED_RULE[verdict],
    inputData: [
      {
        section: "Metadatos del caso",
        rows: [
          { field: "ID de llamada", value: callId },
          { field: "Ejecutivo", value: agent.name },
          { field: "Flujo", value: "Retención" },
          { field: "Motivo de renuncia tipificado", value: "Cambio de situación laboral" },
          { field: "Tipificación", value: "Renuncia" },
          { field: "RUT del cliente", value: "••••••-K" },
        ],
      },
      ...sheets.map((sh, i) => ({
        section: `Seguro ${i + 1} · ${sh.name}`,
        rows: [
          { field: "Compañía", value: sh.insurer },
          { field: "Categoría", value: sh.category },
          { field: "Tipo de prima", value: sh.premiumType },
          { field: "Devolución de prima", value: sh.premiumRefund },
          { field: "Retracto", value: sh.withdrawal },
          ...sh.callData.map((d) => ({ field: d.label, value: d.value })),
        ],
      })),
    ],
    promptSections: [
      {
        title: "System",
        text: "Eres un auditor de calidad de llamadas de retención de seguros. Evalúas la transcripción contra la pauta de 33 motivos de no calidad. Respondes solo con JSON válido según el esquema. Cada hallazgo lleva una cita literal de la transcripción con su minuto. (Texto sintético de la demo.)",
      },
      {
        title: "Reglas de revisión",
        text: [
          "1. Un motivo incumple solo si hay evidencia explícita en la transcripción.",
          "2. Si la evidencia es ambigua, marca el motivo como dudoso y explica por qué.",
          "3. Verifica las frases exactas del protocolo de cierre.",
          "4. Para la retención, evalúa el contexto de los turnos siguientes antes de decidir.",
          "5. Compara lo dicho por el ejecutivo con la ficha del seguro.",
          "(Reglas sintéticas de la demo.)",
        ].join("\n"),
      },
      {
        title: "Mensaje de usuario",
        text: [
          `Metadatos: ID ${callId} · Ejecutivo ${agent.name} · Motivo tipificado: Cambio de situación laboral.`,
          `Seguros: ${sheets.map((x) => x.name).join(", ")}.`,
          "Transcripción (anonimizada): [turnos de la llamada]",
        ].join("\n"),
      },
    ],
    rawResponse: {
      call_id: callId,
      verdict,
      items: findings.map((f) => ({
        criterion_id: `M${f.criterionId}`,
        verdict: f.verdict,
        confidence: f.confidence,
        evidence: f.evidence ? [{ quote: f.evidence.quote, start_ms: f.evidence.startMs, end_ms: f.evidence.endMs }] : [],
        comment: f.comment,
      })),
    },
  };
}

interface CaseOpts {
  id: string;
  callId: string;
  callDate: string;
  agentId: string;
  products: (keyof typeof PRODUCTS)[];
  template: keyof typeof TEMPLATES;
  findings: Finding[];
  queuedAt: string;
  status: CaseDetail["status"];
  lockedBy?: { id: string; name: string } | null;
  sampleCompliant?: boolean;
  external?: { verdict: ExternalVerdict; comment?: string; items?: { criterionId: number; verdict: ExternalVerdict }[] };
  index: number;
}

export function makeCase(o: CaseOpts): CaseDetail {
  const agent = AGENTS.find((a) => a.id === o.agentId)!;
  const tpl = TEMPLATES[o.template];
  const sheets = o.products.map((p) => sheet(p, o.index));
  return {
    id: o.id,
    callId: o.callId,
    callDate: o.callDate,
    agent,
    products: o.products.map((p) => PRODUCTS[p].name),
    engineVerdict: engineVerdict(o.findings),
    sampleCompliant: !!o.sampleCompliant,
    nonCompliantCount: o.findings.filter((f) => f.verdict === "non_compliant").length,
    uncertainCount: o.findings.filter((f) => f.verdict === "uncertain").length,
    durationMs: s(tpl.durationSec),
    queuedAt: o.queuedAt,
    status: o.status,
    lockedBy: o.lockedBy ?? null,
    assignedAuditorId: null,
    hasCritical: o.findings.some((f) => f.verdict === "non_compliant" && RUBRIC.criteria[f.criterionId].critical),
    externalQualityVerdict: o.external?.verdict ?? null,
    audioUrl: null,
    transcript: tpl.transcript(agent.name.split(" ")[0]),
    findings: o.findings,
    productSheets: sheets,
    modelRuns: [modelRun(o.id, o.callId, agent, sheets, o.findings, "Gemini (demo)")],
    rubricId: RUBRIC.id,
    rubricVersion: RUBRIC.version,
    review: null,
    notes: [],
    externalItemVerdicts: o.external?.items ?? null,
    externalComment: o.external?.comment ?? null,
  };
}

export function buildCases(now: Date): CaseDetail[] {
  return SEEDS.map((seed, i) =>
    makeCase({
      ...seed,
      index: i,
      queuedAt: new Date(now.getTime() - seed.queuedMinutesAgo * 60_000).toISOString(),
      status: seed.lockedBy ? "in_review" : "pending",
    }),
  );
}

/**
 * Lote de calibración (sintético): llamadas ya procesadas, la mayoría con veredicto del cliente,
 * para la vista de Discrepancias. Mezcla los tres niveles de D-25 (sin dato, por llamada, por motivo).
 */
export function buildCalibrationCases(): CaseDetail[] {
  const ai = {
    fail: FINDINGS_DESEMPLEO.filter((f) => f.verdict !== "uncertain"),
    doubt: FINDINGS_DESEMPLEO.slice(1, 3),
    pass: FINDINGS_SAMPLE,
  };
  const plan: { ai: keyof typeof ai; client: ExternalVerdict | null; byItem?: boolean; comment?: string }[] = [
    { ai: "fail", client: "compliant", comment: "Ejecutivo informa correctamente. Sin observaciones." },
    { ai: "fail", client: "compliant", byItem: true },
    { ai: "fail", client: "compliant", comment: "Se aprueba: el cliente no consultó por devolución." },
    { ai: "fail", client: "compliant" },
    { ai: "fail", client: "compliant" },
    { ai: "fail", client: "non_compliant", comment: "Niega devolución de primas." },
    { ai: "fail", client: "non_compliant" },
    { ai: "pass", client: "non_compliant", comment: "No valida correo ni teléfono." },
    { ai: "pass", client: "non_compliant" },
    { ai: "pass", client: "compliant" },
    { ai: "pass", client: "compliant" },
    { ai: "pass", client: "compliant" },
    { ai: "doubt", client: "compliant" },
    { ai: "doubt", client: "non_compliant", comment: "Excede objeciones." },
    { ai: "pass", client: null },
    { ai: "fail", client: null },
  ];
  return plan.map((p, i) => {
    const n = 200 + i * 11;
    return makeCase({
      id: `c-k${n}`,
      callId: `LL-1001-0${n}`,
      callDate: `2026-10-01T${String(9 + (i % 9)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00`,
      agentId: AGENTS[i % AGENTS.length].id,
      products: ["desempleo"],
      template: "desempleo",
      findings: ai[p.ai],
      queuedAt: "2026-10-01T20:00:00",
      status: "closed",
      external: p.client
        ? {
            verdict: p.client,
            comment: p.comment,
            items: p.byItem
              ? [
                  { criterionId: 28, verdict: "compliant" },
                  { criterionId: 13, verdict: "compliant" },
                ]
              : undefined,
          }
        : undefined,
      index: i + 10,
    });
  });
}
