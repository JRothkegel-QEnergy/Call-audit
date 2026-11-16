"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { Swatch } from "@/components/admin/agreement-charts";
import {
  CALL_STATUS,
  LISTS,
  listTitle,
  LIST_SWATCH,
  SEGMENT_SUPPORT,
  VERDICT,
  VERDICT_CLASS,
  listHref,
  summaryLine,
} from "@/components/admin/verification-labels";
import { typificationLabel } from "@/components/call/typification";
import { Button } from "@/components/ui/button";
import { MetricHelp } from "@/components/ui/metric-help";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CallList, CallVerification, SegmentCall, SegmentCalls } from "@/lib/api/admin-types";
import { shortDate } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { scopeFromParams, scopeQuery, verificationHref } from "@/lib/verification-scope";

const scopeLabel = (assignee: string | null) =>
  assignee === "me" ? "asignadas a ti" : assignee === "unassigned" ? "sin asignar" : assignee && assignee !== "all" ? "de esta persona" : "de la corrida completa";

/** Nivel 2 · Lista de las llamadas de una parte del mosaico (o de un lado, o de un motivo), con el avance de la
 * verificación (04-verificacion-propuesta.md §5.2, 05-numeros-propuesta.md §3). El motivo filtra en el servidor: la
 * suma de la verificación es la de la lista que se ve. */
export function CallsListView({ version }: { version: string }) {
  const params = useSearchParams();
  const raw = params.get("segment") as CallList | null;
  const segment: CallList = raw && LISTS.includes(raw) ? raw : "reviewer";
  const motivo = params.get("motivo") ? Number(params.get("motivo")) : null;
  const vs = params.get("vs");
  const sample = params.get("muestra") ? Number(params.get("muestra")) : null;
  const scope = scopeFromParams(params);
  const state = useAsync(
    () => api.getSegmentCalls(version, segment, motivo, { vs, sample, scope }),
    [version, segment, motivo, vs, sample, scope.source, scope.assignee],
  );
  return (
    <AsyncView state={state} what="las llamadas">
      {(data) => <CallsList version={version} data={data} />}
    </AsyncView>
  );
}

type StatusFilter = "all" | Exclude<CallVerification, "none">;
const FILTERS: [StatusFilter, string][] = [
  ["all", "Todas"],
  ["pending", "Pendientes"],
  ["confirmed", "Confirmadas"],
  ["ai_wrong", "La IA se equivocó"],
  ["inconclusive", "No concluyentes"],
];

