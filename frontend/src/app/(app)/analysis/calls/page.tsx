"use client";

import Link from "next/link";
import { CallList } from "@/components/analysis/call-list";
import { analysisHome, SourceChip, useAnalysisParams, useIsQubico, withFilters } from "@/components/analysis/parts";
import type { AnalysisSource } from "@/lib/api/analysis-types";
import { useRubric } from "@/lib/rubric";

const SOURCE_TEXT: Record<AnalysisSource, string> = {
  ai: "No cumple según la IA",
  sheet: "No cumple según el auditor",
  mismatch: "La IA y el auditor no coinciden",
};

export default function AnalysisCallsPage() {
  const p = useAnalysisParams();
  const rubric = useRubric();
  const source = (["ai", "sheet", "mismatch"].includes(p.params.get("source") ?? "") ? p.params.get("source") : "ai") as AnalysisSource;
  const agent = p.params.get("agent") ?? undefined;
  const evaluator = p.params.get("evaluator") ?? undefined;
  const f = { type: p.type, flow: p.flow };
  const qubico = useIsQubico();
  // D-41: el supervisor no tiene Criterios; vuelve a la ficha del ejecutivo o a la entrada de la sección.
  const backHref = agent
    ? withFilters(`/analysis/agents/${encodeURIComponent(agent)}`, f)
    : evaluator
      ? withFilters(`/analysis/evaluators/${encodeURIComponent(evaluator)}`, f)
      : withFilters(p.criterion && qubico ? `/analysis/criteria/${p.criterion}` : analysisHome(qubico), f);
  const parts = [
    p.criterion ? `Criterio ${p.criterion}${rubric?.criteria[p.criterion] ? ` · ${rubric.criteria[p.criterion].name}` : ""}` : null,
    p.criterion ? SOURCE_TEXT[source] : null,
    p.type || null,
    p.flow || null,
    evaluator ? `Auditor ${evaluator}` : null,
  ].filter(Boolean);

  return (
    <>
      <p className="mb-2 mt-0 text-[13px]">
        <Link href={backHref}>← Volver</Link>
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-lg font-semibold">Llamadas{parts.length ? ` · ${parts.join(" · ")}` : ""}</h2>
        {p.criterion != null && <SourceChip source={source} />}
      </div>
      <CallList
        query={{ type: p.type, flow: p.flow, criterion: p.criterion, source: p.criterion ? source : undefined, agent, evaluator, page: p.page }}
        onPage={(n) => p.set({ page: n })}
      />
    </>
  );
}
