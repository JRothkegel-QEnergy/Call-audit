"use client";

import { Bot, ChevronLeft, Cloud, Info, PanelRight, StickyNote } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/call/audio-player";
import { EscalateDialog, OverrideDialog, ReopenDialog } from "@/components/call/call-dialogs";
import { ModelPanel } from "@/components/call/model-panel";
import { NoteEditor, NoteList } from "@/components/call/notes";
import { ProductSheetColumn, ProductSheetContent } from "@/components/call/product-sheet";
import { RubricChecklist } from "@/components/call/rubric-checklist";
import { Transcript } from "@/components/call/transcript";
import {
  type AddedFinding,
  type DetailMode,
  type ItemWork,
  actionableOrder,
  buildReviewItems,
  finalVerdictOf,
  findingFor,
  pendingUncertain,
} from "@/components/call/work";
import { useNavCounts } from "@/components/shell/nav-counts";
import { CallVerdictBadge, SourceBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { CallVerdict, CaseDetail, Note, Rubric } from "@/lib/api/types";
import { durationText, shortDateTime } from "@/lib/format";
import { usePreferences } from "@/lib/preferences";
import { loadRubric } from "@/lib/rubric";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { caseStatusLabel } from "@/lib/verdicts";

const BACK: Record<string, [string, string]> = {
  queue: ["/queue", "Cola"],
  reviews: ["/reviews", "Revisiones"],
  alerts: ["/alerts", "Alertas"],
  "my-reviews": ["/my-reviews", "Mis revisiones"],
  agents: ["/agents", "Ejecutivos"],
  discrepancies: ["/discrepancies", "Discrepancias"],
};

const nowMs = () => Date.now();
const secondsSince = (start: number) => Math.round((Date.now() - start) / 1000);

function scrollToItem(criterionId: number) {
  requestAnimationFrame(() => {
    const el = document.getElementById(`item-${criterionId}`);
    const col = el?.closest(".col");
    if (el && col) col.scrollTop += el.getBoundingClientRect().top - col.getBoundingClientRect().top - 56;
    const rel = document.querySelector<HTMLElement>("[data-relevant]");
    const col2 = rel?.closest(".col");
    if (rel && col2) col2.scrollTop += rel.getBoundingClientRect().top - col2.getBoundingClientRect().top - 90;
  });
}

export function CallDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const loaded = useAsync(async () => {
    const [rubric, data] = await Promise.all([loadRubric(), api.getCase(id)]);
    return { rubric, data };
  }, [id]);

  if (loaded.status === "error") return <ErrorState what="el caso" onRetry={() => void loaded.reload()} />;
  if (!loaded.data || loaded.status === "loading") return <LoadingState />;
  return (
    <CallWorkspace
      key={id}
      rubric={loaded.data.rubric}
      data={loaded.data.data}
      from={params.get("from") ?? undefined}
      startAtMs={params.get("t") ? Number(params.get("t")) : undefined}
    />
  );
}

