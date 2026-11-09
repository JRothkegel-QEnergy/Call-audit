"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionBar, CriteriaChart, SummaryTiles, WhoIsRightBar } from "@/components/admin/discrepancy-charts";
import { AnalyzeDialog } from "@/components/admin/discrepancy-parts";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DiscrepancyCriterionRow, DiscrepancyOverview } from "@/lib/api/admin-types";
import { ANALYSIS_STATUS, usd } from "@/lib/discrepancy-labels";
import type { SetParams } from "@/lib/discrepancy-url";
import { int, shortDateTime } from "@/lib/format";

const TOP_MOTIVES = 10;

/** Pestaña Resumen (Cambio 20 §4.1): el panorama. Cada gráfico lleva a Patrones con su filtro. */
export function SummaryTab({
  data,
  params,
  setParams,
  reload,
  onOpenPatterns,
}: {
  data: DiscrepancyOverview;
  params: URLSearchParams;
  setParams: SetParams;
  reload: () => void;
  /** Pide el foco en el título de Patrones al llegar (R-20.2). */
  onOpenPatterns: () => void;
}) {
  const [dialog, setDialog] = useState<number[] | "default" | null>(null);
  const [unpatterned, setUnpatterned] = useState(false);
  const a = data.analysis;
  const run = data.running;
  const series = data.currentSeries;
  const view = params.get("view") === "table" ? "table" : "chart";
  const allMotives = params.get("motives") === "all";
  const motive = /^\d+$/.test(params.get("motivo") ?? "") ? Number(params.get("motivo")) : null;
  const pending = a ? a.criteria.filter((c) => !a.doneCriteria.includes(c)) : [];
  const manualPct = data.cases ? Math.round((100 * data.manualCases) / data.cases) : 0;

  const goToList = (changes: Record<string, string | null>) => {
    onOpenPatterns();
    setParams({ tab: "patterns", motivo: "all", page: null, kind: null, action: null, right: null, ...changes });
  };
  const openMotive = (criterionId: number) => {
    onOpenPatterns();
    setParams({ tab: "patterns", motivo: String(criterionId), page: null });
  };

  return (
    <div className="grid gap-4">
      <section className="card grid gap-1.5">
        <p className="m-0">
          Comparamos la corrida vigente <b>{series ? `${series.model} · v${series.promptVersion}` : "—"}</b> con la planilla de calidad y la revisión manual Qubico.
        </p>
        {a ? (
          <p className="m-0 text-sm">
            {data.readOnly ? "Análisis" : "Último análisis"}: {a.createdAt ? shortDateTime(a.createdAt) : "—"} · {a.model} · prompt de análisis v{a.analysisPromptVersion} ·{" "}
            {a.doneCriteria.length} motivos · {usd(a.costUsd)}
            {a.status !== "done" && ` · ${ANALYSIS_STATUS[a.status]}`}
          </p>
        ) : (
          !run && <p className="m-0">Todavía no hay análisis con IA. Analizar busca patrones y propone soluciones; no cambia el prompt.</p>
        )}
        {a?.status === "stopped" && (
          <p className="m-0 text-sm">
            Análisis detenido por {a.stoppedBy ?? "—"} en {a.doneCriteria.length} de {a.criteria.length} motivos. Costo: {usd(a.costUsd)}.
          </p>
        )}
        {a?.status === "failed" && (
          <p className="m-0 text-sm" role="alert">
            El análisis falló en {a.failedCriteria.map((f) => `el motivo ${f.criterionId}`).join(", ") || "un motivo"}
            {a.failedCriteria[0] ? `: ${a.failedCriteria[0].error}` : a.error ? `: ${a.error}` : ""}. Los {a.doneCriteria.length} motivos anteriores quedaron guardados.
          </p>
        )}
        {data.stale && (
          <p className="m-0 flex items-center gap-1.5 text-sm text-[var(--amber-700,#9a6700)]">
            <AlertTriangle size={14} aria-hidden />
            Desactualizado:{" "}
            {data.stale.currentSeriesChanged && data.stale.currentSeries
              ? `cambió la corrida vigente a ${data.stale.currentSeries.model} · v${data.stale.currentSeries.promptVersion}`
              : `entraron ${data.stale.newReviews} revisiones nuevas`}{" "}
            desde el último análisis.
          </p>
        )}
        {!data.readOnly && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {run ? (
              <RunningLine run={run} onStopped={reload} />
            ) : (
              <>
                <Button variant="primary" onClick={() => setDialog("default")}>
                  {a ? "Analizar de nuevo" : "Analizar discrepancias"}
                </Button>
                {pending.length > 0 && a && a.status !== "done" && <Button onClick={() => setDialog(pending)}>Analizar motivos pendientes ({pending.length})</Button>}
              </>
            )}
          </div>
        )}
      </section>

      <SummaryTiles s={data.summary} hasAnalysis={!!a} followUp={data.followUp} stale={!!data.stale} onFollowUp={() => setParams({ tab: "followup", analysis: null })} />

      {a && (
        <section className="card grid gap-3">
          <ActionBar
            s={data.summary}
            criteria={a.doneCriteria.length}
            selected={unpatterned ? "unpatterned" : null}
            onSelect={(k) => {
              if (k === "unpatterned" || k === null) setUnpatterned(k === "unpatterned");
              else if (k === "observation") goToList({ kind: "obs", status: null });
              else goToList({ action: k, status: "all" });
            }}
          />
          {unpatterned && (
            <p className="m-0 text-sm" role="note">
              {int(data.summary.byAction.unpatterned)} casos analizados sin patrón: la IA no encontró algo en común. <Link href="/admin/stats?tab=quality">Revísalos desde Calidad de la IA →</Link>
            </p>
          )}
          <WhoIsRightBar s={data.summary} version={a.analysisPromptVersion} selected={null} onSelect={(k) => k && goToList({ right: k, status: "all" })} />
        </section>
      )}

      <p className="help m-0">
        {int(data.calls)} llamadas · {int(data.cases)} casos en desacuerdo · {data.manualCases} casos con revisión manual Qubico ({manualPct} %)
        {Object.entries(data.callsOutside).map(([why, n]) => ` · ${n} llamadas fuera (${why})`)}
        {manualPct < 10 && ". Hay poca revisión manual: la causa Evaluador de la planilla se apoya casi solo en la planilla."}
      </p>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 flex-1 text-lg font-semibold">¿Dónde están los desacuerdos?</h2>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={view === "chart"} onClick={() => setParams({ view: null })}>
              Gráfico
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setParams({ view: "table" })}>
              Tabla
            </button>
          </div>
        </div>
        <p className="help m-0">
          Calce de llamada: {data.callMatch.agree} de {data.callMatch.total} ({data.callMatch.total ? Math.round((100 * data.callMatch.agree) / data.callMatch.total) : 0} %) ·{" "}
          <Link href="/admin/stats?tab=quality">Ver en Calidad de la IA →</Link>
        </p>
        {view === "chart" ? (
          <CriteriaChart rows={data.criteria} selected={motive} onSelect={openMotive} limit={allMotives ? undefined : TOP_MOTIVES} />
        ) : (
          <CriteriaTable rows={allMotives ? data.criteria : data.criteria.slice(0, TOP_MOTIVES)} motive={motive} onSelect={openMotive} />
        )}
        {data.criteria.length > TOP_MOTIVES && (
          <div>
            <Button size="sm" onClick={() => setParams({ motives: allMotives ? null : "all" })}>
              {allMotives ? `Mostrar solo ${TOP_MOTIVES}` : `Ver los ${data.criteria.length} motivos`}
            </Button>
          </div>
        )}
      </section>

      <details className="card">
        <summary className="cursor-pointer font-medium">Cómo leer este análisis</summary>
        <p className="mb-0">
          La IA de análisis agrupa los desacuerdos entre la corrida vigente y la planilla de calidad, y propone una causa y una solución. Son hallazgos para revisar: nada cambia el prompt ni los
          resultados hasta que una persona sube una versión nueva. Un patrón con menos de 3 casos queda como observación: se puede aceptar para calibrar o descartar, pero no llega al prompt. Si la
          planilla y la revisión manual Qubico no coinciden, el caso va a calibración y no al prompt.
        </p>
        <p className="mb-0">
          Las barras cuentan casos (llamada × motivo), no patrones; un caso en varios patrones cuenta una vez, en el de mejor prioridad. «Según el análisis» quiere decir que lo decidió la IA de
          análisis y nadie lo ha verificado.
        </p>
      </details>

      {dialog && (
        <AnalyzeDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          data={data}
          initialCriteria={dialog === "default" ? undefined : dialog}
          onStarted={() => {
            toast("Análisis en curso. El worker lo toma en su próxima pasada.");
            reload();
          }}
        />
      )}
    </div>
  );
}