function CallsList({ version, data }: { version: string; data: SegmentCalls }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (params.get("estado") as StatusFilter | null) ?? "all";
  const scope = scopeFromParams(params);
  const full = scope.source === "full";
  const motivo = data.criterion;
  const byCall = params.get("orden") === "llamada";
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const { segment, summary: s, items } = data;
  // En la corrida completa, una llamada sin desacuerdos queda pendiente hasta marcarla «Sin observaciones» (13, V1 B).
  const statusOf = (i: SegmentCall): CallVerification =>
    full && i.verification === "none" && !i.reviewedAt ? "pending" : i.verification;
  const count = (f: StatusFilter) => (f === "all" ? items.length : items.filter((i) => statusOf(i) === f).length);
  const criteria = [
    ...new Set([...items.flatMap((i) => i.disagreements.map((d) => d.criterionId)), ...(motivo != null ? [motivo] : [])]),
  ].sort((a, b) => a - b);
  const shown = items
    .filter((i) => status === "all" || statusOf(i) === status)
    .sort((a, b) => (byCall ? a.callId.localeCompare(b.callId) : a.order - b.order));
  const firstPending = items.find((i) => statusOf(i) === "pending");
  const caseHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(version)}/calls/${encodeURIComponent(caseId)}?segment=${segment}${
      motivo != null ? `&motivo=${motivo}` : ""
    }${scopeQuery(scope)}`;
  const swatch = LIST_SWATCH[segment];
  const line = summaryLine(segment, s);

  return (
    <>
      <Link
        href={full ? verificationHref(version, scope.assignee) : `/admin/prompts/${encodeURIComponent(version)}?tab=test`}
        className="btn btn-ghost btn-sm mb-2"
      >
        <ChevronLeft size={14} aria-hidden /> {full ? "Volver a Verificación" : `Volver a v${version}`}
      </Link>
      <AdminHeader
        title={`${listTitle(segment, motivo, { vs: data.vs, sample: data.sample })} · v${version}`}
        description={`${items.length} llamadas de ${data.n} ${full ? scopeLabel(scope.assignee) : "de validación"} · ${
          motivo != null ? `con desacuerdo en el motivo ${motivo}` : SEGMENT_SUPPORT[segment]
        }`}
      />

      <section className="card mb-4 grid gap-2" aria-labelledby="verif-h">
        <h2 id="verif-h" className="m-0 flex items-center gap-2 text-sm font-semibold">
          {swatch && <Swatch part={swatch} />} Verificación
          <MetricHelp title="Cómo se verifica">
            Las llamadas aparecen en un orden al azar, el mismo para todos, para que una revisión a medias no quede cargada hacia un tipo
            de llamada. El margen dice entre qué valores estaría la tasa si se revisaran muchas llamadas como estas, con 95 % de
            confianza.
          </MetricHelp>
        </h2>
        {s.calls === 0 && !(full && firstPending) ? (
          <p className="help m-0">Ninguna llamada de esta parte tiene motivos en desacuerdo que verificar.</p>
        ) : (
          <>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={s.calls}
              aria-valuenow={s.reviewed}
              aria-label="Llamadas revisadas"
              className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${(100 * s.reviewed) / s.calls}%` }} />
            </div>
            <p className="m-0 text-sm tabular">
              {s.reviewed} de {s.calls} revisadas · Confirmadas {s.confirmed} · La IA se equivocó {s.aiWrong} · No concluyentes{" "}
              {s.inconclusive} · Pendientes {s.pending}
            </p>
            {line && <p className="m-0 text-sm font-semibold">{line}</p>}
            {segment === "reviewer" && s.reviewed > 0 && (
              <p className="help m-0">
                Equivale a {Math.round((100 * s.confirmed) / data.n)} % de las {data.n} llamadas hasta ahora. Las métricas oficiales no
                cambian.
              </p>
            )}
            {s.seenFirst > 0 && <p className="help m-0">{s.seenFirst} registros se hicieron con la explicación de la IA a la vista.</p>}
            <div>
              {firstPending ? (
                <Button variant="primary" onClick={() => router.push(caseHref(firstPending.caseId))}>
                  {s.reviewed === 0 ? "Empezar a revisar" : `Seguir revisando · ${s.reviewed + 1} de ${s.calls}`}
                </Button>
              ) : (
                <Button variant="primary" disabled>
                  Revisión completa
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="seg" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => set("estado", k === "all" ? null : k)}>
              {label} {count(k)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          Motivo:
          <select className="control" value={motivo ?? ""} onChange={(e) => set("motivo", e.target.value || null)}>
            <option value="">Todos</option>
            {criteria.map((c) => (
              <option key={c} value={c}>
                Motivo {c}
              </option>
            ))}
          </select>
        </label>
        <span className="help ml-auto">
          {byCall ? "Ordenadas por llamada" : "Orden aleatorio fijo"} ·{" "}
          <button type="button" className="underline" onClick={() => set("orden", byCall ? null : "llamada")}>
            {byCall ? "Volver al orden aleatorio" : "Ordenar por llamada"}
          </button>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">Ninguna llamada de esta prueba cae en esta parte.</p>
      ) : shown.length === 0 ? (
        <p className="empty-state">
          No hay llamadas con este filtro.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => router.replace(`${listHref(version, segment)}${scopeQuery(scope)}`, { scroll: false })}
          >
            Quitar filtro
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" className="num">
                  #
                </th>
                <th scope="col">Llamada</th>
                <th scope="col">Fecha</th>
                <th scope="col">IA</th>
                <th scope="col">Planilla</th>
                <th scope="col">Tipificó</th>
                {segment === "changed" && <th scope="col">Cambio</th>}
                <th scope="col">Motivos en desacuerdo</th>
                {full && <th scope="col">Asignada a</th>}
                <th scope="col">Verificación</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.caseId} className="clickable" onClick={() => router.push(caseHref(i.caseId))}>
                  <td className="num">{i.order}</td>
                  <td>
                    <Link href={caseHref(i.caseId)} onClick={(e) => e.stopPropagation()}>
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
                  <td className="max-w-[14rem] truncate" title={typificationLabel(i.typification)}>
                    <span className={!i.typification?.outcome || i.typification.assumed ? "text-muted-foreground" : undefined}>
                      {typificationLabel(i.typification, { short: true })}
                    </span>
                  </td>
                  {segment === "changed" && <td>{i.group === "toAgree" ? "Pasa a coincidir" : "Deja de coincidir"}</td>}
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {i.disagreements.length === 0 && <span className="help">—</span>}
                      {i.disagreements.map((d) => (
                        <span
                          key={d.criterionId}
                          className="chip"
                          title={d.kind === "undecided" ? "La IA quedó dudosa" : d.kind === "fn" ? "La IA aprueba, la planilla rechaza" : "La IA rechaza, la planilla aprueba"}
                        >
                          M{d.criterionId}
                          {d.outcome && <span aria-hidden> ✓</span>}
                          <span className="sr-only">{d.outcome ? " registrado" : " sin registrar"}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                  {full && <td>{i.assigneeName ?? <span className="help">Sin asignar</span>}</td>}
                  <td>
                    {full && i.verification === "none" ? (i.reviewedAt ? "Sin observaciones" : "Por revisar") : CALL_STATUS[i.verification]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
