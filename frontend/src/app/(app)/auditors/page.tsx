"use client";

import { StatusBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AuditorStats } from "@/lib/api/types";
import { durationText, pct } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { AuditorsTabs } from "./auditors-tabs";

/**
 * Marca solo el desvío que merece mirarse respecto de la media del equipo (sin rankings, L-22):
 * revisar mucho más rápido que la media, o tener muchos más reabiertos o cambiados.
 */
function flag(value: number, mean: number, direction: "below" | "above") {
  if (mean === 0) return null;
  const ratio = value / mean;
  if (direction === "below" && ratio < 0.7) return <StatusBadge tone="doubt">bajo la media</StatusBadge>;
  if (direction === "above" && ratio > 1.6) return <StatusBadge tone="doubt">sobre la media</StatusBadge>;
  return null;
}

export default function AuditorsPage() {
  const stats = useAsync(() => api.listAuditorStats(), []);
  return (
    <>
      <PageHeader title="Auditores" description="Comparado con la media del equipo." />
      <AuditorsTabs active="performance" />
      <AsyncView state={stats} what="el desempeño de los auditores">
        {(rows: AuditorStats[]) => {
          const mean = (k: keyof AuditorStats) => rows.reduce((a, r) => a + Number(r[k]), 0) / rows.length;
          const mTime = mean("avgReviewSeconds");
          const mReopen = mean("reopenedOrChangedPct");
          return (
            <table className="tbl">
              <thead>
                <tr>
                  <th aria-sort="ascending">Auditor ↑</th>
                  <th>Casos por día</th>
                  <th>Tiempo medio</th>
                  <th>Corrige a la IA</th>
                  <th>Reabiertos o cambiados</th>
                  <th>Escalamientos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.auditorId}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="num">{r.casesPerDay}</td>
                    <td className="num">
                      {durationText(r.avgReviewSeconds)} {flag(r.avgReviewSeconds, mTime, "below")}
                    </td>
                    <td className="num">{pct(r.correctsAiPct, 0)}</td>
                    <td className="num">
                      {pct(r.reopenedOrChangedPct, 0)} {flag(r.reopenedOrChangedPct, mReopen, "above")}
                    </td>
                    <td className="num">{pct(r.escalationsPct, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }}
      </AsyncView>
    </>
  );
}
