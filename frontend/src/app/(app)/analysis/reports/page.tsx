"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/badges";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";

export default function ReportsPage() {
  const { user } = useSession();
  const qubico = user?.role === "qubico_admin" || user?.role === "qubico_viewer";
  const reports = useAsync(() => api.listAnalysisReports(), []);
  return (
    <AsyncView state={reports} what="los informes">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState title="Todavía no hay informes publicados." />
        ) : (
          <table className="tbl">
            <caption className="sr-only">Informes publicados, del más nuevo al más antiguo</caption>
            <thead>
              <tr>
                <th scope="col">Informe</th>
                <th scope="col">Fecha</th>
                <th scope="col">Corrida</th>
                {qubico && <th scope="col">Audiencia</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <th scope="row">
                    <Link href={`/analysis/reports/${encodeURIComponent(r.slug)}`} className="font-semibold">
                      {r.title}
                    </Link>
                  </th>
                  <td className="tabular">{shortDate(r.date)}</td>
                  <td>{r.run || "—"}</td>
                  {qubico && (
                    <td>
                      <StatusBadge tone={r.audience === "internal" ? "ink" : "neutral"}>
                        {r.audience === "internal" ? "Interno" : "Empresa"}
                      </StatusBadge>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </AsyncView>
  );
}
