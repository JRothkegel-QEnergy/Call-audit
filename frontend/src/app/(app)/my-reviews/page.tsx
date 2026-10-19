"use client";

import { History } from "lucide-react";
import { useRouter } from "next/navigation";
import { CallVerdictBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CaseStatus } from "@/lib/api/types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { caseStatusLabel } from "@/lib/verdicts";

function StatusCell({ status }: { status: CaseStatus }) {
  const label = caseStatusLabel(status, "auditor");
  if (status === "reopened")
    return (
      <StatusBadge tone="fail">
        <History size={14} aria-hidden />
        Reabierto
      </StatusBadge>
    );
  if (status === "escalated") return <StatusBadge tone="doubt">{label}</StatusBadge>;
  if (status === "awaiting_approval") return <StatusBadge tone="teal">{label}</StatusBadge>;
  if (status === "closed") return <StatusBadge tone="ink">{label}</StatusBadge>;
  return <StatusBadge>{label}</StatusBadge>;
}

export default function MyReviewsPage() {
  const router = useRouter();
  const rows = useAsync(() => api.listMyReviews(), []);
  return (
    <>
      <PageHeader
        title="Mis revisiones"
        description="Los casos reabiertos aparecen primero. Puedes editar una revisión mientras el supervisor no la apruebe."
      />
      <AsyncView state={rows} what="tus revisiones">
        {(data) =>
          data.length === 0 ? (
            <EmptyState title="Aún no tienes revisiones." body="Empieza desde la Cola.">
              <Button variant="primary" onClick={() => router.push("/queue")}>
                Ir a la Cola
              </Button>
            </EmptyState>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Llamada</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Tu decisión</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const editable = r.status === "awaiting_approval" || r.status === "reopened";
                  const open = () => router.push(`/calls/${r.caseId}?from=my-reviews`);
                  return (
                    <tr key={r.caseId} className="clickable" onClick={open} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open()}>
                      <td className="tabular font-semibold">{r.callId}</td>
                      <td className="tabular">{shortDateTime(r.submittedAt)}</td>
                      <td>
                        <StatusCell status={r.status} />
                      </td>
                      <td>{r.myVerdict ? <CallVerdictBadge verdict={r.myVerdict} /> : "—"}</td>
                      <td className="whitespace-normal">
                        {editable && !r.note ? (
                          <Button variant="ghost" onClick={open}>
                            Editar revisión
                          </Button>
                        ) : (
                          r.note || "—"
                        )}
                      </td>
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
