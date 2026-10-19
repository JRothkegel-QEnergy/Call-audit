"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/dialogs/export-dialog";
import { SourceBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { KpiCard, PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { int, pct, shortDate } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

export default function DashboardPage() {
  const router = useRouter();
  const rubric = useRubric();
  const state = useAsync(async () => {
    const [kpis, alerts] = await Promise.all([api.getKpis(), api.listAlerts("new")]);
    return { kpis, newAlerts: alerts.length };
  }, []);

  return (
    <>
      <PageHeader title="Inicio" description="Operación · últimos 7 días" actions={<ExportButton />} />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="control" aria-label="Periodo">
          <option>Últimos 7 días</option>
          <option>Últimos 30 días</option>
        </select>
        <select className="control" aria-label="Seguro">
          <option>Seguro: todos</option>
        </select>
        <select className="control" aria-label="Equipo">
          <option>Equipo: todos</option>
        </select>
        <select className="control" aria-label="Versión de la pauta">
          <option>Pauta v{rubric?.version ?? "…"}</option>
        </select>
      </div>
      <AsyncView state={state} what="el panel">
        {({ kpis: k, newAlerts }) => (
          <>
            {newAlerts > 0 && (
              <div className="banner mb-3" style={{ borderLeftColor: "var(--red-700)" }}>
                <Bell size={14} aria-hidden />
                <span>
                  <b>{newAlerts === 1 ? "1 alerta nueva espera" : `${newAlerts} alertas nuevas esperan`}</b> gestión.
                </span>
                <Button variant="ghost" className="ml-auto" onClick={() => router.push("/alerts")}>
                  Ver alertas
                </Button>
              </div>
            )}
            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              <KpiCard badge={<SourceBadge source="ai" />} value={int(k.processed)} label="Llamadas procesadas · 100 % de cobertura" />
              <KpiCard
                badge={<SourceBadge source="ai" />}
                value={pct(k.engineCompliantPct, 0)}
                label={`Decisión del motor: Cumple · No cumple ${pct(k.engineNonCompliantPct, 0)} · Dudosa ${pct(k.engineUncertainPct, 0)}`}
              />
              <KpiCard badge={<SourceBadge source="human" />} value={pct(k.finalCompliancePct)} label="Cumplimiento final, después de la revisión humana" />
              <KpiCard
                badge={<SourceBadge source="queue" />}
                value={k.pendingCases}
                label={`Casos pendientes · el más antiguo espera ${k.oldestPendingHours} h`}
                onClick={() => router.push("/queue")}
              />
              <KpiCard
                badge={<SourceBadge source="human" />}
                value={k.criticalConfirmed}
                label={`Críticos confirmados · ${k.criticalUnhandled} sin gestionar`}
                onClick={() => router.push("/alerts")}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="card">
                <div className="flex items-center gap-2">
                  <b>Cumplimiento final por día</b>
                  <SourceBadge source="human" />
                </div>
                <div className="flex h-[140px] items-end gap-2 border-b border-border pt-3" role="img" aria-label={`Cumplimiento final por día: ${k.dailyCompliance.map((d) => `${shortDate(d.date)} ${pct(d.pct, 0)}`).join(", ")}`}>
                  {k.dailyCompliance.map((d) => (
                    <div key={d.date} className="relative flex-1 rounded-t-[3px] bg-primary" style={{ height: `${d.pct}%` }}>
                      <span className="absolute -top-[18px] left-0 right-0 text-center text-[11px] text-muted-foreground">{pct(d.pct, 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="help mt-1 flex justify-between">
                  {k.dailyCompliance.map((d) => (
                    <span key={d.date}>{shortDate(d.date)}</span>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="flex items-center gap-2">
                  <b>Motivos más incumplidos</b>
                  <SourceBadge source="human" />
                </div>
                <ol className="my-3 pl-[18px]">
                  {k.topCriteria.map((c) => (
                    <li key={c.criterionId}>
                      Motivo {c.criterionId} · {rubric?.criteria[c.criterionId]?.name ?? ""} · <b>{pct(c.pct)}</b>
                    </li>
                  ))}
                </ol>
                <Button variant="ghost" onClick={() => router.push("/dashboard/criteria")}>
                  Ver todos los motivos
                </Button>
              </div>
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}
