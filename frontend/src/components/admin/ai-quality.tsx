"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { CallVerdictBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import type { AiQuality, QualitySeries } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";
import { int, pct, plural, shortDate } from "@/lib/format";
import {
  MAX_SERIES,
  callDiff,
  clientMarks,
  coverage,
  criterionRows,
  defaultSeries,
  detectionGoal,
  rejects,
  resultTier,
  seriesMetrics,
  seriesName,
  type Coverage,
  type SeriesMetrics,
} from "@/lib/quality";

type Metric = "balanced" | "detection" | "fp" | "agreement";
type Kind = "all" | "ai_only" | "missed";

const METRICS: {
  key: Metric;
  label: string;
  value: (m: SeriesMetrics) => number;
  lowerIsBetter?: boolean;
}[] = [
  { key: "balanced", label: "Calce equilibrado", value: (m) => m.balancedPct },
  { key: "detection", label: "Detección", value: (m) => m.detectionPct },
  {
    key: "fp",
    label: "Falsas alarmas (FP)",
    value: (m) => m.falsePositivePct,
    lowerIsBetter: true,
  },
  { key: "agreement", label: "Coincidencia", value: (m) => m.agreementPct },
];
const PAGE = 25;
const MAP_PAGE = 100; // columnas del mapa llamada por llamada por página (§7.10)
const CURRENT = "current"; // serie "Vigente": la corrida vigente de cada llamada (D-88)

const usd = (v: number | null) => (v == null ? "costo sin registrar" : `${v.toFixed(4).replace(".", ",")} USD/llamada`);
const p0 = (v: number) => pct(Math.round(v), 0);
const color = (s: QualitySeries) => `var(--series-${(s.colorIndex % 6) + 1})`;
const list = (ids: number[]) => (ids.length ? ids.join(", ") : "—");

/** Marca de la corrida: color del modelo; la segunda corrida del mismo modelo va rayada (H-98). */
function swatch(s: QualitySeries, striped: boolean): React.CSSProperties {
  return striped
    ? {
        background: `repeating-linear-gradient(135deg, ${color(s)} 0 3px, #fff 3px 5px)`,
        border: `1px solid ${color(s)}`,
      }
    : { background: color(s) };
}

function Dot({ s, striped }: { s: QualitySeries; striped: boolean }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={swatch(s, striped)} />;
}

/** Cobertura en el chip (§7.11, D-89): "892 de 1.097", o solo el total si la corrida las tiene todas. */
function CoverageText({ cov }: { cov: Coverage }) {
  const text = cov.withResult === cov.total ? int(cov.total) : `${int(cov.withResult)} de ${int(cov.total)}`;
  return (
    <>
      <span aria-hidden className="help tabular">
        · {text}
      </span>
      <span className="sr-only">
        , {int(cov.withResult)} de {int(cov.total)} llamadas con resultado
      </span>
    </>
  );
}

