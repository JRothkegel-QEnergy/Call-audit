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
  RejectedCriterion,
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
 * Bandejas del calibrador (docs/ux/admin-prompt-metrics/18, ajustadas en 21 y 23-modulo-de-calibracion): «Por calibrar»
 * (sus llamadas asignadas que faltan, en el orden aleatorio fijo) y «Calibradas» (lo ya calibrado, la más reciente
 * primero). Las dos resuelven la versión con la última corrida completa.
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

// 23 §7 (AE12-AE13).
const TITLE: Record<Tray, string> = { pending: "Llamadas por calibrar", reviewed: "Llamadas calibradas" };
const DESCRIPTION: Record<Tray, string> = {
  pending: "Tus llamadas asignadas que faltan por calibrar. Están en un orden al azar fijo, el mismo para todos.",
  reviewed: "Listado de llamadas ya calibradas ordenadas desde la más reciente. Si desea corregir un registro, abra la llamada.",
};

const SORT_LABEL: Record<TraySort, string> = {
  call: "ID de llamada",
  date: "Fecha llamada",
  ai: "Veredicto Qubyt",
  reviewer: "Veredicto Revisor",
  final: "Veredicto final",
  reviewed: "Fecha de calibración",
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
      : "Ordenado por fecha de calibración, descendente";

function TrayHeader({ tray, actions, sort = null, dir = null }: { tray: Tray; actions?: React.ReactNode; sort?: TraySort | null; dir?: SortDirection | null }) {
  const description =
    tray === "pending" && sort
      ? `Tus llamadas asignadas que faltan por calibrar, ordenadas por ${sortName(sort)}, ${dirName(dir)}.`
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

/** Avance de una llamada pendiente (21, 23): «Por calibrar» o «{k} de {t} criterios». */
function progressLabel(i: SegmentCall) {
  const total = i.disagreements.length;
  const done = i.disagreements.filter((d) => d.outcome).length;
  return done === 0 ? "Por calibrar" : `${done} de ${total} criterios`;
}

/** Quién rechaza el criterio (23-modulo-de-calibracion, AB3): color y texto. Nunca «Qubyt en duda». */
const KIND: Record<RejectedCriterion["kind"], { chip: string; text: string }> = {
  qubyt: { chip: "chip-blue", text: "Lo rechaza Qubyt" },
  reviewer: { chip: "chip-yellow", text: "Lo rechaza el revisor" },
  both: { chip: "chip-green", text: "Lo rechazan los dos" },
  calibrated: { chip: "chip-muted", text: "Rechazado en la calibración" },
};
const KIND_ORDER: RejectedCriterion["kind"][] = ["qubyt", "reviewer", "both", "calibrated"];

/** Leyenda de colores sobre la tabla (23, AB3). */
function ChipLegend() {
  return (
    <p className="help m-0 mb-2 flex flex-wrap items-center gap-3 text-xs">
      {(["qubyt", "reviewer", "both"] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("chip-dot", KIND[k].chip)} />
          {KIND[k].text}
        </span>
      ))}
      <span>✗ = No cumple confirmado</span>
    </p>
  );
}

/** Criterios rechazados de la llamada (23, AB3-AB4): azul, amarillo, verde y gris en ese orden. Calibrado Cumple → sale
 * de la lista; calibrado No cumple → ✗. */
