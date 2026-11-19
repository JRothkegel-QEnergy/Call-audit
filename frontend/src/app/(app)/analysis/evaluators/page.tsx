"use client";

import Link from "next/link";
import { useState } from "react";
import { useSnapshotMeta } from "@/components/analysis/frame";
import {
  blockGroups,
  ChartFigure,
  dec,
  type HeatCell,
  Heatmap,
  HBars,
  KpiCards,
  Scatter,
  seqTone,
  signed,
  Swatch,
} from "@/components/analysis/charts";
import { FilterBar, HelpList, LowSampleMark, MetricLink, rowClass, useAnalysisParams, withFilters } from "@/components/analysis/parts";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { EvaluatorMatrix, EvaluatorRow } from "@/lib/api/analysis-types";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

const num = (v: number) => v.toFixed(2).replace(".", ",");
/** IT-Q13 (D-39): el «top» muestra a todos si son 8 o menos; si no, 8 y «Ver todos los auditores». */
const TOP = 8;

function severityText(v: number, unit: string) {
  if (Math.abs(v) < 0.05) return "Parejo";
  return v > 0 ? `Más estricto (+${num(v)} ${unit})` : `Más permisivo (−${num(Math.abs(v))} ${unit})`;
}

function severityPts(v: number) {
  if (Math.abs(v) < 2) return "Parejo";
  return v > 0 ? `Más estricto (+${Math.round(v)} pts)` : `Más permisivo (−${Math.round(Math.abs(v))} pts)`;
}