/** La tabla por motivo de siempre (Cambio 16), en «Ver como tabla» (D-83). */
function CriteriaTable({ rows, motive, onSelect }: { rows: DiscrepancyCriterionRow[]; motive: number | null; onSelect: (criterionId: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Motivo</th>
            <th scope="col">Planilla NO CUMPLE</th>
            <th scope="col">IA NO CUMPLE</th>
            <th scope="col">Coinciden</th>
            <th scope="col">Solo la IA detectó</th>
            <th scope="col">Omitidos por la IA</th>
            <th scope="col">IA dudosa</th>
            <th scope="col">Con revisión manual</th>
            <th scope="col">Patrones</th>
            <th scope="col">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.criterionId} aria-current={motive === c.criterionId || undefined}>
              <td>
                {c.criterionId} · {c.name}
                {c.summary && <div className="help">{c.summary}</div>}
              </td>
              <td className="num">{c.clientFails}</td>
              <td className="num">{c.aiFails}</td>
              <td className="num">{c.matchFail}</td>
              <td className="num">{c.fp}</td>
              <td className="num">{c.fn}</td>
              <td className="num">{c.aiUncertain}</td>
              <td className="num">{c.manualItems}</td>
              <td className="num">{c.patterns == null ? <span className="help">sin analizar</span> : c.patterns}</td>
              <td>
                {c.patterns != null && (
                  <button type="button" className="btn btn-ghost btn-sm whitespace-nowrap" onClick={() => onSelect(c.criterionId)}>
                    Ver patrones
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunningLine({ run, onStopped }: { run: NonNullable<DiscrepancyOverview["running"]>; onStopped: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = run.doneCriteria.length + run.failedCriteria.length;
  return (
    <>
      <span aria-live="polite">
        {run.status === "queued" ? "En cola: el worker lo toma en su próxima pasada" : `Analizando · ${done} de ${run.criteria.length} motivos`} · {usd(run.costUsd)}
      </span>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.stopDiscrepancyAnalysis(run.id);
            onStopped();
          } finally {
            setBusy(false);
          }
        }}
      >
        Detener
      </Button>
      <span className="help">Analizar de nuevo queda deshabilitado mientras corre.</span>
    </>
  );
}
