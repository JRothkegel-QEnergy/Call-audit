"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatedBrandLogo } from "@/components/brand/logo";
import { homeFor } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api/types";
import { useSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, setUser } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    } catch {
      setError("No pudimos ingresar. Revisa tu conexión e intenta de nuevo.");
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
      <section className="hidden flex-col justify-between bg-blue-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <AnimatedBrandLogo height={40} />
        </div>
        <div>
          <h2 className="m-0 max-w-[420px] text-[28px] font-semibold leading-[34px]">Auditoría de llamadas</h2>
          <p className="max-w-[420px] text-on-dark-muted">
            Qubyt propone hallazgos sobre el 100 % de las llamadas. Las personas revisan y deciden.
          </p>
        </div>
        <p className="help text-on-dark-subtle">Demo con datos sintéticos</p>
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
          <a href="#" onClick={(e) => e.preventDefault()}>
            ¿Olvidaste tu contraseña?
          </a>
          <div className="help border-t border-border pt-2.5">
            Demo: <a href="#" onClick={demo("auditor")}>entrar como auditora</a> ·{" "}
            <a href="#" onClick={demo("supervisor")}>entrar como supervisor</a> ·{" "}
            <a href="#" onClick={demo("qubico_admin")}>entrar como admin Qubico</a>
            <br />
            Con correo y contraseña: si el correo contiene «sup» entras como supervisor, y si contiene «admin», como admin.
          </div>
          <div className="help">
            <Link href="/privacy">Privacidad</Link> · <Link href="/privacy#terminos">Términos de uso</Link> ·{" "}
            <Link href="/privacy#cookies">Cookies</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
