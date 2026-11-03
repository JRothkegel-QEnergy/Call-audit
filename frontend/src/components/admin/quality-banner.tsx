"use client";

import { api } from "@/lib/api";
import { seriesName } from "@/lib/quality";
import { useAsync } from "@/lib/use-async";

const VERDICT = {
  compliant: "Cumple",
  non_compliant: "No cumple",
  uncertain: "Dudosa",
} as const;

function motives(ids: number[]): string {
  if (ids.length === 0) return "sin motivos incumplidos";
  if (ids.length === 1) return `motivo ${ids[0]}`;
  return `motivos ${ids.slice(0, -1).join(", ")} y ${ids[ids.length - 1]}`;
}

/** Llamada abierta desde «Calidad de la IA» (Cambio 15, D-58): lo que marcó esa corrida. El panel del modelo sigue
 * mostrando la corrida vigente. */
export function QualityBanner({ caseId, seriesId, callId }: { caseId: string; seriesId: string; callId: string | null }) {
  const quality = useAsync(() => api.getAiQuality(), []);
  const q = quality.data;
  if (!q) return null;
  const series = q.series.find((s) => s.id === seriesId);
  const call = q.calls.find((c) => c.caseId === caseId && (!callId || c.callId === callId)) ?? q.calls.find((c) => c.caseId === caseId);
  if (!series || !call) return null;
  const result = call.results[series.id];
  return (
    <div className="banner mt-2" role="note">
      <span>
        Llegaste desde Calidad de la IA · <b>{seriesName(series)}</b>:{" "}
        {result ? (
          <>
            marcó <b>{VERDICT[result.verdict]}</b> ({motives(result.failCriteria)}).
          </>
        ) : (
          "no tiene resultado para esta llamada."
        )}{" "}
        {series.isCurrent ? "El panel del modelo muestra esta corrida." : "El panel del modelo muestra la corrida vigente."}
      </span>
    </div>
  );
}
