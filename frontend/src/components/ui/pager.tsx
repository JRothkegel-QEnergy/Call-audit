"use client";

import { Button } from "@/components/ui/button";
import { int } from "@/lib/format";

/* Reutilizado por Análisis de discrepancias y Calidad de la IA. */
export const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

/** Página válida (desde 1) a partir de lo que venga en la URL: una inválida o fuera de rango se ajusta. */
export function clampPage(raw: string | number | null | undefined, total: number, size: number): number {
  const page = Math.floor(Number(raw ?? 1));
  return Math.min(Number.isFinite(page) && page >= 1 ? page : 1, pageCount(total, size));
}

/** Paginador simple (Cambio 20 §6): «Patrones 11–20 de 58», Anterior, «2 de 6», Siguiente. Sin más de una página, nada. */
export function Pager({
  label,
  page,
  size,
  total,
  onChange,
}: {
  label: string;
  /** Desde 1. */
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = pageCount(total, size);
  if (pages <= 1) return null;
  return (
    <nav className="mt-2 flex flex-wrap items-center gap-2 text-sm" aria-label={`Páginas de ${label.toLowerCase()}`}>
      <span className="help tabular mr-auto" aria-live="polite">
        {label} {int((page - 1) * size + 1)}–{int(Math.min(page * size, total))} de {int(total)}
      </span>
      <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="tabular">
        {page} de {pages}
      </span>
      <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente
      </Button>
    </nav>
  );
}
