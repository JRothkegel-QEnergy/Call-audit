"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data: T | undefined; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | undefined; error: Error };

/**
 * Carga de datos mínima para el front dummy. Si más adelante hace falta caché compartida,
 * se reemplaza por TanStack Query sin cambiar las pantallas (devuelven el mismo estado).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: undefined, error: null });
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  // Solo vale la respuesta del último pedido: una lenta no puede pisar a una más nueva.
  const latestRequest = useRef(0);
  const run = useCallback(async (opts?: { silent?: boolean }) => {
    const request = ++latestRequest.current;
    if (!opts?.silent) setState((s) => ({ status: "loading", data: s.data, error: null }));
    try {
      const data = await fnRef.current();
      if (request === latestRequest.current) setState({ status: "success", data, error: null });
      return data;
    } catch (e) {
      if (request === latestRequest.current) setState((s) => ({ status: "error", data: s.data, error: e instanceof Error ? e : new Error(String(e)) }));
      return undefined;
    }
  }, []);
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload: run };
}
