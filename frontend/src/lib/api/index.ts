import type { ApiClient } from "./client";
import { httpApi } from "./http-api";
import { mockApi } from "./mock/mock-api";

/**
 * Punto único de acceso a la API. NEXT_PUBLIC_API_MODE elige el adaptador:
 * - "mock" (por defecto): datos sintéticos en el navegador, para la demo.
 * - "http": backend FastAPI (src/call_audit/api) a través del proxy /api de next.config.ts.
 */
export const apiMode: "mock" | "http" = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

export const api: ApiClient = apiMode === "http" ? httpApi : mockApi;
export type { ApiClient };

/** Modo real (backend v0): oculta lo que solo existe en la demo o que v0 todavía no tiene (Cambio 10 de UX). */
export const isRealMode = apiMode === "http";
