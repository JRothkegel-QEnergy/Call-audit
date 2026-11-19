"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChartFigure, dec, DivergingBars, DotVsTeam, KpiCards, signed, TrendChart } from "@/components/analysis/charts";
import { useSnapshotMeta } from "@/components/analysis/frame";
import { MetricLink, pct0, useAnalysisParams, withFilters } from "@/components/analysis/parts";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

function severity(v: number) {
  if (Math.abs(v) < 0.5) return "Parejo";
  const n = Math.round(Math.abs(v));
  return v > 0 ? `Más estricto (+${n} pts)` : `Más permisivo (−${n} pts)`;
}

export default function EvaluatorPage() {
  const { id } = useParams<{ id: string }>();
  const name = decodeURIComponent(id);
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rubric = useRubric();
  const f = { type: p.type, flow: p.flow };
  const detail = useAsync(() => api.getAnalysisEvaluator(name, f), [name, p.type, p.flow]);
  // La fila del auditor en la lista trae «más estricto o permisivo» y «frente al equipo» por llamada.
  const rows = useAsync(() => api.listAnalysisEvaluators(f), [p.type, p.flow]);
  const matrix = useAsync(() => api.getAnalysisEvaluatorMatrix(f), [p.type, p.flow]);
  if (detail.status === "error" && detail.error.message === "not_found") return <EmptyState title="No encontramos esta página." />;
  const crit = (cid: number) => rubric?.criteria[cid]?.name ?? "";
  const equal = meta.config.equal;

  return (
    <>
      <p className="mb-2 mt-0 text-[13px]">
        <Link href={withFilters("/analysis/evaluators", f)}>← Auditores</Link>
      </p>
      <AsyncView state={detail} what="el auditor">
        {(d) => {
          const row = rows.status === "success" ? rows.data.find((r) => r.name === d.name) : undefined;
          const team = matrix.status === "success" ? matrix.data.team.disagreementPerCall : null;
          const mine = row?.disagreementPerCall ?? null;
          const shown = p.all ? d.criteria : d.criteria.slice(0, meta.config.topCriteria);
          const first = d.criteria[0];
          const apart = first && first.disagreementPct - first.teamDisagreementPct > equal;
          const callsHref = (cid: number) => withFilters("/analysis/calls", f, { evaluator: d.name, criterion: cid, source: "mismatch" });
          const title = (cid: number) => (
            <>
              <b>Criterio {cid}</b>
              <RenunciationReasonsButton criterionId={cid} /> <span className="text-muted-foreground">{crit(cid)}</span>
            </>
          );
          const trendOk = d.trend.filter((t) => !t.lowSample).length >= 2;
          const firstOk = d.trend.find((t) => !t.lowSample);
          const lastOk = [...d.trend].reverse().find((t) => !t.lowSample);
          return (
            <>
              <h2 className="mb-1 mt-0 text-lg font-semibold">{d.name}</h2>
              <p className="help mb-3 mt-0">Solo la ven personas de Qubico. Marcar distinto que la IA no es un error: la IA es el punto de comparación, no la respuesta correcta.</p>

              <KpiCards
                items={[
                  { label: "Llamadas revisadas", value: d.evaluated, hint: `en los últimos ${meta.periodDays} días` },
                  {
                    label: "Marca distinto que la IA",
                    value: mine == null ? "—" : dec(mine, 2),
                    hint: `criterios por llamada${team != null ? ` · equipo ${dec(team, 2)}` : ""}`,
                  },
                  {
                    label: "Más estricto o permisivo",
                    value:
                      row == null ? "—" : Math.abs(row.severityPerCall) < 0.05 ? "Parejo" : row.severityPerCall > 0 ? `+${dec(row.severityPerCall, 2)}` : `−${dec(Math.abs(row.severityPerCall), 2)}`,
                    hint: row == null ? undefined : row.severityPerCall > 0.05 ? "más estricto, por llamada" : row.severityPerCall < -0.05 ? "más permisivo, por llamada" : "ni más estricto ni más permisivo",
                  },
                  {
                    label: "Frente al equipo",
                    value: row == null ? "—" : Math.abs(row.vsTeam) < 0.05 ? "Igual" : signed(row.vsTeam, 2),
                    hint: row == null ? undefined : Math.abs(row.vsTeam) < 0.05 ? "que el equipo" : `${row.vsTeam > 0 ? "sobre" : "bajo"} el equipo, por llamada`,
                  },
                ]}
              />

              <ChartFigure
                className="mb-4"
                title={
                  apart
                    ? `Donde más se aparta del equipo: Criterio ${first.criterionId}, ${Math.round(first.disagreementPct)} % frente a ${Math.round(first.teamDisagreementPct)} %`
                    : "Se aparta de la IA en la misma medida que el equipo en todos los criterios"
                }
                subtitle="% de sus llamadas en que no coincide con la IA, frente al promedio de los auditores."
                legend={
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ink-900)]" />
                      {d.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-3 w-0.5 bg-[var(--neutral-700)]" />
                      Promedio del equipo
                    </span>
                  </>
                }
              >
                <DotVsTeam
                  label={`${d.name}: % de llamadas en que no coincide con la IA por criterio, frente al equipo. ${shown
                    .map((c) => `Criterio ${c.criterionId}: ${Math.round(c.disagreementPct)} % frente a ${Math.round(c.teamDisagreementPct)} %`)
                    .join("; ")}.`}
                  rows={shown.map((c) => ({
                    key: String(c.criterionId),
                    title: title(c.criterionId),
                    value: c.disagreementPct,
                    team: c.teamDisagreementPct,
                    right: `${Math.round(c.disagreementPct)} % · equipo ${Math.round(c.teamDisagreementPct)} %`,
                    sub: `${c.mismatchCalls} de ${c.evaluated} llamadas`,
                    href: c.mismatchCalls ? callsHref(c.criterionId) : null,
                    tip: (
                      <>
                        <b>Criterio {c.criterionId}</b> {crit(c.criterionId)}
                        <br />
                        No coincide con la IA en {c.mismatchCalls} de {c.evaluated} llamadas ({Math.round(c.disagreementPct)} %)
                        <br />
                        Equipo: {Math.round(c.teamDisagreementPct)} %{c.mismatchCalls ? " · Clic para ver las llamadas" : ""}
                      </>
                    ),
                  }))}
                />
              </ChartFigure>

              <ChartFigure
                className="mb-4"
                title="Hacia dónde se inclina en cada criterio"
                subtitle="Cuando no coincide con la IA, ¿marca No cumple (más estricto) o Cumple (más permisivo)? En puntos, mismos criterios y orden que arriba."
              >
                <DivergingBars
                  equal={equal}
                  leftLabel="Más permisivo"
                  rightLabel="Más estricto"
                  label={`${d.name}: severidad por criterio. ${shown.map((c) => `Criterio ${c.criterionId}: ${signed(c.severityPts)} pts`).join("; ")}.`}
                  rows={shown.map((c) => ({
                    key: String(c.criterionId),
                    title: title(c.criterionId),
                    value: c.severityPts,
                    text: Math.abs(c.severityPts) <= equal ? "Parejo" : `${signed(c.severityPts)} ${c.severityPts > 0 ? "estricto" : "permisivo"}`,
                    href: c.mismatchCalls ? callsHref(c.criterionId) : null,
                    tip: (
                      <>
                        <b>Criterio {c.criterionId}</b>
                        <br />
                        {severity(c.severityPts)}
                      </>
                    ),
                  }))}
                />
              </ChartFigure>
              {!p.all && d.criteria.length > shown.length ? (
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
                  !trendOk || !firstOk || !lastOk
                    ? "Cómo ha cambiado"
                    : Math.abs(lastOk.disagreementPerCall - firstOk.disagreementPerCall) <= 0.2
                      ? `Se mantiene en ${dec(lastOk.disagreementPerCall, 2)} criterios por llamada en los últimos ${meta.periodDays} días`
                      : `Cómo ha cambiado: de ${dec(firstOk.disagreementPerCall, 2)} a ${dec(lastOk.disagreementPerCall, 2)} criterios por llamada`
                }
                subtitle="Criterios por llamada en que no coincide con la IA, en tramos de 30 días."
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
                    format={(v) => dec(v, 2)}
                    lowNote={d.trend.map((t) => t.lowSample)}
                    label={`Evolución en 3 tramos de 30 días. ${d.name}: ${d.trend.map((t) => dec(t.disagreementPerCall, 2)).join(", ")}. Equipo: ${d.trend
                      .map((t) => dec(t.teamDisagreementPerCall, 2))
                      .join(", ")}.`}
                    series={[
                      {
                        label: d.name,
                        color: "var(--ink-900)",
                        values: d.trend.map((t) => (t.evaluated ? t.disagreementPerCall : null)),
                        low: d.trend.map((t) => t.lowSample),
                      },
                      { label: "Equipo", color: "var(--neutral-700)", dashed: true, values: d.trend.map((t) => t.teamDisagreementPerCall) },
                    ]}
                  />
                )}
              </ChartFigure>

              <h3 className="mb-2 mt-2 text-base font-semibold">Detalle por criterio</h3>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">Criterios de {d.name}, de mayor a menor diferencia con el equipo</caption>
                  <thead>
                    <tr>
                      <th scope="col">Criterio</th>
                      <th scope="col" aria-sort="descending">
                        Marca distinto que la IA<span className="block font-normal">% de sus llamadas</span>
                      </th>
                      <th scope="col">Equipo</th>
                      <th scope="col">Más estricto o permisivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.criteria.map((c) => (
                      <tr key={c.criterionId}>
                        <th scope="row" className="max-w-[360px] whitespace-normal font-normal">
                          <span className="font-semibold">{c.criterionId}</span> <span className="text-muted-foreground">{crit(c.criterionId)}</span>
                          <RenunciationReasonsButton criterionId={c.criterionId} />
                        </th>
                        <td className="num">
                          <MetricLink
                            href={c.mismatchCalls ? callsHref(c.criterionId) : null}
                            label={`Criterio ${c.criterionId}: ${pct0(c.disagreementPct)} marca distinto que la IA. Ver llamadas`}
                          >
                            {pct0(c.disagreementPct)}
                          </MetricLink>{" "}
                          <span className="help">
                            ({c.mismatchCalls} de {c.evaluated})
                          </span>
                        </td>
                        <td className="num">{pct0(c.teamDisagreementPct)}</td>
                        <td>{severity(c.severityPts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="card mt-4">
                <summary className="cursor-pointer font-semibold">Detalle técnico: acuerdo con la IA por criterio (kappa de Cohen)</summary>
                <p className="help">1 = acuerdo total, 0 = el que se espera por azar. «—» cuando no se puede calcular.</p>
                <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0 tabular sm:grid-cols-4">
                  {[...d.criteria]
                    .sort((a, b) => a.criterionId - b.criterionId)
                    .map((c) => (
                      <li key={c.criterionId}>
                        Criterio {c.criterionId}: {c.kappa == null ? "—" : c.kappa.toFixed(2).replace(".", ",")}
                      </li>
                    ))}
                </ul>
              </details>
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
