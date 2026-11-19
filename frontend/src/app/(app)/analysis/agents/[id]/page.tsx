"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CallList } from "@/components/analysis/call-list";
import { ChartFigure, DivergingBars, Dumbbell, DumbbellLegend, KpiCards, signed, TrendChart } from "@/components/analysis/charts";
import { useSnapshotMeta } from "@/components/analysis/frame";
import {
  DeviationText,
  LowSampleMark,
  MetricLink,
  NoticeDataExplained,
  pct0,
  useAnalysisParams,
  useIsQubico,
  withFilters,
} from "@/components/analysis/parts";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

const DATA_EXPLAINED_NOTE =
  "Parte de la diferencia viene de los datos de la gestión: el sistema registra una fila por grabación aunque en la llamada se gestionen varios seguros. No refleja solo el trabajo del ejecutivo.";

export default function AnalysisAgentPage() {
  const { id } = useParams<{ id: string }>();
  const agentId = decodeURIComponent(id);
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rubric = useRubric();
  const detail = useAsync(
    () => api.getAnalysisAgent(agentId, { type: p.type, flow: p.flow, all: p.all }),
    [agentId, p.type, p.flow, p.all],
  );
  const f = { type: p.type, flow: p.flow };
  const equal = meta.config.equal;
  const qubico = useIsQubico();
  const crit = (cid: number) => rubric?.criteria[cid]?.name ?? "";

  return (
    <>
      <p className="mb-2 mt-0 text-[13px]">
        <Link href={withFilters("/analysis/agents", f, { criterion: p.criterion })}>← Ejecutivos</Link>
      </p>
      <AsyncView state={detail} what="el ejecutivo">
        {(d) => {
          const a = d.agent;
          const above = d.criteria.filter((c) => c.deviationPts > equal).length;
          const callsHref = (cid: number) => withFilters("/analysis/calls", f, { agent: agentId, criterion: cid, source: "ai" });
          const title = (cid: number) => (
            <>
              <b>Criterio {cid}</b>
              <RenunciationReasonsButton criterionId={cid} /> <span className="text-muted-foreground">{crit(cid)}</span>
            </>
          );
          const max = Math.max(10, ...d.criteria.flatMap((c) => [c.aiPct, c.sheetPct ?? 0])) * 1.1;
          const trendOk = d.trend.filter((t) => !t.lowSample).length >= 2;
          const firstOk = d.trend.find((t) => !t.lowSample);
          const lastOk = [...d.trend].reverse().find((t) => !t.lowSample);
          const explained = d.criteria.some((c) => c.criterionId === 25);
          return (
            <>
              <h2 className="mb-1 mt-0 text-lg font-semibold">
                {a.name}
                {a.lowSample && <LowSampleMark />}
              </h2>
              <p className="help mb-3 mt-0">Son hallazgos para conversar con el ejecutivo, no una evaluación ni una sanción.</p>

              <KpiCards
                items={[
                  { label: "Llamadas", value: a.calls, hint: `${a.evaluated} revisadas por un auditor` },
                  { label: "Con algún No cumple, según la IA", value: pct0(a.aiPct), hint: `de ${a.calls} llamadas` },
                  { label: "Según el auditor", value: pct0(a.sheetPct), hint: a.evaluated ? `de ${a.evaluated} revisadas` : "sin revisión del auditor" },
                  {
                    label: "Frente al equipo",
                    value: Math.abs(a.deviationPts) <= equal ? "Igual" : `${signed(a.deviationPts)} pts`,
                    hint: Math.abs(a.deviationPts) <= equal ? "que el equipo, según la IA" : `${a.deviationPts > 0 ? "sobre" : "bajo"} el equipo, según la IA`,
                  },
                ]}
              />

              <ChartFigure
                className="mb-4"
                title={above ? `Más No cumple que el equipo en ${above} ${above === 1 ? "criterio" : "criterios"}` : "En ningún criterio se aleja del equipo"}
                subtitle="Criterios donde más se aleja del equipo, según la IA, en puntos."
              >
                <DivergingBars
                  equal={equal}
                  leftLabel="Menos No cumple que el equipo"
                  rightLabel="Más No cumple"
                  label={`${a.name}: desvío frente al equipo por criterio, según la IA. ${d.criteria
                    .map((c) => `Criterio ${c.criterionId}: ${signed(c.deviationPts)} pts`)
                    .join("; ")}.`}
                  rows={d.criteria.map((c) => ({
                    key: String(c.criterionId),
                    title: title(c.criterionId),
                    value: c.deviationPts,
                    text: Math.abs(c.deviationPts) <= equal ? "Igual" : `${signed(c.deviationPts)} pts`,
                    href: c.aiPct ? callsHref(c.criterionId) : null,
                    tip: (
                      <>
                        <b>Criterio {c.criterionId}</b> {crit(c.criterionId)}
                        <br />
                        Según la IA: {pct0(c.aiPct)} ({signed(c.deviationPts)} pts frente al equipo)
                        {c.aiPct ? (
                          <>
                            <br />
                            Clic para ver las llamadas
                          </>
                        ) : null}
                      </>
                    ),
                  }))}
                />
                {explained && (
                  <div className="mt-3">
                    <NoticeDataExplained note={`Criterio 25: ${DATA_EXPLAINED_NOTE}`} />
                  </div>
                )}
              </ChartFigure>

              <ChartFigure
                className="mb-4"
                title="Según la IA y según el auditor, en los mismos criterios"
                subtitle="% de sus llamadas con No cumple en cada criterio."
                legend={<DumbbellLegend />}
              >
                <div
                  role="img"
                  aria-label={`${a.name}: % No cumple por criterio según la IA y según el auditor. ${d.criteria
                    .map((c) => `Criterio ${c.criterionId}: IA ${Math.round(c.aiPct)} %, auditor ${c.sheetPct == null ? "sin revisión" : `${Math.round(c.sheetPct)} %`}`)
                    .join("; ")}.`}
                >
                  <div className="grid gap-1" aria-hidden>
                    {d.criteria.map((c) => (
                      <div key={c.criterionId} className="grid min-h-8 grid-cols-[minmax(140px,240px)_1fr_auto] items-center gap-3 px-1 text-[13px]">
                        <span className="truncate">{title(c.criterionId)}</span>
                        <Dumbbell ai={c.aiPct} sheet={c.sheetPct} max={max} width={320} />
                        <span className="whitespace-nowrap tabular">
                          IA {pct0(c.aiPct)} · {c.sheetPct == null ? <span className="help">sin revisión del auditor</span> : `auditor ${pct0(c.sheetPct)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartFigure>
              {!d.showingAll ? (
                <button type="button" className="btn mb-4" onClick={() => p.set({ all: "true" }, { keepPage: true })}>
                  Ver los 33 criterios
                </button>
              ) : p.all ? (
                <button type="button" className="btn mb-4" onClick={() => p.set({ all: null }, { keepPage: true })}>
                  Ver menos
                </button>
              ) : null}

              <ChartFigure
                className="mb-4"
                title={
                  trendOk && firstOk && lastOk
                    ? `Cómo ha cambiado: de ${pct0(firstOk.aiPct)} a ${pct0(lastOk.aiPct)} de llamadas con algún No cumple, según la IA`
                    : "Cómo ha cambiado"
                }
                subtitle="% de llamadas con algún No cumple, en tramos de 30 días."
              >
                {meta.periods.length === 0 ? (
                  <p className="help m-0">La evolución aparece cuando la foto cubre 60 días o más.</p>
                ) : !trendOk ? (
                  <p className="help m-0">
                    Todavía no hay llamadas suficientes para ver la evolución: se necesitan {meta.config.low} en al menos dos tramos.
                  </p>
                ) : (
                  <TrendChart
                    periods={meta.periods}
                    format={(v) => `${Math.round(v)} %`}
                    lowNote={d.trend.map((t) => t.lowSample)}
                    label={`Evolución en 3 tramos de 30 días. Según la IA: ${d.trend.map((t) => pct0(t.aiPct)).join(", ")}. Según el auditor: ${d.trend
                      .map((t) => pct0(t.sheetPct))
                      .join(", ")}. Equipo: ${d.trend.map((t) => pct0(t.teamAiPct)).join(", ")}.`}
                    series={[
                      { label: "Según la IA", color: "var(--analysis-ai)", values: d.trend.map((t) => (t.calls ? t.aiPct : null)), low: d.trend.map((t) => t.lowSample) },
                      { label: "Según el auditor", color: "var(--analysis-sheet)", hollow: true, values: d.trend.map((t) => t.sheetPct) },
                      { label: "Equipo, según la IA", color: "var(--neutral-700)", dashed: true, values: d.trend.map((t) => t.teamAiPct) },
                    ]}
                  />
                )}
              </ChartFigure>

              <h3 className="mb-2 mt-2 text-base font-semibold">Detalle por criterio</h3>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">Criterios de {a.name}, de mayor a menor desvío frente al equipo</caption>
                  <thead>
                    <tr>
                      <th scope="col">Criterio</th>
                      <th scope="col">Según la IA</th>
                      <th scope="col">Según el auditor</th>
                      <th scope="col" aria-sort="descending">
                        Frente al equipo ↓
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.criteria.map((c) => (
                      <tr key={c.criterionId}>
                        <th scope="row" className="max-w-[360px] whitespace-normal font-normal">
                          {qubico ? (
                            <Link href={withFilters(`/analysis/criteria/${c.criterionId}`, f)} className="font-semibold text-foreground">
                              {c.criterionId}
                            </Link>
                          ) : (
                            <span className="font-semibold">{c.criterionId}</span>
                          )}{" "}
                          <span className="text-muted-foreground">{crit(c.criterionId)}</span>
                          <RenunciationReasonsButton criterionId={c.criterionId} />
                        </th>
                        <td className="num">
                          <MetricLink href={c.aiPct ? callsHref(c.criterionId) : null} label={`Criterio ${c.criterionId}: ${pct0(c.aiPct)} según la IA. Ver llamadas`}>
                            {pct0(c.aiPct)}
                          </MetricLink>
                        </td>
                        <td className="num">{pct0(c.sheetPct)}</td>
                        <td>
                          <DeviationText pts={c.deviationPts} equal={equal} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-2 mt-6 text-base font-semibold">Sus llamadas</h3>
              {a.calls ? (
                <CallList query={{ ...f, agent: agentId, criterion: p.criterion, source: p.criterion ? "ai" : undefined }} paged={false} />
              ) : (
                <EmptyState title="No tiene llamadas en esta foto." />
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
