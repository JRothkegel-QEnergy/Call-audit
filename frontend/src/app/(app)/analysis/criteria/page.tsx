"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSnapshotMeta } from "@/components/analysis/frame";
import {
  CriterionStatusBadge,
  FilterBar,
  HelpList,
  MetricLink,
  PairedBars,
  pct0,
  ptsText,
  useAnalysisParams,
  withFilters,
} from "@/components/analysis/parts";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CriterionRow } from "@/lib/api/analysis-types";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

type SortKey = "mismatchPct" | "aiPct" | "sheetPct" | "gapPts" | "criterionId";
const COLUMNS: { key: SortKey; label: string; unit?: string }[] = [
  { key: "criterionId", label: "Criterio" },
  { key: "mismatchPct", label: "No coinciden", unit: "% de llamadas" },
  { key: "aiPct", label: "Según la IA", unit: "% de llamadas" },
  { key: "sheetPct", label: "Según el auditor", unit: "% de llamadas" },
  { key: "gapPts", label: "Diferencia", unit: "pts" },
];

export default function CriteriaPage() {
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rubric = useRubric();
  const rows = useAsync(() => api.listAnalysisCriteria({ type: p.type, flow: p.flow }), [p.type, p.flow]);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "mismatchPct", desc: true });

  const sorted = useMemo(() => {
    const data = [...(rows.data ?? [])];
    const val = (r: CriterionRow) => (sort.key === "gapPts" ? Math.abs(r.gapPts ?? -1) : (r[sort.key] ?? -1));
    data.sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)) || a.criterionId - b.criterionId);
    return data;
  }, [rows.data, sort]);

  const f = { type: p.type, flow: p.flow };
  const callsHref = (r: CriterionRow, source: string) => withFilters("/analysis/calls", f, { criterion: r.criterionId, source });
  const name = (id: number) => rubric?.criteria[id]?.name ?? "";
  const many = (rows.data ?? []).filter((r) => (r.mismatchPct ?? 0) >= 10).length;
  const filterText = [p.type, p.flow].filter(Boolean).join(" · ");

  // D-41: Criterios solo para Qubico; al supervisor la API responde 404.
  if (rows.status === "error" && rows.error.message === "not_found") return <EmptyState title="No encontramos esta página." />;
  return (
    <>
      <FilterBar meta={meta} announce={rows.data ? `Mostrando ${rows.data.length} criterios${filterText ? ` · ${filterText}` : ""}` : undefined} />
      <AsyncView state={rows} what="los criterios">
        {(data) =>
          data.length === 0 ? (
            <EmptyState title={`No hay llamadas con ${filterText} en esta foto.`}>
              <button type="button" className="btn" onClick={p.clear}>
                Quitar filtros
              </button>
            </EmptyState>
          ) : (
            <>
              <h2 className="mb-2 mt-0 text-base font-semibold">
                {meta.sheetUntil
                  ? `En ${many} ${many === 1 ? "criterio" : "criterios"} la IA y el auditor no coinciden en 10 % de las llamadas o más`
                  : "Criterios según la IA"}
              </h2>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">
                    Criterios{filterText ? ` · ${filterText}` : ""}, ordenados por {COLUMNS.find((c) => c.key === sort.key)?.label}
                  </caption>
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                          <button
                            type="button"
                            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-inherit"
                            onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : c.key !== "criterionId" }))}
                          >
                            {c.label}
                            {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                          </button>
                          {c.unit && <span className="block font-normal">{c.unit}</span>}
                        </th>
                      ))}
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.criterionId}>
                        <th scope="row" className="max-w-[340px] whitespace-normal font-normal">
                          <Link href={withFilters(`/analysis/criteria/${r.criterionId}`, f)} className="font-semibold text-foreground">
                            {r.criterionId}
                          </Link>{" "}
                          <span className="text-muted-foreground">{name(r.criterionId)}</span>
                          <RenunciationReasonsButton criterionId={r.criterionId} />
                        </th>
                        <td className="num">
                          <MetricLink
                            href={r.mismatchCalls ? callsHref(r, "mismatch") : null}
                            label={`Criterio ${r.criterionId}: ${pct0(r.mismatchPct)} de llamadas no coinciden. Ver llamadas`}
                          >
                            {pct0(r.mismatchPct)}
                          </MetricLink>
                        </td>
                        <td className="num">
                          <MetricLink href={callsHref(r, "ai")} label={`Criterio ${r.criterionId}: ${pct0(r.aiPct)} según la IA. Ver llamadas`}>
                            {pct0(r.aiPct)}
                          </MetricLink>
                        </td>
                        <td className="num">
                          <MetricLink
                            href={r.sheetPct == null ? null : callsHref(r, "sheet")}
                            label={`Criterio ${r.criterionId}: ${pct0(r.sheetPct)} según el auditor. Ver llamadas`}
                          >
                            {pct0(r.sheetPct)}
                          </MetricLink>
                        </td>
                        <td className="num">
                          <span className="inline-flex items-center gap-2">
                            <PairedBars ai={r.aiPct} sheet={r.sheetPct} max={Math.max(...data.map((x) => Math.max(x.aiPct, x.sheetPct ?? 0)))} />
                            <span className="tabular">{ptsText(r.gapPts)}</span>
                          </span>
                        </td>
                        <td>
                          <CriterionStatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <HelpList
                items={[
                  ["No coinciden", "% de las llamadas revisadas por un auditor donde una fuente marca el criterio y la otra no."],
                  ["Según la IA", `% de llamadas con este criterio en No cumple, sobre todas las llamadas con corrida (${data[0].base.withRun}).`],
                  ["Según el auditor", `lo mismo, sobre las llamadas revisadas por un auditor (${data[0].base.evaluated}): su revisión en la app o, si no la hay, la planilla.`],
                  ["Diferencia", "auditor menos IA, en puntos. Dice hacia dónde se inclina, pero puede esconder llamadas que no coinciden."],
                  ["Se marca distinto", "la mayoría de los auditores no coincide con la IA en este criterio, así que conviene revisar cómo está definido."],
                ]}
              />
            </>
          )
        }
      </AsyncView>
    </>
  );
}
