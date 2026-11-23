"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

export type SortDir = "asc" | "desc";

/**
 * Encabezado de tabla ordenable (19-resumen-avance-y-orden-bandejas, X4 A): el clic va en un botón dentro del `<th>`,
 * con la flecha ↑ (ascendente) o ↓ (descendente) solo en la columna ordenada y `aria-sort` en ella.
 */
export function SortableTh({
  label,
  dir,
  onClick,
  className,
}: {
  label: string;
  /** Dirección si esta columna es la ordenada; null si no. */
  dir: SortDir | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined} className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-[inherit] hover:underline"
        aria-label={`Ordenar por ${label}`}
        onClick={onClick}
      >
        {label}
        {dir === "asc" && <ArrowUp size={13} aria-hidden />}
        {dir === "desc" && <ArrowDown size={13} aria-hidden />}
      </button>
    </th>
  );
}

/** Ciclo de 3 clics: ↑ ascendente → ↓ descendente → sin orden (vuelve al de la lista). */
export function nextSort<K extends string>(current: K | null, dir: SortDir | null, column: K): { sort: K | null; dir: SortDir | null } {
  if (current !== column) return { sort: column, dir: "asc" };
  if (dir === "asc") return { sort: column, dir: "desc" };
  return { sort: null, dir: null };
}