/** Calidad de la IA por corrida contra el cliente (Cambio 15, §7). El estado vive en la URL (H-96). */
export function AiQualityView({ data }: { data: AiQuality }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const listHeading = useRef<HTMLHeadingElement>(null);

  const byId = useMemo(() => new Map(data.series.map((s) => [s.id, s])), [data.series]);
  const fromUrl = (params.get("series") ?? "").split(",").filter((id) => byId.has(id));
  const selectedIds = fromUrl.length ? fromUrl.slice(0, MAX_SERIES) : defaultSeries(data.series);
  const selected = selectedIds.map((id) => byId.get(id)!);
  const metric = (METRICS.find((m) => m.key === params.get("metric")) ?? METRICS[0]).key;
  const mapId = selectedIds.includes(params.get("map") ?? "") ? params.get("map")! : null;
  const listId = selectedIds.includes(params.get("list") ?? "") ? params.get("list")! : null;
  const reason = Number(params.get("reason")) || null;
  const kind = (["ai_only", "missed"].includes(params.get("kind") ?? "") ? params.get("kind") : "all") as Kind;
  const page = Math.max(0, Number(params.get("page")) || 0);
  const mapPage = Math.max(0, Number(params.get("mapPage")) || 0);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  // Quitar la corrida del mapa cambia la corrida del mapa: vuelve a la página 1 (D-90).
  const setSeries = (ids: string[]) =>
    update({ series: ids.join(","), page: null, ...(ids.includes(mapId ?? best[0].id) ? {} : { mapPage: null }) });

  // La segunda (o más) corrida de un mismo modelo entre las elegidas va rayada.
  const striped = new Set(selected.filter((s, i) => selected.findIndex((o) => o.model === s.model) !== i).map((s) => s.id));
  const metrics = new Map(selected.map((s) => [s.id, seriesMetrics(s, data.calls)]));
  const best = [...selected].sort((a, b) => metrics.get(b.id)!.balancedPct - metrics.get(a.id)!.balancedPct);

  const marked = data.calls.filter((c) => c.clientFails).length;
  const okCount = data.calls.filter((c) => c.clientVerdict === "compliant").length;
  const badCount = data.calls.length - okCount;
  const badMarked = data.calls.filter((c) => c.clientVerdict === "non_compliant" && c.clientFails).length;
  const rows = criterionRows(data, selected);
  const silent = data.criteria.filter((c) => !rows.some((r) => r.id === c.id)).map((c) => c.id);
  const critName = new Map(data.criteria.map((c) => [c.id, c]));

  if (data.calls.length === 0) return <EmptyState title="Aún no hay llamadas con planilla de calidad para medir." />;

  const openList = (seriesId: string, criterion: number | null, k: Kind) => {
    update({
      list: seriesId,
      reason: criterion ? String(criterion) : null,
      kind: k === "all" ? null : k,
      page: null,
    });
    requestAnimationFrame(() => listHeading.current?.focus());
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <p aria-live="polite" className="sr-only">
        Comparando {plural(selected.length, "corrida", "corridas")}
      </p>

      <SeriesBar data={data} selected={selected} striped={striped} onChange={setSeries} />
      <div className="help -mt-2 grid gap-0.5">
        <span>
          Referencia: planilla de calidad · {int(data.calls.length)} llamadas ({okCount} Cumple · {badCount} No cumple)
        </span>
        {marked === 0 ? (
          <span className="font-medium text-amber-800">
            La planilla de estas llamadas no trae la marca por motivo: por motivo solo se ven las falsas alarmas en llamadas Cumple.
          </span>
        ) : (
          marked < data.calls.length && (
            <span>
              Marca por motivo: {marked} de {data.calls.length} llamadas · {data.calls.length - marked} sin marca, solo cuentan por llamada
            </span>
          )
        )}
        {data.promptTestRunning && (
          <span>
            Prueba de v{data.promptTestRunning.version} en curso ({data.promptTestRunning.done} de {data.promptTestRunning.total}) ·{" "}
            <Link href={`/admin/prompts/${encodeURIComponent(data.promptTestRunning.version)}`}>Ver avance</Link>
          </span>
        )}
      </div>

      <Headline best={best} metrics={metrics} data={data} />

      <section className="card" aria-labelledby="q-rank">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="q-rank" className="m-0 text-base font-semibold">
            ¿Qué corrida calza mejor con la planilla?
          </h2>
          <div className="seg" role="radiogroup" aria-label="Métrica del ranking">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={metric === m.key}

                onClick={() => update({ metric: m.key === "balanced" ? null : m.key })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <Ranking selected={selected} striped={striped} metrics={metrics} metric={metric} data={data} />
        <p className="help mb-0 mt-3">Dudosa cuenta como No cumple: en operación igual llega a un auditor.</p>
      </section>

      <section aria-labelledby="q-matrix">
        <h2 id="q-matrix" className="mb-2 mt-0 text-base font-semibold">
          ¿Acierta el veredicto de la llamada?
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {selected.map((s) => (
            <Matrix key={s.id} s={s} striped={striped.has(s.id)} m={metrics.get(s.id)!} data={data} />
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="q-criteria">
        <h2 id="q-criteria" className="mb-3 mt-0 text-base font-semibold">
          ¿En qué motivos se equivoca cada corrida?
        </h2>
        <CriteriaTable
          data={data}
          rows={rows}
          selected={selected}
          striped={striped}
          okCount={okCount}
          badMarked={badMarked}
          critName={critName}
          showRight={marked > 0}
          onCell={openList}
        />
        <p className="help mb-0 mt-2">
          Borde grueso = la única mejor de la fila · +n = la IA lo marca en una No cumple y la planilla no · clic en un número para ver esas llamadas.
        </p>
        {silent.length > 0 && <p className="help mb-0 mt-1">Ninguna corrida ni la planilla marcaron los motivos {silent.join(", ")}.</p>}
      </section>

      <CallMap
        data={data}
        selected={selected}
        striped={striped}
        mapId={mapId ?? best[0].id}
        page={mapPage}
        onPick={(id) => update({ map: id, mapPage: null })}
        onPage={(p) => update({ mapPage: p ? String(p) : null })}
        onList={(id) => openList(id, null, "all")}
      />

      <Disagreements
        data={data}
        selected={selected}
        listId={listId ?? best[0].id}
        reason={reason}
        kind={kind}
        page={page}
        critName={critName}
        headingRef={listHeading}
        onChange={(c) => update(c)}
      />

      <details className="card">
        <summary className="cursor-pointer font-semibold">Cómo leer las métricas y lo que no se mide</summary>
        <dl className="mt-3 grid gap-2 text-sm">
          <Term t="Corrida">
            Un modelo con una versión del prompt aplicado a un conjunto de llamadas. Repetir una corrida muestra cuánto varía el resultado. No es la pasada del
            worker.
          </Term>
          <Term t="Prueba desde la app">Corrida lanzada desde Prompt, con costo confirmado.</Term>
          <Term t="Vigente">La corrida que hoy define el veredicto del motor.</Term>
          <Term t="Marca de la planilla por motivo">Motivos marcados NO CUMPLE en la planilla de calidad.</Term>
          <Term t="Detección">De las llamadas que la planilla marcó No cumple, cuántas marca también la IA. Meta ≥ {detectionGoal(data)} %.</Term>
          <Term t="Falsas alarmas (FP)">
            Llamadas Cumple según la planilla que la IA marca No cumple. Meta ≤ {data.goals.falsePositivePct} %. Por motivo: la IA marca un motivo que la planilla
            no marcó.
          </Term>
          <Term t="Rechazos no detectados (FN)">
            Llamadas No cumple según la planilla que la IA deja en Cumple. Meta ≤ {data.goals.falseNegativePct} %. Por motivo: la planilla lo marcó y la IA no.
          </Term>
          <Term t="Calce equilibrado">Promedio entre la detección y (1 − falsas alarmas). Una IA que marca todo No cumple saca 50 %.</Term>
          <Term t="Coincidencia">Porcentaje de llamadas donde la IA dijo lo mismo que la planilla.</Term>
          <Term t="Desacuerdo">La IA y la planilla difieren en el veredicto o en al menos un motivo.</Term>
        </dl>
        <p className="mb-0 mt-3 text-sm">
          La planilla se toma como verdad. Si quien la llenó pasó por alto un incumplimiento, aquí la IA aparece con un falso positivo que en
          realidad es un acierto; para revisarlo, abre la llamada desde la lista. El motivo 1 lo calcula el código desde las esperas, así que es igual en todas
          las corridas.
        </p>
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

// --- Selector de corridas ----------------------------------------------------------------------------------------

function SeriesBar({
  data,
  selected,
  striped,
  onChange,
}: {
  data: AiQuality;
  selected: QualitySeries[];
  striped: Set<string>;
  onChange: (ids: string[]) => void;
}) {
  const ids = selected.map((s) => s.id);
  const models = [...new Map(data.series.map((s) => [s.model, s.modelLabel])).entries()];
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">Corridas</span>
      {selected.map((s) => (
        <span key={s.id} className="chip" style={{ borderColor: color(s) }}>
          <Dot s={s} striped={striped.has(s.id)} />
          {seriesName(s)}
          {s.isCurrent && s.id !== CURRENT && <span className="help">· Vigente</span>}
          <CoverageText cov={coverage(s.id, data.calls)} />
          <button
            type="button"
            aria-label={`Quitar ${seriesName(s)}`}
            disabled={ids.length === 1}
            title={ids.length === 1 ? "Debe quedar al menos una corrida" : undefined}
            onClick={() => toggle(s.id)}
          >
            <X size={14} aria-hidden />
          </button>
        </span>
      ))}
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost">
            <Plus size={14} aria-hidden /> Agregar corrida <ChevronDown size={14} aria-hidden />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-[60] max-h-[420px] w-[360px] overflow-auto rounded-md border border-border bg-card p-2 shadow-md"
          >
            {models.map(([model, label]) => (
              <fieldset key={model} className="m-0 mb-2 border-0 p-0">
                <legend className="help mb-1 font-semibold">{label}</legend>
                {data.series
                  .filter((s) => s.model === model)
                  .sort((a, b) => (b.ranAt ?? "").localeCompare(a.ranAt ?? ""))
                  .map((s) => {
                    const on = ids.includes(s.id);
                    const full = !on && ids.length >= MAX_SERIES;
                    const cov = coverage(s.id, data.calls);
                    return (
                      <label
                        key={s.id}
                        className={cn(
                          "flex min-h-8 cursor-pointer items-center gap-2 rounded px-1.5 text-sm hover:bg-muted",
                          full && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input type="checkbox" checked={on} disabled={full || (on && ids.length === 1)} onChange={() => toggle(s.id)} />
                        <span className="flex-1">
                          v{s.promptVersion}
                          {s.source === "run" && s.runLabel.replace(/^v[\d.]+\s*/, "") ? ` · ${s.runLabel.replace(/^v[\d.]+\s*/, "")}` : ""}
                          {s.isCurrent && s.id !== CURRENT && <b> · Vigente</b>}
                          {s.source === "prompt_test" && (
                            <span className="help">
                              {" "}
                              · Prueba desde la app
                              {s.ranAt ? ` · ${shortDate(s.ranAt)}` : ""}
                            </span>
                          )}
                        </span>
                        <span className="help tabular grid text-right">
                          <span>
                            {cov.withResult === cov.total ? int(cov.total) : `${int(cov.withResult)} de ${int(cov.total)}`}
                          </span>
                          {cov.errors > 0 && <span>{int(cov.errors)} con error</span>}
                        </span>
                      </label>
                    );
                  })}
              </fieldset>
            ))}
            {ids.length >= MAX_SERIES && <p className="help m-0">Puedes comparar hasta {MAX_SERIES} corridas.</p>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span className="help ml-auto">
        {selected.length} de {MAX_SERIES} posibles
      </span>
    </div>
  );
}

// --- Titular y ranking -------------------------------------------------------------------------------------------

function Headline({ best, metrics, data }: { best: QualitySeries[]; metrics: Map<string, SeriesMetrics>; data: AiQuality }) {
  const [a, b] = best;
  const ma = metrics.get(a.id)!;
  const goals = (m: SeriesMetrics) => {
    const det = m.detectionPct >= detectionGoal(data);
    const fp = m.falsePositivePct <= data.goals.falsePositivePct;
    if (det && fp) return "Cumple las dos metas.";
    if (!det && !fp) return "No cumple ninguna de las dos metas.";
    return det ? "Cumple la meta de detección, no la de falsas alarmas." : "Cumple la meta de falsas alarmas, no la de detección.";
  };
  const facts = `detecta ${ma.detected} de ${ma.bad} llamadas No cumple y da ${plural(ma.falsePositives, "falsa alarma", "falsas alarmas")} en ${ma.ok} Cumple.`;
  const close = b && Math.abs(metrics.get(b.id)!.detected - metrics.get(b.id)!.falsePositives - (ma.detected - ma.falsePositives)) <= 1;
  return (
    <div className="card border-l-4" style={{ borderLeftColor: color(a) }}>
      <p className="m-0 font-semibold">
        {!b
          ? `${seriesName(a)} ${facts}`
          : close
            ? `${seriesName(a)} y ${seriesName(b)} calzan casi igual: la primera ${facts}`
            : `${seriesName(a)} es la que mejor calza: ${facts}`}{" "}
        {goals(ma)}
      </p>
      {b && <CoverageNote best={best} metrics={metrics} />}
    </div>
  );
}

/** D-91: si las corridas cubren cantidades distintas, la comparación es orientativa. */
function CoverageNote({ best, metrics }: { best: QualitySeries[]; metrics: Map<string, SeriesMetrics> }) {
  const counts = best.map((s) => metrics.get(s.id)!.n);
  if (counts.every((n) => n === counts[0]))
    return <p className="help mb-0 mt-1">Con {int(counts[0])} llamadas, diferencias de 1 a 3 llamadas entre corridas no son concluyentes.</p>;
  const which =
    best.length > 3
      ? `(${int(Math.min(...counts))} a ${int(Math.max(...counts))})`
      : best.map((s, i) => `${mapName(s)} ${int(counts[i])}`).join(", ");
  return (
    <p className="help mb-0 mt-1">
      Cada corrida se mide sobre las llamadas que tiene{best.length > 3 ? " " : ": "}
      {which}. No son las mismas llamadas, así que la comparación es orientativa.
    </p>
  );
}

/** Nombre corto: "Gemini · Vigente" para la serie vigente, "{modelo} · v{versión}" para las demás. */
function mapName(s: QualitySeries): string {
  return s.id === CURRENT ? `${s.modelLabel.split(" ")[0]} · Vigente` : `${s.modelLabel} · v${s.promptVersion}`;
}

function Ranking({
  selected,
  striped,
  metrics,
  metric,
  data,
}: {
  selected: QualitySeries[];
  striped: Set<string>;
  metrics: Map<string, SeriesMetrics>;
  metric: Metric;
  data: AiQuality;
}) {
  const def = METRICS.find((m) => m.key === metric)!;
  const ordered = [...selected].sort((x, y) => {
    const d = def.value(metrics.get(y.id)!) - def.value(metrics.get(x.id)!);
    return def.lowerIsBetter ? -d : d;
  });
  const goal = metric === "detection" ? detectionGoal(data) : metric === "fp" ? data.goals.falsePositivePct : null;
  // Falsos positivos van en una escala más corta para que se vean las diferencias.
  const scale = metric === "fp" ? Math.max(20, ...ordered.map((s) => def.value(metrics.get(s.id)!))) : 100;
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {ordered.map((s) => {
        const m = metrics.get(s.id)!;
        const v = def.value(m);
        return (
          <li key={s.id} className="grid grid-cols-[minmax(160px,220px)_1fr] items-center gap-3 max-md:grid-cols-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Dot s={s} striped={striped.has(s.id)} />
              {seriesName(s)}
            </span>
            <div className="flex items-center gap-3">
              <div className="relative h-4 min-w-[120px] flex-1 rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm"
                  style={{
                    ...swatch(s, striped.has(s.id)),
                    width: `${Math.min(100, (v / scale) * 100)}%`,
                  }}
                />
                {goal != null && (
                  <span
                    aria-hidden
                    title={`Meta ${goal} %`}
                    className="absolute -bottom-1 -top-1 w-0.5 bg-ink-900"
                    style={{ left: `${(goal / scale) * 100}%` }}
                  />
                )}
              </div>
              <span className="tabular whitespace-nowrap text-sm">
                <b>{p0(v)}</b> · {m.detected} de {m.bad} · {m.falsePositives} FP · {usd(s.costPerCallUsd)}
                <MissingText cov={coverage(s.id, data.calls)} />
              </span>
            </div>
          </li>
        );
      })}
      {goal != null && (
        <li className="help">
          La línea vertical marca la meta ({metric === "fp" ? "≤" : "≥"} {goal} %).
        </li>
      )}
    </ul>
  );
}

function MissingText({ cov }: { cov: Coverage }) {
  const parts = [cov.errors > 0 && `${int(cov.errors)} con error`, cov.notRun > 0 && `${int(cov.notRun)} sin correr`].filter(Boolean);
  return parts.length ? <span className="help"> · {parts.join(" · ")}</span> : null;
}

// --- Matriz por corrida ------------------------------------------------------------------------------------------

function Matrix({ s, striped, m, data }: { s: QualitySeries; striped: boolean; m: SeriesMetrics; data: AiQuality }) {
  const fnOk = m.falseNegativePct <= data.goals.falseNegativePct;
  const fpOk = m.falsePositivePct <= data.goals.falsePositivePct;
  return (
    <div className="card">
      <p className="m-0 mb-2 flex items-center gap-2 font-semibold">
        <Dot s={s} striped={striped} />
        {seriesName(s)}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="help">
            <th className="text-left font-medium" />
            <th className="text-right font-medium">IA No cumple</th>
            <th className="text-right font-medium">IA Cumple</th>
          </tr>
        </thead>
        <tbody className="tabular">
          <tr>
            <th scope="row" className="py-1 text-left font-medium">
              Planilla: No cumple
            </th>
            <td className="text-right">{m.detected} ✓</td>
            <td className="text-right text-red-700">{m.missed} ✗ no detectadas</td>
          </tr>
          <tr>
            <th scope="row" className="py-1 text-left font-medium">
              Planilla: Cumple
            </th>
            <td className="text-right text-amber-800">{m.falsePositives} ! falsas alarmas</td>
            <td className="text-right">{m.trueNegatives} ✓</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-0 mt-2 text-sm">
        <span className={fnOk ? "" : "font-semibold text-red-700"}>
          {fnOk ? "✓" : "✗"} Rechazos no detectados (FN) {p0(m.falseNegativePct)} (meta ≤ {data.goals.falseNegativePct} %)
        </span>
        {"   "}
        <span className={fpOk ? "" : "font-semibold text-red-700"}>
          {fpOk ? "✓" : "✗"} Falsas alarmas (FP) {p0(m.falsePositivePct)} (meta ≤ {data.goals.falsePositivePct} %)
        </span>
      </p>
      <p className="help mb-0 mt-1">
        {plural(m.uncertain, "dudosa contada", "dudosas contadas")} como No cumple · Citas no validadas {pct(s.unvalidatedQuoteRate)} ·{" "}
        {m.missing ? `${m.missing} sin resultado, fuera del cálculo` : "0 sin resultado"}
      </p>
    </div>
  );
}

// --- Tabla por motivo --------------------------------------------------------------------------------------------

function CriteriaTable({
  data,
  rows,
  selected,
  striped,
  okCount,
  badMarked,
  critName,
  showRight,
  onCell,
}: {
  data: AiQuality;
  rows: ReturnType<typeof criterionRows>;
  selected: QualitySeries[];
  striped: Set<string>;
  okCount: number;
  badMarked: number;
  critName: Map<number, AiQuality["criteria"][number]>;
  showRight: boolean;
  onCell: (seriesId: string, criterion: number, kind: Kind) => void;
}) {
  const total = (fn: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + fn(r), 0);
  const cellBtn = "min-h-6 min-w-6 rounded px-1.5 tabular hover:bg-muted focus-visible:outline-2";
  if (rows.length === 0) return <p className="help m-0">Ninguna corrida ni la planilla marcaron motivos en estas llamadas.</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="tbl flat text-sm">
        <thead>
          <tr>
            <th rowSpan={2}>Motivo</th>
            <th colSpan={selected.length} className="border-l border-border text-center">
              Cumple: falsas alarmas (de {okCount})
            </th>
            {showRight && (
              <th colSpan={selected.length + 1} className="border-l border-border text-center">
                No cumple: detecta lo de la planilla (de {badMarked})
              </th>
            )}
          </tr>
          <tr>
            {selected.map((s, i) => (
              <th key={s.id} className={cn("text-right", i === 0 && "border-l border-border")} title={seriesName(s)}>
                <span className="inline-flex items-center gap-1">
                  <Dot s={s} striped={striped.has(s.id)} />
                  <span className="sr-only">{seriesName(s)}</span>
                  <span aria-hidden>{s.modelLabel.split(" ")[0].slice(0, 6)}</span>
                </span>
              </th>
            ))}
            {showRight && (
              <>
                <th className="border-l border-border text-right">Planilla</th>
                {selected.map((s) => (
                  <th key={s.id} className="text-right" title={seriesName(s)}>
                    <span className="inline-flex items-center gap-1">
                      <Dot s={s} striped={striped.has(s.id)} />
                      <span className="sr-only">{seriesName(s)}</span>
                      <span aria-hidden>{s.modelLabel.split(" ")[0].slice(0, 6)}</span>
                    </span>
                  </th>
                ))}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = critName.get(r.id)!;
            const left = selected.map((s) => r.cells[s.id].aiOnlyOnCompliant);
            const right = selected.map((s) => r.cells[s.id].detected);
            const bestLeft = selected.length > 1 ? Math.min(...left) : null;
            const bestRight = selected.length > 1 && r.clientCount ? Math.max(...right) : null;
            return (
              <tr key={r.id}>
                <td className="max-w-[300px] truncate" title={c.name}>
                  <b className="tabular">{r.id}.</b> {c.name}
                  {c.byCode && <span className="help"> · código</span>}
                  {c.minor && <span className="help"> · leve</span>}
                  {c.partial && <span className="help"> · parcial</span>}
                  {/* Cambio 16 (D-62): el porqué está en el análisis de discrepancias de la corrida vigente. */}
                  {selected.some((s) => s.isCurrent) && data.currentSeriesPatternCounts?.[String(r.id)] ? (
                    <>
                      {" · "}
                      <Link href={`/admin/discrepancies?tab=patterns&motivo=${r.id}`}>Ver por qué</Link>
                    </>
                  ) : null}
                </td>
                {selected.map((s, i) => {
                  const v = left[i];
                  const isBest = bestLeft != null && v === bestLeft && left.filter((x) => x === bestLeft).length === 1;
                  return (
                    <td key={s.id} className={cn("num text-right", i === 0 && "border-l border-border")}>
                      {v === 0 ? (
                        <span className={cn("px-1.5", isBest && "rounded border-2 border-ink-900")}>0{isBest && <span className="sr-only"> mejor</span>}</span>
                      ) : (
                        <button
                          type="button"
                          className={cn(cellBtn, "bg-amber-100", isBest && "border-2 border-ink-900")}
                          aria-label={`${seriesName(s)}: ${v} llamadas Cumple con el motivo ${r.id} marcado solo por la IA`}
                          onClick={() => onCell(s.id, r.id, "ai_only")}
                        >
                          {v}
                          {isBest && <span className="sr-only"> mejor</span>}
                        </button>
                      )}
                    </td>
                  );
                })}
                {showRight && (
                  <>
                    <td className="num border-l border-border text-right font-semibold">{r.clientCount}</td>
                    {selected.map((s, i) => {
                      const cell = r.cells[s.id];
                      const isBest = bestRight != null && right[i] === bestRight && right.filter((x) => x === bestRight).length === 1;
                      const missed = r.clientCount - cell.detected;
                      return (
                        <td key={s.id} className="num text-right">
                          <button
                            type="button"
                            className={cn(cellBtn, isBest && "border-2 border-ink-900")}
                            aria-label={`${seriesName(s)}: detecta ${cell.detected} de ${r.clientCount} del motivo ${r.id}${cell.extra ? `, y lo marca de más en ${cell.extra}` : ""}`}
                            onClick={() => onCell(s.id, r.id, missed > 0 || !cell.extra ? "missed" : "ai_only")}
                          >
                            {cell.detected}
                            {cell.extra > 0 && <span className="text-amber-800">+{cell.extra}</span>}
                            {isBest && <span className="sr-only"> mejor</span>}
                          </button>
                        </td>
                      );
                    })}
                  </>
                )}
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td>Total</td>
            {selected.map((s, i) => (
              <td key={s.id} className={cn("num text-right", i === 0 && "border-l border-border")}>
                {total((r) => r.cells[s.id].aiOnlyOnCompliant)}
              </td>
            ))}
            {showRight && (
              <>
                <td className="num border-l border-border text-right">{total((r) => r.clientCount)}</td>
                {selected.map((s) => (
                  <td key={s.id} className="num text-right">
                    {total((r) => r.cells[s.id].detected)}
                    {total((r) => r.cells[s.id].extra) > 0 && <span className="text-amber-800">+{total((r) => r.cells[s.id].extra)}</span>}
                  </td>
                ))}
              </>
            )}
          </tr>
        </tbody>
      </table>
      {data.criteria.some((c) => c.partial) && (
        <p className="help mb-0 mt-2">«parcial»: los motivos 19 a 25 no se evalúan si la llamada no trae tipificación.</p>
      )}
    </div>
  );
}

// --- Mapa llamada × motivo ---------------------------------------------------------------------------------------

type CellState = "match" | "ai_only" | "missed" | "none" | "unknown" | "error";
const CELL: Record<CellState, string> = {
  match: "bg-[var(--teal-600)]",
  ai_only: "bg-[var(--amber-600)]",
  missed: "border-2 border-[var(--red-700)] bg-white",
  none: "bg-[var(--neutral-100)]",
  unknown: "border border-dashed border-[var(--neutral-300)] bg-white",
  error: "bg-[var(--neutral-500)]",
};
const TIER_TITLE = ["", " · error de la IA, sin resultado", " · esta corrida no la evaluó"];

function CallMap({
  data,
  selected,
  striped,
  mapId,
  page,
  onPick,
  onPage,
  onList,
}: {
  data: AiQuality;
  selected: QualitySeries[];
  striped: Set<string>;
  mapId: string;
  page: number;
  onPick: (id: string) => void;
  onPage: (page: number) => void;
  onList: (id: string) => void;
}) {
  const router = useRouter();
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const s = selected.find((x) => x.id === mapId) ?? selected[0];
  // D-90: todas las llamadas; en cada grupo primero las que tienen resultado, luego con error, luego sin correr.
  const groups = (["compliant", "non_compliant"] as const).map((v) =>
    data.calls
      .filter((c) => c.clientVerdict === v)
      .sort((a, b) => resultTier(a, s.id) - resultTier(b, s.id) || a.callId.localeCompare(b.callId, undefined, { numeric: true })),
  );
  const cov = coverage(s.id, data.calls);
  const name = mapName(s);
  const lacking = [cov.errors > 0 && `${int(cov.errors)} con error`, cov.notRun > 0 && `${int(cov.notRun)} sin correr`].filter(
    (x): x is string => !!x,
  );
  // §7.10: cada página lleva hasta 50 Cumple y 50 No cumple; si un grupo se agota, el otro rellena hasta 100.
  // consumed(k) = cuántas de cada grupo ocupan las primeras k páginas. Los encabezados muestran el total del grupo.
  const total = data.calls.length;
  const pages = Math.max(1, Math.ceil(total / MAP_PAGE));
  const current = Math.min(page, pages - 1);
  const [okTotal, badTotal] = [groups[0].length, groups[1].length];
  const consumed = (k: number) => {
    const t = Math.min(k * MAP_PAGE, total);
    const ok = Math.min(okTotal, Math.max((k * MAP_PAGE) / 2, t - badTotal));
    return [ok, t - ok];
  };
  const [from, to] = [consumed(current), consumed(current + 1)];
  const visible = [0, 1]
    .map((i) => ({ i, from: from[i], calls: groups[i].slice(from[i], to[i]) }))
    .filter((g) => g.calls.length > 0);
  const span = (g: (typeof visible)[number], sep: string) => {
    const [a, b] = [g.from + 1, g.from + g.calls.length];
    return `${g.i === 0 ? "Cumple" : "No cumple"} ${a === b ? int(a) : `${int(a)}${sep}${int(b)}`}`;
  };
  const go = (p: number) => {
    onPage(p);
    // Si el botón con foco queda deshabilitado, el foco pasa al otro.
    if (p === 0 && document.activeElement === prevRef.current) nextRef.current?.focus();
    if (p === pages - 1 && document.activeElement === nextRef.current) prevRef.current?.focus();
  };
  const crits = data.criteria.map((c) => c.id);
  let aiOnly = 0,
    missed = 0;
  for (const c of data.calls) {
    const d = callDiff(c, s.id);
    if (d?.verdictDiffers) {
      if (rejects(d.aiVerdict)) aiOnly += 1;
      else missed += 1;
    }
  }
  const state = (call: AiQuality["calls"][number], crit: number | "verdict"): CellState => {
    const r = call.results[s.id];
    if (!r) return r === null && crit === "verdict" ? "error" : "unknown";
    if (crit === "verdict") {
      const ai = rejects(r.verdict),
        client = call.clientVerdict === "non_compliant";
      return ai && client ? "match" : ai ? "ai_only" : client ? "missed" : "none";
    }
    const truth = clientMarks(call);
    const ai = r.failCriteria.includes(crit);
    if (truth == null) return ai ? "ai_only" : "unknown";
    const client = truth.includes(crit);
    return ai && client ? "match" : ai ? "ai_only" : client ? "missed" : "none";
  };
  const rowLabels = ["Llamada", ...crits.map((c) => `M${String(c).padStart(2, "0")}`)];
  return (
    <section className="card" aria-labelledby="q-map">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="q-map" className="m-0 mr-auto text-base font-semibold">
          Mapa llamada por llamada
        </h2>
        <div className="seg" role="radiogroup" aria-label="Corrida del mapa">
          {selected.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={x.id === s.id}

              onClick={() => onPick(x.id)}
              title={seriesName(x)}
            >
              <Dot s={x} striped={striped.has(x.id)} />
              {x.id === CURRENT ? mapName(x) : `${x.modelLabel.split(" ")[0]} · v${x.promptVersion}`}
              {striped.has(x.id) ? " · 2" : ""}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => onList(s.id)}>
          Ver como lista
        </Button>
      </div>
      <p className="help tabular mb-2 mt-0" aria-live="polite">
        {cov.withResult === total
          ? `${name}: las ${int(total)} llamadas tienen resultado.`
          : cov.withResult === 0
            ? `${name}: ninguna de las ${int(total)} llamadas tiene resultado (${lacking.join(" · ")}).`
            : `${name}: ${[`${int(cov.withResult)} con resultado`, ...lacking].join(" · ")}, de ${int(total)}. Primero las que tienen resultado.`}
      </p>
      <div className="relative overflow-x-auto overflow-y-hidden pb-1">
        <div
          role="img"
          aria-label={`${seriesName(s)}: ${aiOnly} falsas alarmas y ${missed} no detectadas, en ${int(cov.withResult)} llamadas con resultado de ${int(total)}. Primero las que tienen resultado.${
            pages > 1 ? ` Se muestran ${visible.map((g) => span(g, " a ")).join(" y ")}.` : ""
          }`}
          className="inline-grid gap-x-3"
          style={{ gridTemplateColumns: `auto repeat(${visible.length}, auto)` }}
        >
          <span />
          {visible.map(({ i }) => (
            <span key={i} className="help pb-1 font-semibold">
              {i === 0 ? "Cumple" : "No cumple"} según la planilla ({groups[i].length})
            </span>
          ))}
          <div className="grid gap-[2px] pr-1 text-right text-[10px] leading-[8px] text-muted-foreground">
            {rowLabels.map((l, i) => (
              <span key={l} className={cn("h-2", i === 0 && "mb-1 font-semibold")}>
                {i === 0 || (i - 1) % 4 === 0 ? l : ""}
              </span>
            ))}
          </div>
          {visible.map(({ i: gi, calls }) => (
            <div key={gi} className="flex gap-[2px]">
              {calls.map((call, ci) => (
                <div
                  key={`${call.callId}-${ci}`}
                  className={cn(
                    "grid cursor-pointer gap-[2px] hover:opacity-70",
                    // Corte entre "con resultado", "con error" y "sin correr" dentro del bloque.
                    ci > 0 && resultTier(call, s.id) !== resultTier(calls[ci - 1], s.id) && "ml-1.5",
                  )}
                  title={`Llamada ${call.callId}${TIER_TITLE[resultTier(call, s.id)]}`}
                  onClick={() => router.push(`/calls/${call.caseId}?serie=${encodeURIComponent(s.id)}&llamada=${encodeURIComponent(call.callId)}`)}
                >
                  {(["verdict", ...crits] as const).map((crit, i) => (
                    <span key={i} className={cn("block h-2 w-2 rounded-[1px]", CELL[state(call, crit)], i === 0 && "mb-1")} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="help tabular mr-auto" aria-live="polite">
            {visible.map((g) => span(g, "–")).join(" · ")}
          </span>
          <Button ref={prevRef} size="sm" disabled={current === 0} onClick={() => go(current - 1)}>
            Anterior
          </Button>
          <span className="tabular">
            {current + 1} de {pages}
          </span>
          <Button ref={nextRef} size="sm" disabled={current >= pages - 1} onClick={() => go(current + 1)}>
            Siguiente
          </Button>
        </div>
      )}
      <ul className="help m-0 mt-3 flex list-none flex-wrap gap-4 p-0">
        {(
          [
            ["match", "Coincide con la planilla"],
            ["ai_only", "Falsa alarma"],
            ["missed", "No detectado"],
            ["unknown", "Sin referencia (sin marca por motivo o sin resultado)"],
            ["error", "Error de la IA (fila de veredicto)"],
          ] as const
        ).map(([k, label]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("inline-block h-3 w-3 rounded-[2px]", CELL[k])} />
            {label}
          </li>
        ))}
        <li>Primera fila: veredicto de la llamada. Clic en una columna abre la llamada.</li>
      </ul>
    </section>
  );
}

// --- Llamadas en desacuerdo --------------------------------------------------------------------------------------

function Disagreements({
  data,
  selected,
  listId,
  reason,
  kind,
  page,
  critName,
  headingRef,
  onChange,
}: {
  data: AiQuality;
  selected: QualitySeries[];
  listId: string;
  reason: number | null;
  kind: Kind;
  page: number;
  critName: Map<number, AiQuality["criteria"][number]>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onChange: (c: Record<string, string | null>) => void;
}) {
  const s = selected.find((x) => x.id === listId) ?? selected[0];
  const all = data.calls
    .map((c) => callDiff(c, s.id))
    .filter((d): d is NonNullable<typeof d> => !!d && (d.verdictDiffers || d.aiOnly.length > 0 || d.missed.length > 0));
  const rows = all
    .filter((d) => {
      const pool = kind === "ai_only" ? d.aiOnly : kind === "missed" ? d.missed : [...d.aiOnly, ...d.missed];
      if (reason) return pool.includes(reason);
      if (kind === "ai_only") return d.aiOnly.length > 0 || (d.verdictDiffers && rejects(d.aiVerdict));
      if (kind === "missed") return d.missed.length > 0 || (d.verdictDiffers && !rejects(d.aiVerdict));
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.verdictDiffers) - Number(a.verdictDiffers) ||
        a.call.callId.localeCompare(b.call.callId, undefined, {
          numeric: true,
        }),
    );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const filtered = reason != null || kind !== "all";
  const used = [...new Set(all.flatMap((d) => [...d.aiOnly, ...d.missed]))].sort((a, b) => a - b);
  return (
    <section className="card" aria-labelledby="q-list">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="q-list" ref={headingRef} tabIndex={-1} className="m-0 mr-auto text-base font-semibold outline-none">
          Llamadas en desacuerdo
        </h2>
        <label className="flex items-center gap-1.5 text-sm">
          Corrida
          <select className="control" value={s.id} onChange={(e) => onChange({ list: e.target.value, page: null })}>
            {selected.map((x) => (
              <option key={x.id} value={x.id}>
                {seriesName(x)}
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="radiogroup" aria-label="Tipo de desacuerdo">
          {(
            [
              ["all", "Todas"],
              ["ai_only", "Falsas alarmas"],
              ["missed", "No detectados"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}

              onClick={() => onChange({ kind: k === "all" ? null : k, page: null })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          Motivo
          <select className="control" value={reason ?? ""} onChange={(e) => onChange({ reason: e.target.value || null, page: null })}>
            <option value="">Todos</option>
            {used.map((id) => (
              <option key={id} value={id}>
                {id}. {critName.get(id)?.name}
              </option>
            ))}
          </select>
        </label>
        <span className="help tabular">{plural(rows.length, "llamada", "llamadas")}</span>
      </div>
      {all.length === 0 ? (
        <p className="help m-0">{seriesName(s)} coincide con la planilla en todas las llamadas.</p>
      ) : rows.length === 0 ? (
        <p className="help m-0">
          Ninguna llamada en desacuerdo con estos filtros.{" "}
          <Button size="sm" variant="ghost" onClick={() => onChange({ reason: null, kind: null, page: null })}>
            Quitar filtros
          </Button>
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className="tbl flat text-sm">
              <thead>
                <tr>
                  <th>Llamada</th>
                  <th>Fecha</th>
                  <th>Planilla</th>
                  <th>IA</th>
                  <th>Falsas alarmas</th>
                  <th>No detectados</th>
                  <th>
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(current * PAGE, current * PAGE + PAGE).map((d, i) => (
                  <tr key={`${d.call.callId}-${i}`}>
                    <td className="tabular">{d.call.callId}</td>
                    <td className="tabular">{shortDate(d.call.callDate)}</td>
                    <td>
                      <CallVerdictBadge verdict={d.call.clientVerdict} />
                    </td>
                    <td>
                      <CallVerdictBadge verdict={d.aiVerdict as AiQuality["calls"][number]["clientVerdict"]} />
                    </td>
                    <td className="tabular">{list(d.aiOnly)}</td>
                    <td className="tabular">
                      {d.call.clientFails == null && d.call.clientVerdict === "non_compliant" ? <span className="help">sin marca</span> : list(d.missed)}
                    </td>
                    <td className="text-right">
                      <Link
                        className="btn btn-sm"
                        href={`/calls/${d.call.caseId}?serie=${encodeURIComponent(s.id)}&llamada=${encodeURIComponent(d.call.callId)}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager label="Llamadas" page={current + 1} size={PAGE} total={rows.length} onChange={(p) => onChange({ page: String(p - 1) })} />
        </>
      )}
      {filtered && rows.length > 0 && (
        <p className="help mb-0 mt-2">
          Filtrado por {reason ? `motivo ${reason}` : "tipo"}
          {kind !== "all" ? ` · ${kind === "ai_only" ? "Falsas alarmas" : "No detectados"}` : ""} ·{" "}
          <button type="button" className="underline" onClick={() => onChange({ reason: null, kind: null, page: null })}>
            Quitar filtros
          </button>
        </p>
      )}
    </section>
  );
}
