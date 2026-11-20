"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CallSearch } from "@/components/call-search";
import { AdminHeader } from "@/components/admin/admin-header";
import { CALL_STATUS, VERDICT, VERDICT_CLASS } from "@/components/admin/verification-labels";
import { Button } from "@/components/ui/button";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CallVerification, Discrepancy, SegmentCall, SegmentCalls, Tray, VerifierSummary } from "@/lib/api/admin-types";
import { int, shortDate, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { discrepancyFromParam, scopeQuery, trayPath } from "@/lib/verification-scope";

/**
 * Bandejas del verificador (docs/ux/admin-prompt-metrics/18-verificador-bandeja-y-revisadas.md): «Por revisar» (sus
 * llamadas asignadas que faltan, en el orden aleatorio fijo) y «Revisadas» (lo ya revisado, la más reciente primero).
 * Las dos resuelven la versión con la última corrida completa terminada.
 */
export function TrayView({ tray }: { tray: Tray }) {
  const home = useAsync(() => api.getVerificationHome(), []);
  return (
    <AsyncView state={home} what="tus llamadas">
      {(h) =>
        !h.version || !h.me || h.me.assigned === 0 ? (
          <>
            <TrayHeader tray={tray} />
            <p className="empty-state">Todavía no tienes llamadas asignadas. Te avisaremos cuando el admin las reparta.</p>
          </>
        ) : (
          <TrayList tray={tray} version={h.version} me={h.me} />
        )
      }
    </AsyncView>
  );
}

const TITLE: Record<Tray, string> = { pending: "Por revisar", reviewed: "Revisadas" };
const DESCRIPTION: Record<Tray, string> = {
  pending: "Tus llamadas asignadas que faltan por revisar. Están en un orden al azar fijo, el mismo para todos.",
  reviewed: "Las llamadas que ya revisaste, la más reciente primero. Ábrelas para corregir tus registros.",
};

function TrayHeader({ tray, actions }: { tray: Tray; actions?: React.ReactNode }) {
  return <AdminHeader title={TITLE[tray]} description={DESCRIPTION[tray]} actions={actions} />;
}

const DISCREPANCY_OPTIONS: [Discrepancy, string][] = [
  ["fn", "Qubyt aprueba, el revisor rechaza"],
  ["fp", "Qubyt rechaza, el revisor aprueba"],
  ["undecided", "Qubyt en duda"],
  ["criteria", "Mismo veredicto, distintos criterios"],
  ["none", "Sin discrepancias"],
];

type Result = Exclude<CallVerification, "pending">;
const RESULTS: [Result, string][] = [
  ["confirmed", "Confirmada"],
  ["ai_wrong", "Qubyt se equivocó"],
  ["inconclusive", "No concluyente"],
  ["none", "Sin observaciones"],
];

const resultLabel = (i: SegmentCall) => (i.verification === "none" ? "Sin observaciones" : CALL_STATUS[i.verification]);

function progressLabel(i: SegmentCall) {
  const total = i.disagreements.length;
  if (total === 0) return "Sin desacuerdos · por confirmar";
  const done = i.disagreements.filter((d) => d.outcome).length;
  return done === 0 ? "Sin empezar" : `${done} de ${total} criterios`;
}

function TrayList({ tray, version, me }: { tray: Tray; version: string; me: VerifierSummary }) {
  const params = useSearchParams();
  const motivo = params.get("motivo") ? Number(params.get("motivo")) : null;
  const discrepancy = discrepancyFromParam(params.get("discrepancia"));
  const scope = { source: "full" as const, assignee: "me", tray, discrepancy };
  const state = useAsync(
    () => api.getSegmentCalls(version, "all", motivo, { scope }),
    [version, tray, motivo, discrepancy],
  );
  const actions = (
    <span className="help tabular" aria-live="polite">
      {int(me.pending)} pendientes · {int(me.reviewedToday)} revisadas hoy
    </span>
  );
  return (
    <>
      <TrayHeader tray={tray} actions={actions} />
      <AsyncView state={state} what="tus llamadas">
        {(data) => <TrayTable tray={tray} version={version} data={data} me={me} />}
      </AsyncView>
    </>
  );
}

function TrayTable({ tray, version, data, me }: { tray: Tray; version: string; data: SegmentCalls; me: VerifierSummary }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const motivo = data.criterion;
  const discrepancy = discrepancyFromParam(params.get("discrepancia"));
  const result = params.get("resultado") as Result | null;
  const call = params.get("llamada");
  const byCall = params.get("orden") === "llamada";
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const scope = { source: "full" as const, assignee: "me", tray, discrepancy };
  const caseHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(version)}/calls/${encodeURIComponent(caseId)}?segment=all${
      motivo != null ? `&motivo=${motivo}` : ""
    }${scopeQuery(scope)}`;

  const { items } = data;
  const resultOf = (i: SegmentCall): Result => (i.verification === "pending" ? "none" : i.verification);
  const shown = items
    .filter((i) => tray !== "reviewed" || !result || resultOf(i) === result)
    .filter((i) => !call || i.callId.startsWith(call))
    .sort((a, b) => (tray === "pending" ? (byCall ? a.callId.localeCompare(b.callId) : a.order - b.order) : 0));

  const counts = data.discrepancyCounts;
  const totalCounts = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : items.length;
  const filtered = motivo != null || discrepancy != null || !!result || !!call;
  const clear = () => router.replace(pathname, { scroll: false });

  // Bandeja vacía sin filtros: todo hecho (Por revisar) o nada aún (Revisadas).
  if (items.length === 0 && motivo == null && discrepancy == null) {
    return tray === "pending" ? (
      <EmptyState title={`¡Listo! Revisaste tus ${int(me.assigned)} llamadas.`} body="Si el admin te asigna más, aparecerán aquí.">
        <Button onClick={() => router.push(trayPath("reviewed"))}>Ver revisadas</Button>
      </EmptyState>
    ) : (
      <EmptyState title="Aún no has revisado llamadas.">
        <Button onClick={() => router.push(trayPath("pending"))}>Ir a Por revisar</Button>
      </EmptyState>
    );
  }

  const first = shown[0];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
        <CallSearch value={call ?? undefined} onChange={(v) => set("llamada", v)} />
        <label className="flex items-center gap-1.5 text-sm">
          Discrepancia:
          <select className="control" value={discrepancy ?? ""} onChange={(e) => set("discrepancia", e.target.value || null)}>
            <option value="">
              Todas · {int(totalCounts)} {totalCounts === 1 ? "llamada" : "llamadas"}
            </option>
            {DISCREPANCY_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label} · {int(counts?.[k] ?? 0)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Criterio:
          <select className="control" value={motivo ?? ""} onChange={(e) => set("motivo", e.target.value || null)}>
            <option value="">Todos los criterios</option>
            {(data.criterionCounts ?? []).map((c) => (
              <option key={c.criterionId} value={c.criterionId}>
                Criterio {c.criterionId} · {int(c.calls)} {c.calls === 1 ? "llamada" : "llamadas"}
              </option>
            ))}
            {motivo != null && !data.criterionCounts?.some((c) => c.criterionId === motivo) && (
              <option value={motivo}>Criterio {motivo} · 0 llamadas</option>
            )}
          </select>
        </label>
        {tray === "reviewed" && (
          <label className="flex items-center gap-1.5 text-sm">
            Resultado:
            <select className="control" value={result ?? ""} onChange={(e) => set("resultado", e.target.value || null)}>
              <option value="">Todos</option>
              {RESULTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {tray === "pending" && (
          <span className="help">
            {byCall ? "Ordenadas por llamada" : "Orden aleatorio fijo"} ·{" "}
            <button type="button" className="underline" onClick={() => set("orden", byCall ? null : "llamada")}>
              {byCall ? "Volver al orden aleatorio" : "Ordenar por llamada"}
            </button>
          </span>
        )}
        {tray === "pending" && first && (
          <Button variant="primary" className="ml-auto" onClick={() => router.push(caseHref(first.caseId))}>
            Seguir revisando
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        call ? (
          <p className="empty-state">
            No tienes la llamada {call} en esta pestaña.
            {tray === "pending" && (
              <>
                {" "}
                Puede que ya esté revisada.{" "}
                <Link className="underline" href={`${trayPath("reviewed")}?llamada=${encodeURIComponent(call)}`}>
                  Buscar en Revisadas
                </Link>
              </>
            )}
          </p>
        ) : (
          <p className="empty-state">
            {discrepancy && !motivo && !result
              ? `Ninguna de tus llamadas ${tray === "pending" ? "pendientes" : "revisadas"} es de este tipo.`
              : "No hay llamadas con este filtro."}{" "}
            {filtered && (
              <button type="button" className="underline" onClick={clear}>
                Quitar filtro
              </button>
            )}
          </p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                {tray === "pending" && (
                  <th scope="col" className="num">
                    #
                  </th>
                )}
                <th scope="col">Llamada</th>
                <th scope="col">Fecha</th>
                <th scope="col">Qubyt</th>
                <th scope="col">Planilla</th>
                <th scope="col">Criterios</th>
                <th scope="col">{tray === "pending" ? "Avance" : "Resultado"}</th>
                {tray === "reviewed" && <th scope="col">Revisada el</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr
                  key={i.caseId}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => router.push(caseHref(i.caseId))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(caseHref(i.caseId));
                  }}
                >
                  {tray === "pending" && <td className="num">{i.order}</td>}
                  <td>
                    <Link href={caseHref(i.caseId)} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                      {i.callId}
                    </Link>
                  </td>
                  <td>{i.callDate ? shortDate(i.callDate) : "—"}</td>
                  <td>
                    <span className={VERDICT_CLASS[i.aiVerdict]}>{VERDICT[i.aiVerdict]}</span>
                  </td>
                  <td>
                    <span className={VERDICT_CLASS[i.reviewerVerdict]}>{VERDICT[i.reviewerVerdict]}</span>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {i.disagreements.length === 0 && <span className="help">—</span>}
                      {i.disagreements.map((d) => (
                        <span
                          key={d.criterionId}
                          className={d.criterionId === motivo ? "chip border-2 border-foreground font-bold" : "chip"}
                          title={
                            d.kind === "undecided"
                              ? "Qubyt quedó en duda"
                              : d.kind === "fn"
                                ? "Qubyt aprueba, la planilla rechaza"
                                : "Qubyt rechaza, la planilla aprueba"
                          }
                        >
                          M{d.criterionId}
                          {d.outcome && <span aria-hidden> ✓</span>}
                          <span className="sr-only">{d.outcome ? " registrado" : " sin registrar"}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>{tray === "pending" ? progressLabel(i) : resultLabel(i)}</td>
                  {tray === "reviewed" && <td>{i.lastReviewedAt ? shortDateTime(i.lastReviewedAt) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
