"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useNavCounts } from "@/components/shell/nav-counts";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AlertStatus } from "@/lib/api/types";
import { mmss, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

const TABS: [AlertStatus, string][] = [
  ["new", "Nuevas"],
  ["seen", "Vistas"],
  ["handled", "Gestionadas"],
];

export default function AlertsPage() {
  const router = useRouter();
  const rubric = useRubric();
  const { refresh } = useNavCounts();
  const [tab, setTab] = useState<AlertStatus>("new");
  const all = useAsync(() => api.listAlerts(), []);
  const count = (s: AlertStatus) => all.data?.filter((a) => a.status === s).length ?? 0;

  return (
    <>
      <PageHeader title="Alertas" description="Casos escalados por auditores e incumplimientos críticos confirmados." />
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label} <span className="cnt">{count(k)}</span>
          </button>
        ))}
      </div>
      <AsyncView state={all} what="las alertas">
        {(alerts) => {
          const list = alerts.filter((a) => a.status === tab);
          if (!list.length)
            return (
              <EmptyState
                title={tab === "new" ? "No hay alertas nuevas." : tab === "seen" ? "No hay alertas vistas." : "Aún no hay alertas gestionadas."}
                body="Cuando un auditor escale un caso o confirme un crítico, aparecerá aquí."
              />
            );
          return list.map((a) => (
            <div key={a.id} className="card mb-2.5 flex items-start gap-3.5">
              {a.kind === "escalation" ? <StatusBadge tone="doubt">Escalamiento</StatusBadge> : <StatusBadge tone="fail">Crítico confirmado</StatusBadge>}
              <div className="flex-1">
                <b className="tabular">{a.callId}</b> · {a.reason}
                {a.criterionId != null && ` · Motivo ${a.criterionId}${rubric ? ` · ${rubric.criteria[a.criterionId]?.name}` : ""}`}
                {a.atMs != null && ` · ${mmss(a.atMs)}`}
                <div className="help">
                  {a.raisedBy} · {shortDateTime(a.createdAt)}
                </div>
                {a.comment && (
                  <div className="quote" style={{ borderLeftColor: "var(--neutral-500)", background: "var(--neutral-50)" }}>
                    «{a.comment}»
                  </div>
                )}
                {a.handledComment && <div className="help mt-1">Gestión: {a.handledComment}</div>}
              </div>
              <Button
                variant="primary"
                onClick={() => router.push(`/calls/${a.caseId}?from=alerts${a.atMs != null ? `&t=${Math.max(0, a.atMs - 4000)}` : ""}`)}
              >
                Abrir en el minuto
              </Button>
              {a.status !== "handled" ? (
                <Button
                  onClick={async () => {
                    try {
                      await api.handleAlert(a.id);
                      toast("Alerta marcada como gestionada.");
                      void all.reload({ silent: true });
                      refresh();
                    } catch {
                      toast("No pudimos actualizar la alerta. Intenta de nuevo.");
                    }
                  }}
                >
                  Marcar como gestionada
                </Button>
              ) : (
                <StatusBadge tone="ink">Gestionada</StatusBadge>
              )}
            </div>
          ));
        }}
      </AsyncView>
    </>
  );
}
