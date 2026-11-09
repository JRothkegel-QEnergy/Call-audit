"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ACTION_LABEL, PriorityMap, QUADRANT_LABEL, quadrantOf, WHO_LABEL, type Quadrant } from "@/components/admin/discrepancy-charts";
import { BulkDiscardDialog, DecisionDialog, type DecisionKind, ObservationRow, PatternCard } from "@/components/admin/discrepancy-parts";
import { Button } from "@/components/ui/button";
import { clampPage, Pager } from "@/components/ui/pager";
import type { ActionGroup, DiscrepancyCause, DiscrepancyOverview, DiscrepancyPattern, ProposalType, WhoIsRight } from "@/lib/api/admin-types";
import { CAUSE, PROPOSAL, statusLabel } from "@/lib/discrepancy-labels";
import { resolveMotive, type SetParams } from "@/lib/discrepancy-url";
import { usePreferences } from "@/lib/preferences";

const CARDS_PER_PAGE = 10;
const OBSERVATIONS_PER_PAGE = 20;
/** Patrones u observaciones de un motivo: solo se paginan si superan esto (hoy, máximo 6). */
const MOTIVE_LIST_LIMIT = 10;

const isPending = (p: DiscrepancyPattern) => p.status === "pending";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Grupo de «¿Dónde se arregla?» de un patrón (igual que el backend). */
function actionOf(p: DiscrepancyPattern): ActionGroup {
  if (p.isObservation) return "observation";
  const t = p.proposal?.type;
  return t === "client_question" || t === "data_request" ? "company" : (t ?? "none");
}

interface RailRow {
  id: number;
  name: string;
  pendingPatterns: number;
  pendingObservations: number;
}
const pendingOf = (r: RailRow) => r.pendingPatterns + r.pendingObservations;

/** Pestaña Patrones (Cambio 20 §5): se revisa motivo por motivo; «Todos los motivos» mantiene la lista por impacto. */
export function PatternsTab(props: {
  data: DiscrepancyOverview;
  patterns: DiscrepancyPattern[];
  params: URLSearchParams;
  setParams: SetParams;
  onDecided: (p: DiscrepancyPattern) => void;
  /** "title" o el id de un patrón: adónde va el foco en el próximo render. */
  requestFocus: (target: string) => void;
  takeFocusRequest: () => string | null;
}) {
  if (!props.data.analysis) {
    return (
      <p className="help m-0">
        Todavía no hay análisis con IA. <Link href="/admin/discrepancies?tab=summary">Ir a Resumen</Link>
      </p>
    );
  }
  return <Review {...props} />;
}

