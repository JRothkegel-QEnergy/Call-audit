"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { PatternActions, PatternBody, PatternTags } from "@/components/admin/discrepancy-parts";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { DiscrepancyCase, DiscrepancyPattern, DiscrepancyPatternDetail } from "@/lib/api/admin-types";
import { mmss, shortDate } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Filter = "all" | "manual" | "disagree";

const AI = { compliant: "Cumple", non_compliant: "No cumple", uncertain: "Dudosa", not_applicable: "No aplica" } as Record<string, string>;
const SIDES = { ai: "da razón a la IA", excel: "da razón al Excel", none: "no se alinea" } as const;

const disagree = (c: DiscrepancyCase) =>
  (c.manualVerdict === "compliant" || c.manualVerdict === "non_compliant") && (c.manualVerdict === "non_compliant") !== c.clientFail;

/** Detalle de un patrón con sus casos y las tres miradas por fila (Cambio 16, D-65 y D-69). */
export function PatternDetailView({ id }: { id: string }) {
  const detail = useAsync(() => api.getDiscrepancyPattern(id), [id]);
  return (
    <AsyncView state={detail} what="el patrón">
      {(p) => <PatternDetail initial={p} />}
    </AsyncView>
  );
}

function PatternDetail({ initial }: { initial: DiscrepancyPatternDetail }) {
  const [p, setP] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const cases = p.cases.filter((c) => filter === "all" || (filter === "manual" ? c.manualVerdict != null : disagree(c)));
  // Al volver desde la llamada, el foco queda en la fila del caso (§7.6).
  useEffect(() => {
    const last = sessionStorage.getItem(`pattern-case-${p.id}`);
    if (last) document.getElementById(`case-${last}`)?.focus();
  }, [p.id]);
  return (
    <>
      <Link href="/admin/discrepancies" className="btn btn-ghost btn-sm mb-2">
        <ChevronLeft size={14} aria-hidden /> Patrones
      </Link>
      <AdminHeader title={`Motivo ${p.criterionId} · ${p.title}`} description={p.criterionName ?? undefined} />
      <section className="card mb-4 grid gap-2">
        <PatternTags p={p} />
        <PatternBody p={p} />
        {p.criterionSummary && <p className="help m-0">Resumen del motivo: {p.criterionSummary}</p>}
        <PatternActions p={p} readOnly={p.readOnly} showCases={false} onChange={(next: DiscrepancyPattern) => setP({ ...p, ...next })} />
      </section>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="m-0 flex-1 text-lg font-semibold">Casos ({p.cases.length})</h2>
        <div className="seg" role="group" aria-label="Filtro de casos">
          {(
            [
              ["all", "Todos"],
              ["manual", "Con revisión manual"],
              ["disagree", "Desacuerdo entre revisores"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Llamada</th>
              <th scope="col">Fecha</th>
              <th scope="col">IA</th>
              <th scope="col">Cliente</th>
              <th scope="col">Revisión manual</th>
              <th scope="col">Cita de la IA · comentario del cliente</th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={7} className="help">
                  Ningún caso con este filtro.
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.callId}>
                <td className="tabular">{c.callId}</td>
                <td className="tabular">{c.callDate ? shortDate(c.callDate) : "—"}</td>
                <td>{AI[c.aiVerdict] ?? c.aiVerdict}</td>
                <td>{c.clientFail ? "No cumple" : "Cumple"}</td>
                <td>
                  {c.manualVerdict ? `${AI[c.manualVerdict] ?? c.manualVerdict}${c.manualSidesWith ? ` · ${SIDES[c.manualSidesWith]}` : ""}` : "—"}
                  {disagree(c) && <div className="help">Desacuerdo entre revisores</div>}
                </td>
                <td className="max-w-[420px]">
                  <div>
                    IA: {c.aiQuote ? `«${c.aiQuote}»${c.aiQuoteMs != null ? ` (${mmss(c.aiQuoteMs)})` : ""}` : c.aiComment || "—"}
                  </div>
                  <div className="help">Cliente: {c.clientComment ?? "sin comentario"}</div>
                </td>
                <td>
                  {c.caseId && (
                    <Link
                      id={`case-${c.callId}`}
                      className="btn btn-sm"
                      href={`/calls/${c.caseId}?from=analysis&pattern=${encodeURIComponent(p.id)}&motivo=${p.criterionId}${
                        c.aiQuoteMs != null ? `&t=${Math.max(0, c.aiQuoteMs - 4000)}` : ""
                      }`}
                      onClick={() => sessionStorage.setItem(`pattern-case-${p.id}`, c.callId)}
                    >
                      Abrir
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
