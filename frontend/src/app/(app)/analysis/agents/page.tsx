"use client";

import Link from "next/link";
import { useState } from "react";
import { useSnapshotMeta } from "@/components/analysis/frame";
import { AgentsGateNotice } from "@/components/analysis/agents-gate";
import {
  blockGroups,
  ChartFigure,
  DeviationStrip,
  divTone,
  Dumbbell,
  DumbbellLegend,
  type HeatCell,
  Heatmap,
  KpiCards,
  signed,
  Swatch,
} from "@/components/analysis/charts";
import {
  DeviationText,
  FilterBar,
  HelpList,
  LowSampleMark,
  MetricLink,
  pct0,
  rowClass,
  useAnalysisParams,
  withFilters,
} from "@/components/analysis/parts";
import { Pager } from "@/components/ui/pager";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AgentMatrix, AgentsPage as AgentsData } from "@/lib/api/analysis-types";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

function AgentMatrixChart({ m, f, criterion }: { m: AgentMatrix; f: { type: string; flow: string }; criterion?: number }) {
  const meta = useSnapshotMeta();
  const rubric = useRubric();
  const [all, setAll] = useState(false);
  const equal = meta.config.equal;
  // Los 10 criterios donde los ejecutivos están más dispersos; los explicados por los datos nunca de entrada (D-10).
  const spread = (cid: number) => Math.max(0, ...m.rows.filter((r) => !r.lowSample).map((r) => Math.abs(r.cells[cid - 1]?.deviationPts ?? 0)));
  const top = new Set(
    [...m.criteria]
      .filter((c) => !c.dataExplained)
      .sort((a, b) => b.agentsOutside - a.agentsOutside || spread(b.criterionId) - spread(a.criterionId))
      .slice(0, meta.config.topCriteria)
      .map((c) => c.criterionId),
  );
  if (criterion) top.add(criterion);
  const crit = new Map(m.criteria.map((c) => [c.criterionId, c]));
  const name = (id: number) => rubric?.criteria[id]?.name ?? "";
  const groups = blockGroups(
    rubric,
    (id) => ({
      id,
      label: String(id),
      highlight: id === criterion,
      headerTip: (
        <>
          <b>Criterio {id}</b> {name(id)}
          <br />
          Equipo, según la IA: {Math.round(crit.get(id)?.teamAiPct ?? 0)} % · {crit.get(id)?.agentsOutside ?? 0} ejecutivos fuera de ±{equal} pts
        </>
      ),
    }),
    all ? undefined : top,
  );
  const rows = m.rows.map((r) => ({
    key: r.agentId,
    header: (
      <Link href={withFilters(`/analysis/agents/${encodeURIComponent(r.agentId)}`, f)} className="block truncate font-medium text-foreground">
        {r.name}
        <span className="help block">
          {r.calls} llamadas{r.lowSample ? " · pocas" : ""}
        </span>
      </Link>
    ),
    cells: Object.fromEntries(
      r.cells.map((c): [number, HeatCell] => {
        const team = crit.get(c.criterionId)?.teamAiPct ?? 0;
        return [
          c.criterionId,
          {
            text: signed(c.deviationPts),
            ...divTone(c.deviationPts, equal),
            low: r.lowSample,
            label: `${r.name}, criterio ${c.criterionId}: ${signed(c.deviationPts)} pts frente al equipo`,
            href: c.aiPct ? withFilters("/analysis/calls", f, { agent: r.agentId, criterion: c.criterionId, source: "ai" }) : null,
            tip: (
              <>
                <b>
                  {r.name} · Criterio {c.criterionId}
                </b>
                <br />
                Según la IA: {Math.round(c.aiPct)} % · equipo {Math.round(team)} % ({signed(c.deviationPts)} pts)
                <br />
                Según el auditor: {c.sheetPct == null ? "sin revisión" : `${Math.round(c.sheetPct)} % (${c.evaluated} revisadas)`}
                <br />
                {r.calls} llamadas{c.aiPct ? " · Clic para ver las llamadas" : ""}
              </>
            ),
          },
        ];
      }),
    ),
  }));
  return (
    <ChartFigure
      className="mb-4"
      title="Dónde se aparta cada ejecutivo del equipo"
      subtitle={`Según la IA, ${all ? "en los 33 criterios" : "en los 10 criterios donde los ejecutivos están más dispersos"}. Diferencia con el promedio del equipo, en puntos. No es un ranking: sirve para elegir qué llamadas escuchar.`}
      legend={
        <>
          <Swatch color="var(--div-neg-2)" label="Menos No cumple que el equipo" />
          <Swatch color="var(--div-neg-1)" label="" />
          <Swatch color="var(--div-mid)" label={`Igual (±${equal} pts)`} />
          <Swatch color="var(--div-pos-1)" label="" />
          <Swatch color="var(--div-pos-2)" label="Más No cumple que el equipo" />
          <Swatch color="transparent" dashed label="— pocas llamadas" />
        </>
      }
    >
      <Heatmap caption="Ejecutivos por criterio: diferencia con el equipo según la IA, en puntos" groups={groups} rows={rows} cellWidth={34} />
      <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setAll(!all)}>
        {all ? "Ver los 10 principales" : "Ver los 33 criterios"}
      </button>
    </ChartFigure>
  );
}