function CallWorkspace({ rubric, data, from, startAtMs }: { rubric: Rubric; data: CaseDetail; from?: string; startAtMs?: number }) {
  const router = useRouter();
  const { user } = useSession();
  const { prefs } = usePreferences();
  const { refresh } = useNavCounts();
  const role = user!.role;

  const mode: DetailMode = useMemo(() => {
    if (role === "supervisor") return data.status === "awaiting_approval" ? "supervisor" : "readonly";
    const lockedByOther = data.lockedBy && data.lockedBy.id !== user!.id;
    if (lockedByOther) return "readonly";
    if (["pending", "in_review", "reopened"].includes(data.status)) return "auditor";
    if (data.status === "awaiting_approval" && data.review?.auditorId === user!.id) return "auditor";
    return "readonly";
  }, [role, data, user]);

  const order = useMemo(() => actionableOrder(rubric, data.findings), [rubric, data.findings]);

  // ---- Estado de la revisión ----
  const [work, setWork] = useState<Record<number, ItemWork>>(() => {
    // Si el auditor edita una revisión ya enviada, se precarga lo que decidió.
    if (mode !== "auditor" || !data.review) return {};
    return Object.fromEntries(
      data.review.items
        .filter((i) => i.action === "confirmed" || i.action === "corrected")
        .map((i) => [
          i.criterionId,
          i.action === "confirmed"
            ? { choice: "confirm", done: true }
            : { choice: i.verdict === "non_compliant" ? "non_compliant" : "compliant", done: true, correctionReason: i.correctionReason, comment: i.comment },
        ]),
    ) as Record<number, ItemWork>;
  });
  const [added, setAdded] = useState<AddedFinding[]>([]);
  const [badTurns, setBadTurns] = useState<number[]>(data.review?.badTranscriptTurns ?? []);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = nowMs();
  }, []);

  // ---- Foco y audio: el caso abre en el primer hallazgo que pide acción, 4–5 s antes de la cita ----
  const firstFocus = order[0] ?? null;
  const [focusId, setFocusId] = useState<number | null>(firstFocus);
  const firstEvidence = firstFocus != null ? findingFor(data.findings, firstFocus).evidence : null;
  const [currentMs, setCurrentMs] = useState(startAtMs ?? Math.max(0, (firstEvidence?.startMs ?? 0) - 5000));
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(prefs.playbackRate);
  const [onlyActionable, setOnlyActionable] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetDrawer, setSheetDrawer] = useState(false);
  const [dialog, setDialog] = useState<null | "escalate" | "reopen" | "override">(null);
  const [modelOpen, setModelOpen] = useState(false);
  // Notas por caso y por motivo (Cambio 09 §3.3): se pueden dejar en cualquier modo.
  const [notes, setNotes] = useState<Note[]>(data.notes);
  const [noteOpenFor, setNoteOpenFor] = useState<number | null>(null);
  const [caseNoteOpen, setCaseNoteOpen] = useState(false);
  const canSeeModel = role === "supervisor" || user!.permissions.includes("view_model_io");
  const run = data.modelRuns[0];
  const [saving, setSaving] = useState(false);

  // Supervisor: modo edición de la decisión (C-08)
  const [editing, setEditing] = useState(false);
  const auditorVerdicts = useMemo(
    () => Object.fromEntries((data.review?.items ?? []).map((i) => [i.criterionId, i.verdict === "non_compliant" ? "non_compliant" : "compliant"])) as Record<number, "compliant" | "non_compliant">,
    [data.review],
  );
  const [supEdit, setSupEdit] = useState<Record<number, "compliant" | "non_compliant">>(auditorVerdicts);

  // Reloj simulado del audio (la demo no tiene archivo de audio).
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setCurrentMs((ms) => {
        const next = ms + 250 * rate;
        if (next >= data.durationMs) {
          setPlaying(false);
          return data.durationMs;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [playing, rate, data.durationMs]);

  const touch = () => setSavedAt(Date.now());

  const editNote = async (noteId: string, text: string) => {
    const updated = await api.editNote(noteId, text);
    setNotes((list) => list.map((n) => (n.id === noteId ? updated : n)));
    toast("Nota actualizada.");
  };

  const focusItem = useCallback(
    (criterionId: number | null | undefined) => {
      if (criterionId == null) return;
      setFocusId(criterionId);
      const ev = findingFor(data.findings, criterionId).evidence;
      if (ev) setCurrentMs(Math.max(0, ev.startMs - 4000));
      scrollToItem(criterionId);
    },
    [data.findings],
  );

  // Al abrir el caso, las columnas se desplazan al hallazgo en foco y a la sección relevante de la ficha.
  useEffect(() => {
    if (firstFocus != null) scrollToItem(firstFocus);
  }, [firstFocus]);

  // ---- Derivados ----
  const pending = mode === "auditor" ? pendingUncertain(data.findings, work) : 0;
  const resultVerdict: CallVerdict = useMemo(() => {
    const all = rubric.blocks.flatMap((b) => b.criterionIds).map((cid) => finalVerdictOf(findingFor(data.findings, cid), work[cid], added));
    if (all.includes("non_compliant")) return "non_compliant";
    if (pending) return "uncertain";
    return "compliant";
  }, [rubric, data.findings, work, added, pending]);

  const relevantSection = focusId != null ? rubric.criteria[focusId]?.productSheetSection : undefined;
  const focusEvidence = focusId != null ? findingFor(data.findings, focusId).evidence : null;
  const markers = data.findings.filter((f) => f.verdict !== "compliant" && f.verdict !== "not_applicable");
  const back = BACK[from ?? ""] ?? (role === "supervisor" ? BACK.reviews : BACK.queue);

  // ---- Acciones del auditor ----
  const goNext = async (message: string) => {
    try {
      const next = await api.takeNextCase();
      refresh();
      if (next) {
        toast(`${message} Abriendo el siguiente.`);
        router.push(`/calls/${next}?from=queue`);
      } else {
        toast(message);
        router.push("/queue");
      }
    } catch {
      toast(message);
      router.push("/queue");
    }
  };

  const save = async () => {
    if (pending || saving || mode !== "auditor") return;
    setSaving(true);
    try {
      await api.submitReview(data.id, {
        items: buildReviewItems(rubric, data.findings, work, added),
        badTranscriptTurns: badTurns,
        reviewSeconds: secondsSince(startedAt.current),
      });
      await goNext("Caso enviado a aprobación.");
    } catch {
      toast("No pudimos guardar el caso. Tus cambios siguen aquí.", { action: { label: "Reintentar", onClick: () => void save() } });
    } finally {
      setSaving(false);
    }
  };

  const choose = (criterionId: number, choice: ItemWork["choice"]) => {
    setFocusId(criterionId);
    setWork((w) => ({ ...w, [criterionId]: { choice, done: choice === "confirm" } }));
    touch();
  };

  // ---- Acciones del supervisor ----
  const approveAndNext = async () => {
    try {
      await api.approveReviews([data.id], { batch: false });
      const rest = (await api.listPendingApprovals()).filter((a) => a.flags.length > 0 && a.caseId !== data.id);
      refresh();
      if (rest[0]) {
        toast("Revisión aprobada. Abriendo la siguiente con señales.");
        router.push(`/calls/${rest[0].caseId}?from=reviews`);
      } else {
        toast("Revisión aprobada.");
        router.push("/reviews");
      }
    } catch {
      toast("No pudimos aprobar la revisión. Intenta de nuevo.");
    }
  };

  // ---- Atajos (05 §2; desactivables en Preferencias, WCAG 2.1.4) ----
  const stateRef = useRef({ focusId, order, work, data, mode, pending, editing, dialog, sheetDrawer, modelOpen, noteOpenFor });
  useEffect(() => {
    stateRef.current = { focusId, order, work, data, mode, pending, editing, dialog, sheetDrawer, modelOpen, noteOpenFor };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
      if (["input", "textarea", "select"].includes(tag)) return;
      if (s.dialog || s.sheetDrawer || s.modelOpen || s.noteOpenFor != null || document.querySelector("[role=dialog]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const single = prefs.singleKeyShortcuts;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (s.mode === "supervisor" && key === "a" && single && !s.editing) {
        e.preventDefault();
        void approveAndNext();
        return;
      }
      const i = s.focusId != null ? s.order.indexOf(s.focusId) : -1;
      if ((key === "j" && single) || key === "ArrowDown") {
        if (!s.order.length) return;
        e.preventDefault();
        focusItem(s.order[Math.min(s.order.length - 1, i + 1)]);
      } else if ((key === "k" && single) || key === "ArrowUp") {
        if (!s.order.length) return;
        e.preventDefault();
        focusItem(s.order[Math.max(0, i - 1)]);
      } else if (key === " " && single) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (key === "ArrowLeft") {
        setCurrentMs((ms) => Math.max(0, ms - 5000));
      } else if (key === "ArrowRight") {
        setCurrentMs((ms) => Math.min(s.data.durationMs, ms + 5000));
      } else if (s.mode === "auditor" && key === "c" && single && s.focusId != null) {
        if (findingFor(s.data.findings, s.focusId).verdict !== "uncertain") choose(s.focusId, "confirm");
      } else if (s.mode === "auditor" && key === "x" && single && s.focusId != null) {
        // C-03: lleva el foco al control de veredicto sin preseleccionar.
        document.querySelector<HTMLButtonElement>(`#seg-${s.focusId} button:not([data-choice="confirm"])`)?.focus();
      } else if (key === "n" && single && s.focusId != null) {
        e.preventDefault();
        setNoteOpenFor(s.focusId);
      } else if (s.mode === "auditor" && key === "e" && single) {
        setDialog("escalate");
      } else if (s.mode === "auditor" && key === "Enter" && e.target === document.body && !s.pending) {
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Las acciones leen el estado actual desde stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.singleKeyShortcuts, focusItem]);

  // ---- Render ----
  const statusText = caseStatusLabel(data.status, role, {
    lockedByMe: data.lockedBy?.id === user!.id,
    lockedByName: data.lockedBy?.name ?? data.review?.auditorName,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => router.push(back[0])}>
          <ChevronLeft size={14} aria-hidden />
          Volver a {back[1]}
        </Button>
        <h1 className="m-0 text-lg font-semibold leading-6 tabular">Llamada {data.callId}</h1>
        <span className="text-[13px] text-muted-foreground">
          {shortDateTime(data.callDate)} · Ejecutivo {data.agent.name} · {data.products.join(", ")}
        </span>
        <span className="text-[13px] text-muted-foreground">Decisión del motor</span>
        <CallVerdictBadge verdict={data.engineVerdict} />
        <StatusBadge tone={mode === "supervisor" ? "teal" : "neutral"} locked={mode === "readonly" && data.status === "in_review"}>
          {mode === "supervisor" && data.review ? `Por aprobar · ${data.review.auditorName}` : statusText}
        </StatusBadge>
        <Button variant="ghost" className="ml-auto xl:hidden" onClick={() => setSheetDrawer(true)}>
          <PanelRight size={14} aria-hidden />
          Ficha del seguro
        </Button>
        {canSeeModel && run && (
          <Button variant="ghost" className="xl:ml-auto" onClick={() => setModelOpen(true)}>
            <Bot size={14} aria-hidden />
            Modelo {run.model} · Prompt v{run.promptVersion}
          </Button>
        )}
      </div>

      {/* Veredicto del cliente: solo llega al supervisor (D-24) y solo si vino en la metadata (D-25). */}
      {role === "supervisor" && data.externalQualityVerdict && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Cliente:</span>
          <CallVerdictBadge verdict={data.externalQualityVerdict} />
          <SourceBadge source="client" />
          {data.externalComment && (
            <details className="ml-1">
              <summary className="cursor-pointer text-accent-foreground">Comentario del cliente</summary>
              <p className="m-0 mt-1 max-w-[720px] rounded-md border border-border bg-card px-2.5 py-1.5">«{data.externalComment}»</p>
            </details>
          )}
        </div>
      )}

      <div className="banner my-2.5" role="note">
        <Info size={14} aria-hidden />
        <span>Hallazgos generados por IA, pendientes de revisión humana. No constituyen una sanción.</span>
      </div>

      {mode === "readonly" && role === "auditor" && data.lockedBy && data.lockedBy.id !== user!.id && (
        <div className="banner mb-2.5" role="status" style={{ borderLeftColor: "var(--amber-600)" }}>
          <span>
            <b>Lo está revisando {data.lockedBy.name}.</b> Lo ves en solo lectura.
          </span>
        </div>
      )}

      <AudioPlayer
        durationMs={data.durationMs}
        currentMs={currentMs}
        playing={playing}
        rate={rate}
        markers={markers}
        focusId={focusId}
        unavailable={false}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSeek={setCurrentMs}
        onRate={setRate}
        onMarker={focusItem}
      />

      {/* Bajo 1280 px la ficha pasa a un panel lateral (05 §1.1). */}
      <div
        className={cn(
          "grid grid-cols-[4fr_3.5fr] items-start gap-3",
          sheetOpen ? "xl:grid-cols-[4fr_3.5fr_2.5fr]" : "xl:grid-cols-[4fr_3.5fr_44px]",
        )}
      >
        <Transcript
          turns={data.transcript}
          currentMs={currentMs}
          evidence={focusEvidence}
          badTurns={badTurns}
          readOnly={mode !== "auditor"}
          onSeek={setCurrentMs}
          onMarkBad={(idx) => {
            setBadTurns((b) => (b.includes(idx) ? b : [...b, idx]));
            touch();
          }}
        />
        <RubricChecklist
          rubric={rubric}
          findings={data.findings}
          mode={mode}
          work={work}
          added={added}
          focusId={focusId}
          currentMs={currentMs}
          onlyActionable={onlyActionable}
          auditorItems={mode !== "auditor" ? data.review?.items : undefined}
          externalItemVerdicts={role === "supervisor" ? data.externalItemVerdicts : null}
          notes={notes}
          currentUserId={user!.id}
          noteOpenFor={noteOpenFor}
          onNoteOpen={(cid) => {
            setNoteOpenFor(cid);
            if (cid != null) setFocusId(cid);
          }}
          onAddNote={async (cid, text) => {
            const n = await api.addNote(data.id, { scope: "finding", criterionId: cid, text });
            setNotes((list) => [...list, n]);
            toast("Nota guardada.");
          }}
          onEditNote={editNote}
          editing={editing}
          supervisorEdit={supEdit}
          onSupervisorEdit={(cid, v) => setSupEdit((s) => ({ ...s, [cid]: v }))}
          onOnlyActionable={setOnlyActionable}
          onFocus={focusItem}
          onChoose={choose}
          onCorrection={(cid, reason, comment) => {
            setWork((w) => ({ ...w, [cid]: { ...w[cid], done: true, correctionReason: reason, comment } }));
            touch();
          }}
          onCancelCorrection={(cid) =>
            setWork((w) => {
              const next = { ...w };
              delete next[cid];
              return next;
            })
          }
          onUndo={(cid) => {
            setWork((w) => {
              const next = { ...w };
              delete next[cid];
              return next;
            });
            touch();
          }}
          onAdd={(a) => {
            setAdded((list) => [...list.filter((x) => x.criterionId !== a.criterionId), a]);
            setFocusId(a.criterionId);
            touch();
            toast(`Hallazgo agregado en el minuto ${String(Math.floor(a.atMs / 60000)).padStart(2, "0")}:${String(Math.floor((a.atMs % 60000) / 1000)).padStart(2, "0")}.`);
          }}
        />
        <div className="hidden xl:block">
          {sheetOpen ? (
            <ProductSheetColumn sheets={data.productSheets} relevant={relevantSection} criterionId={focusId} onCollapse={() => setSheetOpen(false)} />
          ) : (
            <button
              type="button"
              className="col btn w-full justify-center [writing-mode:vertical-rl]"
              onClick={() => setSheetOpen(true)}
            >
              Ficha del seguro
            </button>
          )}
        </div>
      </div>

      <section className="card mt-3" aria-label="Notas del caso">
        <div className="flex items-center gap-2">
          <StickyNote size={16} aria-hidden />
          <b>Notas del caso</b>
          {!caseNoteOpen && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCaseNoteOpen(true)}>
              Agregar nota
            </Button>
          )}
        </div>
        {notes.filter((n) => n.scope === "case").length === 0 && !caseNoteOpen && <p className="help mb-0 mt-1">Aún no hay notas en este caso.</p>}
        <NoteList notes={notes.filter((n) => n.scope === "case")} currentUserId={user!.id} onEdit={editNote} />
        {caseNoteOpen && (
          <NoteEditor
            onCancel={() => setCaseNoteOpen(false)}
            onSave={async (text) => {
              const n = await api.addNote(data.id, { scope: "case", criterionId: null, text });
              setNotes((list) => [...list, n]);
              setCaseNoteOpen(false);
              toast("Nota guardada.");
            }}
          />
        )}
      </section>

      {/* Barra de acciones fija abajo */}
      {mode === "auditor" && (
        <div className="sticky bottom-3 z-[6] mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-md">
          <span className="flex flex-1 flex-wrap items-center gap-2.5" aria-live="polite">
            Veredicto resultante <CallVerdictBadge verdict={resultVerdict} />
            <span className="help">
              {pending ? `Te ${pending === 1 ? "queda 1 hallazgo dudoso" : `quedan ${pending} hallazgos dudosos`} por resolver.` : "Todo listo para guardar."}
            </span>
            {savedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Cloud size={14} aria-hidden />
                Guardado · hace un momento
              </span>
            )}
          </span>
          <Button onClick={() => setDialog("escalate")} shortcut="E">
            Escalar
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!!pending} aria-disabled={!!pending} loading={saving} shortcut="↵">
            Guardar y siguiente
          </Button>
        </div>
      )}

      {mode === "supervisor" && data.review && (
        <div className="sticky bottom-3 z-[6] mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-md">
          <span className="flex flex-1 flex-wrap items-center gap-2.5">
            Revisión de {data.review.auditorName} · {durationText(data.review.reviewSeconds)} · Veredicto del auditor <CallVerdictBadge verdict={data.review.finalVerdict} />
            {editing && <StatusBadge tone="ink">Editando la decisión</StatusBadge>}
          </span>
          {editing ? (
            <>
              <Button
                onClick={() => {
                  setEditing(false);
                  setSupEdit(auditorVerdicts);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => setDialog("override")}>
                Guardar cambio
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setDialog("reopen")}>Reabrir</Button>
              <Button onClick={() => setEditing(true)}>Cambiar decisión</Button>
              <Button variant="primary" onClick={() => void approveAndNext()} shortcut="A">
                Aprobar y siguiente
              </Button>
            </>
          )}
        </div>
      )}

      <Sheet open={sheetDrawer} onOpenChange={setSheetDrawer} title="Ficha del seguro">
        <ProductSheetContent sheets={data.productSheets} relevant={relevantSection} criterionId={focusId} />
      </Sheet>
      {canSeeModel && run && (
        <ModelPanel
          open={modelOpen}
          onOpenChange={setModelOpen}
          run={run}
          rubricId={data.rubricId}
          onCriterion={(cid) => {
            setOnlyActionable(false);
            focusItem(cid);
          }}
        />
      )}
      <EscalateDialog
        open={dialog === "escalate"}
        onOpenChange={(o) => setDialog(o ? "escalate" : null)}
        criterionId={focusId}
        atMs={currentMs}
        onConfirm={async (reason, comment) => {
          await api.escalateCase(data.id, { reason, comment, criterionId: focusId, atMs: Math.round(currentMs) });
          setDialog(null);
          await goNext("Caso escalado.");
        }}
      />
      {data.review && (
        <ReopenDialog
          open={dialog === "reopen"}
          onOpenChange={(o) => setDialog(o ? "reopen" : null)}
          reviewerId={data.review.auditorId}
          onConfirm={async (auditorId, comment) => {
            await api.reopenCase(data.id, { auditorId, comment });
            setDialog(null);
            refresh();
            toast("Caso reabierto. Le avisamos al auditor.");
            router.push("/reviews");
          }}
        />
      )}
      <OverrideDialog
        open={dialog === "override"}
        onOpenChange={(o) => setDialog(o ? "override" : null)}
        onConfirm={async (reason, comment) => {
          await api.overrideReview(data.id, {
            items: Object.entries(supEdit).map(([cid, verdict]) => ({ criterionId: Number(cid), verdict })),
            reason,
            comment,
          });
          setDialog(null);
          refresh();
          toast("Decisión cambiada. Se conserva la del auditor.");
          router.push("/reviews");
        }}
      />
    </>
  );
}
