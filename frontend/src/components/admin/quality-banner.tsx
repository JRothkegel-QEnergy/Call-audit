"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";

const VERDICT = {
  compliant: "Cumple",
  non_compliant: "No cumple",
  uncertain: "Dudosa",
} as const;

/** Llamada abierta desde un patrón del «Análisis de discrepancias» (Cambio 16, D-65): qué marcó cada uno en el criterio. */
export function AnalysisBanner({ caseId, patternId }: { caseId: string; patternId: string }) {
  const pattern = useAsync(() => api.getDiscrepancyPattern(patternId), [patternId]);
  const p = pattern.data;
  if (!p) return null;
  const c = p.cases.find((x) => x.caseId === caseId);
  const manual = c?.manualVerdict && c.manualVerdict in VERDICT ? VERDICT[c.manualVerdict as keyof typeof VERDICT] : "sin revisión";
  return (
    <div className="banner mt-2" role="note">
      <span>
        Llegaste desde Análisis de discrepancias · <b>Criterio {p.criterionId}</b>
        {c && (
          <>
            : IA {VERDICT[c.aiVerdict as keyof typeof VERDICT] ?? c.aiVerdict} · Planilla {c.clientFail ? "No cumple" : "Cumple"} · Revisión manual:{" "}
            {manual}
          </>
        )}
        . Patrón: «{p.title}»
      </span>
    </div>
  );
}
