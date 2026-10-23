"use client";

import { useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { ROLE_LABEL } from "@/components/shell/app-shell";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const ACTION_LABEL: Record<string, string> = {
  account_invited: "Invitó una cuenta",
  account_activated: "Activó su cuenta",
  password_reset: "Creó una contraseña nueva",
  account_deactivated: "Desactivó una cuenta",
  account_reactivated: "Reactivó una cuenta",
  permission_changed: "Cambió un permiso",
  invite_resent: "Reenvió una invitación",
  password_reset_sent: "Envió un enlace para restablecer la contraseña",
  prompt_published: "Publicó una versión del prompt",
  prompt_discarded: "Descartó un borrador del prompt",
  prompt_tested: "Probó una versión del prompt",
  prompt_test_stopped: "Detuvo la prueba de un prompt",
  prompt_activated: "Activó una versión del prompt",
  prompt_rolled_back: "Volvió a una versión del prompt",
  agent_search: "Buscó o filtró por ejecutivo",
  pii_exported: "Exportó con datos personales",
  "catalog.edit": "Editó un seguro",
  "catalog.archive": "Archivó un seguro",
  "catalog.reactivate": "Reactivó un seguro",
  "catalog.restore": "Restauró una versión de un seguro",
  "catalog.upload": "Subió un documento de seguros",
  "catalog.retry": "Reintentó la lectura de un documento",
  "catalog.batch": "Aplicó cambios en lote al catálogo",
  "catalog.discard": "Descartó un documento de seguros",
  "catalog.download": "Descargó un documento de seguros",
};

// Las decisiones sobre ítems del catálogo llegan como catalog.decide.<acción>.
const labelOf = (action: string) => ACTION_LABEL[action] ?? (action.startsWith("catalog.decide.") ? "Revisó un cambio del catálogo" : action);

/** Registro de acciones sensibles. Solo lectura. */
export default function ActivityPage() {
  const log = useAsync(() => api.listActivity(), []);
  const [action, setAction] = useState("");
  const [person, setPerson] = useState("");
  const people = useMemo(() => [...new Set((log.data ?? []).map((e) => e.actorName))], [log.data]);
  const actions = useMemo(() => [...new Set((log.data ?? []).map((e) => labelOf(e.action)))].sort(), [log.data]);
  const rows = (log.data ?? []).filter((e) => (!action || labelOf(e.action) === action) && (!person || e.actorName === person));
  return (
    <>
      <AdminHeader title="Registro de actividad" description="Registro de acciones sensibles. No se puede editar ni borrar." />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="control" aria-label="Persona" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Persona: todas</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="control" aria-label="Acción" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Acción: todas</option>
          {actions.map((a) => (
            <option key={a}>{a}</option>
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
                    <td className="tabular">{e.at ? shortDateTime(e.at) : "—"}</td>
                    <td>{e.actorName}</td>
                    <td>{ROLE_LABEL[e.actorRole] ?? e.actorRole}</td>
                    <td>{labelOf(e.action)}</td>
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
