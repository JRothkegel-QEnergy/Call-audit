"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { EvaluatorsTab } from "@/components/admin/discrepancy-evaluators";
import { FollowUpTab } from "@/components/admin/discrepancy-follow-up";
import { HistoryTab } from "@/components/admin/discrepancy-history";
import { PatternsTab } from "@/components/admin/discrepancy-patterns";
import { SummaryTab } from "@/components/admin/discrepancy-summary";
import { AsyncView, EmptyState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { DiscrepancyOverview, DiscrepancyPattern } from "@/lib/api/admin-types";
import { type DiscrepancyTab, hasPatternFilters, resolveTab, type SetParams } from "@/lib/discrepancy-url";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/** Análisis de discrepancias del admin Qubico (Cambios 16, 19 y 20). El estado vive en la URL; cómo se lee, en
 * lib/discrepancy-url.ts. Cinco pestañas: Resumen, Patrones, Evaluadores, Seguimiento e Historial (D-92). */
export default function DiscrepancyAnalysisPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DiscrepancyAnalysis />
    </Suspense>
  );
}

function DiscrepancyAnalysis() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setParams: SetParams = (changes) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const analysisId = params.get("analysis") ?? undefined;
  // Otro análisis parte de cero: sus decisiones locales no aplican.
  return (
    <>
      <AdminHeader
        title="Análisis de discrepancias"
        description="Por qué la IA y la planilla no coinciden. Son hallazgos para revisar: nada cambia el prompt hasta que una persona sube una versión nueva."
      />
      <Workspace key={analysisId ?? "latest"} analysisId={analysisId} params={params} setParams={setParams} />
    </>
  );
}

const TABS: [DiscrepancyTab, string][] = [
  ["summary", "Resumen"],
  ["patterns", "Patrones"],
  ["evaluators", "Evaluadores"],
  ["followup", "Seguimiento"],
  ["history", "Historial"],
];

function Workspace({ analysisId, params, setParams }: { analysisId: string | undefined; params: URLSearchParams; setParams: SetParams }) {
  const tab = resolveTab(params);
  // Vive acá y no en cada pestaña: al cambiar de pestaña no se recarga ni se pierden las decisiones locales (§13.3).
  const overview = useAsync(() => api.getDiscrepancyOverview(analysisId), [analysisId]);
  const followUp = useAsync(() => api.getDiscrepancyFollowUp(), []);
  const [decided, setDecided] = useState<Record<string, DiscrepancyPattern>>({});
  const focusRequest = useRef<string | null>(null);
  const summaryOutdated = useRef(false);
  const { reload } = overview;
  const running = !!overview.data?.running;

  // Mientras corre, el avance se actualiza solo (D-48).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void reload({ silent: true }), 5000);
    return () => clearInterval(id);
  }, [running, reload]);

  // Las cifras de Resumen vienen del backend: tras decidir, se piden de nuevo al volver a esa pestaña.
  useEffect(() => {
    if (tab === "summary" && summaryOutdated.current) {
      summaryOutdated.current = false;
      void reload({ silent: true });
    }
  }, [tab, reload]);

  const patterns = (overview.data?.patterns ?? []).map((p) => decided[p.id] ?? p);
  const pendingPatterns = patterns.filter((p) => !p.isObservation && p.status === "pending").length;
  // Contador de Seguimiento (H-115): aceptadas que todavía esperan algo (versión, pregunta o calibración).
  const pendingFollowUp = (followUp.data ?? []).filter((p) => p.status === "accepted").length;

  const counts: Partial<Record<DiscrepancyTab, number>> = { patterns: pendingPatterns, followup: pendingFollowUp };
  const openTab = (k: DiscrepancyTab) => {
    // Sin `tab`, un filtro en la URL llevaría a Patrones: Resumen se pide explícitamente si quedó alguno.
    const value = k === "summary" ? (hasPatternFilters(params) ? "summary" : null) : k;
    setParams({ tab: value, ...(k === "followup" || k === "history" ? { analysis: null } : {}) });
  };

  const onDecided = (p: DiscrepancyPattern) => {
    summaryOutdated.current = true;
    setDecided((d) => ({ ...d, [p.id]: p }));
    void followUp.reload({ silent: true });
  };
  const onFollowUpChange = async () => {
    void followUp.reload({ silent: true });
    await reload({ silent: true });
    setDecided({});
  };

  const renderAnalysis = (data: DiscrepancyOverview) => {
    if (data.calls === 0) return <EmptyState title="Aún no hay llamadas con corrida vigente y marca por motivo en la planilla para comparar." />;
    if (data.cases === 0) return <EmptyState title="La corrida vigente coincide con la planilla en todos los motivos. No hay nada que analizar." />;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {data.readOnly && data.analysis && (
          <div className="banner" role="note">
            <span>
              Estás viendo el análisis del {data.analysis.createdAt ? shortDateTime(data.analysis.createdAt) : "—"}.{" "}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({ analysis: null })}>
                Ver el último
              </button>
            </span>
          </div>
        )}
        {tab === "summary" && (
          <SummaryTab
            data={data}
            params={params}
            setParams={setParams}
            reload={() => void reload({ silent: true })}
            onOpenPatterns={() => {
              focusRequest.current = "title";
            }}
          />
        )}
        {tab === "patterns" && (
          <PatternsTab
            data={data}
            patterns={patterns}
            params={params}
            setParams={setParams}
            onDecided={onDecided}
            requestFocus={(target) => {
              focusRequest.current = target;
            }}
            takeFocusRequest={() => {
              const target = focusRequest.current;
              focusRequest.current = null;
              return target;
            }}
          />
        )}
        {tab === "evaluators" && <EvaluatorsTab data={data} params={params} setParams={setParams} />}
      </div>
    );
  };

  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => openTab(k)}>
            {label}
            {counts[k] ? <span className="cnt">{counts[k]}</span> : null}
          </button>
        ))}
      </div>
      {tab === "followup" ? (
        <AsyncView state={followUp} what="el seguimiento">
          {(rows) => <FollowUpTab rows={rows} onChange={() => void onFollowUpChange()} />}
        </AsyncView>
      ) : tab === "history" ? (
        <HistoryTab />
      ) : (
        <AsyncView state={overview} what="el análisis de discrepancias">
          {renderAnalysis}
        </AsyncView>
      )}
    </>
  );
}
