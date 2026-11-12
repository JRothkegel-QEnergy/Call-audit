"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AiQualityView } from "@/components/admin/ai-quality";
import { ProcessedChart } from "@/components/admin/processed-chart";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/page-header";
import { AsyncView, EmptyState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AdminStats, StatsPeriod } from "@/lib/api/admin-types";
import { int, shortDate, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Tab = "operation" | "quality" | "cost";

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
];
const TABS = [
  ["operation", "Operación"],
  ["quality", "Calidad de la IA"],
  ["cost", "Costo"],
] as const;

const usd = (v: number, d = 2) => `${v.toFixed(d).replace(".", ",")} USD`;
const ms = (v: number) => `${(v / 1000).toFixed(1).replace(".", ",")} s`;

/** Estadísticas del sistema (Cambio 10 §4.3). Sin indicadores por persona. La pestaña y los filtros van en la URL
 * (?tab=cost&period=30d&model=…&prompt=…) para volver al mismo lugar desde una llamada (Cambio 15, H-96). */
export default function AdminStatsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StatsScreen />
    </Suspense>
  );
}

function QualityTab() {
  const quality = useAsync(() => api.getAiQuality(), []);
  return (
    <AsyncView state={quality} what="la calidad de la IA">
      {(q) => <AiQualityView data={q} />}
    </AsyncView>
  );
}

function rangeText(stats: AdminStats | undefined, period: StatsPeriod | undefined): string {
  const range = stats?.filters.range;
  if (!range) return "";
  return `${shortDate(range.from)} – ${shortDate(range.to)}${period ? "" : " · primera y última corrida"}`;
}

function resultAnnouncement(stats: AdminStats, tab: Tab, range: string): string {
  const result = tab === "cost" ? `${int(stats.cost.length)} combinaciones de modelo y prompt` : `${int(stats.operation.callsProcessed)} llamadas procesadas`;
  return range ? `${result}, ${range}` : result;
}

function LastRun({ at }: { at: string | null }) {
  return at ? <> Última corrida: {shortDate(at)}.</> : null;
}

function StatsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = (["quality", "cost"] as const).find((t) => t === params.get("tab")) ?? "operation";
  const period = PERIODS.find((p) => p.value === params.get("period"))?.value;
  const model = params.get("model") ?? undefined;
  const prompt = params.get("prompt") ?? undefined;
  const hasFilters = Boolean(period || model || prompt);
  const narrowsRuns = Boolean(model || prompt);
  const periodSelect = useRef<HTMLSelectElement>(null);

  const stats = useAsync(() => api.getAdminStats({ period, model, prompt }), [period, model, prompt]);
  const data = stats.data;
  const updating = stats.status === "loading";

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Un valor inválido en la URL se quita y queda el valor por defecto.
  const rawPeriod = params.get("period");
  const badPeriod = Boolean(rawPeriod && !period);
  const badModel = Boolean(data && model && !data.filters.models.some((m) => m.id === model));
  const badPrompt = Boolean(data && prompt && !data.filters.promptVersions.includes(prompt));
  useEffect(() => {
    if (!badPeriod && !badModel && !badPrompt) return;
    updateParams({
      ...(badPeriod && { period: undefined }),
      ...(badModel && { model: undefined }),
      ...(badPrompt && { prompt: undefined }),
    });
  }, [badPeriod, badModel, badPrompt, updateParams]);

  const clearFilters = () => {
    updateParams({ period: undefined, model: undefined, prompt: undefined });
    periodSelect.current?.focus();
  };

  // Mientras llegan las opciones, el valor de la URL sigue visible en su select deshabilitado.
  const modelOptions = data?.filters.models ?? (model ? [{ id: model, label: model }] : []);
  const promptOptions = data?.filters.promptVersions ?? (prompt ? [prompt] : []);
  const range = rangeText(data, period);

  const chartEmpty = (s: AdminStats) => {
    if (s.filters.models.length === 0) return "Aún no hay corridas registradas.";
    return (
      <>
        {narrowsRuns ? "Sin llamadas procesadas con estos filtros." : "Sin llamadas procesadas en este periodo."}
        <LastRun at={s.filters.lastRunAt} />
      </>
    );
  };

  return (
    <>
      <AdminHeader
        title="Estadísticas"
        description="Métricas del sistema. No se muestran indicadores por persona."
        actions={<Button onClick={() => toast("Estamos preparando el archivo. Te avisaremos cuando esté listo.")}>Exportar CSV</Button>}
      />
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} id={`stats-tab-${k}`} type="button" role="tab" className="tab" aria-selected={tab === k} aria-controls="stats-panel" onClick={() => updateParams({ tab: k === "operation" ? undefined : k })}>
            {label}
          </button>
        ))}
      </div>
      <div id="stats-panel" role="tabpanel" aria-labelledby={`stats-tab-${tab}`}>
        {tab === "quality" && <QualityTab />}
        {tab !== "quality" && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select ref={periodSelect} className="control" aria-label="Periodo" value={period ?? ""} onChange={(e) => updateParams({ period: e.target.value || undefined })}>
                <option value="">Todo el historial</option>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select className="control" aria-label="Modelo" value={model ?? ""} disabled={!data} onChange={(e) => updateParams({ model: e.target.value || undefined })}>
                <option value="">Modelo: todos</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    Modelo: {m.label}
                  </option>
                ))}
              </select>
              <select className="control" aria-label="Versión del prompt" value={prompt ?? ""} disabled={!data} onChange={(e) => updateParams({ prompt: e.target.value || undefined })}>
                <option value="">Prompt: todas</option>
                {promptOptions.map((v) => (
                  <option key={v} value={v}>
                    Prompt: v{v}
                  </option>
                ))}
              </select>
              {hasFilters && <Button onClick={clearFilters}>Quitar filtros</Button>}
              <span className="help">{updating ? "Actualizando…" : range}</span>
              <span className="sr-only" aria-live="polite">
                {updating ? "Actualizando…" : stats.status === "success" && data ? resultAnnouncement(data, tab, range) : ""}
              </span>
            </div>
            <div aria-busy={updating} className={updating && data ? "opacity-60" : undefined}>
              <AsyncView state={stats} what="las estadísticas">
                {(s) => (
                  <>
                    {tab === "operation" && (
                      <>
                        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                          <KpiCard value={int(s.operation.callsProcessed)} label={`Llamadas procesadas · ${int(s.operation.minutesProcessed)} min`} />
                          <KpiCard
                            value={s.operation.medianHoursToResult == null ? "—" : `${String(s.operation.medianHoursToResult).replace(".", ",")} h`}
                            label="Mediana hasta el resultado · meta < 24 h"
                            hint={s.operation.medianHoursToResult == null ? "Se mide cuando el pipeline registre la llegada de cada lote." : undefined}
                          />
                          <KpiCard value={s.operation.batchesWithError} label="Lotes con error" />
                          <KpiCard value={s.operation.humanQueue} label={`En cola de revisión · la más antigua, ${s.operation.oldestQueueHours} h`} hint="Ahora. No cambia con los filtros." />
                          <KpiCard value={s.operation.reviewedPerDay} label="Casos revisados por día (todo el equipo)" hint="Usa el periodo. No depende de modelo ni prompt." />
                        </div>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <ProcessedChart points={s.operation.daily} bucket={s.operation.dailyBucket} range={rangeText(s, period)} filtered={narrowsRuns} emptyMessage={chartEmpty(s)} />
                          <div className="card">
                            <b>Lotes con error</b>
                            <table className="tbl flat mt-2.5">
                              <thead>
                                <tr>
                                  <th>Lote</th>
                                  <th>Fecha</th>
                                  <th>Etapa</th>
                                  <th>Llamadas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.operation.failedBatches.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="help">
                                      {hasFilters ? "Sin lotes con error con estos filtros." : "Sin lotes con error."}
                                    </td>
                                  </tr>
                                )}
                                {s.operation.failedBatches.map((b) => (
                                  <tr key={b.batchId}>
                                    <td className="tabular">{b.batchId}</td>
                                    <td className="tabular">{b.at ? shortDateTime(b.at) : "—"}</td>
                                    <td>{b.stage}</td>
                                    <td className="num">{b.calls}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                    {tab === "cost" && s.cost.length === 0 && (
                      <EmptyState
                        title={s.filters.models.length === 0 ? "Aún no hay corridas registradas." : "Sin corridas con estos filtros."}
                        body={s.filters.lastRunAt ? `Última corrida: ${shortDate(s.filters.lastRunAt)}.` : undefined}
                      />
                    )}

                    {tab === "cost" && s.cost.length > 0 && (
                      <>
                        <p className="help mb-3 mt-0">Costos registrados por cada corrida del modelo; no se calculan con precios escritos en la app.</p>
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>Modelo</th>
                              <th>Prompt</th>
                              <th>Llamadas</th>
                              <th>Costo total</th>
                              <th>Por llamada</th>
                              <th>Tokens entrada / salida</th>
                              <th>Latencia media</th>
                              <th>Latencia p95</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.cost.map((c) => (
                              <tr key={`${c.model}-${c.promptVersion}`}>
                                <td>{c.model}</td>
                                <td className="tabular">v{c.promptVersion}</td>
                                <td className="num">{int(c.calls)}</td>
                                <td className="num">{usd(c.totalUsd)}</td>
                                <td className="num">{usd(c.perCallUsd, 4)}</td>
                                <td className="num">{c.tokensIn == null ? "—" : `${int(c.tokensIn)} / ${int(c.tokensOut ?? 0)}`}</td>
                                <td className="num">{ms(c.latencyMsAvg)}</td>
                                <td className="num">{ms(c.latencyMsP95)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </AsyncView>
            </div>
          </>
        )}
      </div>
    </>
  );
}
