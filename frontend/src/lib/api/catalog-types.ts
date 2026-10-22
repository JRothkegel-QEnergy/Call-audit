/**
 * Catálogo de seguros (Cambio 11, docs/ux/call-audit/11-catalogo-seguros.md §9). Todo exige el permiso
 * manage_catalog, salvo la versión de la ficha en el detalle de llamada.
 */

export type ProductCategory =
  | "RETENIBLE"
  | "NO_RETENIBLE"
  | "NO_RENUNCIABLE_COSTO_BANCO"
  | "NO_RENUNCIABLE_SUCURSAL"
  | "NO_RENUNCIABLE_SUBSIDIADO"
  | "NO_RENUNCIABLE_OBLIGATORIO";

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  RETENIBLE: "Retenible",
  NO_RETENIBLE: "No retenible",
  NO_RENUNCIABLE_COSTO_BANCO: "No renunciable · lo paga el banco",
  NO_RENUNCIABLE_SUCURSAL: "No renunciable · derivar a sucursal",
  NO_RENUNCIABLE_SUBSIDIADO: "No renunciable · subsidiado",
  NO_RENUNCIABLE_OBLIGATORIO: "No renunciable · obligatorio",
};

export const PREMIUM_TYPE_LABEL: Record<string, string> = {
  mensual: "Mensual",
  anual: "Anual",
  credito: "Asociada a un crédito",
  sin_dato: "Sin dato",
};

export type ProductStatus = "active" | "archived";

export interface Coverage { name: string; amount: string | null; detail: string | null; beneficiary: string | null }
export interface Assistance { name: string; detail: string | null; events: string | null; cap: string | null; phone: string | null }
export interface Premium {
  plan: string | null; insured: string | null; ageBand: string | null; amountInsured: string | null;
  premiumUf: string | null; premiumClp: string | null; periodicity: string | null;
  policyTable: string | null; note: string | null;
}
export interface Claim {
  coverage: string | null; deadline: string | null; channel: string | null; documents: string | null; coverageTerm: string | null;
}
export interface Exclusion { type: string | null; detail: string | null }
/** Tasa por mil sobre el monto del crédito, según plazo en meses. */
export interface CreditRate {
  coverage: string | null; termFrom: string | null; termTo: string | null;
  netRate: string | null; vat: string | null; grossRate: string | null; note: string | null;
}
export interface MaxAgeByTerm { termFrom: string | null; termTo: string | null; maxAge: string | null }
export interface DisabilityRow { fromDay: string | null; toDay: string | null; amount: string | null }
/** Lo del Excel que no calza en otro campo, tal cual. Se guarda y se muestra; no va al prompt de validación. */
export interface ExtraInfo { title: string; text: string; source: string | null }

/** La ficha. Clave única: nombre normalizado + aseguradora (D-27). */
export interface CatalogProduct {
  name: string;
  insurer: string | null;
  category: ProductCategory;
  systemNames: string[];
  policies: string[];
  policiesNote: string | null;
  identificationNotes: string | null;
  channels: string[];
  premiumType: string;
  premiumMode: string | null;
  insuredCapital: string | null;
  minEntryAge: string | null;
  maxEntryAge: string | null;
  maxStayAge: string | null;
  claimDeadlineDays: string | null;
  premiumRefund: string | null;
  withdrawal: string | null;
  coverageStart: string | null;
  solidaritySupport: string | null;
  assistancePhone: string | null;
  notes: string | null;
  categoryDetail: string | null;
  coverages: Coverage[];
  assistances: Assistance[];
  premiums: Premium[];
  claims: Claim[];
  temporaryDisabilityTable: DisabilityRow[];
  observations: string[];
  exclusions: Exclusion[];
  creditRates: CreditRate[];
  maxAgeByTerm: MaxAgeByTerm[];
  extraInfo: ExtraInfo[];
}

export interface UserRef { id: string; name: string }

export interface ProductSummary {
  id: string;
  name: string;
  insurer: string | null;
  category: ProductCategory;
  policies: string[];
  systemNames: string[];
  status: ProductStatus;
  version: number;
  updatedAt: string;
  updatedBy: UserRef | null;
  incomplete: boolean;
}

export interface ProductDetail extends Omit<ProductSummary, "name" | "insurer" | "category" | "policies" | "systemNames"> {
  product: CatalogProduct;
}

export type VersionOrigin =
  | { kind: "initial_load" }
  | { kind: "upload"; uploadId: string; fileName: string; batch: boolean }
  | { kind: "manual" }
  | { kind: "restore"; fromVersion: number };

export interface ProductVersion {
  version: number;
  createdAt: string;
  author: UserRef | null;
  origin: VersionOrigin;
  note: string | null;
}

export interface FieldChange {
  path: string;
  label: string;
  kind: "changed" | "added" | "removed";
  before: unknown;
  after: unknown;
}

export interface ProductFilters {
  query?: string;
  insurer?: string;
  category?: ProductCategory;
  status?: ProductStatus | "all";
  incomplete?: boolean;
}

export type CatalogUploadStatus = "processing" | "failed" | "ready" | "partial" | "closed" | "discarded" | "expired";
export type CatalogUploadStep = "reading" | "extracting" | "matching";
export type CatalogUploadError = "invalid_format" | "too_large" | "password_protected" | "no_products" | "extraction_failed";

export interface CatalogUploadSummary {
  id: string;
  fileName: string;
  uploadedBy: UserRef;
  uploadedAt: string;
  status: CatalogUploadStatus;
  counts: {
    total: number; new: number; existsChanged: number; existsUnchanged: number; existsArchived: number;
    withWarnings: number; decided: number; created: number; updated: number; discarded: number;
  };
}

export interface CatalogUpload extends CatalogUploadSummary {
  fileSizeBytes: number;
  step: CatalogUploadStep | null;
  error: CatalogUploadError | null;
  model: string;
  extractionPromptVersion: string;
  schemaVersion: string;
  unusedSheets: string[];
  items: UploadItem[];
}

export type UploadMatch =
  | { status: "new" }
  | { status: "exists"; state: "unchanged" | "changed" | "archived"; productId: string; version: number; changes: FieldChange[] };

export type UploadWarning =
  | { kind: "possible_duplicate"; productId: string; productName: string; insurer: string | null; via: "policy" | "system_name"; value: string }
  | { kind: "repeated_in_file"; otherItemId: string }
  | { kind: "missing_required"; field: "name" | "category" | "identifier" }
  | { kind: "invalid_category"; value: string }
  | { kind: "possible_personal_data"; field: string; dataType: "rut" | "email" | "phone" };

export interface UploadItem {
  id: string;
  proposed: CatalogProduct;
  fieldSources: Record<string, { sheet: string; row: number; raw: string }>;
  missingFields: string[];
  match: UploadMatch;
  warnings: UploadWarning[];
  decision: null | {
    action: "created" | "updated" | "discarded";
    productId: string | null;
    version: number | null;
    by: UserRef;
    at: string;
    batch: boolean;
    reason: string | null;
  };
}

export type UploadAction = "create" | "update" | "discard";