function CriteriaCell({ items, filtered }: { items: RejectedCriterion[]; filtered: number | null }) {
  const shown = items
    .filter((c) => c.calibration !== "compliant")
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  if (shown.length === 0) return <span className="help">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((c) => {
        const status = c.calibration === "non_compliant" ? "No cumple confirmado" : "sin calibrar";
        return (
          <span
            key={c.criterionId}
            className={cn("chip", KIND[c.kind].chip, c.criterionId === filtered && "font-bold ring-2 ring-[var(--ring)]")}
            title={`${KIND[c.kind].text} · ${status}`}
          >
            C{c.criterionId}
            {c.calibration === "non_compliant" && <span aria-hidden> ✗</span>}
            <span className="sr-only">
              {" "}
              {KIND[c.kind].text.charAt(0).toLowerCase() + KIND[c.kind].text.slice(1)}, {status}
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
      {int(me.pending)} pendientes · {int(me.reviewedToday)} calibradas hoy
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

  // Bandeja vacía sin filtros: todo hecho (Por calibrar) o nada aún (Calibradas).
  if (items.length === 0 && !filtered) {
    return tray === "pending" ? (
      <EmptyState title={`¡Listo! Calibraste tus ${int(me.assigned)} llamadas.`} body="Si el admin te asigna más, aparecerán aquí.">
        <Button onClick={() => router.push(trayPath("reviewed"))}>Ver calibradas</Button>
      </EmptyState>
    ) : (
      <EmptyState title="Aún no has calibrado llamadas.">
        <Button onClick={() => router.push(trayPath("pending"))}>Ir a Por calibrar</Button>
      </EmptyState>
    );
  }

  const first = shown[0];
  return (
    <>
      {/* 23 §7 (AE19): cada filtro en su grupo, con la etiqueta arriba, para que se lean como distintos. */}
      <div className="mb-2 flex flex-wrap items-end gap-x-6 gap-y-3" role="search">
        <div className="grid gap-1 text-sm">
          <span aria-hidden>ID de llamada</span>
          <CallSearch value={call ?? undefined} onChange={(v) => set("llamada", v)} />
        </div>
        <label className="grid gap-1 text-sm">
          Criterios rechazados
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
        <label className="grid gap-1 text-sm">
          Veredicto Qubyt
          <select className="control" value={aiVerdict ?? ""} onChange={(e) => set("qubyt", e.target.value || null)}>
            <option value="">Todos · {calls(sum(ai))}</option>
            {AI_OPTIONS.filter(([k]) => k !== "uncertain" || (ai?.uncertain ?? 0) > 0 || aiVerdict === "uncertain").map(([k, label]) => (
              <option key={k} value={k}>
                {label} · {int(ai?.[k] ?? 0)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Veredicto Revisor
          <select className="control" value={reviewerVerdict ?? ""} onChange={(e) => set("revisor", e.target.value || null)}>
            <option value="">Todos · {calls(sum(reviewer))}</option>
            {REVIEWER_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label} · {int(reviewer?.[k] ?? 0)}
              </option>
            ))}
          </select>
        </label>
        {tray === "pending" && first && (
          <Button variant="primary" className="ml-auto" onClick={() => router.push(caseHref(first.caseId))}>
            Seguir calibrando
          </Button>
        )}
      </div>

      {/* 23 §7 (AE18): el orden, entre los filtros y la leyenda de los criterios rechazados. */}
      <p className="help m-0 mb-2" aria-live="polite">
        {sortText(tray, sort, dir)}
      </p>

      {shown.length === 0 ? (
        call ? (
          <p className="empty-state">
            No tienes la llamada {call} en esta pestaña.
            {tray === "pending" && (
              <>
                {" "}
                Puede que ya esté calibrada.{" "}
                <Link className="underline" href={`${trayPath("reviewed")}?llamada=${encodeURIComponent(call)}`}>
                  Buscar en Calibradas
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
          <ChipLegend />
          <table className="tbl">
            <thead>
              <tr>
                {th("call")}
                {th("date")}
                {th("ai")}
                {th("reviewer")}
                <th scope="col">Nombre Revisor</th>
                <th scope="col">Criterios rechazados</th>
                {tray === "reviewed" && th("final")}
                {tray === "pending" ? <th scope="col">Avance</th> : th("reviewed")}
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
                  <td>{personName(i.evaluator) || "—"}</td>
                  <td>
                    <CriteriaCell items={i.rejectedCriteria ?? []} filtered={motivo} />
                  </td>
                  {tray === "reviewed" && (
                    <td>
                      {i.finalVerdict ? (
                        <span className={VERDICT_CLASS[i.finalVerdict]}>{VERDICT[i.finalVerdict]}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {tray === "pending" ? (
                    <td>{progressLabel(i)}</td>
                  ) : (
                    <td>{i.lastReviewedAt ? shortDateTime(i.lastReviewedAt) : "—"}</td>
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
