"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AgreementMosaic, ReasonMatchBar } from "@/components/admin/agreement-charts";
import { CaseGrid } from "@/components/admin/case-grid";
import { GoalBadge, QualityHeader, headerNumbers } from "@/components/admin/quality-header";
import { listHref } from "@/components/admin/verification-labels";
import { Button } from "@/components/ui/button";
import { MetricHelp } from "@/components/ui/metric-help";
import { EmptyState } from "@/components/ui/states";
import type { AiQuality, QualitySeries } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";
import { int, shortDate } from "@/lib/format";
import { MAX_SERIES, defaultSeries, seriesName } from "@/lib/quality";

/**
 * Estadísticas › Calidad de la IA (docs/ux/admin-prompt-metrics/05-numeros-propuesta.md §5): cabecera común + mosaico
 * de la primera versión elegida, comparación entre versiones (con 2 o más) y desacuerdos por motivo. Todo sobre las
 * llamadas de validación y con las cifras de la pestaña Prueba; cada cifra lleva a su lista de llamadas.
 * Las versiones elegidas viven en la URL (?series=…).
 */

const TOP = 12;
const color = (s: QualitySeries) => `var(--series-${(s.colorIndex % 6) + 1})`;
const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);
const usd = (v: number | null) => (v == null ? "—" : `US$ ${v.toFixed(4).replace(".", ",")}`);

function Dot({ s }: { s: QualitySeries }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ background: color(s) }} />;
}

export function AiQualityView({ data }: { data: AiQuality }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const byId = useMemo(() => new Map(data.series.map((s) => [s.id, s])), [data.series]);
  const fromUrl = (params.get("series") ?? "").split(",").filter((id) => byId.has(id));
  const selectedIds = fromUrl.length ? fromUrl.slice(0, MAX_SERIES) : defaultSeries(data.series);
  const selected = selectedIds.map((id) => byId.get(id)!);
  const allMotives = params.get("motives") === "all";
  // Versión activa (06-ajustes-feedback.md §5, F5): la que muestran cabecera, mosaico y análisis por caso.
  const activeId = selectedIds.includes(params.get("ver") ?? "") ? params.get("ver")! : selectedIds[0];
  const [announce, setAnnounce] = useState("");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  if (selected.length === 0)
    return <EmptyState title="Aún no hay versiones medidas sobre las llamadas de validación." body="Prueba una versión desde Prompt para verla aquí." />;

  const main = byId.get(activeId)!;
  const current = data.series.find((s) => s.isCurrent);
  const view = (id: string) => {
    update({ ver: id === selectedIds[0] ? null : id });
    setAnnounce(`Ahora ves ${seriesName(byId.get(id)!)}`);
  };
  const changeSeries = (ids: string[]) => {
    const added = ids.find((id) => !selectedIds.includes(id));
    // La versión recién agregada pasa a ser la activa: agregar siempre cambia algo arriba.
    const ver = added ?? (ids.includes(activeId) ? activeId : ids[0]);
    update({ series: ids.join(","), ver: ver === ids[0] ? null : ver });
    if (added) setAnnounce(`Ahora ves ${seriesName(byId.get(added)!)}`);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <SeriesBar data={data} selected={selected} onChange={changeSeries} />
      {selected.length > 1 && <ViewSwitch selected={selected} activeId={activeId} onView={view} />}
      <div className="help -mt-2 grid gap-0.5">
        <span>
          La duda de la IA se cuenta aparte, como en la pestaña Prueba; desde el 12-nov las cifras de esta pantalla pueden diferir de las que se veían
          antes.
        </span>
        {data.promptTestRunning && (
          <span>
            Prueba de v{data.promptTestRunning.version} en curso ({data.promptTestRunning.done} de {data.promptTestRunning.total}) ·{" "}
            <Link href={`/admin/prompts/${encodeURIComponent(data.promptTestRunning.version)}`}>Ver avance</Link>
          </span>
        )}
      </div>

      <QualityHeader
        version={main.promptVersion}
        a={main.agreement}
        goals={data.goals}
        linkVersion={main.listVersion}
        compare={current && current.id !== main.id ? { label: `v${current.promptVersion} (vigente)`, a: current.agreement } : null}
        note={
          !main.listVersion ? (
            <p className="help m-0">
              {main.isCurrent
                ? "La vigente se mide con sus corridas de hoy, sin lista de llamadas ni análisis de causa."
                : main.source === "full_run"
                  ? "Corrida completa: aquí se mide solo en sus llamadas de validación, igual que las pruebas. Su lista completa está en Verificación."
                  : "Hay una prueba más nueva de esta versión: la lista de llamadas abre esa."}
            </p>
          ) : null
        }
      />
      <AgreementMosaic version={main.promptVersion} a={main.agreement} linked={!!main.listVersion} />
      <ReasonMatchBar version={main.promptVersion} a={main.agreement} linked={!!main.listVersion} />
      <CaseGrid key={main.id} series={main} />

      {selected.length > 1 && <Comparison selected={selected} goals={data.goals} activeId={activeId} onView={view} />}

      <ByCriterion data={data} selected={selected} all={allMotives} onAll={() => update({ motives: allMotives ? null : "all" })} />

      <details className="card">
        <summary className="cursor-pointer font-semibold">Cómo leer esta pantalla</summary>
        <dl className="mt-3 grid gap-2 text-sm">
          <Term t="Llamadas de validación">
            Las llamadas del golden set que se usan para medir. El loop aprende de otras (entrenamiento); si una versión usa reglas que salieron de
            un análisis de causa de estas mismas llamadas, la cabecera lo avisa porque su mejora se ve más grande de lo que es.
          </Term>
          <Term t="Coincide con el revisor">Mismo veredicto final (Cumple o No cumple) que la planilla del revisor.</Term>
          <Term t="Falsas alarmas">
            De las llamadas que el revisor aprobó, cuántas rechaza la IA. Meta ≤ {data.goals.falsePositivePct} %.
          </Term>
          <Term t="Rechazos no detectados">
            De las llamadas que el revisor rechazó, cuántas aprueba la IA. Meta ≤ {data.goals.falseNegativePct} %.
          </Term>
          <Term t="Sin decisión de la IA">La IA no se decide y la llamada pasa a un auditor. No cuenta como falsa alarma ni como rechazo no detectado.</Term>
          <Term t="Posible error del revisor">
            Desacuerdos que una IA de análisis atribuye al revisor, no al prompt. Sin confirmar hasta que se verifiquen a mano.
          </Term>
          <Term t="Desacuerdo por motivo">Un motivo de una llamada en que la IA y el revisor no marcan lo mismo. Una llamada puede tener varios.</Term>
        </dl>
      </details>
    </div>
  );
}

