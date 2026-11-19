"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSnapshotMeta } from "@/components/analysis/frame";
import { Markdown } from "@/components/analysis/markdown";
import { StatusBadge } from "@/components/ui/badges";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";

export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = useSnapshotMeta();
  const { user } = useSession();
  const qubico = user?.role === "qubico_admin" || user?.role === "qubico_viewer";
  const report = useAsync(() => api.getAnalysisReport(decodeURIComponent(slug)), [slug]);
  const back = (
    <p className="mb-2 mt-0 text-[13px]">
      <Link href="/analysis/reports">← Informes</Link>
    </p>
  );
  if (report.status === "error" && report.error.message === "not_found")
    return (
      <>
        {back}
        <EmptyState title="No encontramos este informe." />
      </>
    );
  return (
    <>
      {back}
      <AsyncView state={report} what="el informe">
        {(r) => (
          <article className="card">
            <h2 className="mb-1 mt-0 text-lg font-semibold">{r.title}</h2>
            <p className="help mb-3 mt-0 flex flex-wrap items-center gap-2">
              {shortDate(r.date)}
              {r.run && ` · corrida ${r.run}`}
              {qubico && <StatusBadge tone={r.audience === "internal" ? "ink" : "neutral"}>{r.audience === "internal" ? "Interno" : "Empresa"}</StatusBadge>}
            </p>
            {r.run && r.run !== meta.runs.perCall && (
              <div className="banner mb-3" role="note">
                Este informe usa la corrida {r.run}; las cifras de la sección son de la {meta.runs.perCall}.
              </div>
            )}
            <Markdown source={r.bodyMd} />
          </article>
        )}
      </AsyncView>
    </>
  );
}
