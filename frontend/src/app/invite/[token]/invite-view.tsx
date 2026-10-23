"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { ROLE_LABEL, homeFor } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { InviteInfo } from "@/lib/api/admin-types";
import { shortDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";

const MIN_PASSWORD = 12;

/** Activación de cuenta o contraseña nueva desde el enlace del correo (Cambio 12 §3.2). Pública. */
export function InviteView({ token }: { token: string }) {
  const info = useAsync(() => api.getInvite(token), [token]);
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="grid w-[min(400px,100%)] gap-4">
        <BrandLogo height={30} />
        <AsyncView state={info} what="la invitación">
          {(i) => (i.state === "valid" ? <ActivateForm token={token} info={i} /> : <Closed info={i} />)}
        </AsyncView>
      </div>
    </div>
  );
}

function Closed({ info }: { info: InviteInfo }) {
  const [title, body] =
    info.state === "expired"
      ? [
          "Esta invitación venció",
          `El enlace dejó de funcionar${info.expiresAt ? ` el ${shortDateTime(info.expiresAt)}` : ""}. Pide una nueva a quien te invitó.`,
        ]
      : info.state === "used"
        ? ["Esta invitación ya se usó", "Tu cuenta ya está activa."]
        : [
            "Esta invitación ya no es válida",
            "Se envió una invitación más nueva o la cuenta fue desactivada. Revisa tu correo o pide una nueva a quien te invitó.",
          ];
  return (
    <div className="grid gap-2">
      <h1 className="m-0 text-[22px] font-semibold">{title}</h1>
      <p className="m-0">{body}</p>
      {info.state === "used" && (
        <Link href="/login" className="btn btn-primary w-fit">
          Ir a ingresar
        </Link>
      )}
    </div>
  );
}

function ActivateForm({ token, info }: { token: string; info: InviteInfo }) {
  const router = useRouter();
  const { setUser } = useSession();
  const reset = info.kind === "reset";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = error === "short_password";

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < MIN_PASSWORD) return setError("short_password");
        if (!reset && !terms) return setError("terms_required");
        setBusy(true);
        setError(null);
        try {
          const u = await api.acceptInvite(token, { password, acceptTerms: reset || terms });
          setUser(u);
          router.replace(homeFor(u.role));
        } catch (err) {
          setError(err instanceof Error ? err.message : "error");
          setBusy(false);
        }
      }}
    >
      <h1 className="m-0 text-[22px] font-semibold">{reset ? "Crea una contraseña nueva" : "Activa tu cuenta"}</h1>
      {reset ? (
        <p className="m-0">Para {info.email}.</p>
      ) : (
        <>
          <p className="m-0">
            {info.invitedBy ?? "Qubico"} te invitó a Call Audit como {info.role ? ROLE_LABEL[info.role] : "usuario"}. Crea tu contraseña para
            activar tu cuenta.
          </p>
          <label className="field">
            Correo
            <input className="control control-lg" value={info.email ?? ""} readOnly autoComplete="username" />
          </label>
        </>
      )}
      <label className="field">
        {reset ? "Contraseña nueva" : "Contraseña"}
        <span className="flex gap-2">
          <input
            autoFocus
            className="control control-lg flex-1"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={short}
            aria-describedby="pw-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="button" size="lg" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? "Ocultar" : "Mostrar"}
          </Button>
        </span>
        <span id="pw-help" className={short ? "field-error flex items-center gap-1" : "help"}>
          {short && <AlertCircle size={14} aria-hidden />}
          Usa al menos {MIN_PASSWORD} caracteres.
        </span>
      </label>
      {!reset && (
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            Leí y acepto los{" "}
            <Link href="/privacy#terminos" target="_blank">
              Términos de uso
            </Link>
            . Ver el{" "}
            <Link href="/privacy" target="_blank">
              Aviso de privacidad
            </Link>
            .
          </span>
        </label>
      )}
      {error && !short && (
        <span className="field-error" role="alert">
          {error === "terms_required"
            ? "Para activar tu cuenta, acepta los Términos de uso."
            : ["expired", "used", "revoked"].includes(error)
              ? "Este enlace ya no es válido. Recarga la página para ver por qué."
              : "No pudimos guardar la contraseña. Intenta de nuevo."}
        </span>
      )}
      <Button type="submit" variant="primary" size="lg" loading={busy}>
        {busy ? "Activando…" : reset ? "Guardar contraseña" : "Activar cuenta"}
      </Button>
    </form>
  );
}