function Term({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-semibold">{t}: </dt>
      <dd className="m-0 inline">{children}</dd>
    </div>
  );
}

// --- Selector de versiones ---------------------------------------------------------------------------------------

function SeriesBar({ data, selected, onChange }: { data: AiQuality; selected: QualitySeries[]; onChange: (ids: string[]) => void }) {
  const ids = selected.map((s) => s.id);
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const options = [...data.series].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (b.ranAt ?? "").localeCompare(a.ranAt ?? ""));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">Versiones a comparar</span>
      {selected.map((s) => (
        <span key={s.id} className="chip" style={{ borderColor: color(s) }}>
          <Dot s={s} />
          {seriesName(s)}
          <button
            type="button"
            aria-label={`Quitar ${seriesName(s)}`}
            disabled={ids.length === 1}
            title={ids.length === 1 ? "Debe quedar al menos una versión" : undefined}
            onClick={() => toggle(s.id)}
          >
            <X size={14} aria-hidden />
          </button>
        </span>
      ))}
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost">
            <Plus size={14} aria-hidden /> Agregar versión <ChevronDown size={14} aria-hidden />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={4} className="z-[60] max-h-[420px] w-[340px] overflow-auto rounded-md border border-border bg-card p-2 shadow-md">
            {options.map((s) => {
              const on = ids.includes(s.id);
              const full = !on && ids.length >= MAX_SERIES;
              return (
                <label
                  key={s.id}
                  className={cn("flex min-h-8 cursor-pointer items-center gap-2 rounded px-1.5 text-sm hover:bg-muted", full && "cursor-not-allowed opacity-60")}
                >
                  <input type="checkbox" checked={on} disabled={full || (on && ids.length === 1)} onChange={() => toggle(s.id)} />
                  <Dot s={s} />
                  <span className="flex-1">
                    {seriesName(s)}
                    {s.ranAt && <span className="help"> · {shortDate(s.ranAt)}</span>}
                  </span>
                  <span className="help tabular">{int(s.agreement.byCall.n)}</span>
                </label>
              );
            })}
            <p className="help m-0 mt-1">Solo versiones medidas sobre las llamadas de validación. Hasta {MAX_SERIES} a la vez.</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function ViewSwitch({ selected, activeId, onView }: { selected: QualitySeries[]; activeId: string; onView: (id: string) => void }) {
  const move = (delta: number) => {
    const i = selected.findIndex((s) => s.id === activeId);
    const next = selected[(i + delta + selected.length) % selected.length];
    onView(next.id);
    requestAnimationFrame(() => document.getElementById(`ver-${next.id}`)?.focus());
  };
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold" id="ver-label">
        Ver:
      </span>
      <div
        className="seg"
        role="radiogroup"
        aria-labelledby="ver-label"
        onKeyDown={(e) => {
          const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!delta) return;
          e.preventDefault();
          move(delta);
        }}
      >
        {selected.map((s) => (
          <button
            key={s.id}
            id={`ver-${s.id}`}
            type="button"
            role="radio"
            aria-checked={s.id === activeId}
            tabIndex={s.id === activeId ? 0 : -1}
            onClick={() => onView(s.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Dot s={s} />
              {s.isCurrent ? `v${s.promptVersion} vigente` : `v${s.promptVersion}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Comparación entre versiones (§5.1-3) ------------------------------------------------------------------------

function Comparison({
  selected,
  goals,
  activeId,
  onView,
}: {
  selected: QualitySeries[];
  goals: AiQuality["goals"];
  activeId: string;
  onView: (id: string) => void;
}) {
  return (
    <section className="card" aria-labelledby="q-compare">
      <h2 id="q-compare" className="mb-3 mt-0 text-base font-semibold">
        Comparación entre versiones
      </h2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Versión</th>
              <th scope="col" className="num">
                Coincide
              </th>
              <th scope="col" className="num">
                Posible error del revisor
              </th>
              <th scope="col" className="num">
                Falsas alarmas
              </th>
              <th scope="col" className="num">
                Rechazos no detectados
              </th>
              <th scope="col" className="num">
                Sin decisión
              </th>
              <th scope="col" className="num">
                Costo por llamada
              </th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s) => {
              const h = headerNumbers(s.agreement);
              const analyzed = s.agreement.causeAnalysis.status === "done";
              const cell = (value: string, sub: string, list: Parameters<typeof listHref>[1] | null) => (
                <td className="num align-top">
                  {s.listVersion && list ? (
                    <Link href={listHref(s.listVersion, list)} aria-label={`${seriesName(s)}: ${value}, ${sub}. Ver llamadas`}>
                      {value}
                    </Link>
                  ) : (
                    value
                  )}
                  <div className="help font-normal">{sub}</div>
                </td>
              );
              return (
                <tr key={s.id} className={cn(s.id === activeId && "bg-accent")}>
                  <th scope="row" className="font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      <Dot s={s} />
                      {seriesName(s)}
                    </span>
                    <div className="mt-1">
                      {s.id === activeId ? (
                        <span className="help font-semibold">Viendo</span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => onView(s.id)} aria-label={`Ver ${seriesName(s)}`}>
                          Ver
                        </Button>
                      )}
                    </div>
                  </th>
                  {cell(`${h.agreePct} %`, `${int(h.agree)} de ${int(h.n)}`, "agree")}
                  {analyzed ? cell(`${pct(h.reviewer, h.n)} %`, `${int(h.reviewer)} de ${int(h.n)}`, "reviewer") : <td className="num help">sin analizar</td>}
                  <td className="num align-top">
                    {s.listVersion ? <Link href={listHref(s.listVersion, "fp")}>{h.fpPct} %</Link> : `${h.fpPct} %`}
                    <div className="help font-normal">
                      {int(h.fp)} de {int(h.approved)}
                    </div>
                    <GoalBadge ok={h.fpPct <= goals.falsePositivePct} goal={goals.falsePositivePct} />
                  </td>
                  <td className="num align-top">
                    {s.listVersion ? <Link href={listHref(s.listVersion, "fn")}>{h.fnPct} %</Link> : `${h.fnPct} %`}
                    <div className="help font-normal">
                      {int(h.fn)} de {int(h.rejected)}
                    </div>
                    <GoalBadge ok={h.fnPct <= goals.falseNegativePct} goal={goals.falseNegativePct} />
                  </td>
                  {cell(`${pct(h.undecided, h.n)} %`, `${int(h.undecided)} de ${int(h.n)}`, "undecided")}
                  <td className="num align-top">{usd(s.costPerCallUsd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help mb-0 mt-2">Falsas alarmas sobre las llamadas que el revisor aprobó; rechazos no detectados sobre las que rechazó.</p>
    </section>
  );
}

// --- Desacuerdos por motivo (§5.1-4) -----------------------------------------------------------------------------

function ByCriterion({ data, selected, all, onAll }: { data: AiQuality; selected: QualitySeries[]; all: boolean; onAll: () => void }) {
  const names = new Map(data.criteria.map((c) => [c.id, c.name]));
  const per = selected.map((s) => new Map((s.agreement.byCriterion ?? []).map((c) => [c.criterionId, c])));
  const total = (i: number, id: number) => {
    const c = per[i].get(id);
    return c ? c.fn + c.reviewerFn + c.fp + c.reviewerFp : 0;
  };
  const ids = [...new Set(per.flatMap((m) => [...m.keys()]))]
    .filter((id) => per.some((_, i) => total(i, id) > 0))
    .sort((a, b) => total(0, b) - total(0, a) || a - b);
  const shown = all ? ids : ids.slice(0, TOP);
  const sums = selected.map((_, i) => ids.reduce((t, id) => t + total(i, id), 0));
  return (
    <section className="card" aria-labelledby="q-criteria">
      <h2 id="q-criteria" className="mb-1 mt-0 text-base font-semibold">
        Desacuerdos por motivo
        <MetricHelp title="Desacuerdos por motivo">
          Un desacuerdo por motivo es un motivo de una llamada en que la IA y el revisor no marcan lo mismo; una llamada puede tener varios. «Solo el
          revisor lo marca»: la planilla marcó el motivo y la IA no. «Solo la IA lo marca»: al revés. Incluye lo que la IA de análisis atribuye a la
          planilla. La duda de la IA no cuenta aquí.
        </MetricHelp>
      </h2>
      <p className="help mb-3 mt-0">
        {selected.map((s, i) => `${seriesName(s)}: ${int(sums[i])} desacuerdos por motivo`).join(" · ")} · Clic en un número para ver esas llamadas.
      </p>
      {ids.length === 0 ? (
        <p className="help m-0">No hay desacuerdos por motivo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  Motivo
                </th>
                {selected.map((s) => (
                  <th key={s.id} scope="colgroup" colSpan={2} className="text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <Dot s={s} />
                      {seriesName(s)}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                {selected.flatMap((s) => [
                  <th key={`${s.id}-fn`} scope="col" className="num">
                    <span className="sr-only">{seriesName(s)}: </span>Solo el revisor lo marca
                  </th>,
                  <th key={`${s.id}-fp`} scope="col" className="num">
                    <span className="sr-only">{seriesName(s)}: </span>Solo la IA lo marca
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {shown.map((id) => (
                <tr key={id}>
                  <th scope="row" className="min-w-[12rem] max-w-[22rem] whitespace-normal font-normal">
                    {id} · {names.get(id) ?? ""}
                  </th>
                  {selected.flatMap((s, i) => {
                    const c = per[i].get(id);
                    const fn = c ? c.fn + c.reviewerFn : 0;
                    const fp = c ? c.fp + c.reviewerFp : 0;
                    const link = (n: number, side: "fn" | "fp") =>
                      n > 0 && s.listVersion ? (
                        <Link href={listHref(s.listVersion, side, id)} className="inline-block min-w-6 text-center">
                          {int(n)}
                        </Link>
                      ) : (
                        int(n)
                      );
                    return [
                      <td key={`${s.id}-fn`} className="num">
                        {link(fn, "fn")}
                      </td>,
                      <td key={`${s.id}-fp`} className="num">
                        {link(fp, "fp")}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ids.length > TOP && (
        <div className="mt-2">
          <Button size="sm" onClick={onAll}>
            {all ? `Mostrar solo ${TOP}` : `Ver los ${ids.length} motivos`}
          </Button>
        </div>
      )}
    </section>
  );
}
