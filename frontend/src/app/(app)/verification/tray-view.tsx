"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CallSearch } from "@/components/call-search";
import { AdminHeader } from "@/components/admin/admin-header";
import { VERDICT, VERDICT_CLASS } from "@/components/admin/verification-labels";
import { Button } from "@/components/ui/button";
import { nextSort, SortableTh } from "@/components/ui/sortable-th";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import type {
  SegmentCall,
  SegmentCalls,
  SegmentDisagreement,
  SortDirection,
  Tray,
  TraySort,
  Verdict3,
  VerifierSummary,
} from "@/lib/api/admin-types";
import { int, personName, shortDate, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { dirFromParam, scopeQuery, SORT_PARAM, sortFromParam, trayPath, verdictFromParam } from "@/lib/verification-scope";

/**
 * Bandejas del verificador (docs/ux/admin-prompt-metrics/18-verificador-bandeja-y-revisadas.md, ajustadas en
 * 21-ajustes-vista-verificador.md): «Por revisar» (sus llamadas asignadas que faltan, en el orden aleatorio fijo) y
 * «Revisadas» (lo ya revisado, la más reciente primero). Las dos resuelven la versión con la última corrida completa.
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

const SORT_LABEL: Record<TraySort, string> = {
  call: "ID de llamada",
  date: "Fecha llamada",
  ai: "Veredicto Qubyt",
  reviewer: "Veredicto revisor",
  reviewed: "Fecha de revisión",
};

// Nombre de la columna dentro de una frase: primera letra en minúscula («veredicto Qubyt»).
const sortName = (sort: TraySort) => SORT_LABEL[sort].charAt(0).toLowerCase() + SORT_LABEL[sort].slice(1);
const dirName = (dir: SortDirection | null) => (dir === "desc" ? "descendente" : "ascendente");

/** «Ordenado por {columna}, ascendente|descendente» o el orden por defecto de la bandeja. */
const sortText = (tray: Tray, sort: TraySort | null, dir: SortDirection | null) =>
  sort
    ? `Ordenado por ${sortName(sort)}, ${dirName(dir)}`
    : tray === "pending"
      ? "Orden aleatorio fijo"
      : "Ordenado por fecha de revisión, descendente";

function TrayHeader({ tray, actions, sort = null, dir = null }: { tray: Tray; actions?: React.ReactNode; sort?: TraySort | null; dir?: SortDirection | null }) {
  const description =
    tray === "pending" && sort
      ? `Tus llamadas asignadas que faltan por revisar, ordenadas por ${sortName(sort)}, ${dirName(dir)}.`
      : DESCRIPTION[tray];
  return <AdminHeader title={TITLE[tray]} description={description} actions={actions} />;
}

const AI_OPTIONS: [Verdict3, string][] = [
  ["compliant", "Cumple"],
  ["non_compliant", "No cumple"],
  ["uncertain", "Dudosa"],
];
const REVIEWER_OPTIONS: ["compliant" | "non_compliant", string][] = [
  ["compliant", "Cumple"],
  ["non_compliant", "No cumple"],
];

/** Avance de una llamada pendiente (21): «Por revisar» o «{k} de {t} criterios». */
function progressLabel(i: SegmentCall) {
  const total = i.disagreements.length;
  const done = i.disagreements.filter((d) => d.outcome).length;
  return done === 0 ? "Por revisar" : `${done} de ${total} criterios`;
}

/** Marca de un criterio ya registrado (21, Z2 A): ✓ Qubyt tenía razón · ✗ Qubyt se equivocó · ? ambiguo o falta info. */
function mark(d: SegmentDisagreement): { sign: string; text: string } | null {
  if (!d.outcome) return null;
  if (d.outcome === "reviewer_error") return { sign: "✓", text: "Qubyt tenía razón" };
  if (d.outcome === "ai_error") return { sign: "✗", text: "Qubyt se equivocó" };
  return { sign: "?", text: "ambiguo o falta información" };
}

const KIND_TEXT: Record<SegmentDisagreement["kind"], string> = {
  fp: "Lo rechaza Qubyt",
  fn: "Lo rechaza el revisor",
  undecided: "Qubyt en duda",
};

/** Criterios de la llamada (21, Z1 A): primero los que rechaza Qubyt (rojo); después, en gris, los demás por revisar. */
function CriteriaCell({ items, filtered }: { items: SegmentDisagreement[]; filtered: number | null }) {
  const ordered = [...items.filter((d) => d.kind === "fp"), ...items.filter((d) => d.kind !== "fp")];
  if (ordered.length === 0) return <span className="help">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ordered.map((d) => {
        const m = mark(d);
        return (
          <span
            key={d.criterionId}
            className={cn("chip", d.kind === "fp" ? "chip-fail" : "chip-muted", d.criterionId === filtered && "font-bold ring-2 ring-[var(--ring)]")}
            title={`${KIND_TEXT[d.kind]}${m ? ` · ${m.text}` : " · sin revisar"}`}
          >
            C{d.criterionId}
            {m && <span aria-hidden> {m.sign}</span>}
            <span className="sr-only">
              {" "}
              {KIND_TEXT[d.kind].toLowerCase()}, {m ? m.text : "sin revisar"}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function TrayList({ tray, version, me }: { tray: Tray; version: string; me: VerifierSummary }) {
  const params = useSearchParams();
  const motivo = params.get("motivo") ? Number(params.get("motivo")) : null;
  const aiVerdict = verdictFromParam(params.get("qubyt"));
  const reviewerVerdict = verdictFromParam(params.get("revisor")) as "compliant" | "non_compliant" | null;
  const sort = sortFromParam(params.get("orden"));
  const dir = sort ? (dirFromParam(params.get("dir")) ?? "asc") : null;
  const scope = { source: "full" as const, assignee: "me", tray, sort, dir, rejected: motivo, aiVerdict, reviewerVerdict };
  const state = useAsync(
    () => api.getSegmentCalls(version, "all", motivo, { scope }),
    [version, tray, motivo, aiVerdict, reviewerVerdict, sort, dir],
  );
  const actions = (
    <span className="help tabular" aria-live="polite">
      {int(me.pending)} pendientes · {int(me.reviewedToday)} revisadas hoy
    </span>
  );
  return (
    <>
      <TrayHeader tray={tray} actions={actions} sort={sort} dir={dir} />
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
  const aiVerdict = verdictFromParam(params.get("qubyt"));
  const reviewerVerdict = verdictFromParam(params.get("revisor")) as "compliant" | "non_compliant" | null;
  const call = params.get("llamada");
  const sort = sortFromParam(params.get("orden"));
  const dir = sort ? (dirFromParam(params.get("dir")) ?? "asc") : null;
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  // Clic en el encabezado (19, X4 A): ↑ → ↓ → orden por defecto de la bandeja.
  const sortBy = (column: TraySort) => {
    const n = nextSort(sort, dir, column);
    const next = new URLSearchParams(params.toString());
    if (n.sort) {
      next.set("orden", SORT_PARAM[n.sort]);
      next.set("dir", n.dir ?? "asc");
    } else {
      next.delete("orden");
      next.delete("dir");
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const th = (column: TraySort) => (
    <SortableTh label={SORT_LABEL[column]} dir={sort === column ? dir : null} onClick={() => sortBy(column)} />
  );
  const scope = { source: "full" as const, assignee: "me", tray, sort, dir, rejected: motivo, aiVerdict, reviewerVerdict };
  const caseHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(version)}/calls/${encodeURIComponent(caseId)}?segment=all${
      motivo != null ? `&motivo=${motivo}` : ""
    }${scopeQuery(scope)}`;

  const { items } = data;
  // El orden lo da el servidor (bandeja + columna), el mismo que siguen Anterior/Siguiente (19, X5 A).
  const shown = items.filter((i) => !call || i.callId.startsWith(call));
  const filtered = motivo != null || aiVerdict != null || reviewerVerdict != null || !!call;
  const clear = () => router.replace(pathname, { scroll: false });
  const ai = data.verdictCounts?.ai;
  const reviewer = data.verdictCounts?.reviewer;
  const sum = (r?: Record<string, number>) => (r ? Object.values(r).reduce((a, b) => a + b, 0) : items.length);
  const calls = (n: number) => `${int(n)} ${n === 1 ? "llamada" : "llamadas"}`;

  // Bandeja vacía sin filtros: todo hecho (Por revisar) o nada aún (Revisadas).
  if (items.length === 0 && !filtered) {
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
          Criterios rechazados por Qubyt:
          <select className="control" value={motivo ?? ""} onChange={(e) => set("motivo", e.target.value || null)}>
            <option value="">Todos</option>
            {(data.rejectedCounts ?? []).map((c) => (
              <option key={c.criterionId} value={c.criterionId}>
                C{c.criterionId} · {calls(c.calls)}
              </option>
            ))}
            {motivo != null && !data.rejectedCounts?.some((c) => c.criterionId === motivo) && (
              <option value={motivo}>C{motivo} · 0 llamadas</option>
            )}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Veredicto Qubyt:
          <select className="control" value={aiVerdict ?? ""} onChange={(e) => set("qubyt", e.target.value || null)}>
            <option value="">Todos · {calls(sum(ai))}</option>
            {AI_OPTIONS.filter(([k]) => k !== "uncertain" || (ai?.uncertain ?? 0) > 0 || aiVerdict === "uncertain").map(([k, label]) => (
              <option key={k} value={k}>
                {label} · {int(ai?.[k] ?? 0)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Veredicto revisor:
          <select className="control" value={reviewerVerdict ?? ""} onChange={(e) => set("revisor", e.target.value || null)}>
            <option value="">Todos · {calls(sum(reviewer))}</option>
            {REVIEWER_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label} · {int(reviewer?.[k] ?? 0)}
              </option>
            ))}
          </select>
        </label>
        <span className="help" aria-live="polite">
          {sortText(tray, sort, dir)}
        </span>
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
            No hay llamadas con este filtro.{" "}
            <button type="button" className="underline" onClick={clear}>
              Quitar filtros
            </button>
          </p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                {th("call")}
                {th("date")}
                {th("ai")}
                {th("reviewer")}
                <th scope="col">Criterios rechazados por Qubyt</th>
                {tray === "pending" ? (
                  <th scope="col">Avance</th>
                ) : (
                  <>
                    <th scope="col">Revisor</th>
                    {th("reviewed")}
                  </>
                )}
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
                    <CriteriaCell items={i.disagreements} filtered={motivo} />
                  </td>
                  {tray === "pending" ? (
                    <td>{progressLabel(i)}</td>
                  ) : (
                    <>
                      <td>{personName(i.evaluator) || "—"}</td>
                      <td>{i.lastReviewedAt ? shortDateTime(i.lastReviewedAt) : "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
