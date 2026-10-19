import type { ApiClient } from "./client";
import { mockApi } from "./mock/mock-api";

/**
 * Punto único de acceso a la API. Hoy solo existe el modo mock.
 * Cuando exista el backend: agregar `http-api.ts` con la misma interfaz y elegirlo con
 * NEXT_PUBLIC_API_MODE=http.
 */
const mode = process.env.NEXT_PUBLIC_API_MODE ?? "mock";

if (mode !== "mock") {
  console.warn(`NEXT_PUBLIC_API_MODE=${mode} aún no está implementado; se usa el mock.`);
}

export const api: ApiClient = mockApi;
export type { ApiClient };
