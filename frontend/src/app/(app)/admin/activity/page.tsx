"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { ROLE_LABEL } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { ActivityAction } from "@/lib/api/types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const ACTION_LABEL: Record<ActivityAction, string> = {
  account_invited: "Invitó una cuenta",
  account_deactivated: "Desactivó una cuenta",
  account_reactivated: "Reactivó una cuenta",
  permission_changed: "Cambió un permiso",
  mfa_reset: "Restableció MFA",
  invite_resent: "Reenvió una invitación",
  prompt_published: "Publicó una versión del prompt",
  prompt_tested: "Probó una versión del prompt",
  prompt_activated: "Activó una versión del prompt",
  prompt_rolled_back: "Volvió a una versión del prompt",
  pii_viewed: "Vio datos personales sin enmascarar",
  pii_exported: "Exportó con datos personales",
  agent_search: "Buscó o filtró por ejecutivo",
  login_failed: "Ingresos fallidos repetidos",
};

/** Registro de acciones sensibles (Cambio 10 §4.4). Solo lectura. */
export default function ActivityPage() {
  const log = useAsync(() => api.listActivity(), []);
  const [action, setAction] = useState<ActivityAction | "">("");
  const [person, setPerson] = useState("");
  const people = useMemo(() => [...new Set((log.data ?? []).map((e) => e.actorName))], [log.data]);
  const rows = (log.data ?? []).filter((e) => (!action || e.action === action) && (!person || e.actorName === person));
  return (
    <>
      <AdminHeader
        title="Registro de actividad"
        description="Registro de acciones sensibles. No se puede editar ni borrar."
        actions={<Button onClick={() => toast("Estamos preparando el archivo. Te avisaremos cuando esté listo.")}>Exportar CSV</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="control" aria-label="Persona" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Persona: todas</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="control" aria-label="Acción" value={action} onChange={(e) => setAction(e.target.value as ActivityAction | "")}>
          <option value="">Acción: todas</option>
          {(Object.keys(ACTION_LABEL) as ActivityAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
      </div>
      <AsyncView state={log} what="el registro de actividad">
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No hay acciones con estos filtros." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Persona</th>
                  <th>Rol</th>
                  <th>Acción</th>
                  <th>Objeto</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="tabular">{shortDateTime(e.at)}</td>
                    <td>{e.actorName}</td>
                    <td>{ROLE_LABEL[e.actorRole]}</td>
                    <td>{ACTION_LABEL[e.action]}</td>
                    <td>{e.target}</td>
                    <td className="whitespace-normal">{e.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </AsyncView>
    </>
  );
}
