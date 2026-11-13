"use client";

import Link from "next/link";
import { useState } from "react";
import { PARTS, Swatch } from "@/components/admin/agreement-charts";
import { listHref } from "@/components/admin/verification-labels";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { QualityGrid, QualitySeries } from "@/lib/api/admin-types";
import { int } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/**
 * Análisis por caso (docs/ux/admin-prompt-metrics/06-ajustes-feedback.md §2, F1): una columna por llamada de validación
 * y una fila por motivo, con los colores del mosaico. Va en un acordeón cerrado y se pide al abrirlo.
 */

type Kind = "fn" | "fp" | "undecided" | "both";
type Page = "approved" | "rejected";

const CELL: Record<Kind | "blue", React.CSSProperties> = {
  fn: PARTS.promptFn.style,
  fp: PARTS.promptFp.style,
  blue: PARTS.reviewer.style,
  undecided: PARTS.undecided.style,
  both: PARTS.agree.style,
};

/** Orden de las columnas: desacuerdo de veredicto, luego solo por motivo, luego coincide. */
const RANK: Record<string, number> = { promptFn: 0, promptFp: 0, reviewer: 0, undecided: 1, agree: 2 };

export function CaseGrid({ series }: { series: QualitySeries }) {
  const [open, setOpen] = useState(false);
  const n = series.agreement.byCall.n;
  return (
    <details className="card" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold">
        Análisis por caso · {int(n)} llamadas × {series.agreement.criteria} motivos de v{series.promptVersion}
      </summary>
      {open && <GridBody series={series} />}
    </details>
  );
}

function GridBody({ series }: { series: QualitySeries }) {
  const state = useAsync(() => api.getQualityGrid(series.id), [series.id]);
  return (
    <div className="mt-3">
      <AsyncView state={state} what="el análisis por caso">
        {(g) => <Grid g={g} series={series} />}
      </AsyncView>
    </div>
  );
}

function Grid({ g, series }: { g: QualityGrid; series: QualitySeries }) {
  const [page, setPage] = useState<Page>("approved");
  const approved = g.calls.filter((c) => c.reviewerVerdict === "compliant");
  const rejected = g.calls.filter((c) => c.reviewerVerdict !== "compliant");
  const calls = (page === "approved" ? approved : rejected)
    .map((c) => ({ ...c, wrong: c.items.some(([, k]) => k === "fn" || k === "fp") }))
    .sort((a, b) => RANK[a.segment] - RANK[b.segment] || Number(b.wrong) - Number(a.wrong) || a.callId.localeCompare(b.callId));
  const used = new Set(calls.flatMap((c) => c.items.map(([cid]) => cid)));
  const rows = g.criteria.filter((cid) => used.has(cid));
  const v = g.listVersion;
  const fp = calls.filter((c) => c.segment === "promptFp" || (c.segment === "reviewer" && c.reviewerVerdict === "compliant")).length;
  const fn = calls.filter((c) => c.segment === "promptFn" || (c.segment === "reviewer" && c.reviewerVerdict !== "compliant")).length;
  const cellOf = (c: (typeof calls)[number], cid: number) => {
    const item = c.items.find(([id]) => id === cid);
    if (!item) return undefined;
    return item[2] ? CELL.blue : CELL[item[1]];
  };
  const caseHref = (caseId: string, segment: string) =>
    v ? `/admin/prompts/${encodeURIComponent(v)}/calls/${encodeURIComponent(caseId)}?segment=${segment}` : null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="radiogroup" aria-label="Llamadas">
          {(
            [
              ["approved", `Aprobadas por el revisor (${int(approved.length)})`],
              ["rejected", `Rechazadas por el revisor (${int(rejected.length)})`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={page === k} onClick={() => setPage(k)}>
              {label}
            </button>
          ))}
        </div>
        {v && (
          <Link href={listHref(v, "disagree")} className="ml-auto text-sm">
            Ver como lista ›
          </Link>
        )}
      </div>
      <p className="sr-only">
        v{series.promptVersion}, {page === "approved" ? "aprobadas" : "rechazadas"} por el revisor: {int(calls.length)} llamadas,{" "}
        {page === "approved" ? `${int(fp)} falsas alarmas` : `${int(fn)} rechazos no detectados`}. Cada columna es una llamada y lleva a su caso.
      </p>
      <p className="help m-0">
        Cada columna es una llamada: primero las que no coinciden en el veredicto, luego las que solo difieren en algún motivo.
        {v ? " Clic en una columna para abrir el caso; clic en un motivo para ver sus llamadas." : " La vigente no tiene página de caso."}
      </p>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2">
          <div className="grid auto-rows-[10px] gap-y-[2px] text-[11px] leading-[10px]">
            <span className="font-semibold">Veredicto</span>
            {rows.map((cid) =>
              v ? (
                <Link key={cid} href={listHref(v, "disagree", cid)} className="no-underline hover:underline" aria-label={`Ver las llamadas con desacuerdo en el motivo ${cid}`}>
                  M{String(cid).padStart(2, "0")}
                </Link>
              ) : (
                <span key={cid}>M{String(cid).padStart(2, "0")}</span>
              ),
            )}
          </div>
          <div className="flex gap-px">
            {calls.map((c) => {
              const href = caseHref(c.caseId, c.segment);
              const body = (
                <>
                  <span className="block h-[10px]" style={PARTS[c.segment].style} />
                  {rows.map((cid) => (
                    <span key={cid} className="block h-[10px] bg-[var(--neutral-100,#f4f4f4)]" style={cellOf(c, cid)} />
                  ))}
                </>
              );
              const label = `Llamada ${c.callId}: ${PARTS[c.segment].name}${c.items.length ? `, motivos ${c.items.map(([id]) => id).join(", ")}` : ""}`;
              return href ? (
                <Link
                  key={c.caseId}
                  href={href}
                  title={label}
                  aria-label={`${label}. Abrir el caso`}
                  className="grid min-w-[4px] flex-1 gap-y-[2px] outline-offset-1 focus-visible:outline focus-visible:outline-2"
                >
                  {body}
                </Link>
              ) : (
                <span key={c.caseId} title={label} className="grid min-w-[4px] flex-1 gap-y-[2px]">
                  {body}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1.5">
          <Swatch part="agree" /> Ambos lo marcan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch part="promptFp" /> Solo la IA lo marca
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch part="promptFn" /> Solo el revisor lo marca
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch part="reviewer" /> Posible error del revisor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch part="undecided" /> Sin decisión de la IA
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-[var(--neutral-100,#f4f4f4)]" /> Ninguno lo marca
        </span>
      </p>
      <p className="help m-0">La fila Veredicto usa los colores del mosaico. Solo se muestran los motivos con alguna marca en estas llamadas.</p>
    </div>
  );
}
