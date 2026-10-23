"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { PromptStatusBadge } from "@/components/admin/prompt-status";
import { Button } from "@/components/ui/button";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { pct, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const SOURCE = { yaml: "prompt.yaml", text: "Texto", bench: "Bench", repo: "Repo" } as const;

export default function PromptVersionsPage() {
  const router = useRouter();
  const versions = useAsync(() => api.listPromptVersions(), []);
  return (
    <>
      <AdminHeader
        title="Versiones del prompt"
        description="Cada versión es inmutable una vez que entra en prueba. Solo una está vigente."
        actions={
          <Button variant="primary" onClick={() => router.push("/admin/prompts/new")}>
            <Plus size={14} aria-hidden />
            Publicar versión nueva
          </Button>
        }
      />
      <AsyncView state={versions} what="las versiones del prompt">
        {(rows) => (
          <table className="tbl">
            <thead>
              <tr>
                <th>Versión</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Modelo</th>
                <th>Fecha</th>
                <th>Autor</th>
                <th>Cambios</th>
                <th>Coincidencia con el cliente</th>
                <th>Dudosas</th>
                <th>Costo por llamada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const metrics = v.evaluation?.status === "done" ? v.evaluation.metrics : null;
                const client = metrics?.references.find((r) => r.kind === "client");
                const open = () => router.push(`/admin/prompts/${encodeURIComponent(v.version)}`);
                return (
                  <tr key={v.version} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                    <td className="tabular font-semibold">v{v.version}</td>
                    <td>
                      <PromptStatusBadge status={v.status} />
                    </td>
                    <td>{SOURCE[v.source]}</td>
                    <td>{v.model || "—"}</td>
                    <td className="tabular">{v.createdAt ? shortDateTime(v.createdAt) : "—"}</td>
                    <td>{v.createdBy}</td>
                    <td className="max-w-[320px] truncate whitespace-nowrap" title={v.changelog}>
                      {v.changelog.replaceAll("**", "").split("\n")[0] || "—"}
                    </td>
                    <td className="num">{client ? `${pct(client.matchRate, 0)} · n ${client.n}` : "—"}</td>
                    <td className="num">{client ? pct(client.uncertainRate, 0) : "—"}</td>
                    <td className="num">{metrics ? `${metrics.costPerCallUsd.toFixed(4).replace(".", ",")} USD` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AsyncView>
    </>
  );
}
