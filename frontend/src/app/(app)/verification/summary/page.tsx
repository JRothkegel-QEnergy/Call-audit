"use client";

import { ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { AsyncView, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { VerificationOverview } from "@/lib/api/admin-types";
import { int } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { scopeQuery, trayPath } from "@/lib/verification-scope";

const EMPTY = "Todavía no hay llamadas para verificar. Te avisaremos cuando el admin las reparta.";

/** «Resumen» del verificador (19-resumen-avance-y-orden-bandejas, X1-X3 A): el avance de la verificación de la corrida
 * completa, tuyo o del equipo, en cifras y una barra. El mosaico queda solo en la pestaña Verificación del admin. */
export default function VerificationSummaryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SummaryView />
    </Suspense>
  );
}

function SummaryView() {
  const params = useSearchParams();
  const assignee = params.get("asignadas") === "all" ? "all" : "me";
  const state = useAsync(async () => {
    const home = await api.getVerificationHome();
    return home.version ? await api.getVerificationOverview(home.version, assignee) : null;
  }, [assignee]);
  return (
    <>
      <AdminHeader
        title="Resumen"
        description={
          assignee === "all"
            ? "El avance del equipo en la verificación de la corrida completa."
            : "Tu avance en la verificación de la corrida completa."
        }
      />
      <AsyncView state={state} what="el resumen">
        {(data) => (data == null ? <p className="empty-state">{EMPTY}</p> : <Progress data={data} assignee={assignee} />)}
      </AsyncView>
    </>
  );
}

function Progress({ data, assignee }: { data: VerificationOverview; assignee: "me" | "all" }) {
  const router = useRouter();
  const pathname = usePathname();
  const p = data.progress ?? { total: 0, reviewed: 0, pending: 0 };
  const share = p.total ? Math.round((100 * p.reviewed) / p.total) : 0;
  const mine = assignee === "me";
  const setAssignee = (value: "me" | "all") => router.replace(value === "all" ? `${pathname}?asignadas=all` : pathname, { scroll: false });
  const next = mine ? data.me?.nextCaseId : null;
  const nextHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(data.version)}/calls/${encodeURIComponent(caseId)}?segment=all${scopeQuery({
      source: "full",
      assignee: "me",
      tray: "pending",
    })}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Asignadas a:</span>
        <div className="seg" role="group" aria-label="Asignadas a">
          <button type="button" aria-pressed={mine} onClick={() => setAssignee("me")}>
            Mí
          </button>
          <button type="button" aria-pressed={!mine} onClick={() => setAssignee("all")}>
            Todas
          </button>
        </div>
      </div>

      {mine && p.total === 0 ? (
        <p className="empty-state">{EMPTY}</p>
      ) : (
        <section className="card grid gap-4" aria-labelledby="progress-h">
          <h2 id="progress-h" className="m-0 text-sm font-semibold">
            Avance de la verificación
          </h2>
          <dl className="m-0 grid grid-cols-3 gap-3">
            <Figure label="Total" value={int(p.total)} />
            <Figure label="Revisadas" value={int(p.reviewed)} note={`${share} % del total`} />
            <Figure label="Por revisar" value={int(p.pending)} />
          </dl>
          {p.total > 0 && (
            <div
              role="img"
              aria-label={`${int(p.reviewed)} de ${int(p.total)} llamadas revisadas`}
              className="flex h-9 w-full overflow-hidden rounded-md border border-[var(--muted-foreground)] text-xs font-semibold"
            >
              {p.reviewed > 0 && (
                <div className="flex items-center justify-center bg-primary px-2 text-primary-foreground" style={{ width: `${(100 * p.reviewed) / p.total}%` }}>
                  <span className="truncate">Revisadas {int(p.reviewed)}</span>
                </div>
              )}
              {p.pending > 0 && (
                <div className="flex items-center justify-center bg-muted px-2 text-foreground" style={{ width: `${(100 * p.pending) / p.total}%` }}>
                  <span className="truncate">Por revisar {int(p.pending)}</span>
                </div>
              )}
            </div>
          )}
          {mine && data.me && data.me.assigned > 0 && data.me.pending === 0 ? (
            <p className="m-0 font-semibold">¡Listo! Revisaste tus {int(data.me.assigned)} llamadas.</p>
          ) : (
            next && (
              <div>
                <Button variant="primary" onClick={() => router.push(nextHref(next))}>
                  Seguir revisando <ChevronRight size={14} aria-hidden />
                </Button>
              </div>
            )
          )}
          {mine && data.me && data.me.pending === 0 && data.me.assigned > 0 && (
            <div>
              <Button onClick={() => router.push(trayPath("reviewed"))}>Ver revisadas</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="help m-0">{label}</dt>
      <dd className="m-0 text-3xl font-semibold tabular">{value}</dd>
      {note && <dd className="help m-0">{note}</dd>}
    </div>
  );
}
