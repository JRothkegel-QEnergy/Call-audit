"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KpiCard, PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { durationText } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";

/** Estado vacío de la cola del auditor (HU-AUD-04, O-17). */
export function EndOfDay() {
  const router = useRouter();
  const { logout } = useSession();
  const stats = useAsync(() => api.getDayStats(), []);
  return (
    <AsyncView state={stats} what="tu resumen del día">
      {(s) => (
        <>
          <PageHeader
            title="No quedan casos pendientes"
            description={`Revisaste ${s.reviewed} casos hoy: ${s.reviewed - s.corrected} sin correcciones y ${s.corrected} con correcciones.`}
          />
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <KpiCard label="Revisados hoy" value={s.reviewed} />
            <KpiCard label="Con correcciones" value={s.corrected} />
            <KpiCard label="Tu tiempo de revisión" value={durationText(s.reviewSeconds)} hint={`para ${durationText(s.audioSeconds)} de audio`} />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => router.push("/my-reviews")}>
              Ver mis revisiones
            </Button>
            <Button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut size={14} aria-hidden />
              Cerrar sesión
            </Button>
          </div>
        </>
      )}
    </AsyncView>
  );
}