function Review({
  data,
  patterns,
  params,
  setParams,
  onDecided,
  requestFocus,
  takeFocusRequest,
}: {
  data: DiscrepancyOverview;
  patterns: DiscrepancyPattern[];
  params: URLSearchParams;
  setParams: SetParams;
  onDecided: (p: DiscrepancyPattern) => void;
  requestFocus: (target: string) => void;
  takeFocusRequest: () => string | null;
}) {
  const a = data.analysis!;
  const readOnly = data.readOnly;
  const { prefs } = usePreferences();

  const cause = params.get("cause") as DiscrepancyCause | null;
  const type = params.get("type") as ProposalType | null;
  const quad = (Object.keys(QUADRANT_LABEL) as Quadrant[]).find((q) => q === params.get("quad")) ?? null;
  const rawAction = (Object.keys(ACTION_LABEL) as ActionGroup[]).find((k) => k === params.get("action")) ?? null;
  const action = rawAction === "unpatterned" ? null : rawAction;
  const right = (["auditor", "ia", "ambiguo"] as WhoIsRight[]).find((k) => k === params.get("right")) ?? null;
  const status = params.get("status") ?? "pending";
  const listKind = params.get("kind") === "obs" ? "obs" : "patterns";
  const narrowed = !!(cause || type || quad || action || right);

  // Las observaciones no tienen causa, tipo ni cuadrante: con esos filtros se ocultan (§5).
  const matches = (p: DiscrepancyPattern) =>
    p.isObservation
      ? !narrowed
      : (!cause || p.cause === cause) && (!type || p.proposal?.type === type) && (!quad || quadrantOf(p) === quad) && (!action || actionOf(p) === action) && (!right || p.whoIsRight === right);
  const items = patterns.filter(matches);

  // Panel: orden fijo del gráfico, para que las filas no salten al decidir.
  const inCriteria = new Set(data.criteria.map((c) => c.criterionId));
  const ids = [
    ...data.criteria.map((c) => c.criterionId).filter((id) => items.some((p) => p.criterionId === id)),
    ...[...new Set(items.map((p) => p.criterionId))].filter((id) => !inCriteria.has(id)),
  ];
  const rows: RailRow[] = ids.map((id) => {
    const mine = items.filter((p) => p.criterionId === id);
    return {
      id,
      name: data.criteria.find((c) => c.criterionId === id)?.name ?? `Motivo ${id}`,
      pendingPatterns: mine.filter((p) => !p.isObservation && isPending(p)).length,
      pendingObservations: mine.filter((p) => p.isObservation && isPending(p)).length,
    };
  });
  const ready = rows.filter((r) => pendingOf(r) === 0).length;
  const firstPending = (rows.find((r) => pendingOf(r) > 0) ?? rows[0])?.id ?? null;

  // Sin motivo en la URL se abre el primero con pendientes, y se queda fijo: al cerrarlo no salta solo (§5).
  const selection = resolveMotive(params);
  const [autoMotive, setAutoMotive] = useState<number | null>(null);
  const autoValid = autoMotive != null && rows.some((r) => r.id === autoMotive);
  if (selection === "auto" && !autoValid && autoMotive !== firstPending) setAutoMotive(firstPending);
  const motive = selection === "auto" ? (autoValid ? autoMotive : firstPending) : selection;

  // Lo recién decidido se queda en su lugar hasta cambiar de motivo, página o filtro (hallazgo 3).
  const viewKey = [motive, params.get("page"), cause, type, status, quad, action, right, listKind].join("|");
  const [justDecided, setJustDecided] = useState<Set<string>>(new Set());
  const [previousView, setPreviousView] = useState(viewKey);
  if (viewKey !== previousView) {
    setPreviousView(viewKey);
    setJustDecided(new Set());
  }
  const staysInPlace = (p: DiscrepancyPattern) => isPending(p) || justDecided.has(p.id);

  const inMotive = typeof motive === "number" ? items.filter((p) => p.criterionId === motive) : [];
  const cards = inMotive.filter((p) => !p.isObservation && staysInPlace(p));
  const observations = inMotive.filter((p) => p.isObservation && staysInPlace(p));
  const decidedItems = inMotive.filter((p) => !staysInPlace(p));
  const pendingObservations = observations.filter(isPending);
  const pendingInMotive = inMotive.filter(isPending).length;

  const pool = items.filter((p) => (listKind === "obs") === p.isObservation);
  const list = pool.filter((p) => status === "all" || (status === "pending" ? isPending(p) : !isPending(p)) || justDecided.has(p.id));
  const listSize = listKind === "obs" ? OBSERVATIONS_PER_PAGE : CARDS_PER_PAGE;
  const page = clampPage(params.get("page"), list.length, listSize);
  const shown = list.slice((page - 1) * listSize, page * listSize);

  const navigable = motive === "all" ? shown : [...cards, ...observations];
  const pendingTotal = rows.reduce((n, r) => n + pendingOf(r), 0);

  const [focused, setFocused] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ p: DiscrepancyPattern; kind: DecisionKind } | null>(null);
  const [bulk, setBulk] = useState(false);
  const [announce, setAnnounce] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Cada elemento marca `focused` al recibir el foco (onFocusCapture).
  const focusItem = (id: string) => {
    const el = document.getElementById(`pattern-${id}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  };

  // Llegada desde un gráfico, un cambio de motivo o de página: el foco va al título o a la tarjeta pedida.
  useEffect(() => {
    const target = takeFocusRequest();
    if (!target) return;
    if (target === "title") {
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ block: "nearest" });
    } else {
      focusItem(target);
    }
  });

  // «Volver» desde el detalle recupera esta misma lista (§13.3).
  const query = params.toString();
  useEffect(() => {
    sessionStorage.setItem("discrepancies-list-url", `/admin/discrepancies${query ? `?${query}` : ""}`);
  }, [query]);

  const openMotive = (id: number | "all") => {
    requestFocus("title");
    setParams({ tab: "patterns", motivo: String(id), page: null });
  };
  const nextWithPending = (delta: 1 | -1): RailRow | null => {
    const from = rows.findIndex((r) => r.id === motive);
    for (let step = 1; step <= rows.length; step += 1) {
      const row = rows[(from + delta * step + rows.length * step) % rows.length];
      if (row && row.id !== motive && pendingOf(row) > 0) return row;
    }
    return null;
  };
  const railIndex = rows.findIndex((r) => r.id === motive);
  const previousRow = railIndex > 0 ? rows[railIndex - 1] : null;
  const nextRow = nextWithPending(1);

  const applyDecision = (p: DiscrepancyPattern, moveFocus = true) => {
    onDecided(p);
    setJustDecided((s) => new Set(s).add(p.id));
    setAnnounce(`${p.isObservation ? "Observación" : "Patrón"} del motivo ${p.criterionId}: ${statusLabel(p)}`);
    if (!moveFocus || isPending(p)) return;
    const order = navigable.map((x) => x.id);
    const next = navigable.slice(order.indexOf(p.id) + 1).find((x) => isPending(x) && x.id !== p.id) ?? navigable.find((x) => isPending(x) && x.id !== p.id);
    // Después de que el diálogo devuelve el foco a su botón.
    if (next) setTimeout(() => focusItem(next.id), 80);
  };

  const keys = useRef({ navigable, focused, readOnly, dialog, bulk, single: prefs.singleKeyShortcuts, motive });
  useEffect(() => {
    keys.current = { navigable, focused, readOnly, dialog, bulk, single: prefs.singleKeyShortcuts, motive };
  });
  const nextMotiveRef = useRef(nextWithPending);
  const openMotiveRef = useRef(openMotive);
  const focusItemRef = useRef(focusItem);
  useEffect(() => {
    nextMotiveRef.current = nextWithPending;
    openMotiveRef.current = openMotive;
    focusItemRef.current = focusItem;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = keys.current;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
      if (!s.single || ["input", "textarea", "select"].includes(tag)) return;
      if (s.dialog || s.bulk || document.querySelector("[role=dialog]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const index = s.navigable.findIndex((p) => p.id === s.focused);
      if (key === "j" || key === "k") {
        const next = s.navigable[key === "j" ? index + 1 : index <= 0 ? 0 : index - 1];
        if (next) {
          e.preventDefault();
          focusItemRef.current(next.id);
        }
      } else if ((key === "a" || key === "d") && index >= 0 && !s.readOnly && isPending(s.navigable[index])) {
        e.preventDefault();
        setDialog({ p: s.navigable[index], kind: key === "a" ? "accept" : "discard" });
      } else if (key === "m" && s.motive !== "all") {
        const row = nextMotiveRef.current(e.shiftKey ? -1 : 1);
        if (row) {
          e.preventDefault();
          openMotiveRef.current(row.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const causes = (Object.entries(CAUSE) as [DiscrepancyCause, string][]).filter(([k]) => patterns.some((p) => !p.isObservation && p.cause === k));
  const types = (Object.entries(PROPOSAL) as [ProposalType, string][]).filter(([k]) => patterns.some((p) => !p.isObservation && p.proposal?.type === k));
  const caps = a.capabilities;
  const lacking = caps
    ? [!caps.whoIsRight && "quién tiene más razón", !caps.expectedFix && "casos que corregiría", !caps.sideEffects && "posibles efectos", !caps.concentration && "concentración"].filter(
        (x): x is string => !!x,
      )
    : [];
  const filtered = narrowed || (motive === "all" && status !== "pending");
  const clearFilters = () => setParams({ cause: null, type: null, status: null, quad: null, action: null, right: null, page: null });
  const quietMotives = narrowed ? 0 : data.criteria.filter((c) => c.patterns != null && !patterns.some((p) => p.criterionId === c.criterionId)).length;

  const itemProps = (p: DiscrepancyPattern) => ({
    p,
    readOnly,
    onChange: applyDecision,
    onAsk: (kind: DecisionKind) => setDialog({ p, kind }),
    focused: focused === p.id,
    onFocus: () => setFocused(p.id),
  });

  const criterion = typeof motive === "number" ? data.criteria.find((c) => c.criterionId === motive) : undefined;
  const noPatternCases = criterion?.explained ? criterion.fp + criterion.fn - criterion.explained.fp - criterion.explained.fn : null;
  const motiveAnalyzed = typeof motive === "number" && a.doneCriteria.includes(motive);

  const motiveTitle =
    motive === "all" ? (listKind === "obs" ? "Observaciones" : "Patrones · ordenados por impacto") : motive == null ? "Patrones" : `Motivo ${motive}${criterion ? ` · ${criterion.name}` : ""}`;

  return (
    <div className="grid gap-3">
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {(data.stale || data.running) && (
        <p className="help m-0">
          {data.running ? `Analizando · ${data.running.doneCriteria.length} de ${data.running.criteria.length} motivos. ` : ""}
          {data.stale ? "Este análisis está desactualizado: los detalles están en Resumen." : ""}
        </p>
      )}
      {lacking.length > 0 && (
        <p className="help m-0" role="note">
          ⓘ Este análisis usó el prompt de análisis v{a.analysisPromptVersion}: no trae {lacking.slice(0, -1).join(", ")}
          {lacking.length > 1 ? " ni " : ""}
          {lacking[lacking.length - 1]}. Aparecen al correr un análisis nuevo.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Causa" allLabel="Todas" value={cause} options={causes} onChange={(v) => setParams({ cause: v, page: null })} />
        <FilterSelect label="Tipo" allLabel="Todos" value={type} options={types} onChange={(v) => setParams({ type: v, page: null })} />
        {motive === "all" && (
          <label className="flex items-center gap-1.5">
            <span className="help">Estado:</span>
            <select className="control" value={status} onChange={(e) => setParams({ status: e.target.value === "pending" ? null : e.target.value, page: null })}>
              <option value="pending">Pendientes</option>
              <option value="decided">Decididas</option>
              <option value="all">Todas</option>
            </select>
          </label>
        )}
        {quad && <FilterChip label={QUADRANT_LABEL[quad][0]} onRemove={() => setParams({ quad: null, page: null })} />}
        {action && <FilterChip label={ACTION_LABEL[action]} onRemove={() => setParams({ action: null, page: null })} />}
        {right && <FilterChip label={`Más razón: ${WHO_LABEL[right].toLowerCase()}`} onRemove={() => setParams({ right: null, page: null })} />}
        {filtered && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Quitar filtros
          </Button>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <CriterionRail rows={rows} motive={motive} ready={ready} quietMotives={quietMotives} onSelect={openMotive} />

        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <h2 id="patterns-title" ref={titleRef} tabIndex={-1} className="m-0 scroll-mt-4 text-lg font-semibold outline-none">
                {motiveTitle}
              </h2>
              {criterion && (
                <p className="help m-0">
                  {criterion.fp} solo la IA detectó · {criterion.fn} omitidos por la IA
                  {noPatternCases != null ? ` · ${plural(noPatternCases, "caso", "casos")} sin patrón` : ""} · <Link href="/admin/stats?tab=quality">Ver en Calidad de la IA →</Link>
                </p>
              )}
              {criterion?.summary && <p className="m-0 text-sm">{criterion.summary}</p>}
            </div>
            {typeof motive === "number" && <MotiveNav previous={previousRow} next={nextRow} onOpen={openMotive} short />}
          </div>

          {motive === "all" ? (
            <>
              <div className="seg w-fit" role="group" aria-label="Lista">
                <button type="button" aria-pressed={listKind === "patterns"} onClick={() => setParams({ kind: null, page: null })}>
                  Patrones ({patterns.filter((p) => !p.isObservation).length})
                </button>
                <button type="button" aria-pressed={listKind === "obs"} onClick={() => setParams({ kind: "obs", page: null })}>
                  Observaciones ({patterns.filter((p) => p.isObservation).length})
                </button>
              </div>
              {listKind === "patterns" && (
                <PriorityMap
                  patterns={patterns}
                  selected={quad}
                  onSelect={(q) => setParams({ quad: q, status: null, page: null })}
                  onPick={(p) => {
                    requestFocus(p.id);
                    setParams({ motivo: String(p.criterionId), page: null });
                  }}
                />
              )}
              <span className="sr-only" aria-live="polite">
                {list.length} {listKind === "obs" ? "observaciones" : "patrones"}
              </span>
              {listKind === "obs" && narrowed ? (
                <p className="help m-0">
                  Las observaciones no tienen causa, tipo ni prioridad, por eso estos filtros las ocultan.{" "}
                  <button type="button" className="underline" onClick={clearFilters}>
                    Quitar filtros
                  </button>
                </p>
              ) : list.length === 0 ? (
                <p className="help m-0">
                  {pool.length ? `Ningún ${listKind === "obs" ? "elemento" : "patrón"} con estos filtros.` : "La IA no encontró patrones: los desacuerdos parecen casos aislados."}
                  {filtered && (
                    <>
                      {" "}
                      <button type="button" className="underline" onClick={clearFilters}>
                        Quitar filtros
                      </button>
                    </>
                  )}
                </p>
              ) : listKind === "obs" ? (
                <div className="card grid gap-1">
                  {shown.map((p) => (
                    <ObservationRow key={p.id} {...itemProps(p)} withMotive />
                  ))}
                </div>
              ) : (
                shown.map((p) => <PatternCard key={p.id} {...itemProps(p)} />)
              )}
              <Pager
                label={listKind === "obs" ? "Observaciones" : "Patrones"}
                page={page}
                size={listSize}
                total={list.length}
                onChange={(next) => {
                  requestFocus("title");
                  setParams({ page: next === 1 ? null : String(next) });
                }}
              />
            </>
          ) : motive == null ? (
            <p className="help m-0">
              {narrowed ? "Ningún patrón con estos filtros." : "La IA no encontró patrones: los desacuerdos parecen casos aislados."}
              {narrowed && (
                <>
                  {" "}
                  <button type="button" className="underline" onClick={clearFilters}>
                    Quitar filtros
                  </button>
                </>
              )}
            </p>
          ) : !motiveAnalyzed && inMotive.length === 0 ? (
            <p className="help m-0">
              Este motivo no se analizó. <Link href="/admin/discrepancies?tab=summary">Ir a Resumen</Link>
            </p>
          ) : inMotive.length === 0 ? (
            narrowed ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="help m-0">Ningún patrón con estos filtros en el motivo {motive}.</p>
                <Button size="sm" onClick={clearFilters}>
                  Quitar filtros
                </Button>
                {nextRow && (
                  <Button size="sm" onClick={() => openMotive(nextRow.id)}>
                    Siguiente motivo
                  </Button>
                )}
              </div>
            ) : (
              <p className="help m-0">La IA no encontró un patrón: los desacuerdos parecen casos aislados.</p>
            )
          ) : (
            <>
              {pendingInMotive === 0 && justDecided.size > 0 && (
                <div className="banner" role="status">
                  <span>
                    {pendingTotal === 0 ? (
                      <>
                        Revisaste todos los motivos.{" "}
                        <button type="button" className="underline" onClick={() => setParams({ tab: "followup", analysis: null })}>
                          Ir a Seguimiento
                        </button>
                      </>
                    ) : (
                      `Motivo ${motive} listo.`
                    )}
                  </span>
                  {pendingTotal > 0 && nextRow && (
                    <Button size="sm" onClick={() => openMotive(nextRow.id)}>
                      Siguiente motivo
                    </Button>
                  )}
                </div>
              )}
              {cards.length > 0 && (
                <section className="grid gap-2" aria-label="Patrones por decidir">
                  <h3 className="m-0 text-base font-semibold">Patrones por decidir ({cards.filter(isPending).length})</h3>
                  <Paged key={`p-${motive}`} items={cards} label="Patrones">
                    {(page_) => page_.map((p) => <PatternCard key={p.id} {...itemProps(p)} />)}
                  </Paged>
                </section>
              )}
              {observations.length > 0 && (
                <section className="grid gap-2" aria-label="Observaciones por decidir">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 flex-1 text-base font-semibold">Observaciones por decidir ({pendingObservations.length})</h3>
                    {!readOnly && pendingObservations.length >= 2 && (
                      <Button size="sm" onClick={() => setBulk(true)}>
                        Descartar las {pendingObservations.length}
                      </Button>
                    )}
                  </div>
                  <p className="help m-0">Menos de 3 casos: alcanzan para calibrar con el auditor, no para cambiar el prompt.</p>
                  <div className="card grid gap-1">
                    <Paged key={`o-${motive}`} items={observations} label="Observaciones">
                      {(page_) => page_.map((p) => <ObservationRow key={p.id} {...itemProps(p)} />)}
                    </Paged>
                  </div>
                </section>
              )}
              {decidedItems.length > 0 && (
                <details className="card">
                  <summary className="cursor-pointer font-medium">Decididas ({decidedItems.length})</summary>
                  <div className="mt-2 grid gap-2">
                    {decidedItems.map((p) => (p.isObservation ? <ObservationRow key={p.id} {...itemProps(p)} /> : <PatternCard key={p.id} {...itemProps(p)} />))}
                  </div>
                </details>
              )}
              <MotiveNav previous={previousRow} next={nextRow} onOpen={openMotive} />
            </>
          )}
        </div>
      </div>

      {dialog && <DecisionDialog p={dialog.p} kind={dialog.kind} onClose={() => setDialog(null)} onDone={applyDecision} />}
      {bulk && (
        <BulkDiscardDialog
          items={pendingObservations}
          onClose={() => setBulk(false)}
          onDone={(done) => {
            done.forEach((p) => applyDecision(p, false));
            setAnnounce(`${plural(done.length, "observación descartada", "observaciones descartadas")} en el motivo ${motive}`);
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | null;
  options: [string, string][];
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="help">{label}:</span>
      <select className="control" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{allLabel}</option>
        {options.map(([k, text]) => (
          <option key={k} value={k}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip">
      {label}
      <button type="button" aria-label={`Quitar filtro ${label}`} onClick={onRemove}>
        <X size={13} aria-hidden />
      </button>
    </span>
  );
}

function railDetail(r: RailRow): string {
  if (pendingOf(r) === 0) return "Listo";
  const parts = [];
  if (r.pendingPatterns) parts.push(plural(r.pendingPatterns, "patrón", "patrones"));
  if (r.pendingObservations) parts.push(`${r.pendingObservations} obs.`);
  return parts.join(" · ");
}

function railLabel(r: RailRow): string {
  if (pendingOf(r) === 0) return `Motivo ${r.id}: listo`;
  const parts = [];
  if (r.pendingPatterns) parts.push(plural(r.pendingPatterns, "patrón", "patrones"));
  if (r.pendingObservations) parts.push(plural(r.pendingObservations, "observación", "observaciones"));
  return `Motivo ${r.id}: ${parts.join(" y ")} por decidir`;
}

function CriterionRail({
  rows,
  motive,
  ready,
  quietMotives,
  onSelect,
}: {
  rows: RailRow[];
  motive: number | "all" | null;
  ready: number;
  quietMotives: number;
  onSelect: (id: number | "all") => void;
}) {
  const progress = (
    <>
      <p className="m-0 text-sm font-medium" aria-live="polite">
        {ready} de {rows.length} motivos listos
      </p>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[var(--neutral-200,#e5e5e5)]">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${rows.length ? (100 * ready) / rows.length : 0}%` }} />
      </div>
    </>
  );
  return (
    <>
      <div className="grid gap-1.5 xl:hidden">
        {progress}
        <label className="field">
          <span>Motivo</span>
          <select className="control" value={String(motive ?? "")} onChange={(e) => onSelect(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Todos los motivos</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.name} ({railDetail(r)})
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav aria-label="Motivos" className="card sticky top-4 hidden max-h-[calc(100vh-2rem)] gap-2 overflow-y-auto xl:grid">
        <div className="grid gap-1.5">{progress}</div>
        <button
          type="button"
          aria-current={motive === "all" || undefined}
          onClick={() => onSelect("all")}
          className={`cursor-pointer rounded border-0 px-2 py-1.5 text-left font-medium hover:bg-[var(--neutral-100,#f4f4f4)] ${motive === "all" ? "bg-[var(--accent)]" : "bg-transparent"}`}
        >
          Todos los motivos
        </button>
        <ul className="m-0 grid list-none gap-0.5 border-t border-border p-0 pt-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-label={railLabel(r)}
                aria-current={motive === r.id || undefined}
                onClick={() => onSelect(r.id)}
                className={`grid w-full cursor-pointer rounded border-0 px-2 py-1.5 text-left hover:bg-[var(--neutral-100,#f4f4f4)] ${motive === r.id ? "bg-[var(--accent)]" : "bg-transparent"}`}
              >
                <span className="truncate text-sm">
                  {r.id} · {r.name}
                </span>
                <span className={`help ${pendingOf(r) === 0 ? "font-medium" : ""}`}>{railDetail(r)}</span>
              </button>
            </li>
          ))}
        </ul>
        {quietMotives > 0 && <p className="help m-0 border-t border-border pt-2">{plural(quietMotives, "motivo", "motivos")} sin patrones ni observaciones</p>}
      </nav>
    </>
  );
}

