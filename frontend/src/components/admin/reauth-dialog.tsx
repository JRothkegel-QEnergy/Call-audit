"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";

/**
 * Re-autenticación con el código MFA antes de una acción sensible (crear o desactivar un admin,
 * activar un prompt). Devuelve un token de un solo uso. En la demo, cualquier código de 6 dígitos sirve.
 */
export function ReauthDialog({
  open,
  onOpenChange,
  onToken,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onToken: (token: string) => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setCode("");
          setError(null);
        }
        onOpenChange(o);
      }}
      title="Verificación en dos pasos"
      description={<p className="m-0">Para continuar, escribe el código de tu app de verificación.</p>}
      width={420}
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const token = await api.reauthenticate(code.trim());
                await onToken(token);
                setCode("");
              } catch (e) {
                setError(e instanceof Error && e.message === "invalid_code" ? "El código debe tener 6 dígitos." : "No pudimos completar la acción. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <label className="field">
        Código de 6 dígitos
        <input
          autoFocus
          className="control control-lg w-[160px] tracking-[0.3em] tabular"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      <span className="help">Demo: cualquier código de 6 dígitos funciona.</span>
    </Dialog>
  );
}
