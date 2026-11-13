"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { CaseMix, FixBar, Swatch, WHO_LABEL } from "@/components/admin/discrepancy-charts";
import { PatternActions, PatternBody, PatternTags } from "@/components/admin/discrepancy-parts";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { DiscrepancyCase, DiscrepancyPattern, DiscrepancyPatternDetail } from "@/lib/api/admin-types";
import { mmss, shortDate } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Filter = "all" | "manual" | "disagree" | "fix";

const AI = { compliant: "Cumple", non_compliant: "No cumple", uncertain: "Dudosa", not_applicable: "No aplica" } as Record<string, string>;
const SIDES = { ai: "da razón a la IA", excel: "da razón a la planilla", none: "no se alinea" } as const;

const disagree = (c: DiscrepancyCase) =>
  (c.manualVerdict === "compliant" || c.manualVerdict === "non_compliant") && (c.manualVerdict === "non_compliant") !== c.clientFail;

/** Síntesis del patrón sobre la tabla de casos (Cambio 19 §7.5). Lo de v1.1+ se dice una vez si falta. */
function PatternSynthesis({ p }: { p: DiscrepancyPatternDetail }) {
  const sides = { ai: 0, excel: 0, none: 0, missing: 0 };
  for (const c of p.cases) sides[c.manualSidesWith ?? "missing"] += 1;
  const total = p.cases.length || 1;
  const noAi = p.whoIsRight == null && p.expectedFix == null && !p.sideEffects && !p.concentration;
  return (
    <section className="card mb-4 grid gap-1.5" aria-label="Síntesis del patrón">
      <CaseMix k={p.kindCounts} label={`Desacuerdos (${p.cases.length})`} />
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Revisión manual:</span>
        <span aria-hidden className="flex h-3 w-40 overflow-hidden rounded-[2px] shadow-[inset_0_0_0_1px_var(--neutral-400,#a3a3a3)]">
          <span style={{ background: "var(--series-6)", width: `${(100 * sides.ai) / total}%` }} />
          <span style={{ background: "var(--series-5)", width: `${(100 * sides.excel) / total}%` }} />
        </span>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Swatch fill={{ background: "var(--series-6)" }} /> {sides.ai} dan razón a la IA ·
          <Swatch fill={{ background: "var(--series-5)" }} /> {sides.excel} a la planilla
          {sides.none ? ` · ${sides.none} no se alinean` : ""} · {sides.missing} sin revisión
        </span>
      </p>
      <div className="grid gap-0.5 text-sm">
        <span className="text-muted-foreground">Antes de aceptar:</span>
        {noAi ? (
          <span className="help">
            Sin dato en este análisis: quién tiene más razón, desacuerdos que corregiría, posibles efectos y concentración. Aparecen al correr un
            análisis nuevo.
          </span>
        ) : (
          <>
            {p.whoIsRight && (
              <span className="inline-flex items-center gap-1.5">
                <Swatch fill={{ background: p.whoIsRight === "auditor" ? "var(--series-5)" : p.whoIsRight === "ia" ? "var(--series-6)" : "var(--neutral-500)" }} />
                Más razón: <b>{WHO_LABEL[p.whoIsRight].toLowerCase()}</b> · según el análisis{p.tentative ? " · tentativo" : ""}
              </span>
            )}
            {p.expectedFix != null && p.proposal && (
              <span>
                Si se acepta: <FixBar fixed={p.expectedFix.length} total={p.caseCount} />
              </span>
            )}
            {p.sideEffects && <span>Podría cambiar: {p.sideEffects}</span>}
            {p.concentration && <span>Concentración: {p.concentration}</span>}
          </>
        )}
      </div>
    </section>
  );
}

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
  const cases = p.cases.filter(
    (c) => filter === "all" || (filter === "manual" ? c.manualVerdict != null : filter === "fix" ? c.expectedFix === true : disagree(c)),
  );
  const hasFix = p.expectedFix != null;
  // Cambio 20: «volver» recupera la lista exacta (motivo y filtros) desde donde se abrió el patrón.
  // Este componente se monta recién con el patrón cargado, ya en el navegador.
  const [back] = useState(() => sessionStorage.getItem("discrepancies-list-url") ?? `/admin/discrepancies?tab=patterns&motivo=${initial.criterionId}`);
  // Al volver desde la llamada, el foco queda en la fila del caso (§7.6).
  useEffect(() => {
    const last = sessionStorage.getItem(`pattern-case-${p.id}`);
    if (last) document.getElementById(`case-${last}`)?.focus();
  }, [p.id]);
  return (
    <>
      <Link href={back} className="btn btn-ghost btn-sm mb-2">
        <ChevronLeft size={14} aria-hidden /> Motivo {p.criterionId}
      </Link>
      <AdminHeader title={`Motivo ${p.criterionId} · ${p.title}`} description={p.criterionName ?? undefined} />
      <section className="card mb-4 grid gap-2">
        <PatternTags p={p} />
        <PatternBody p={p} />
        {p.criterionSummary && <p className="help m-0">Resumen del motivo: {p.criterionSummary}</p>}
        <PatternActions p={p} readOnly={p.readOnly} showCases={false} onChange={(next: DiscrepancyPattern) => setP({ ...p, ...next })} />
      </section>

      <PatternSynthesis p={p} />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="m-0 flex-1 text-lg font-semibold">Desacuerdos ({p.cases.length})</h2>
        <div className="seg" role="group" aria-label="Filtro de desacuerdos">
          {(
            [
              ["all", "Todos"],
              ["manual", "Con revisión manual"],
              ["disagree", "Desacuerdo entre revisores"],
              ...(hasFix ? ([["fix", "Lo corregiría"]] as const) : []),
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
              <th scope="col">Planilla</th>
              <th scope="col">Revisión manual</th>
              <th scope="col">Cita de la IA · comentario en la planilla</th>
              {hasFix && <th scope="col">Corregiría</th>}
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={hasFix ? 8 : 7} className="help">
                  Ningún desacuerdo con este filtro.
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
                {/* .tbl no corta líneas: la cita sí, para no pisar las columnas siguientes. */}
                <td className="min-w-[320px] max-w-[560px] py-2 whitespace-normal">
                  <div>
                    IA: {c.aiQuote ? `«${c.aiQuote}»${c.aiQuoteMs != null ? ` (${mmss(c.aiQuoteMs)})` : ""}` : c.aiComment || "—"}
                  </div>
                  <div className="help">Planilla: {c.clientComment ?? "sin comentario"}</div>
                </td>
                {hasFix && <td>{c.expectedFix ? "Sí" : "—"}</td>}
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
