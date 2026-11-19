"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSnapshotMeta } from "@/components/analysis/frame";
import {
  CriterionStatusBadge,
  DeviationText,
  FilterBar,
  LowSampleMark,
  MetricLink,
  NoticeDataExplained,
  pct0,
  pct1,
  ptsText,
  rowClass,
  useAnalysisParams,
  withFilters,
} from "@/components/analysis/parts";
import { AgentsGateNotice } from "@/components/analysis/agents-gate";
import { KpiCard } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

export default function CriterionPage() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rubric = useRubric();
  const detail = useAsync(() => api.getAnalysisCriterion(cid, { type: p.type, flow: p.flow }), [cid, p.type, p.flow]);
  const f = { type: p.type, flow: p.flow };
  const calls = (source: string, type?: string) =>
    withFilters("/analysis/calls", { ...f, type: type ?? f.type }, { criterion: cid, source });

  // D-41: Criterios solo para Qubico; al supervisor la API responde 404.
  if (detail.status === "error" && detail.error.message === "not_found") return <EmptyState title="No encontramos esta página." />;
  return (
    <>
      <p className="mb-2 mt-0 text-[13px]">
        <Link href={withFilters("/analysis/criteria", f)}>← Criterios</Link>
      </p>
      <h2 className="mb-3 mt-0 text-lg font-semibold">
        Criterio {cid} · {rubric?.criteria[cid]?.name ?? ""}
        <RenunciationReasonsButton criterionId={cid} />
      </h2>
      <FilterBar meta={meta} />
      <AsyncView state={detail} what="el criterio">
        {(d) =>
          d.base.withRun === 0 ? (
            <EmptyState title="No hay llamadas con estos filtros en esta foto.">
              <button type="button" className="btn" onClick={p.clear}>
                Quitar filtros
              </button>
            </EmptyState>
          ) : (
            <>
              {d.dataExplainedNote && <NoticeDataExplained note={d.dataExplainedNote} />}
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  value={<MetricLink href={d.mismatchCalls ? calls("mismatch") : null} label={`${pct1(d.mismatchPct)} no coinciden. Ver llamadas`}>{pct1(d.mismatchPct)}</MetricLink>}
                  label="No coinciden"
                  hint={`${d.mismatchCalls} de ${d.base.evaluated} llamadas revisadas por un auditor`}
                />
                <KpiCard
                  value={<MetricLink href={calls("ai")} label={`${pct1(d.aiPct)} según la IA. Ver llamadas`}>{pct1(d.aiPct)}</MetricLink>}
                  label="Según la IA"
                  hint={`sobre ${d.base.withRun} llamadas con corrida`}
                />
                <KpiCard
                  value={<MetricLink href={d.sheetPct == null ? null : calls("sheet")} label={`${pct1(d.sheetPct)} según el auditor. Ver llamadas`}>{pct1(d.sheetPct)}</MetricLink>}
                  label="Según el auditor"
                  hint={`sobre ${d.base.evaluated} llamadas revisadas por un auditor`}
                />
                <KpiCard value={ptsText(d.gapPts)} label="Diferencia (auditor − IA)" badge={<CriterionStatusBadge status={d.status} />} />
              </div>

              <h3 className="mb-2 text-base font-semibold">Dónde se concentra</h3>
              <div className="mb-5 overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">Criterio {cid} por tipo de seguro</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tipo de seguro</th>
                      <th scope="col">Llamadas</th>
                      <th scope="col">No coinciden</th>
                      <th scope="col">Según la IA</th>
                      <th scope="col">Según el auditor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.byInsuranceType.map((t) => (
                      <tr key={t.insuranceType} className={rowClass(t.lowSample)}>
                        <th scope="row" className="font-semibold">
                          {t.insuranceType}
                          {t.lowSample && <LowSampleMark />}
                        </th>
                        <td className="num">{t.calls}</td>
                        <td className="num">
                          <MetricLink href={t.mismatchPct ? calls("mismatch", t.insuranceType) : null} label={`${t.insuranceType}: ${pct0(t.mismatchPct)} no coinciden. Ver llamadas`}>
                            {pct0(t.mismatchPct)}
                          </MetricLink>
                        </td>
                        <td className="num">
                          <MetricLink href={calls("ai", t.insuranceType)} label={`${t.insuranceType}: ${pct0(t.aiPct)} según la IA. Ver llamadas`}>
                            {pct0(t.aiPct)}
                          </MetricLink>
                        </td>
                        <td className="num">{pct0(t.sheetPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 text-base font-semibold">Ejecutivos que se desvían en este criterio</h3>
              {!d.agentsGate.open ? (
                <AgentsGateNotice gate={d.agentsGate} low={meta.config.low} />
              ) : d.deviatingAgents.length === 0 ? (
                <p className="help">Ningún ejecutivo con suficientes llamadas se aleja del equipo en este criterio.</p>
              ) : (
                <ul className="m-0 grid list-none gap-1 p-0">
                  {d.deviatingAgents.map((a) => (
                    <li key={a.agentId}>
                      <Link href={withFilters(`/analysis/agents/${encodeURIComponent(a.agentId)}`, f, { criterion: cid })} className="font-semibold">
                        {a.name}
                      </Link>{" "}
                      · <DeviationText pts={a.deviationPts} equal={meta.config.equal} />
                    </li>
                  ))}
                </ul>
              )}
              {d.agentsGate.open && (
                <p className="mt-2">
                  <Link href={withFilters("/analysis/agents", f, { criterion: cid })}>Ver todos los ejecutivos</Link>
                </p>
              )}
            </>
          )
        }
      </AsyncView>
    </>
  );
}