function Overview({ d, f, criterion }: { d: AgentsData; f: { type: string; flow: string }; criterion?: number }) {
  const meta = useSnapshotMeta();
  const t = d.team;
  const enough = d.rows.filter((r) => !r.lowSample);
  return (
    <>
      <KpiCards
        items={[
          { label: "Ejecutivos", value: t.agentsWithEnough, hint: `con ${meta.config.low} llamadas o más · ${d.total} en total` },
          {
            label: criterion ? `Criterio ${criterion}, según la IA` : "Con algún No cumple, según la IA",
            value: pct0(t.aiPct),
            hint: `de ${t.calls} llamadas`,
          },
          { label: "Según el auditor", value: pct0(t.sheetPct), hint: `de ${t.evaluated} revisadas por un auditor` },
          {
            label: "Dentro del rango del equipo",
            value: `${t.withinRange} de ${t.agentsWithEnough}`,
            hint: `a ±${meta.config.equal} pts del promedio, según la IA`,
          },
        ]}
      />
      {d.rows.length > 0 && (
        <ChartFigure
          className="mb-4"
          title={`${t.withinRange} de ${t.agentsWithEnough} ejecutivos están dentro del rango del equipo`}
          subtitle={`Diferencia con el promedio del equipo en llamadas con ${criterion ? `No cumple en el criterio ${criterion}` : "algún No cumple"}, según la IA, en puntos.`}
        >
          <DeviationStrip
            equal={meta.config.equal}
            label={`Puntos: desvío de cada ejecutivo frente al equipo, según la IA. ${t.withinRange} de ${t.agentsWithEnough} dentro de ±${meta.config.equal} pts. El detalle está en la tabla de abajo.`}
            rows={d.rows.map((r) => ({
              key: r.agentId,
              name: r.name,
              href: withFilters(`/analysis/agents/${encodeURIComponent(r.agentId)}`, f, { criterion }),
              value: r.deviationPts,
              low: r.lowSample,
              tip: (
                <>
                  <b>{r.name}</b>
                  <br />
                  {signed(r.deviationPts)} pts frente al equipo · {pct0(r.aiPct)} según la IA
                  <br />
                  {r.calls} llamadas{r.lowSample ? " · pocas llamadas" : ""}
                </>
              ),
            }))}
          />
          {enough.length < d.rows.length && <p className="help mb-0 mt-2">Punto hueco: pocas llamadas, la cifra puede cambiar mucho.</p>}
        </ChartFigure>
      )}
    </>
  );
}

