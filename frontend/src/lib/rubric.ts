"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Rubric } from "./api/types";

let cached: Promise<Rubric> | null = null;

/** Pauta vigente. Cambia poco: se pide una vez por sesión de navegador. */
export function loadRubric(): Promise<Rubric> {
  if (!cached) {
    cached = api.getRubric().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function useRubric(): Rubric | null {
  const [rubric, setRubric] = useState<Rubric | null>(null);
  useEffect(() => {
    let alive = true;
    loadRubric()
      .then((r) => alive && setRubric(r))
      .catch(() => {
        // Las pantallas muestran su propio estado de error si la necesitan.
      });
    return () => {
      alive = false;
    };
  }, []);
  return rubric;
}
