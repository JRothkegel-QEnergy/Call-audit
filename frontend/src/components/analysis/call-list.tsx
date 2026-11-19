"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CallVerdictBadge } from "@/components/ui/badges";
import { Pager } from "@/components/ui/pager";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CallsQuery } from "@/lib/api/analysis-types";
import { mmss, shortDate } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/** Enlace a la llamada con su origen: el banner y «Volver» se arman con estos parámetros (C-08). */
export function callHref(
  caseId: string,
  back: string,
  criterion?: number,
  source?: string,
  evidenceMs?: number | null,
  reference?: string | null,
) {
  const q = new URLSearchParams({ from: "analysis", back });
  if (reference) q.set("ref", reference);
  if (criterion != null) q.set("criterion", String(criterion));
  if (source) q.set("source", source);
  if (evidenceMs != null) q.set("t", String(Math.max(0, evidenceMs - 4000)));
  return `/calls/${encodeURIComponent(caseId)}?${q}`;
}

/**
 * Llamadas de una cifra. `paged`: la página vive en la URL (lista propia, D-17); si no, en el estado local (ficha).
 */
export function CallList({
  query,
  paged = true,
  onPage,
}: {
  query: CallsQuery;
  paged?: boolean;
  onPage?: (page: number) => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [localPage, setLocalPage] = useState(1);
  const page = paged ? (query.page ?? 1) : localPage;
  const list = useAsync(() => api.listAnalysisCalls({ ...query, page }), [JSON.stringify(query), page]);
  const back = `${pathname}${params.toString() ? `?${params}` : ""}`;
  const withCriterion = query.criterion != null;

  return (
    <AsyncView state={list} what="las llamadas">
      {(d) =>
        d.total === 0 ? (
          <EmptyState title="No hay llamadas con estos filtros en esta foto." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tbl">
                <caption className="sr-only">Llamadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Llamada</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Ejecutivo</th>
                    <th scope="col">Tipo de seguro</th>
                    <th scope="col">Según la IA</th>
                    <th scope="col">Según el auditor</th>
                    {withCriterion && <th scope="col">Evidencia de la IA</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.caseId + r.callId}>
                      <th scope="row">
                        <Link
                          href={callHref(r.caseId, back, query.criterion, query.source, r.evidenceMs, r.reference)}
                          className="font-semibold tabular"
                        >
                          {r.callId}
                        </Link>
                      </th>
                      <td className="tabular">{shortDate(r.callDate)}</td>
                      <td>{r.agentName}</td>
                      <td>{r.insuranceType}</td>
                      <td>
                        {withCriterion ? (r.aiFails ? "No cumple" : "Cumple") : <CallVerdictBadge verdict={r.aiVerdict} />}
                      </td>
                      <td>
                        {withCriterion ? (
                          r.sheetFails == null ? "—" : r.sheetFails ? "No cumple" : "Cumple"
                        ) : r.sheetVerdict ? (
                          <CallVerdictBadge verdict={r.sheetVerdict} />
                        ) : (
                          "—"
                        )}
                        {r.reference && <span className="help block">{r.reference === "auditor" ? "en la app" : "de la planilla"}</span>}
                      </td>
                      {withCriterion && (
                        <td className="tabular">{r.evidenceMs != null ? mmss(r.evidenceMs) : <span className="help">sin evidencia de la IA</span>}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              label="Llamadas"
              page={d.page}
              size={d.pageSize}
              total={d.total}
              onChange={(n) => (paged ? onPage?.(n) : setLocalPage(n))}
            />
          </>
        )
      }
    </AsyncView>
  );
}
