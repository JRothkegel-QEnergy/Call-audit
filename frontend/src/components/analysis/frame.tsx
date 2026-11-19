"use client";

import { createContext, useContext } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AnalysisSnapshotMeta } from "@/lib/api/analysis-types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { AnalysisTabs, SnapshotBand } from "./parts";

const MetaContext = createContext<AnalysisSnapshotMeta | null>(null);

/** La foto vigente; solo se usa dentro de AnalysisFrame, que no renderiza las pestañas sin ella. */
export function useSnapshotMeta(): AnalysisSnapshotMeta {
  const meta = useContext(MetaContext);
  if (!meta) throw new Error("useSnapshotMeta fuera de AnalysisFrame");
  return meta;
}

/** Encabezado común de la sección: título, banda de la foto y pestañas. S-01 si todavía no hay foto. */
export function AnalysisFrame({ children }: { children: React.ReactNode }) {
  const loaded = useAsync(async () => {
    const status = await api.getAnalysisStatus();
    return { status, meta: status.hasSnapshot ? await api.getAnalysisSnapshot() : null };
  }, []);
  return (
    <>
      <PageHeader title="Calidad del servicio" description="Cómo se cumple la pauta según la IA y según el auditor." />
      {loaded.status === "error" ? (
        <ErrorState what="los datos de calidad del servicio" onRetry={() => void loaded.reload()} />
      ) : !loaded.data ? (
        <LoadingState />
      ) : !loaded.data.meta ? (
        <EmptyState
          title="Todavía no hay datos de calidad del servicio."
          body={`Aparecerán cuando se procese la próxima corrida o planilla.${
            loaded.data.status.lastProcessedAt ? ` Última pasada procesada: ${shortDateTime(loaded.data.status.lastProcessedAt)}.` : ""
          }`}
        />
      ) : (
        <MetaContext.Provider value={loaded.data.meta}>
          <SnapshotBand meta={loaded.data.meta} />
          <AnalysisTabs />
          {children}
        </MetaContext.Provider>
      )}
    </>
  );
}