function Charts({ m, rows, f }: { m: EvaluatorMatrix; rows: EvaluatorRow[]; f: { type: string; flow: string } }) {
  const meta = useSnapshotMeta();
  const rubric = useRubric();
  const [allBars, setAllBars] = useState(false);
  const enough = m.rows.filter((r) => !r.lowSample);
  const marked = m.criteria.filter((c) => c.markedDifferent);
  const team = m.team.disagreementPerCall;
  const crit = new Map(m.criteria.map((c) => [c.criterionId, c]));
  const name = (id: number) => rubric?.criteria[id]?.name ?? "";
  const evalHref = (n: string) => withFilters(`/analysis/evaluators/${encodeURIComponent(n)}`, f);

  const groups = blockGroups(rubric, (id) => ({
    id,
    label: String(id),
    marked: crit.get(id)?.markedDifferent,
    headerTip: (
      <>
        <b>Criterio {id}</b> {name(id)}
        <br />
        Equipo: {Math.round(crit.get(id)?.teamDisagreementPct ?? 0)} % no coincide con la IA
        {crit.get(id)?.markedDifferent && (
          <>
            <br />
            Se marca distinto: la mayoría de los auditores no coincide con la IA en este criterio. Puede ser la pauta, no la persona.
          </>
        )}
      </>
    ),
  }));

  const heatRows = m.rows.map((r) => ({
    key: r.name,
    header: (
      <Link href={evalHref(r.name)} className="block truncate font-medium text-foreground">
        {r.name}
        {r.lowSample && <span className="help block">pocas llamadas</span>}
      </Link>
    ),
    cells: Object.fromEntries(
      r.cells.map((c): [number, HeatCell] => {
        const tone = seqTone(c.disagreementPct);
        return [
          c.criterionId,
          {
            text: String(Math.round(c.disagreementPct)),
            ...tone,
            low: c.lowSample,
            label: `${r.name}, criterio ${c.criterionId}: ${Math.round(c.disagreementPct)} %`,
            href: c.mismatchCalls ? withFilters("/analysis/calls", f, { evaluator: r.name, criterion: c.criterionId, source: "mismatch" }) : null,
            tip: c.lowSample ? (
              <>
                <b>
                  {r.name} · Criterio {c.criterionId}
                </b>
                <br />
                Pocas llamadas ({r.evaluated}): la cifra todavía no es confiable
              </>
            ) : (
              <>
                <b>
                  {r.name} · Criterio {c.criterionId}
                </b>
                <br />
                No coincide con la IA en {c.mismatchCalls} de {r.evaluated} llamadas ({Math.round(c.disagreementPct)} %)
                <br />
                {severityPts(c.severityPts)}
                <br />
                Equipo: {Math.round(crit.get(c.criterionId)?.teamDisagreementPct ?? 0)} %
                {c.mismatchCalls > 0 && (
                  <>
                    <br />
                    Clic para ver las llamadas
                  </>
                )}
              </>
            ),
          },
        ];
      }),
    ),
  }));

  const top = [...enough].sort((a, b) => b.disagreementPerCall - a.disagreementPerCall);
  const barRows = [...top, ...m.rows.filter((r) => r.lowSample)];
  const shownBars = allBars || barRows.length <= TOP ? barRows : barRows.slice(0, TOP);
  const leader = top[0];
  const spread = top.length > 1 && top.some((r) => Math.abs(r.disagreementPerCall - team) > 0.2);
  const byName = new Map(rows.map((r) => [r.name, r]));

  return (
    <>
      <KpiCards
        items={[
          { label: "Auditores", value: enough.length, hint: `con ${meta.config.low} llamadas o más · ${m.rows.length} en total` },
          { label: "Llamadas revisadas", value: m.team.evaluated, hint: `en los últimos ${meta.periodDays} días` },
          { label: "Marca distinto que la IA", value: dec(team, 2), hint: "criterios por llamada, promedio del equipo" },
          { label: "Criterios que se marcan distinto", value: `${marked.length} de 33`, hint: "en la mayoría de los auditores" },
        ]}
      />
      <p className="help -mt-1 mb-4">
        Marcar distinto que la IA no es un error: la IA es el punto de comparación común, no la respuesta correcta. Sirve para ver si es la persona o la
        pauta.
      </p>

      <ChartFigure
        className="mb-4"
        title={
          marked.length
            ? `En ${marked.length} ${marked.length === 1 ? "criterio" : "criterios"} la mayoría de los auditores no coincide con la IA: puede ser la pauta, no la persona`
            : "Ningún criterio se marca distinto en la mayoría de los auditores"
        }
        subtitle="% de las llamadas de cada auditor en que no coincide con la IA, por criterio. Una fila oscura es una persona que se aparta; una columna oscura, un criterio que conviene revisar."
        legend={
          <>
            <Swatch color="var(--seq-1)" label="0–4 %" />
            <Swatch color="var(--seq-2)" label="5–9 %" />
            <Swatch color="var(--seq-3)" label="10–14 %" />
            <Swatch color="var(--seq-4)" label="15–24 %" />
            <Swatch color="var(--seq-5)" label="25 % o más" />
            <Swatch color="transparent" dashed label={`— pocas llamadas (menos de ${meta.config.low})`} />
            <span>▲ Se marca distinto</span>
          </>
        }
      >
        {enough.length === 0 && (
          <p className="help mt-0">
            Ningún auditor tiene {meta.config.low} llamadas revisadas o más. Los gráficos se llenan a medida que se revisan más llamadas.
          </p>
        )}
        <Heatmap caption="Auditores por criterio: % de llamadas en que no coinciden con la IA" groups={groups} rows={heatRows} />
      </ChartFigure>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <ChartFigure
          title={
            leader && spread
              ? `${leader.name} es quien más marca distinto que la IA: ${dec(leader.disagreementPerCall, 2)} criterios por llamada, frente a ${dec(team, 2)} del equipo`
              : "Los auditores marcan distinto que la IA en cantidades parecidas"
          }
          subtitle="Criterios por llamada en que cada auditor no coincide con la IA."
        >
          <HBars
            label={`Barras: criterios por llamada en que cada auditor marca distinto que la IA. ${barRows
              .map((r) => `${r.name}: ${dec(r.disagreementPerCall, 2)}`)
              .join("; ")}. Promedio del equipo: ${dec(team, 2)}.`}
            max={Math.ceil(Math.max(team, ...barRows.map((r) => r.disagreementPerCall)) * 2) / 2 || 1}
            reference={{ value: team, label: `Equipo ${dec(team, 2)}` }}
            rows={shownBars.map((r) => ({
              key: r.name,
              name: r.name,
              href: evalHref(r.name),
              value: r.disagreementPerCall,
              valueText: `${dec(r.disagreementPerCall, 2)} por llamada`,
              sub: `${r.evaluated} llamadas${r.lowSample ? " · pocas" : ""}`,
              low: r.lowSample,
              tip: (
                <>
                  <b>{r.name}</b>
                  <br />
                  {dec(r.disagreementPerCall, 2)} criterios por llamada · {r.evaluated} llamadas
                </>
              ),
            }))}
          />
          {barRows.length > TOP && (
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setAllBars(!allBars)}>
              {allBars ? "Ver menos" : "Ver todos los auditores"}
            </button>
          )}
        </ChartFigure>

        {enough.length > 0 && (
          <ChartFigure
            title="Más estricto o más permisivo que la IA"
            subtitle="Arriba, quienes más marcan distinto; a la derecha, quienes marcan No cumple cuando la IA no lo hace."
          >
            <Scatter
              label={`Dispersión de ${m.rows.length} auditores según cuánto marcan distinto que la IA y si son más estrictos o más permisivos. El detalle está en la tabla de abajo.`}
              xLeft="Más permisivo"
              xRight="Más estricto"
              yLabel="Marca distinto (criterios por llamada)"
              reference={{ value: team, label: "Promedio del equipo" }}
              points={m.rows.map((r) => {
                const sev = byName.get(r.name)?.severityPerCall ?? 0;
                return {
                  key: r.name,
                  name: r.name,
                  href: evalHref(r.name),
                  x: sev,
                  y: r.disagreementPerCall,
                  low: r.lowSample,
                  tip: (
                    <>
                      <b>{r.name}</b>
                      <br />
                      Marca distinto: {dec(r.disagreementPerCall, 2)} por llamada
                      <br />
                      {severityText(sev, "por llamada")} · {r.evaluated} llamadas
                    </>
                  ),
                };
              })}
            />
          </ChartFigure>
        )}
      </div>
    </>
  );
}