export default function AgentsPage() {
  const meta = useSnapshotMeta();
  const p = useAnalysisParams();
  const rubric = useRubric();
  const page = useAsync(
    () => api.listAnalysisAgents({ type: p.type, flow: p.flow, criterion: p.criterion, page: p.page }),
    [p.type, p.flow, p.criterion, p.page],
  );
  const matrix = useAsync(() => api.getAnalysisAgentMatrix({ type: p.type, flow: p.flow, page: p.page }), [p.type, p.flow, p.page]);
  const f = { type: p.type, flow: p.flow };
  const ids = rubric ? Object.keys(rubric.criteria).map(Number).sort((a, b) => a - b) : [];

  return (
    <>
      <FilterBar meta={meta}>
        <label className="field">
          <span className="text-[13px] font-medium">Criterio</span>
          <select className="control max-w-[320px]" value={p.criterion ?? ""} onChange={(e) => p.set({ criterion: e.target.value })}>
            <option value="">Todos los criterios</option>
            {ids.map((id) => (
              <option key={id} value={id}>
                {id} · {rubric!.criteria[id].name}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>
      <AsyncView state={page} what="los ejecutivos">
        {(d) =>
          !d.gate.open ? (
            <AgentsGateNotice gate={d.gate} low={meta.config.low} />
          ) : d.rows.length === 0 ? (
            <EmptyState title="No hay llamadas con estos filtros en esta foto.">
              <button type="button" className="btn" onClick={p.clear}>
                Quitar filtros
              </button>
            </EmptyState>
          ) : (
            <>
              <Overview d={d} f={f} criterion={p.criterion} />
              <AsyncView state={matrix} what="el mapa">
                {(m) => <AgentMatrixChart m={m} f={f} criterion={p.criterion} />}
              </AsyncView>
              <h3 className="mb-2 mt-2 text-base font-semibold">Detalle por ejecutivo</h3>
              <div className="help mb-2 flex flex-wrap gap-4">
                <DumbbellLegend />
              </div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <caption className="sr-only">
                    Ejecutivos{p.criterion ? ` · criterio ${p.criterion}` : ""}, ordenados por desvío frente al equipo según la IA
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Ejecutivo</th>
                      <th scope="col">Llamadas</th>
                      <th scope="col">{p.criterion ? "Según la IA" : "Con algún No cumple, según la IA"}</th>
                      <th scope="col">Según el auditor</th>
                      <th scope="col">
                        <span className="sr-only">IA frente al auditor</span>
                      </th>
                      <th scope="col" aria-sort="descending">
                        Frente al equipo ↓
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.agentId} className={rowClass(r.lowSample)}>
                        <th scope="row">
                          <Link
                            href={withFilters(`/analysis/agents/${encodeURIComponent(r.agentId)}`, f, { criterion: p.criterion })}
                            className="font-semibold text-foreground"
                          >
                            {r.name}
                          </Link>
                          {r.lowSample && <LowSampleMark />}
                        </th>
                        <td className="num">
                          {r.calls} / {r.evaluated}
                        </td>
                        <td className="num">
                          <MetricLink
                            href={withFilters("/analysis/calls", f, { agent: r.agentId, criterion: p.criterion, source: p.criterion ? "ai" : undefined })}
                            label={`${r.name}: ${pct0(r.aiPct)} según la IA. Ver llamadas`}
                          >
                            {pct0(r.aiPct)}
                          </MetricLink>
                        </td>
                        <td className="num">{pct0(r.sheetPct)}</td>
                        <td>
                          <Dumbbell ai={r.aiPct} sheet={r.sheetPct} max={Math.max(...d.rows.flatMap((x) => [x.aiPct, x.sheetPct ?? 0]), 10)} />
                        </td>
                        <td>
                          <DeviationText pts={r.deviationPts} equal={meta.config.equal} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager label="Ejecutivos" page={d.page} size={d.pageSize} total={d.total} onChange={(n) => p.set({ page: n })} />
              <HelpList
                items={[
                  ["Llamadas", "con corrida / revisadas por un auditor."],
                  [
                    "Frente al equipo",
                    "diferencia con el promedio de todos los ejecutivos en este criterio, según la IA. No es un ranking: sirve para elegir qué llamadas escuchar.",
                  ],
                  ["Pocas llamadas", `con menos de ${meta.config.low} llamadas la cifra puede cambiar mucho.`],
                ]}
              />
            </>
          )
        }
      </AsyncView>
    </>
  );
}
