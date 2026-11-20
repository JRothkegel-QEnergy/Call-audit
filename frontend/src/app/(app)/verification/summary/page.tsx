"use client";

import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AsyncView, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { VerificationView } from "../../admin/prompts/[version]/verification/verification-view";

/** «Resumen» del verificador: la verificación de la versión con la última corrida completa terminada (13, V2 A), con
 * su mosaico y el filtro Mí/Todas, sin cambios (18, W1 A). */
export default function VerificationSummaryPage() {
  const state = useAsync(() => api.getVerificationHome(), []);
  return (
    <AsyncView state={state} what="la verificación">
      {(d) =>
        d.version ? (
          <Suspense fallback={<LoadingState />}>
            <VerificationView version={d.version} />
          </Suspense>
        ) : (
          <>
            <AdminHeader title="Resumen" />
            <p className="empty-state">Todavía no hay llamadas para verificar. Te avisaremos cuando el admin las reparta.</p>
          </>
        )
      }
    </AsyncView>
  );
}
