"use client";

import { AlertTriangle, Check, ChevronDown, ChevronRight, Play, Plus, StickyNote } from "lucide-react";
import { useState } from "react";
import { ItemVerdictBadge, StatusBadge } from "@/components/ui/badges";
import { Button, Kbd } from "@/components/ui/button";
import {
  CORRECTION_REASONS,
  type CorrectionReason,
  type ExternalVerdict,
  type Finding,
  type ItemReview,
  type Note,
  type Rubric,
  type Verdict,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { mmss } from "@/lib/format";
import { ITEM_VERDICT } from "@/lib/verdicts";
import { NoteEditor, NoteList } from "./notes";
import { type AddedFinding, type DetailMode, type ItemWork, finalVerdictOf, findingFor, isActionable } from "./work";

interface Props {
  rubric: Rubric;
  findings: Finding[];
  mode: DetailMode;
  work: Record<number, ItemWork>;
  added: AddedFinding[];
  focusId: number | null;
  currentMs: number;
  onlyActionable: boolean;
  /** Revisión del auditor (modo supervisor): para la vista de diferencias IA → Auditor. */
  auditorItems?: ItemReview[];
  supervisorEdit?: Record<number, "compliant" | "non_compliant">;
  editing?: boolean;
  onOnlyActionable: (v: boolean) => void;
  onFocus: (criterionId: number) => void;
  onChoose: (criterionId: number, choice: ItemWork["choice"]) => void;
  onCorrection: (criterionId: number, reason: CorrectionReason, comment: string) => void;
  onCancelCorrection: (criterionId: number) => void;
  onUndo: (criterionId: number) => void;
  onAdd: (a: AddedFinding) => void;
  onSupervisorEdit?: (criterionId: number, v: "compliant" | "non_compliant") => void;
  /** Notas por motivo (Cambio 09 §3.3). */
  notes: Note[];
  currentUserId: string;
  noteOpenFor: number | null;
  onNoteOpen: (criterionId: number | null) => void;
  onAddNote: (criterionId: number, text: string) => Promise<void>;
  onEditNote: (noteId: string, text: string) => Promise<void>;
  /** Veredicto del cliente por motivo (solo supervisor, si vino). */
  externalItemVerdicts?: { criterionId: number; verdict: ExternalVerdict }[] | null;
}

export function RubricChecklist(props: Props) {
  const { rubric, findings, work, added, focusId, onlyActionable, mode } = props;
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  return (
    <section className="col" aria-label="Pauta de calidad">
      <div className="col-h">
        <b className="text-sm font-semibold">Pauta de calidad</b>
        <span
          className="grid h-[18px] w-[18px] cursor-help place-items-center rounded-full border border-input bg-card text-[11px] font-bold text-muted-foreground"
          title="Cada motivo describe algo que no debe ocurrir. Incumple = ocurrió."
          aria-label="Cada motivo describe algo que no debe ocurrir. Incumple = ocurrió."
        >
          ?
        </span>
        <span className="help">motivos de no calidad</span>
        <label className="help ml-auto flex items-center gap-2">
          <input type="checkbox" checked={onlyActionable} onChange={(e) => props.onOnlyActionable(e.target.checked)} />
          Solo los que piden acción
        </label>
      </div>

      {rubric.blocks.map((b) => {
        const verdicts = b.criterionIds.map((id) => finalVerdictOf(findingFor(findings, id), work[id], added));
        const nc = verdicts.filter((v) => v === "non_compliant").length;
        const du = verdicts.filter((v) => v === "uncertain").length;
        const shownIds = onlyActionable
          ? b.criterionIds.filter((id) => isActionable(findingFor(findings, id)) || id === focusId || added.some((a) => a.criterionId === id))
          : b.criterionIds;
        const hidden = b.criterionIds.length - shownIds.length;
        const containsFocus = focusId != null && b.criterionIds.includes(focusId);
        const open = openBlocks[b.id] ?? (nc + du > 0 || containsFocus);
        return (
          <div key={b.id} className="border-b border-border">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenBlocks((s) => ({ ...s, [b.id]: !open }))}
              className="flex h-10 w-full cursor-pointer items-center gap-2 border-0 bg-muted px-3 text-left font-semibold"
            >
              {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
              {b.name}
              <small className="ml-auto flex gap-1.5 font-medium text-muted-foreground">
                {nc > 0 && <span className="vt vt-fail">{nc} incumple</span>}
                {du > 0 && <span className="vt vt-doubt">{du === 1 ? "1 dudoso" : `${du} dudosos`}</span>}
                {!nc && !du && "Todo cumple"}
              </small>
            </button>
            {open && (
              <>
                {shownIds.map((id) => (
                  <FindingItem key={id} {...props} criterionId={id} />
                ))}
                {hidden > 0 && (
                  <div className="flex items-center gap-2 border-t border-[var(--neutral-100)] px-3 py-2.5 text-[13px] text-muted-foreground">
                    <Check size={14} aria-hidden /> y {hidden === 1 ? "1 motivo" : `${hidden} motivos`} sin incumplimiento
                    <Button variant="ghost" size="sm" onClick={() => props.onOnlyActionable(false)}>
                      Mostrar
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {mode === "auditor" && <AddFinding rubric={rubric} currentMs={props.currentMs} onAdd={props.onAdd} />}
    </section>
  );
}

function SupportLine({ verdict, atMs }: { verdict: Verdict; atMs: number | null }) {
  if (verdict === "non_compliant")
    return (
      <p className="m-0 mt-0.5 text-xs font-semibold text-red-700">
        Se detectó en la llamada{atMs != null ? ` · ${mmss(atMs)}` : ""}
      </p>
    );
  if (verdict === "uncertain") return <p className="m-0 mt-0.5 text-xs font-semibold text-amber-800">No está claro si ocurrió · revisa la evidencia</p>;
  return <p className="m-0 mt-0.5 text-xs text-muted-foreground">No se detectó en la llamada</p>;
}

function FindingItem(props: Props & { criterionId: number }) {
  const { criterionId: id, rubric, findings, mode, work, added, focusId } = props;
  const criterion = rubric.criteria[id];
  const f = findingFor(findings, id);
  const w = work[id];
  const add = added.find((a) => a.criterionId === id);
  const verdict = finalVerdictOf(f, w, added);
  const focused = focusId === id;
  const needs = isActionable(f);
  const atMs = add?.atMs ?? f.evidence?.startMs ?? null;

  const header = (
    <>
      <div className="flex items-start gap-2">
        <ItemVerdictBadge verdict={verdict} />
        <span className="flex-1 font-medium">
          Motivo {id} · {criterion.name}
          {criterion.critical && (
            <>
              {" "}
              <StatusBadge tone="ink">Crítico</StatusBadge>
            </>
          )}
        </span>
      </div>
      <SupportLine verdict={verdict} atMs={verdict === "non_compliant" ? atMs : null} />
    </>
  );

  const itemNotes = props.notes.filter((n) => n.scope === "finding" && n.criterionId === id);
  const noteOpen = props.noteOpenFor === id;
  const notesFooter = (
    <>
      <NoteList notes={itemNotes} currentUserId={props.currentUserId} onEdit={props.onEditNote} />
      {noteOpen ? (
        <NoteEditor
          onCancel={() => props.onNoteOpen(null)}
          onSave={async (text) => {
            await props.onAddNote(id, text);
            props.onNoteOpen(null);
          }}
        />
      ) : (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => props.onNoteOpen(id)}>
          <StickyNote size={14} aria-hidden />
          Agregar nota{focused ? <Kbd>N</Kbd> : null}
        </Button>
      )}
    </>
  );

  const wrap = (children: React.ReactNode) => (
    <div
      id={`item-${id}`}
      className={cn("border-t border-[var(--neutral-100)] px-3 py-2.5", focused && "bg-[#fbfcfc] shadow-[inset_3px_0_0_var(--primary)]")}
    >
      {header}
      {children}
      {notesFooter}
    </div>
  );

  if (add) {
    return wrap(
      <div className="mt-1.5 text-xs text-muted-foreground">
        Agregado por ti en el minuto {mmss(add.atMs)}
        {add.comment ? ` · ${add.comment}` : ""}
      </div>,
    );
  }

  // Cumple sin foco: resumen corto, sin acción (D-18).
  if (!needs && !focused) {
    return wrap(
      mode === "auditor" ? (
        <div className="mb-1 mt-1.5 text-xs text-muted-foreground">
          La IA propone: Cumple ·{" "}
          <span title="Si no lo cambias, queda como aceptado sin cambios al guardar.">aceptado sin cambios al guardar</span> ·{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              props.onFocus(id);
            }}
          >
            Revisar
          </a>
        </div>
      ) : null,
    );
  }

  const evidence = f.evidence ? (
    <>
      <Button variant="ghost" size="sm" onClick={() => props.onFocus(id)}>
        <Play size={14} aria-hidden />
        Ir a la evidencia · {mmss(f.evidence.startMs)}
      </Button>
      <div className="quote">“{f.evidence.quote}”</div>
      {!f.evidence.quoteValidated && (
        <div className="my-1.5 flex items-start gap-1.5 rounded-sm border border-[var(--red-200)] bg-[var(--red-100)] px-2 py-1.5 text-xs text-[var(--red-800)]">
          <AlertTriangle size={14} aria-hidden className="mt-px flex-none" />
          Esta cita no aparece tal cual en la transcripción. Verifícala en el audio.
        </div>
      )}
    </>
  ) : null;
  const comment =
    f.verdict === "uncertain" ? (
      <details>
        <summary className="help cursor-pointer">Ver comentario de la IA</summary>
        <p className="my-1">{f.comment}</p>
      </details>
    ) : (
      <p className="my-1 text-[13px]">IA: {f.comment}</p>
    );

  const body = (
    <>
      <div className="mb-1 mt-1.5 text-xs text-muted-foreground">
        La IA propone: {ITEM_VERDICT[f.verdict].label} · Confianza {Math.round(f.confidence * 100)} %
      </div>
      {f.verdict === "uncertain" ? (
        <>
          {evidence}
          {comment}
        </>
      ) : (
        <>
          {comment}
          {evidence}
        </>
      )}
    </>
  );

  if (mode === "supervisor" || mode === "readonly") {
    const ai = props.auditorItems?.find((i) => i.criterionId === id);
    const client = props.externalItemVerdicts ? props.externalItemVerdicts.find((x) => x.criterionId === id) : undefined;
    return wrap(
      <>
        {body}
        {(ai || props.externalItemVerdicts) && (
          <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-sm border border-neutral-300 bg-[var(--neutral-50)] px-2 py-0.5 text-xs">
            IA: {ITEM_VERDICT[f.verdict].label}
            {ai && (
              <>
                {" "}→ Auditor:{" "}
                {ai.action === "corrected"
                  ? `${ITEM_VERDICT[ai.verdict].label} · ${ai.correctionReason ?? "corrigió"}`
                  : ai.action === "confirmed"
                    ? `${ITEM_VERDICT[ai.verdict].label} (confirmó)`
                    : `${ITEM_VERDICT[ai.verdict].label} (sin cambios)`}
              </>
            )}
            {props.externalItemVerdicts && (
              <>
                {" "}→ Cliente:{" "}
                {client ? (
                  ITEM_VERDICT[client.verdict].label
                ) : (
                  <span title="Sin dato del cliente en este motivo" aria-label="Sin dato del cliente en este motivo">
                    —
                  </span>
                )}
              </>
            )}
          </div>
        )}
        {props.editing && props.onSupervisorEdit && (
          <div className="seg mt-2" role="group" aria-label={`Decisión del supervisor sobre el motivo ${id}`}>
            {(["compliant", "non_compliant"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={props.supervisorEdit?.[id] === v}
                onClick={() => props.onSupervisorEdit!(id, v)}
              >
                {ITEM_VERDICT[v].label}
              </button>
            ))}
          </div>
        )}
      </>,
    );
  }

  // Modo auditor
  if (w?.done) {
    return wrap(
      <>
        {body}
        <div className="mt-2 flex items-center gap-2 text-[13px] font-medium text-accent-foreground">
          <Check size={14} aria-hidden />
          {w.choice === "confirm" ? "Confirmado por ti" : `Corregido por ti: ${ITEM_VERDICT[w.choice].label}`} ·{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              props.onUndo(id);
            }}
          >
            Cambiar
          </a>
        </div>
      </>,
    );
  }

  const options: { key: ItemWork["choice"]; label: string; kbd?: string }[] = [
    ...(f.verdict !== "uncertain" ? [{ key: "confirm" as const, label: "Confirmar", kbd: "C" }] : []),
    ...(["compliant", "non_compliant"] as const).filter((v) => v !== f.verdict).map((v) => ({ key: v, label: ITEM_VERDICT[v].label })),
  ];

  return wrap(
    <>
      {body}
      <div className="seg mt-2" role="group" aria-label={`Decisión sobre el motivo ${id}`} id={`seg-${id}`}>
        {options.map((o) => (
          <button key={o.key} type="button" data-choice={o.key} aria-pressed={w?.choice === o.key} onClick={() => props.onChoose(id, o.key)}>
            {o.label}
            {o.kbd && <Kbd>{o.kbd}</Kbd>}
          </button>
        ))}
      </div>
      {w && !w.done && w.choice !== "confirm" && (
        <CorrectionForm
          criterionId={id}
          onSave={(reason, comment) => props.onCorrection(id, reason, comment)}
          onCancel={() => props.onCancelCorrection(id)}
        />
      )}
    </>,
  );
}

function CorrectionForm({
  criterionId,
  onSave,
  onCancel,
}: {
  criterionId: number;
  onSave: (reason: CorrectionReason, comment: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<CorrectionReason | "">("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errId = `corr-err-${criterionId}`;
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-border bg-[var(--neutral-50)] p-2.5">
      <label className="field">
        Motivo de la corrección
        <select
          autoFocus
          className="control"
          value={reason}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => setReason(e.target.value as CorrectionReason)}
        >
          <option value="">Elige un motivo…</option>
          {CORRECTION_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      {error && (
        <span className="field-error" id={errId}>
          <AlertTriangle size={14} aria-hidden />
          {error}
        </span>
      )}
      <label className="field">
        Comentario (obligatorio si eliges «Otro»)
        <textarea className="control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => {
            if (!reason) return setError("Elige un motivo de corrección.");
            if (reason === "Otro" && !comment.trim()) return setError("Escribe un comentario para el motivo «Otro».");
            onSave(reason, comment.trim());
          }}
        >
          Guardar corrección
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function AddFinding({ rubric, currentMs, onAdd }: { rubric: Rubric; currentMs: number; onAdd: (a: AddedFinding) => void }) {
  const [open, setOpen] = useState(false);
  const [criterionId, setCriterionId] = useState<number>(rubric.blocks[0].criterionIds[0]);
  const [minute, setMinute] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    setOpen((o) => !o);
    setMinute(mmss(currentMs));
    setError(null);
  };
  return (
    <div className="p-3">
      <Button onClick={toggle} aria-expanded={open}>
        <Plus size={14} aria-hidden />
        Agregar hallazgo que la IA no detectó
      </Button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-md border border-border bg-[var(--neutral-50)] p-2.5">
          <label className="field">
            Motivo
            <select autoFocus className="control" value={criterionId} onChange={(e) => setCriterionId(Number(e.target.value))}>
              {rubric.blocks.flatMap((b) =>
                b.criterionIds.map((id) => (
                  <option key={id} value={id}>
                    Motivo {id} · {rubric.criteria[id].name}
                  </option>
                )),
              )}
            </select>
          </label>
          <label className="field">
            Minuto
            <input className="control w-[90px] tabular" value={minute} onChange={(e) => setMinute(e.target.value)} />
          </label>
          <span className="help">Se registra en el minuto actual del audio ({mmss(currentMs)}). Puedes cambiarlo.</span>
          {error && <span className="field-error">{error}</span>}
          <label className="field">
            Comentario
            <textarea className="control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const m = /^(\d{1,2}):(\d{2})$/.exec(minute.trim());
                if (!m) return setError("Escribe el minuto como mm:ss, por ejemplo 07:42.");
                onAdd({ criterionId, atMs: (Number(m[1]) * 60 + Number(m[2])) * 1000, comment: comment.trim() });
                setOpen(false);
                setComment("");
              }}
            >
              Agregar hallazgo
            </Button>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
