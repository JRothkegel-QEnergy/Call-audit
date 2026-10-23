"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { homeFor } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { api, isRealMode } from "@/lib/api";
import type { Role } from "@/lib/api/types";
import { useSession } from "@/lib/session";

/** Mensajes por código de error de la API (Cambio 10, punto 1e; textos de la Fase 6). */
const LOGIN_ERRORS: Record<string, string> = {
  unauthorized: "El correo o la contraseña no son correctos.",
  forbidden: "Tu cuenta no tiene acceso a Call Audit. Pide acceso a Qubico.",
};

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, setUser } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  const enter = async (input: Parameters<typeof api.login>[0]) => {
    setBusy(true);
    setError(null);
    try {
      const u = await api.login(input);
      setUser(u);
      router.replace(homeFor(u.role));
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(LOGIN_ERRORS[code] ?? "No pudimos ingresar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const demo = (role: Role) => (e: React.MouseEvent) => {
    e.preventDefault();
    void enter({ demoRole: role });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandLogo onDark height={40} />
        </div>
        <div>
          <h2 className="m-0 max-w-[420px] text-[28px] font-semibold leading-[34px]">Auditoría de llamadas</h2>
          <p className="max-w-[420px] text-[#c9ced4]">
            La IA propone hallazgos sobre el 100 % de las llamadas. Las personas revisan y deciden.
          </p>
        </div>
        {!isRealMode && <p className="help text-[#9aa3ad]">Demo con datos sintéticos</p>}
      </section>
      <section className="grid place-items-center p-6">
        <form
          className="grid w-[min(380px,100%)] gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email || !password) {
              setError("Ingresa tu correo y tu contraseña.");
              return;
            }
            void enter({ email, password });
          }}
        >
          <h1 className="m-0 text-[22px] font-semibold">Ingresar</h1>
          <label className="field">
            Correo
            <input
              className="control control-lg"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Contraseña
            <input
              className="control control-lg"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <div className="error-state" role="alert">
              <b>{error}</b>
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" loading={busy}>
            Ingresar
          </Button>
          {resetSent ? (
            <p className="help m-0" role="status">
              Si {email} tiene una cuenta, le enviamos un enlace para crear una contraseña nueva. Revisa tu correo.
            </p>
          ) : (
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Escribe tu correo arriba y vuelve a intentarlo.");
                setError(null);
                // Respuesta neutra: no revela si el correo tiene cuenta.
                await api.forgotPassword(email.trim()).catch(() => undefined);
                setResetSent(true);
              }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          )}
          {!isRealMode && (
            <>
              <div className="help border-t border-border pt-2.5">
                Demo: <a href="#" onClick={demo("auditor")}>entrar como auditora</a> ·{" "}
                <a href="#" onClick={demo("supervisor")}>entrar como supervisor</a> ·{" "}
                <a href="#" onClick={demo("qubico_admin")}>entrar como admin Qubico</a>
                <br />
                Con correo y contraseña: si el correo contiene «sup» entras como supervisor, y si contiene «admin», como admin.
              </div>
            </>
          )}
          <div className="help">
            <Link href="/privacy">Privacidad</Link> · <Link href="/privacy#terminos">Términos de uso</Link> ·{" "}
            <Link href="/privacy#cookies">Cookies</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
