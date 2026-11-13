"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AgreementMosaic, PARTS, Swatch } from "@/components/admin/agreement-charts";
import { AnalyzeDialog } from "@/components/admin/discrepancy-parts";
import { QualityHeader } from "@/components/admin/quality-header";
import { listHref } from "@/components/admin/verification-labels";
import { Button } from "@/components/ui/button";
import { MetricHelp } from "@/components/ui/metric-help";
import { api } from "@/lib/api";
import type { Agreement, AgreementCriterion, DiscrepancyOverview } from "@/lib/api/admin-types";
import { ANALYSIS_STATUS, usd } from "@/lib/discrepancy-labels";
import type { SetParams } from "@/lib/discrepancy-url";
import { int, shortDateTime } from "@/lib/format";

const TOP_MOTIVES = 10;
const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);

/**
 * Pestaña Resumen (docs/ux/admin-prompt-metrics/05-numeros-propuesta.md §4): estado del análisis, la cabecera común con
 * el mosaico de la última prueba sobre validación, la frase que pasa de llamadas a desacuerdos por motivo, la barra de
 * esos desacuerdos y en qué motivos están. Todo con una unidad nombrada y sumas a la vista.
 */
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
  const a = data.analysis;
  const run = data.running;
  const q = data.quality;
  const allMotives = params.get("motives") === "all";
  const pending = a ? a.criteria.filter((c) => !a.doneCriteria.includes(c)) : [];
  const patternsOf = new Map(data.criteria.map((c) => [c.criterionId, c.patterns]));
  const names = new Map(data.criteria.map((c) => [c.criterionId, c.name]));
  const openPatterns = (criterionId: number) => {
    onOpenPatterns();
    setParams({ tab: "patterns", motivo: String(criterionId), page: null });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="card grid gap-1.5">
        {a ? (
          <p className="m-0 text-sm">
            Patrones: {data.readOnly ? "análisis" : "último análisis"} del {a.createdAt ? shortDateTime(a.createdAt) : "—"} · {a.model} · {a.doneCriteria.length} motivos ·{" "}
            {usd(a.costUsd)}
            {a.status !== "done" && ` · ${ANALYSIS_STATUS[a.status]}`}
            <span className="help"> · sobre la corrida vigente en las llamadas de entrenamiento</span>
          </p>
        ) : (
          !run && <p className="m-0">Todavía no hay análisis de patrones. Analizar busca patrones y propone soluciones; no cambia el prompt.</p>
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
            Patrones desactualizados:{" "}
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

      {q ? (
        <>
          <QualityHeader version={q.version} a={q.agreement} linkVersion={q.listVersion} />
          <AgreementMosaic version={q.version} a={q.agreement} linked={!!q.listVersion} />
          <Bridge a={q.agreement} version={q.listVersion} />
          <ByCriterion
            a={q.agreement}
            version={q.listVersion}
            names={names}
            patternsOf={patternsOf}
            all={allMotives}
            onAll={() => setParams({ motives: allMotives ? null : "all" })}
            onPatterns={openPatterns}
          />
        </>
      ) : (
        <p className="help m-0">
          Aún no hay una prueba de versión terminada sobre las llamadas de validación: la calidad se mide con ella. Prueba una versión desde{" "}
          <Link href="/admin/prompts">Prompt</Link>.
        </p>
      )}

      <details className="card">
        <summary className="cursor-pointer font-medium">Cómo leer este análisis</summary>
        <p className="mb-0">
          <b>Llamadas</b> y <b>desacuerdos por motivo</b> son dos unidades distintas. Una llamada tiene un veredicto (Cumple o No cumple); un
          desacuerdo por motivo es un motivo de una llamada en que la IA y el revisor no marcan lo mismo. Una llamada puede tener varios, y una llamada
          en que el veredicto coincide puede tener alguno.
        </p>
        <p className="mb-0">
          La duda de la IA no es desacuerdo: se cuenta aparte, como «sin decisión». Las cifras de arriba salen de la última prueba de versión sobre las
          llamadas de validación, las mismas de su pestaña Prueba. Los patrones salen de otro grupo de llamadas (entrenamiento) para no medir una versión
          con las mismas llamadas de donde salieron sus reglas.
        </p>
        <p className="mb-0">
          Los patrones son hallazgos para revisar: nada cambia el prompt hasta que una persona sube una versión nueva. Un patrón con menos de 3 desacuerdos
          queda como observación. Si la planilla y la revisión manual Qubico no coinciden, el desacuerdo va a calibración y no al prompt
          {data.manualCases ? ` (${int(data.manualCases)} desacuerdos tienen revisión manual Qubico)` : ""}. «Según el análisis» quiere decir que lo
          decidió una IA de análisis y nadie lo ha verificado.
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

const sides = (c: AgreementCriterion) => ({ fn: c.fn, fp: c.fp, reviewer: c.reviewerFn + c.reviewerFp, total: c.fn + c.fp + c.reviewerFn + c.reviewerFp });

/** Frase puente (§4.1-3) y barra de los desacuerdos por motivo en los colores del mosaico (§4.1-4). */
function Bridge({ a, version }: { a: Agreement; version: string | null }) {
  const items = a.byCallCriterion;
  const total = items.promptFn + items.promptFp + items.reviewer;
  const crits = (a.byCriterion ?? []).filter((c) => sides(c).total > 0).length;
  const undecidedCrits = (a.byCriterion ?? []).reduce((t, c) => t + c.undecided, 0);
  const br = a.bridge;
  const verdictDiffers = br ? br.promptFn + br.promptFp + br.reviewer : 0;
  const parts = [
    { key: "promptFn" as const, label: "Solo el revisor lo marca", value: items.promptFn },
    { key: "promptFp" as const, label: "Solo la IA lo marca", value: items.promptFp },
    { key: "reviewer" as const, label: "Posible error de planilla", value: items.reviewer },
  ];
  return (
    <section className="card grid gap-3" aria-labelledby="bridge-h">
      <h3 id="bridge-h" className="m-0 text-sm font-semibold">
        Desacuerdos por motivo
        <MetricHelp title="Desacuerdos por motivo">
          Un desacuerdo por motivo es un motivo de una llamada en que la IA y el revisor no marcan lo mismo. Rojo: el revisor marcó el motivo y la IA no.
          Amarillo: la IA lo marcó y el revisor no. Azul: la IA de análisis cree que el error está en la planilla.
        </MetricHelp>
      </h3>
      <p className="m-0 text-sm">
        En las {int(a.byCall.n)} llamadas hay <b>{int(total)} desacuerdos por motivo</b> en <b>{int(crits)} motivos</b>. Además, la IA quedó sin decisión en{" "}
        {int(undecidedCrits)} motivos de alguna llamada; esos no cuentan como desacuerdo.
        {br && br.calls > 0 && (
          <>
            {" "}
            Los {int(total)} están en {int(br.calls)} llamadas: {int(verdictDiffers)} en desacuerdo de veredicto, {int(br.agree)} que coinciden en el
            veredicto pero difieren en algún motivo{br.undecided ? ` y ${int(br.undecided)} sin decisión de la IA` : ""}.
          </>
        )}
        {version && total > 0 && (
          <>
            {" "}
            <Link href={listHref(version, "disagree")}>Ver las {int(br?.calls ?? 0)} llamadas ›</Link>
          </>
        )}
      </p>
      {total > 0 && (
        <>
          <div
            role="img"
            aria-label={`${int(total)} desacuerdos por motivo: ${parts.map((p) => `${int(p.value)} ${p.label}`).join(", ")}.`}
            className="flex h-8 w-full gap-[2px]"
          >
            {parts
              .filter((p) => p.value > 0)
              .map((p) => (
                <div
                  key={p.key}
                  className="flex min-w-[4px] items-center justify-center overflow-hidden text-[13px] font-semibold"
                  style={{ ...PARTS[p.key].style, color: PARTS[p.key].ink, flexGrow: p.value, flexBasis: 0 }}
                >
                  {pct(p.value, total) >= 12 && int(p.value)}
                </div>
              ))}
          </div>
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {parts.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5">
                <Swatch part={p.key} />
                {p.label} <span className="tabular">{int(p.value)} ({pct(p.value, total)} %)</span>
              </span>
            ))}
            <span className="help">Suman {int(total)}</span>
          </p>
        </>
      )}
    </section>
  );
}

/** ¿En qué motivos? (§4.1-5): las barras suman el total de desacuerdos; la duda va en su columna. */
function ByCriterion({
  a,
  version,
  names,
  patternsOf,
  all,
  onAll,
  onPatterns,
}: {
  a: Agreement;
  version: string | null;
  names: Map<number, string>;
  patternsOf: Map<number, number | null>;
  all: boolean;
  onAll: () => void;
  onPatterns: (criterionId: number) => void;
}) {
  const rows = (a.byCriterion ?? []).filter((c) => sides(c).total > 0).sort((x, y) => sides(y).total - sides(x).total || x.criterionId - y.criterionId);
  const total = rows.reduce((t, c) => t + sides(c).total, 0);
  const scale = Math.max(1, ...rows.map((c) => sides(c).total));
  const shown = all ? rows : rows.slice(0, TOP_MOTIVES);
  if (rows.length === 0) return null;
  return (
    <section className="grid gap-2" aria-labelledby="by-crit-h">
      <h2 id="by-crit-h" className="m-0 text-lg font-semibold">
        ¿En qué motivos?
      </h2>
      <p className="help m-0">
        Desacuerdos por motivo · suman {int(total)} en {int(rows.length)} motivos{version ? " · Clic en un motivo para ver sus llamadas" : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Motivo</th>
              <th scope="col" className="w-[35%] min-w-[120px]">
                <span className="sr-only">Barra</span>
              </th>
              <th scope="col" className="num">
                Solo el revisor lo marca
              </th>
              <th scope="col" className="num">
                Solo la IA lo marca
              </th>
              <th scope="col" className="num">
                Posible error de planilla
              </th>
              <th scope="col" className="num">
                Total
              </th>
              <th scope="col" className="num">
                Sin decisión
              </th>
              <th scope="col">
                <span className="sr-only">Patrones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const s = sides(c);
              const patterns = patternsOf.get(c.criterionId);
              const name = `${c.criterionId} · ${names.get(c.criterionId) ?? `Motivo ${c.criterionId}`}`;
              return (
                <tr key={c.criterionId}>
                  <th scope="row" className="min-w-[12rem] max-w-[22rem] whitespace-normal font-normal">
                    {version ? (
                      <Link href={listHref(version, "disagree", c.criterionId)} aria-label={`Motivo ${name}: ${s.total} desacuerdos. Ver llamadas`}>
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </th>
                  <td aria-hidden>
                    <div className="flex h-4 gap-[2px]" style={{ width: `${(100 * s.total) / scale}%` }}>
                      {(
                        [
                          ["promptFn", s.fn],
                          ["promptFp", s.fp],
                          ["reviewer", s.reviewer],
                        ] as const
                      )
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <div key={k} className="min-w-[3px]" style={{ ...PARTS[k].style, flexGrow: v, flexBasis: 0 }} />
                        ))}
                    </div>
                  </td>
                  <td className="num">{int(s.fn)}</td>
                  <td className="num">{int(s.fp)}</td>
                  <td className="num">{int(s.reviewer)}</td>
                  <td className="num font-semibold">{int(s.total)}</td>
                  <td className="num help">{int(c.undecided)}</td>
                  <td>
                    {patterns ? (
                      <button type="button" className="btn btn-ghost btn-sm whitespace-nowrap" onClick={() => onPatterns(c.criterionId)}>
                        {patterns} {patterns === 1 ? "patrón" : "patrones"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > TOP_MOTIVES && (
        <div>
          <Button size="sm" onClick={onAll}>
            {all ? `Mostrar solo ${TOP_MOTIVES}` : `Ver los ${rows.length} motivos`}
          </Button>
        </div>
      )}
    </section>
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
