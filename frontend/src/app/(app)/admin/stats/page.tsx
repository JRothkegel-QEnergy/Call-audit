"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { int, pct, shortDate, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Tab = "operation" | "quality" | "cost";
const REF_LABEL = { client: "auditoría del cliente", app_auditors: "auditores de la app" } as const;

const usd = (v: number, d = 2) => `${v.toFixed(d).replace(".", ",")} USD`;
const ms = (v: number) => `${(v / 1000).toFixed(1).replace(".", ",")} s`;

/** Estadísticas del sistema (Cambio 10 §4.3). Sin indicadores por persona. */
export default function AdminStatsPage() {
  const stats = useAsync(() => api.getAdminStats(), []);
  const [tab, setTab] = useState<Tab>("operation");
  return (
    <>
      <AdminHeader
        title="Estadísticas"
        description="Métricas del sistema. No se muestran indicadores por persona."
        actions={<Button onClick={() => toast("Estamos preparando el archivo. Te avisaremos cuando esté listo.")}>Exportar CSV</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="control" aria-label="Periodo">
          <option>Últimos 7 días</option>
          <option>Últimos 30 días</option>
        </select>
        <select className="control" aria-label="Modelo">
          <option>Modelo: todos</option>
        </select>
        <select className="control" aria-label="Versión del prompt">
          <option>Prompt: todas</option>
        </select>
      </div>
      <div className="tabs" role="tablist">
        {(
          [
            ["operation", "Operación"],
            ["quality", "Calidad de la IA"],
            ["cost", "Costo"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
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
                  <KpiCard value={s.operation.humanQueue} label={`En cola de revisión · la más antigua, ${s.operation.oldestQueueHours} h`} />
                  <KpiCard value={s.operation.reviewedPerDay} label="Casos revisados por día (todo el equipo)" />
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="card">
                    <b>Llamadas procesadas por día</b>
                    <div className="flex h-[140px] items-end gap-2 border-b border-border pt-4" role="img" aria-label={s.operation.daily.map((d) => `${shortDate(d.date)}: ${d.calls}`).join(", ")}>
                      {s.operation.daily.map((d) => (
                        <div
                          key={d.date}
                          className="relative flex-1 rounded-t-[3px] bg-primary"
                          style={{ height: `${(d.calls / Math.max(1, ...s.operation.daily.map((x) => x.calls))) * 85}%` }}
                        >
                          <span className="absolute -top-[18px] left-0 right-0 text-center text-[11px] text-muted-foreground">{int(d.calls)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="help mt-1 flex justify-between">
                      {s.operation.daily.map((d) => (
                        <span key={d.date}>{shortDate(d.date)}</span>
                      ))}
                    </div>
                  </div>
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
                              Sin lotes con error.
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

            {tab === "quality" && (
              <>
                <p className="help mb-3 mt-0">Toda métrica indica contra qué referencia se midió y con cuántas llamadas (n). Metas: falsos positivos ≤ 5 % y falsos negativos ≤ 20 %.</p>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Prompt</th>
                      <th>Modelo</th>
                      <th>Referencia</th>
                      <th>n</th>
                      <th>Coincidencia</th>
                      <th>Dudosas</th>
                      <th>Citas no validadas</th>
                      <th>Cumple / No cumple / Dudosa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.aiQuality.map((q) => (
                      <tr key={`${q.promptVersion}-${q.model}-${q.reference}`}>
                        <td className="tabular">v{q.promptVersion}</td>
                        <td>{q.model}</td>
                        <td>{REF_LABEL[q.reference]}</td>
                        <td className="num">{q.n}</td>
                        <td className="num font-semibold">{pct(q.matchRate, 0)}</td>
                        <td className="num">{pct(q.uncertainRate, 0)}</td>
                        <td className="num">{pct(q.unvalidatedQuoteRate)}</td>
                        <td className="num">
                          {q.distribution.compliant} / {q.distribution.non_compliant} / {q.distribution.uncertain} %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.aiQuality.length === 0 && <p className="help">Aún no hay llamadas con veredicto del cliente para medir.</p>}
                <p className="help mt-2">Alerta de drift: si la distribución se mueve más de TBD puntos entre periodos.</p>
              </>
            )}

            {tab === "cost" && (
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
    </>
  );
}
