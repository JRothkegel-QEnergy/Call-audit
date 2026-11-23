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

export default function PromptVersionsPage() {
  const router = useRouter();
  const versions = useAsync(async () => {
    const list = await api.listPromptVersions();
    // Métricas de cada versión probada (en el backend vendrían en la misma respuesta).
    const details = await Promise.all(list.map((v) => api.getPromptVersion(v.version)));
    return details;
  }, []);
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
              {rows.map(({ meta, evaluation }) => {
                const client = evaluation?.status === "done" ? evaluation.references.find((r) => r.kind === "client") : undefined;
                const open = () => router.push(`/admin/prompts/${meta.version}`);
                return (
                  <tr key={meta.version} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                    <td className="tabular font-semibold">v{meta.version}</td>
                    <td>
                      <PromptStatusBadge status={meta.status} />
                    </td>
                    <td>{meta.model}</td>
                    <td className="tabular">{shortDateTime(meta.createdAt)}</td>
                    <td>{meta.createdBy}</td>
                    <td className="max-w-[320px] truncate whitespace-nowrap" title={meta.changelog}>
                      {meta.changelog.split("\n")[0]}
                    </td>
                    <td className="num">{client ? `${pct(client.matchRate, 0)} · n ${client.n}` : "—"}</td>
                    <td className="num">{client ? pct(client.uncertainRate, 0) : "—"}</td>
                    <td className="num">{evaluation?.status === "done" ? `${evaluation.costPerCallUsd.toFixed(4).replace(".", ",")} USD` : "—"}</td>
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
