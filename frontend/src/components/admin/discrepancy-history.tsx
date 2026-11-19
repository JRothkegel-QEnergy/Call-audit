"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badges";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { ANALYSIS_STATUS, usd } from "@/lib/discrepancy-labels";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/** Pestaña Historial (Cambio 16); separada de la página en el Cambio 20, sin cambios de contenido. */
export function HistoryTab() {
  const runs = useAsync(() => api.listDiscrepancyAnalyses(), []);
  const router = useRouter();
  return (
    <AsyncView state={runs} what="el historial de análisis">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState title="Todavía no hay análisis con IA." />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Quién</th>
                <th scope="col">Corrida de capa 2</th>
                <th scope="col">Modelo</th>
                <th scope="col">Prompt de análisis</th>
                <th scope="col">Criterios</th>
                <th scope="col">Patrones</th>
                <th scope="col">Costo real</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular">{r.createdAt ? shortDateTime(r.createdAt) : "—"}</td>
                  <td>{r.createdBy ?? "—"}</td>
                  <td>{r.layer2Series ? `${r.layer2Series.model} · v${r.layer2Series.promptVersion}` : "—"}</td>
                  <td>{r.model}</td>
                  <td className="tabular">v{r.analysisPromptVersion}</td>
                  <td className="num">
                    {r.doneCriteria.length} de {r.criteria.length}
                  </td>
                  <td className="num">{r.patterns ?? "—"}</td>
                  <td className="num">{usd(r.costUsd)}</td>
                  <td>
                    <StatusBadge tone={r.status === "failed" ? "fail" : r.status === "done" ? "teal" : "neutral"} title={r.error ?? undefined}>
                      {ANALYSIS_STATUS[r.status]}
                    </StatusBadge>
                  </td>
                  <td>
                    {r.doneCriteria.length > 0 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/admin/discrepancies?analysis=${r.id}`)}>
                        Abrir <ChevronRight size={14} aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </AsyncView>
  );
}
