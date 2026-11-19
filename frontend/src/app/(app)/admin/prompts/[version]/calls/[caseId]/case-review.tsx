"use client";

import { ChevronLeft, ChevronRight, PanelRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CALL_STATUS_LONG,
  CAUSE,
  listTitle,
  OUTCOMES,
  VERDICT,
  VERDICT_CLASS,
  outcomeLabel,
} from "@/components/admin/verification-labels";
import { AudioPlayer } from "@/components/call/audio-player";
import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import { SuggestedReasons } from "@/components/call/suggested-reasons";
import { TypificationLine } from "@/components/call/typification";
import { CUSTOMER_CRITERIA, ProductSheetColumn, ProductSheetContent } from "@/components/call/product-sheet";
import { Transcript } from "@/components/call/transcript";
import { useAudio } from "@/components/call/use-audio";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { MetricHelp } from "@/components/ui/metric-help";
import { AsyncView } from "@/components/ui/states";
import { api, isRealMode } from "@/lib/api";
import type {
  CallList,
  CaseComparison,
  CaseComparisonCriterion,
  VerificationOutcome,
  VerificationScope,
} from "@/lib/api/admin-types";
import type { CaseDetail, Evidence, Finding, Rubric, Typification } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { mmss, shortDate, shortDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { loadRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";
import { scopeQuery } from "@/lib/verification-scope";

/** Nivel 3 · Caso: lo que dijo la IA de la versión probada frente a la planilla, y el registro (§5.3). */
export function CaseReviewView({
  version,
  caseId,
  segment,
  criterion,
  scope,
}: {
  version: string;
  caseId: string;
  segment: CallList | null;
  criterion: number | null;
  scope: VerificationScope;
}) {
  const state = useAsync(async () => {
    const [cmp, call, rubric] = await Promise.all([
      api.getCaseComparison(version, caseId, segment ?? undefined, criterion, scope),
      api.getCase(caseId),
      loadRubric(),
    ]);
    return { cmp, call, rubric };
  }, [version, caseId, segment, criterion, scope.source, scope.assignee]);
  return (
    <AsyncView state={state} what="la llamada">
      {({ cmp, call, rubric }) => (
        <CaseReview key={caseId} version={version} initial={cmp} call={call} rubric={rubric} scope={scope} />
      )}
    </AsyncView>
  );
}

/** Ficha abierta o plegada (07-ficha-en-caso.md, C2): se mantiene al pasar de caso, no al recargar la página. */
let sheetOpenMemory = true;

const TO_VERIFY = new Set(["fn", "fp", "undecided"]);
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (["input", "textarea", "select"].includes(el.tagName.toLowerCase()) || el.isContentEditable);
};

function CaseReview({
  version,
  initial,
  call,
  rubric,
  scope,
}: {
  version: string;
  initial: CaseComparison;
  call: CaseDetail;
  rubric: Rubric;
  scope: VerificationScope;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [cmp, setCmp] = useState(initial);
  const full = cmp.source === "full";
  const fullScope: VerificationScope = full ? { ...scope, source: "full" } : scope;
  // En la corrida completa decide el backend: el verificador registra solo en sus llamadas (13, V4 A).
  const canWrite = cmp.canRecord ?? user?.role === "qubico_admin";
  const isAdmin = user?.role === "qubico_admin";
  const isVerifier = user?.role === "qubico_verifier";
  const segment = cmp.listSegment;
  const base = `/admin/prompts/${encodeURIComponent(version)}/calls`;
  const motivo = cmp.listCriterion;
  const tail = `?segment=${segment}${motivo != null ? `&motivo=${motivo}` : ""}${scopeQuery(fullScope)}`;
  const listHref = `${base}${tail}`;
  const caseHref = (id: string) => `${base}/${encodeURIComponent(id)}${tail}`;

  const toVerify = cmp.criteria.filter((c) => TO_VERIFY.has(c.kind));
  const agreeing = cmp.criteria.filter((c) => !TO_VERIFY.has(c.kind));
  // Foco inicial: el criterio de la lista si sigue sin registrar (16-lista-verificador-por-motivo, L3 A); si no, el primero
  // sin registrar.
  const [focus, setFocus] = useState(() => {
    const unrecorded = (c: (typeof toVerify)[number]) => !c.verification || c.verification.stale;
    const listed = toVerify.findIndex((c) => c.criterionId === motivo && unrecorded(c));
    return listed >= 0 ? listed : Math.max(0, toVerify.findIndex(unrecorded));
  });
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [sheetOpen, setSheetOpenState] = useState(sheetOpenMemory);
  const setSheetOpen = (open: boolean) => {
    sheetOpenMemory = open;
    setSheetOpenState(open);
  };
  const [sheetDrawer, setSheetDrawer] = useState(false);
  const [shortcuts, setShortcuts] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  // Audio y transcripción de la llamada (los mismos del detalle de llamada, A6).
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const { unavailable } = useAudio({
    src: call.audioUrl,
    simulate: !isRealMode,
    durationMs: call.durationMs,
    playing,
    rate,
    currentMs,
    setCurrentMs,
    setPlaying,
  });
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const markers: Finding[] = useMemo(
    () =>
      toVerify
        .filter((c) => c.ai.evidence[0]?.startMs != null)
        .map((c) => {
          const e = c.ai.evidence[0];
          return {
            criterionId: c.criterionId,
            verdict: c.ai.verdict,
            confidence: 0,
            comment: c.ai.comment ?? "",
            evidence: { quote: e.quote, startMs: e.startMs ?? 0, endMs: (e.startMs ?? 0) + 5000, quoteValidated: e.quoteValidated ?? true },
          };
        }),
    [toVerify],
  );
  const listen = (quote: string, startMs: number | null) => {
    if (startMs == null) return;
    setEvidence({ quote, startMs, endMs: startMs + 5000, quoteValidated: true });
    setCurrentMs(startMs);
    setPlaying(true);
  };

  useEffect(() => headRef.current?.focus(), []);

  const fetchCmp = () => api.getCaseComparison(version, cmp.caseId, segment, motivo, fullScope);
  const reload = async () => setCmp(await fetchCmp());
  const source = full ? ("full" as const) : undefined;
  const [reviewBusy, setReviewBusy] = useState(false);
  const markReviewed = async (reviewed: boolean) => {
    setReviewBusy(true);
    try {
      await api.setReviewed(cmp.caseId, reviewed);
      await reload();
      if (reviewed) nextRef.current?.focus();
    } catch {
      toast.error("No pudimos guardar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setReviewBusy(false);
    }
  };
  const reassign = async (userId: string | null) => {
    try {
      await api.setAssignee(cmp.caseId, userId);
      await reload();
      toast(userId ? "Llamada reasignada." : "Llamada sin asignar.");
    } catch {
      toast.error("No se pudo reasignar la llamada.");
    }
  };

  const save = async (c: CaseComparisonCriterion, outcome: VerificationOutcome, note: string | null) => {
    if (!canWrite) return;
    const before = c.verification && !c.verification.stale ? c.verification : null;
    setBusy(c.criterionId);
    try {
      await api.saveVerification(cmp.caseId, c.criterionId, {
        outcome,
        note,
        version,
        seenFirst: revealed.has(c.criterionId),
        source,
      });
      const next = await fetchCmp();
      setCmp(next);
      const label = outcomeLabel(outcome, c.kind === "undecided");
      toast(`Guardado: ${label} en el criterio ${c.criterionId}.`, {
        action: {
          label: "Deshacer",
          onClick: () =>
            void (async () => {
              if (before)
                await api.saveVerification(cmp.caseId, c.criterionId, {
                  outcome: before.outcome,
                  note: before.note,
                  version,
                  seenFirst: before.seenFirst,
                  source,
                });
              else await api.deleteVerification(cmp.caseId, c.criterionId);
              await reload();
            })(),
        },
      });
      const remaining = next.criteria.filter((x) => TO_VERIFY.has(x.kind)).findIndex((x) => !x.verification || x.verification.stale);
      if (remaining >= 0) setFocus(remaining);
      else nextRef.current?.focus();
    } catch {
      toast.error("No pudimos guardar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const goNext = () => {
    // El verificador salta solo a sus pendientes (V3 A); sin más, vuelve a la lista.
    const id = cmp.position.nextPendingCaseId ?? (isVerifier ? null : cmp.position.nextCaseId);
    if (id) router.push(caseHref(id));
    else {
      toast(isVerifier ? "No te quedan llamadas pendientes en esta lista." : "Revisaste todas las llamadas de esta parte.");
      router.push(listHref);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcuts || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const c = toVerify[focus];
      if (canWrite && c && c.verification?.canChange !== false && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void save(c, OUTCOMES[Number(e.key) - 1], c.verification?.note ?? null);
      } else if (e.key === "j" || e.key === "J") setFocus((f) => Math.min(toVerify.length - 1, f + 1));
      else if (e.key === "k" || e.key === "K") setFocus((f) => Math.max(0, f - 1));
      else if (e.key === "n" || e.key === "N") goNext();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const p = cmp.position;
  // La sección de la ficha que importa sigue al criterio en foco (C3), como en la vista del auditor.
  const focusId = toVerify[focus]?.criterionId ?? null;
  const relevantSection =
    focusId == null ? undefined : CUSTOMER_CRITERIA.has(focusId) ? "customer" : rubric.criteria[focusId]?.productSheetSection;
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link href={listHref} className="btn btn-ghost btn-sm">
          <ChevronLeft size={14} aria-hidden /> Volver a la lista
        </Link>
        <h1 ref={headRef} tabIndex={-1} className="m-0 flex-1 text-base font-semibold outline-none">
          {listTitle(segment, motivo)} · llamada {p.index ?? "—"} de {p.total} <span className="help font-normal">(pendientes: {p.pending})</span>
        </h1>
        <Button size="sm" variant="ghost" className="2xl:hidden" onClick={() => setSheetDrawer(true)}>
          <PanelRight size={14} aria-hidden />
          Ficha del seguro
        </Button>
        <Button size="sm" variant="default" disabled={!p.prevCaseId} onClick={() => p.prevCaseId && router.push(caseHref(p.prevCaseId))}>
          <ChevronLeft size={14} aria-hidden /> Anterior
        </Button>
        <Button ref={nextRef} size="sm" variant="primary" onClick={goNext}>
          Siguiente <ChevronRight size={14} aria-hidden />
        </Button>
      </div>

      <section className="card mb-2.5 grid gap-1 text-sm">
        <p className="m-0">
          <b>Llamada {cmp.callId}</b> · {call.callDate ? shortDateTime(call.callDate) : cmp.callDate ? shortDate(cmp.callDate) : "—"} · Ejecutivo{" "}
          {call.agent.name} · {call.products.join(", ") || "sin seguro"} · {mmss(cmp.durationMs)} min
        </p>
        <TypificationLine t={call.typification} className="m-0 block" />
        <p className="help m-0">v{cmp.version} ({full ? "corrida completa" : "prueba de validación"})</p>
        {full && cmp.assignment && (
          <p className="m-0 flex flex-wrap items-center gap-2">
            {isAdmin && cmp.verifiers ? (
              <label className="flex items-center gap-1.5">
                Asignada a:
                <select className="control" value={cmp.assignment.assigneeId ?? ""} onChange={(e) => void reassign(e.target.value || null)}>
                  <option value="">Sin asignar</option>
                  {cmp.verifiers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>Asignada a: {cmp.assignment.mine ? "ti" : (cmp.assignment.assigneeName ?? "nadie")}</span>
            )}
          </p>
        )}
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            IA v{cmp.version}: <span className={VERDICT_CLASS[cmp.aiVerdict]}>{VERDICT[cmp.aiVerdict]}</span>
          </span>
          <span>
            Planilla: <span className={VERDICT_CLASS[cmp.reviewer.verdict]}>{VERDICT[cmp.reviewer.verdict]}</span>
          </span>
          {cmp.reviewer.evaluator && <span>Evaluador de la planilla: {cmp.reviewer.evaluator}</span>}
        </p>
        <p className="m-0">
          {cmp.reviewer.comment ? <>Comentario de la planilla: «{cmp.reviewer.comment}»</> : <span className="help">La planilla no trae comentario.</span>}
        </p>
        <p className="m-0" aria-live="polite">
          Estado de la llamada: <b>{CALL_STATUS_LONG[cmp.verification]}</b>
        </p>
      </section>

      {full && !canWrite && isVerifier && (
        <div className="banner mb-2.5" role="status">
          {cmp.assignment?.assigneeName
            ? `Esta llamada está asignada a ${cmp.assignment.assigneeName}. Puedes verla, pero no registrar.`
            : "Esta llamada no está asignada a ti."}
        </div>
      )}

      {!cmp.findingsAvailable && (
        <div className="banner mb-2.5">Esta prueba no guardó los comentarios ni las citas de la IA. Se muestran solo los veredictos por criterio.</div>
      )}

      <AudioPlayer
        durationMs={call.durationMs}
        currentMs={currentMs}
        playing={playing}
        rate={rate}
        markers={markers}
        focusId={toVerify[focus]?.criterionId ?? null}
        unavailable={unavailable}
        onTogglePlay={() => setPlaying((x) => !x)}
        onSeek={setCurrentMs}
        onRate={setRate}
        onMarker={(cid) => {
          const i = toVerify.findIndex((c) => c.criterionId === cid);
          if (i >= 0) setFocus(i);
          const m = markers.find((x) => x.criterionId === cid);
          if (m?.evidence) listen(m.evidence.quote, m.evidence.startMs);
        }}
      />

      {/* Ficha del seguro como en la vista del auditor (07-ficha-en-caso.md, C1): tercera columna desde 1536 px: a 1280 las tarjetas por verificar no caben (H-24). */}
      <div
        className={cn(
          "grid items-start gap-3 lg:grid-cols-[4fr_3.5fr]",
          sheetOpen ? "2xl:grid-cols-[4fr_3.5fr_2.5fr]" : "2xl:grid-cols-[4fr_3.5fr_44px]",
        )}
      >
        <Transcript turns={call.transcript} currentMs={currentMs} evidence={evidence} badTurns={[]} readOnly onSeek={setCurrentMs} onMarkBad={() => {}} />
        <div className="grid gap-2.5">
          <section className="card grid gap-3" aria-labelledby="verify-h">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="verify-h" className="m-0 flex-1 text-sm font-semibold">
                Por verificar ({toVerify.length})
              </h2>
              <label className="help flex items-center gap-1.5">
                <input type="checkbox" checked={shortcuts} onChange={(e) => setShortcuts(e.target.checked)} />
                Atajos (1-4, J/K, N)
              </label>
            </div>
            {toVerify.length === 0 &&
              (full && cmp.assignment?.assigneeId ? (
                cmp.assignment.reviewedAt ? (
                  <p className="m-0 flex flex-wrap items-center gap-2">
                    <span>
                      Revisada sin observaciones por {cmp.assignment.reviewedBy ?? "—"} el {shortDateTime(cmp.assignment.reviewedAt)}.
                    </span>
                    {canWrite && (isAdmin || cmp.assignment.mine) && (
                      <Button size="sm" variant="ghost" disabled={reviewBusy} onClick={() => void markReviewed(false)}>
                        Deshacer
                      </Button>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="help m-0">La IA y la planilla coinciden en todos los criterios. Si estás de acuerdo, márcala sin observaciones.</p>
                    {canWrite && (
                      <Button variant="primary" className="justify-self-start" disabled={reviewBusy} onClick={() => void markReviewed(true)}>
                        Sin observaciones
                      </Button>
                    )}
                  </>
                )
              ) : (
                <p className="help m-0">Esta llamada no tiene criterios en desacuerdo con la planilla.</p>
              ))}
            {toVerify.map((c, i) => (
              <CriterionCard
                typification={call.typification}
                key={c.criterionId}
                c={c}
                version={cmp.version}
                focused={i === focus}
                filtered={c.criterionId === motivo}
                canWrite={canWrite && c.verification?.canChange !== false}
                busy={busy === c.criterionId}
                revealed={revealed.has(c.criterionId)}
                onFocus={() => setFocus(i)}
                onReveal={() => setRevealed((r) => new Set(r).add(c.criterionId))}
                onSave={(o, note) => void save(c, o, note)}
                onListen={listen}
              />
            ))}
          </section>
          {agreeing.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold">Coinciden con la planilla ({agreeing.length} criterios)</summary>
              <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-[13px]">
                {agreeing.map((c) => (
                  <li key={c.criterionId}>
                    Criterio {c.criterionId} · {c.description} · IA <span className={VERDICT_CLASS[c.ai.verdict]}>{VERDICT[c.ai.verdict]}</span>
                    {c.verification && <span className="help"> · verificado: {outcomeLabel(c.verification.outcome, false)}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="hidden 2xl:block">
          {sheetOpen ? (
            <ProductSheetColumn
              sheets={call.productSheets}
              customer={call.customer}
              relevant={relevantSection}
              criterionId={focusId}
              onCollapse={() => setSheetOpen(false)}
            />
          ) : (
            <button type="button" className="col btn w-full justify-center [writing-mode:vertical-rl]" onClick={() => setSheetOpen(true)}>
              Ficha del seguro
            </button>
          )}
        </div>
      </div>
      <Sheet open={sheetDrawer} onOpenChange={setSheetDrawer} title="Ficha del seguro">
        <ProductSheetContent sheets={call.productSheets} customer={call.customer} relevant={relevantSection} criterionId={focusId} />
      </Sheet>
    </>
  );
}

function CriterionCard({
  c,
  version,
  focused,
  filtered,
  canWrite,
  busy,
  revealed,
  onFocus,
  onReveal,
  onSave,
  onListen,
  typification,
}: {
  c: CaseComparisonCriterion;
  typification: Typification | null | undefined;
  version: string;
  focused: boolean;
  /** Es el criterio con que se filtró la lista (16-lista-verificador-por-motivo, L3 A). */
  filtered: boolean;
  canWrite: boolean;
  busy: boolean;
  revealed: boolean;
  onFocus: () => void;
  onReveal: () => void;
  onSave: (outcome: VerificationOutcome, note: string | null) => void;
  onListen: (quote: string, startMs: number | null) => void;
}) {
  const v = c.verification;
  const current = v && !v.stale ? v.outcome : null;
  const undecided = c.kind === "undecided";
  const [noteOpen, setNoteOpen] = useState(!!v?.note);
  const [note, setNote] = useState(v?.note ?? "");
  const showExplanation = revealed || current != null;
  const groupLabel = `¿Quién tenía razón? Criterio ${c.criterionId}`;
  return (
    <article
      className={cn("grid gap-1.5 rounded-md border border-border p-3 text-[13px]", focused && "border-primary shadow-[inset_3px_0_0_var(--primary)]")}
      onClick={onFocus}
      aria-current={focused ? "true" : undefined}
    >
      <h3 className="m-0 text-sm font-semibold">
        Criterio {c.criterionId}
        {c.blue && <span className="help font-normal"> · posible error del revisor</span>}
        {filtered && <span className="chip ml-2 align-middle text-xs">Criterio filtrado</span>}
      </h3>
      <p className="help m-0">Criterio: {c.description}</p>
      <p className="m-0">
        IA v{version}: <span className={VERDICT_CLASS[c.ai.verdict]}>{VERDICT[c.ai.verdict]}</span>
      </p>
      {c.ai.evidence.length === 0 ? (
        <p className="help m-0">La IA no dejó cita para este criterio.</p>
      ) : (
        c.ai.evidence.map((e, i) => (
          <p key={i} className="quote m-0">
            «{e.quote}»{" "}
            {e.startMs != null && (
              <button type="button" className="underline" onClick={() => onListen(e.quote, e.startMs)}>
                Escuchar desde {mmss(e.startMs)}
              </button>
            )}
          </p>
        ))
      )}
      <SuggestedReasons reasons={c.ai.suggestedReasons} plainQuotes />
      <RenunciationReasonsButton
        criterionId={c.criterionId}
        variant="text"
        className="justify-self-start"
        call={{ typification, verdict: c.ai.verdict, suggestedReasons: c.ai.suggestedReasons }}
      />
      {c.ai.comment && <p className="m-0">Comentario de la IA: «{c.ai.comment}»</p>}
      <p className="m-0">
        Planilla: <span className={c.reviewerFail ? "vt vt-fail" : "vt vt-pass"}>{c.reviewerFail ? "No cumple" : "Cumple"}</span>
      </p>

      {v?.stale && <p className="m-0 font-semibold">La planilla cambió después de esta verificación. Revísala de nuevo.</p>}

      {canWrite ? (
        <>
          <div className="flex items-center gap-1.5">
            <span id={`q-${c.criterionId}`} className="font-semibold">
              ¿Quién tenía razón?
            </span>
            <MetricHelp title="Salidas">
              Ambiguo: la pauta admite las dos lecturas.
              <br />
              Falta información: con la llamada no se puede decidir (por ejemplo, el dato está en SAP y no en la grabación).
            </MetricHelp>
          </div>
          <div className="seg grid grid-cols-2 [&>button]:justify-start [&>button:nth-child(-n+2)]:border-b [&>button:nth-child(-n+2)]:border-b-[var(--input)] [&>button:nth-child(2n)]:border-r-0" role="radiogroup" aria-label={groupLabel}>
            {OUTCOMES.map((o, i) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={current === o}
                disabled={busy}
                onClick={() => onSave(o, note.trim() || null)}
              >
                <span className="kbd mr-1" aria-hidden>
                  {i + 1}
                </span>
                {outcomeLabel(o, undecided)}
              </button>
            ))}
          </div>
          {noteOpen ? (
            <label className="grid gap-1">
              Nota (opcional)
              <textarea className="control min-h-[56px]" value={note} onChange={(e) => setNote(e.target.value)} />
              {current && note.trim() !== (v?.note ?? "") && (
                <Button size="sm" variant="default" className="justify-self-start" onClick={() => onSave(current, note.trim() || null)}>
                  Guardar nota
                </Button>
              )}
            </label>
          ) : (
            <button type="button" className="justify-self-start underline" onClick={() => setNoteOpen(true)}>
              + Agregar nota
            </button>
          )}
        </>
      ) : (
        <p className="m-0">
          {v ? (
            <>
              Verificado por {v.by}
              {v.at ? ` el ${shortDateTime(v.at)}` : ""}: <b>{outcomeLabel(v.outcome, undecided)}</b>.{v.note ? ` Nota: «${v.note}»` : ""}
            </>
          ) : (
            "Sin verificar."
          )}
        </p>
      )}
      {v && canWrite && (
        <p className="help m-0">
          Registrado por {v.by}
          {v.at ? ` el ${shortDateTime(v.at)}` : ""}
          {v.versionAt !== version ? ` desde v${v.versionAt}` : ""}
          {v.seenFirst ? " · con la explicación a la vista" : ""}
        </p>
      )}

      {TO_VERIFY.has(c.kind) &&
        (showExplanation ? (
          c.analysis ? (
            <p className="m-0 rounded bg-muted p-2">
              Según la IA de análisis: <b>{c.analysis.title}</b>. {c.analysis.explanation} <span className="help">Causa: {CAUSE[c.analysis.cause] ?? c.analysis.cause}</span>
            </p>
          ) : (
            <p className="help m-0">La IA de análisis no agrupó este desacuerdo en un patrón.</p>
          )
        ) : (
          <p className="help m-0">
            Explicación de la IA de análisis: se muestra al registrar, para no influir en tu decisión.{" "}
            {canWrite ? (
              <button type="button" className="underline" onClick={onReveal}>
                Mostrar explicación ahora
              </button>
            ) : (
              <button type="button" className="underline" onClick={onReveal}>
                Mostrar explicación
              </button>
            )}
          </p>
        ))}
    </article>
  );
}
