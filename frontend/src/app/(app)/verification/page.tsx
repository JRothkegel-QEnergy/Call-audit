"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { verificationHref } from "@/lib/verification-scope";

/** Entrada del verificador (13-rol-verificador, V2 A): la versión con la última corrida completa terminada. */
export default function VerificationHomePage() {
  const router = useRouter();
  const state = useAsync(() => api.getVerificationHome(), []);
  const version = state.data?.version;
  useEffect(() => {
    if (version) router.replace(verificationHref(version));
  }, [version, router]);
  return (
    <>
      <AdminHeader title="Verificación" />
      <AsyncView state={state} what="la verificación">
        {(d) =>
          d.version ? null : (
            <p className="empty-state">
              Todavía no hay llamadas para verificar. Te avisaremos cuando el
              admin las reparta.
            </p>
          )
        }
      </AsyncView>
    </>
  );
}
