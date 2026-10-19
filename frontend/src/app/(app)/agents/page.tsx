"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExportButton } from "@/components/dialogs/export-dialog";
import { StatusBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { pct } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

function trend(pts: number) {
  if (pts > 0) return `↗ +${pts} ${pts === 1 ? "pt" : "pts"}`;
  if (pts < 0) return `↘ −${Math.abs(pts)} pts`;
  return "→ estable";
}

export default function AgentsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const stats = useAsync(() => api.listAgentStats(query), [query]);
  return (
    <>
      <PageHeader title="Ejecutivos" description="Solo cuentan los hallazgos confirmados por un auditor." actions={<ExportButton />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="control search w-[220px]"
          placeholder="Buscar ejecutivo"
          aria-label="Buscar ejecutivo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="help">Las búsquedas por ejecutivo quedan registradas.</span>
      </div>
      <AsyncView state={stats} what="los ejecutivos">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title={`No encontramos ejecutivos con «${query}».`} />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th aria-sort="ascending">Ejecutivo ↑</th>
                  <th>Auditadas</th>
                  <th>Cumplimiento final</th>
                  <th>Motivos más incumplidos</th>
                  <th>Tendencia</th>
                  <th>Seguimientos pendientes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = () => {
                    void api.logAgentSearch(r.agent.id);
                    router.push(`/agents/${r.agent.id}`);
                  };
                  return (
                    <tr key={r.agent.id} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                      <td className="font-semibold">{r.agent.name}</td>
                      <td className="num">{r.audited}</td>
                      <td className="num">{pct(r.finalCompliancePct, 0)}</td>
                      <td>{r.topCriteria.join(" · ")}</td>
                      <td>{trend(r.trendPts)}</td>
                      <td className="num">{r.pendingFollowUps ? <StatusBadge tone="teal">{r.pendingFollowUps}</StatusBadge> : "0"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </AsyncView>
    </>
  );
}