export default function EvaluatorsPage() {
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rows = useAsync(() => api.listAnalysisEvaluators({ type: p.type, flow: p.flow }), [p.type, p.flow]);
  const matrix = useAsync(() => api.getAnalysisEvaluatorMatrix({ type: p.type, flow: p.flow }), [p.type, p.flow]);
  const f = { type: p.type, flow: p.flow };
  // Para el supervisor la API responde 404: se muestra como «no encontrado», sin revelar que la pestaña existe.
  if (rows.status === "error" && rows.error.message === "not_found") return <EmptyState title="No encontramos esta página." />;
  return (
    <>
      <p className="help mb-2 mt-0">
        Solo la ven personas de Qubico. Cada fila es la persona que revisó: un auditor en la app o quien llenó la planilla.
      </p>
      <FilterBar meta={meta} />
      <AsyncView state={rows} what="los auditores">
        {(data) =>
          data.length === 0 ? (
            <EmptyState
              title="Esta foto no trae auditores."
              body="La pestaña se llena con las revisiones hechas en la app o cuando la planilla importada incluye la columna del evaluador de calidad."
            />
          ) : (
            <>
              <AsyncView state={matrix} what="los gráficos">
                {(m) => <Charts m={m} rows={data} f={f} />}
              </AsyncView>
              <h3 className="mb-2 mt-2 text-base font-semibold">Detalle por auditor</h3>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">Auditores, ordenados por cuánto marcan distinto que la IA</caption>
                  <thead>
                    <tr>
                      <th scope="col">Auditor</th>
                      <th scope="col">Llamadas revisadas</th>
                      <th scope="col" aria-sort="descending">
                        Marca distinto que la IA ↓<span className="block font-normal">criterios por llamada, promedio</span>
                      </th>
                      <th scope="col">Más estricto o permisivo</th>
                      <th scope="col">Frente al equipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r.name} className={rowClass(r.lowSample)}>
                        <th scope="row">
                          <Link href={withFilters(`/analysis/evaluators/${encodeURIComponent(r.name)}`, f)} className="font-semibold text-foreground">
                            {r.name}
                          </Link>
                          {r.lowSample && <LowSampleMark />}
                        </th>
                        <td className="num">
                          <MetricLink href={withFilters("/analysis/calls", f, { evaluator: r.name })} label={`${r.name}: ${r.evaluated} llamadas revisadas. Ver llamadas`}>
                            {r.evaluated}
                          </MetricLink>
                        </td>
                        <td className="num">{num(r.disagreementPerCall)}</td>
                        <td>{severityText(r.severityPerCall, "por llamada")}</td>
                        <td className="num">
                          {Math.abs(r.vsTeam) < 0.05 ? "Igual que el equipo" : `${signed(r.vsTeam, 2)} ${r.vsTeam > 0 ? "sobre" : "bajo"} el equipo`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <HelpList
                items={[
                  ["Marca distinto que la IA", "en cuántos criterios por llamada, en promedio, él y la IA no coinciden."],
                  [
                    "Más estricto o permisivo",
                    "si cuando no coinciden suele marcar No cumple (estricto) o Cumple (permisivo). Un auditor estricto pero parejo no es un problema; uno que marca distinto en casos parecidos sí.",
                  ],
                ]}
              />
            </>
          )
        }
      </AsyncView>
    </>
  );
}
