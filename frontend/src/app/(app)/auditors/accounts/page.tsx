"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AccountStatus, AuditorAccount } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";
import { AuditorsTabs } from "../auditors-tabs";

const STATUS: Record<AccountStatus, [string, "teal" | "neutral" | "ink"]> = {
  active: ["Activo", "teal"],
  invited: ["Invitado", "neutral"],
  deactivated: ["Desactivado", "ink"],
};

export default function AccountsPage() {
  const accounts = useAsync(() => api.listAuditorAccounts(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivate, setDeactivate] = useState<AuditorAccount | null>(null);
  const reload = () => void accounts.reload({ silent: true });

  return (
    <>
      <PageHeader
        title="Auditores"
        description="Solo puedes crear cuentas de auditor. Las de supervisor las crea Qubico."
        actions={
          // Invitación por correo con enlace de un solo uso (Cambio 12, D-36).
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <Plus size={14} aria-hidden />
            Invitar auditor
          </Button>
        }
      />
      <AuditorsTabs active="accounts" />
      <AsyncView state={accounts} what="las cuentas">
        {(rows) => (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.name}</td>
                  <td>{a.email}</td>
                  <td>
                    <StatusBadge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</StatusBadge>
                  </td>
                  <td className="text-right">
                    {a.status === "deactivated" ? (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await api.setAccountStatus(a.id, "active");
                          toast("Cuenta reactivada.");
                          reload();
                        }}
                      >
                        Reactivar cuenta
                      </Button>
                    ) : a.status === "invited" ? (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api.resendAuditorInvite(a.id);
                            toast(`Reenviamos la invitación a ${a.email}. El enlace anterior dejó de funcionar.`);
                          } catch {
                            toast("No pudimos reenviar la invitación. Intenta de nuevo.");
                          }
                        }}
                      >
                        Reenviar invitación
                      </Button>
                    ) : (
                      <Button variant="ghost" className="text-destructive" onClick={() => setDeactivate(a)}>
                        Desactivar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onDone={(email) => {
          setInviteOpen(false);
          toast(`Enviamos la invitación a ${email}.`);
          reload();
        }}
      />
      <Dialog
        open={!!deactivate}
        onOpenChange={(o) => !o && setDeactivate(null)}
        title={`¿Desactivar la cuenta de ${deactivate?.name ?? ""}?`}
        description={<p className="m-0">No podrá ingresar. Sus revisiones se conservan y sus casos en revisión vuelven a la cola.</p>}
        footer={
          <>
            <Button
              variant="destructive"
              autoFocus
              onClick={async () => {
                if (!deactivate) return;
                await api.setAccountStatus(deactivate.id, "deactivated");
                setDeactivate(null);
                toast("Cuenta desactivada.");
                reload();
              }}
            >
              Desactivar cuenta
            </Button>
            <Button onClick={() => setDeactivate(null)}>Cancelar</Button>
          </>
        }
      />
    </>
  );
}

function InviteDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invitar auditor"
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!name.trim()) return setError("Escribe el nombre del auditor.");
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Escribe un correo válido, por ejemplo nombre@empresa.cl.");
              setBusy(true);
              try {
                await api.inviteAuditor({ name: name.trim(), email: email.trim(), });
                const sent = email.trim();
                setName("");
                setEmail("");
                setError(null);
                onDone(sent);
              } catch (e) {
                setError(e instanceof Error && e.message === "duplicate_email" ? "Ya existe una cuenta con este correo." : "No pudimos enviar la invitación. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Invitar auditor
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
      <span className="help">Rol: auditor. Le llegará un correo para crear su contraseña. Solo Qubico crea supervisores.</span>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}
