"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { ROLE_LABEL } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { UserAccount } from "@/lib/api/admin-types";
import type { Permission, Role } from "@/lib/api/types";
import { shortDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";

type Status = UserAccount["status"];

const STATUS: Record<Status, [string, "teal" | "neutral" | "ink"]> = {
  active: ["Activo", "teal"],
  invited: ["Invitado", "neutral"],
  invite_expired: ["Invitación vencida", "neutral"],
  deactivated: ["Desactivado", "ink"],
};

const ERRORS: Record<string, string> = {
  self: "No puedes desactivar tu propia cuenta.",
  last_admin: "Debe quedar al menos un Administrador Qubico activo.",
  never_activated: "Esta cuenta nunca se activó: reenvía la invitación en vez de reactivarla.",
  duplicate_email: "Ya existe una cuenta con este correo.",
};

/** Permiso extra que se puede dar por rol: el resto ya viene incluido en el rol. */
const ROLE_PERMISSION: Partial<Record<Role, [Permission, string]>> = {
  auditor: ["view_model_io", "Ver prompt y respuesta del modelo"],
  supervisor: ["manage_catalog", "Administrar seguros"],
};

const errorText = (e: unknown, fallback: string) => ERRORS[e instanceof Error ? e.message : ""] ?? fallback;

export default function AdminAccountsPage() {
  const { user } = useSession();
  const accounts = useAsync(() => api.listAccounts(), []);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<UserAccount | null>(null);
  const reload = () => void accounts.reload({ silent: true });

  const rows = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (a) =>
          (!roleFilter || a.role === roleFilter) &&
          (!statusFilter || a.status === statusFilter) &&
          (!query || `${a.name} ${a.email}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [accounts.data, roleFilter, statusFilter, query],
  );

  const setStatus = async (a: UserAccount, status: "active" | "deactivated") => {
    try {
      await api.setUserStatus(a.id, status);
      toast(status === "active" ? "Cuenta reactivada." : "Cuenta desactivada.");
      reload();
    } catch (e) {
      toast(errorText(e, "No pudimos actualizar la cuenta. Intenta de nuevo."));
    }
  };

  return (
    <>
      <AdminHeader
        title="Cuentas"
        description={`Personas con acceso a Call Audit en ${user?.clientName ?? "el cliente"}.`}
        actions={
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <Plus size={14} aria-hidden />
            Invitar persona
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="control search w-[240px]" placeholder="Buscar por nombre o correo" aria-label="Buscar cuenta" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="control" aria-label="Rol" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}>
          <option value="">Rol: todos</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select className="control" aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | "")}>
          <option value="">Estado: todos</option>
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s][0]}
            </option>
          ))}
        </select>
      </div>
      <AsyncView state={accounts} what="las cuentas">
        {() =>
          rows.length === 0 ? (
            <EmptyState title="No hay cuentas con estos filtros." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Permiso extra</th>
                    <th>Último ingreso</th>
                    <th>Creada por</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const self = a.id === user?.id;
                    const extra = ROLE_PERMISSION[a.role];
                    const pending = a.status === "invited" || a.status === "invite_expired";
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">
                          {a.name}
                          {self && <span className="help ml-1">(tú)</span>}
                        </td>
                        <td>{a.email}</td>
                        <td>{ROLE_LABEL[a.role]}</td>
                        <td>
                          <StatusBadge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</StatusBadge>
                        </td>
                        <td>
                          {extra ? (
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                aria-label={`${extra[1]}: ${a.name}`}
                                checked={a.permissions.includes(extra[0])}
                                onChange={async (e) => {
                                  await api.setAccountPermissions(a.id, e.target.checked ? [extra[0]] : []);
                                  toast(`Permiso actualizado para ${a.name}.`);
                                  reload();
                                }}
                              />
                              {extra[1]}
                            </label>
                          ) : (
                            <span className="help">Todo incluido en el rol</span>
                          )}
                        </td>
                        <td className="tabular">{a.lastLoginAt ? shortDateTime(a.lastLoginAt) : "—"}</td>
                        <td>{a.createdBy}</td>
                        <td className="text-right">
                          <span className="inline-flex gap-1">
                            {pending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await api.resendInvite(a.id);
                                  toast(`Reenviamos la invitación a ${a.email}.`);
                                  reload();
                                }}
                              >
                                Reenviar invitación
                              </Button>
                            )}
                            {a.status === "active" && !self && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await api.sendPasswordReset(a.id);
                                  toast(`Enviamos a ${a.email} un enlace para crear una contraseña nueva.`);
                                }}
                              >
                                Restablecer contraseña
                              </Button>
                            )}
                            {!self &&
                              (a.status === "deactivated" ? (
                                <Button variant="ghost" size="sm" onClick={() => void setStatus(a, "active")}>
                                  Reactivar
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm(a)}>
                                  {pending ? "Revocar invitación" : "Desactivar"}
                                </Button>
                              ))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </AsyncView>
      <p className="help mt-2">Para cambiar el rol de alguien, desactiva su cuenta e invítalo de nuevo con el rol correcto. Cada acción queda en el Registro de actividad.</p>

      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.role === "qubico_admin" ? `¿Desactivar a ${confirm.name}?` : `¿Desactivar la cuenta de ${confirm?.name ?? ""}?`}
        description={
          <p className="m-0">
            {confirm?.role === "qubico_admin"
              ? "No podrá ingresar. Debe quedar al menos un Administrador Qubico activo."
              : "No podrá ingresar. Sus revisiones se conservan y sus casos en revisión vuelven a la cola."}
          </p>
        }
        footer={
          <>
            <Button
              variant="destructive"
              autoFocus
              onClick={() => {
                const a = confirm!;
                setConfirm(null);
                void setStatus(a, "deactivated");
              }}
            >
              Desactivar cuenta
            </Button>
            <Button onClick={() => setConfirm(null)}>Cancelar</Button>
          </>
        }
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onDone={(email) => {
          setInviteOpen(false);
          toast(`Enviamos la invitación a ${email}.`);
          reload();
        }}
      />
    </>
  );
}

function InviteDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("auditor");
  const [extra, setExtra] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const perm = ROLE_PERMISSION[role];
      await api.inviteUser({ name: name.trim(), email: email.trim(), role, permissions: perm && extra ? [perm[0]] : [] });
      const sent = email.trim();
      setName("");
      setEmail("");
      setRole("auditor");
      setExtra(false);
      setError(null);
      setConfirmAdmin(false);
      onDone(sent);
    } catch (e) {
      setConfirmAdmin(false);
      setError(errorText(e, "No pudimos enviar la invitación. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  const perm = ROLE_PERMISSION[role];
  return (
    <>
      <Dialog
        open={open && !confirmAdmin}
        onOpenChange={onOpenChange}
        title="Invitar persona"
        description={<p className="m-0">Le enviaremos un correo con un enlace para activar su cuenta. El enlace vence en 72 horas.</p>}
        footer={
          <>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                if (!name.trim()) return setError("Escribe el nombre de la persona.");
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Escribe un correo válido, por ejemplo nombre@empresa.cl.");
                setError(null);
                if (role === "qubico_admin") setConfirmAdmin(true);
                else void submit();
              }}
            >
              Enviar correo
            </Button>
            <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          </>
        }
      >
        <label className="field">
          Nombre
          <input autoFocus className="control" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Correo corporativo
          <input className="control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <fieldset className="m-0 rounded-md border border-border px-3 py-2">
          <legend className="px-1 text-[13px] font-medium">Rol</legend>
          {(["auditor", "supervisor", "qubico_admin"] as Role[]).map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="radio"
                name="role"
                checked={role === r}
                onChange={() => {
                  setRole(r);
                  setExtra(false);
                }}
              />{" "}
              {ROLE_LABEL[r]}
            </label>
          ))}
        </fieldset>
        {perm && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} /> {perm[1]}
          </label>
        )}
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </Dialog>
      <Dialog
        open={confirmAdmin}
        onOpenChange={setConfirmAdmin}
        title={`¿Invitar a ${name.trim()} como Administrador Qubico?`}
        description={<p className="m-0">Tendrá acceso a cuentas, prompt, seguros y estadísticas.</p>}
        footer={
          <>
            <Button variant="primary" loading={busy} autoFocus onClick={() => void submit()}>
              Enviar correo
            </Button>
            <Button onClick={() => setConfirmAdmin(false)}>Cancelar</Button>
          </>
        }
      />
    </>
  );
}
