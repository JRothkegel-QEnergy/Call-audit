import type { CatalogUploadStatus } from "@/lib/api/catalog-types";

export const UPLOAD_STATUS: Record<CatalogUploadStatus, string> = {
  processing: "Procesando",
  failed: "Falló",
  ready: "Lista para revisar",
  partial: "En revisión",
  closed: "Cerrada",
  discarded: "Descartada",
  expired: "Vencida",
};

export const UPLOAD_ERROR: Record<string, string> = {
  invalid_format: "Este archivo no es un Excel .xlsx. Guárdalo como .xlsx e intenta de nuevo.",
  too_large: "El archivo pesa más de 10 MB. Quita hojas que no tengan seguros o divídelo en dos.",
  password_protected: "El Excel tiene contraseña. Quítala y vuelve a subirlo.",
  no_products:
    "No encontramos seguros en este Excel. Revisa que tenga una hoja con un seguro por fila (nombre, aseguradora y condiciones).",
  extraction_failed: "No pudimos extraer los seguros. El archivo quedó guardado; puedes reintentar sin volver a subirlo.",
};