function MotiveNav({ previous, next, onOpen, short }: { previous: RailRow | null; next: RailRow | null; onOpen: (id: number) => void; short?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${short ? "" : "justify-between"}`}>
      <Button size="sm" disabled={!previous} onClick={() => previous && onOpen(previous.id)}>
        <ChevronLeft size={14} aria-hidden /> Anterior
      </Button>
      <Button size="sm" disabled={!next} onClick={() => next && onOpen(next.id)}>
        {next && !short ? `Siguiente motivo: ${next.id} · ${pendingOf(next)} por decidir` : "Siguiente motivo"} <ChevronRight size={14} aria-hidden />
      </Button>
    </div>
  );
}

/** Dentro de un motivo casi nunca hace falta paginar; si la lista supera el límite, aparece el paginador. */
function Paged({ items, label, children }: { items: DiscrepancyPattern[]; label: string; children: (page: DiscrepancyPattern[]) => React.ReactNode }) {
  const [page, setPage] = useState(1);
  const current = clampPage(page, items.length, MOTIVE_LIST_LIMIT);
  return (
    <>
      {children(items.slice((current - 1) * MOTIVE_LIST_LIMIT, current * MOTIVE_LIST_LIMIT))}
      <Pager label={label} page={current} size={MOTIVE_LIST_LIMIT} total={items.length} onChange={setPage} />
    </>
  );
}
