import type { CatalogProduct } from "@/lib/api/catalog-types";

/** Campos de texto de la ficha, por sección (Cambio 11 §5.5: Identificación primero). */
export type TextField = { key: keyof CatalogProduct; label: string; multiline?: boolean };
export type ListField = { key: "systemNames" | "policies" | "channels" | "observations"; label: string; help?: string };
export type TableField = {
  key: "coverages" | "assistances" | "premiums" | "claims" | "temporaryDisabilityTable" | "extraInfo";
  label: string;
  columns: { key: string; label: string; multiline?: boolean }[];
  help?: string;
};

export const IDENTIFICATION: (TextField | ListField)[] = [
  { key: "systemNames", label: "Nombres en sistema", help: "Cómo aparece el seguro en la metadata de la llamada. Uno por línea." },
  { key: "policies", label: "N° de póliza", help: "Uno por línea." },
  { key: "policiesNote", label: "Nota de las pólizas" },
  { key: "identificationNotes", label: "Descripción para identificarlo", multiline: true },
  { key: "channels", label: "Canales", help: "Ej.: MUS, Salesforce. Uno por línea." },
];

export const CONDITIONS: TextField[] = [
  { key: "premiumMode", label: "Modalidad de prima" },
  { key: "insuredCapital", label: "Capital asegurado", multiline: true },
  { key: "minEntryAge", label: "Edad mínima de ingreso" },
  { key: "maxEntryAge", label: "Edad máxima de ingreso" },
  { key: "maxStayAge", label: "Edad máxima de permanencia" },
  { key: "coverageStart", label: "Inicio de cobertura" },
  { key: "premiumRefund", label: "Devolución de prima", multiline: true },
  { key: "withdrawal", label: "Retracto", multiline: true },
  { key: "claimDeadlineDays", label: "Plazo para denunciar siniestros (días)" },
  { key: "solidaritySupport", label: "Apoyo solidario", multiline: true },
  { key: "assistancePhone", label: "Fono de asistencias" },
  { key: "categoryDetail", label: "Detalle de la categoría", multiline: true },
  { key: "notes", label: "Notas", multiline: true },
];

export const TABLES: TableField[] = [
  {
    key: "coverages",
    label: "Coberturas",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "amount", label: "Monto" },
      { key: "detail", label: "Detalle", multiline: true },
      { key: "beneficiary", label: "Beneficiario" },
    ],
  },
  {
    key: "assistances",
    label: "Asistencias",
    columns: [
      { key: "name", label: "Nombre" },
      { key: "detail", label: "Detalle", multiline: true },
      { key: "events", label: "Eventos" },
      { key: "cap", label: "Tope" },
      { key: "phone", label: "Fono" },
    ],
  },
  {
    key: "premiums",
    label: "Primas por plan",
    columns: [
      { key: "plan", label: "Plan" },
      { key: "insured", label: "Asegurado" },
      { key: "ageBand", label: "Tramo de edad" },
      { key: "amountInsured", label: "Monto asegurado" },
      { key: "premiumUf", label: "Prima UF" },
      { key: "premiumClp", label: "Prima $" },
      { key: "periodicity", label: "Periodicidad" },
    ],
  },
  {
    key: "claims",
    label: "Siniestros",
    columns: [
      { key: "coverage", label: "Cobertura" },
      { key: "deadline", label: "Plazo" },
      { key: "channel", label: "Canal" },
      { key: "documents", label: "Documentos", multiline: true },
    ],
  },
  {
    key: "temporaryDisabilityTable",
    label: "Incapacidad temporal",
    columns: [
      { key: "fromDay", label: "Desde el día" },
      { key: "toDay", label: "Hasta el día" },
      { key: "amount", label: "Monto" },
    ],
  },
  {
    key: "extraInfo",
    label: "Información adicional",
    help: "Lo del Excel que no calza en otro campo, tal cual. Se guarda y se muestra; la IA no lo usa al validar.",
    columns: [
      { key: "title", label: "Título" },
      { key: "text", label: "Texto", multiline: true },
      { key: "source", label: "Origen" },
    ],
  },
];

export function isList(f: TextField | ListField): f is ListField {
  return f.key === "systemNames" || f.key === "policies" || f.key === "channels" || f.key === "observations";
}

export function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(show).join(" · ") : "—";
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>)
      .filter((v) => v !== null && v !== "")
      .map(String)
      .join(" · ");
  return String(value);
}
