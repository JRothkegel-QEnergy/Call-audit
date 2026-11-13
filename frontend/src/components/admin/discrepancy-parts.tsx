"use client";

import Link from "next/link";
import { useState } from "react";
import { CaseMix, PatternAiLines } from "@/components/admin/discrepancy-charts";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { DiscrepancyCriterionRow, DiscrepancyOverview, DiscrepancyPattern } from "@/lib/api/admin-types";
import {
  CAUSE,
  confidenceLabel,
  DIRECTION,
  DISCARD_REASONS,
  followUpGroup,
  PROPOSAL,
  statusLabel,
  usd,
} from "@/lib/discrepancy-labels";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

/** Encabezado del patrón: prioridad, motivo, dirección, causa, confianza, casos y estado (todo con texto). */
export function PatternTags({ p }: { p: DiscrepancyPattern }) {
  const confidence = confidenceLabel(p.confidence);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {p.direction && <StatusBadge>{DIRECTION[p.direction]}</StatusBadge>}
      {p.cause && <StatusBadge tone="ink">{CAUSE[p.cause]}</StatusBadge>}
      {confidence && <StatusBadge>{confidence}</StatusBadge>}
      <StatusBadge>{p.caseCount} desacuerdos</StatusBadge>
      {(!p.isObservation || p.status !== "pending") && <StatusBadge tone={p.status === "pending" ? "doubt" : "teal"}>{statusLabel(p)}</StatusBadge>}
    </div>
  );
}

export function PatternBody({ p }: { p: DiscrepancyPattern }) {
  const quote = p.quotes.find((q) => q.validated) ?? null;
  return (
    <div className="grid gap-1.5">
      {p.explanation && <p className="m-0">{p.explanation}</p>}
      <p className="m-0 text-sm">
        <span className="text-muted-foreground">Evidencia: </span>
        {quote ? (
          <>
            llamada {quote.call_id} · «{quote.text}»
          </>
        ) : (
          "Sin cita validada"
        )}
      </p>
      {p.proposal && (
        <p className="m-0">
          <b>Propuesta · {PROPOSAL[p.proposal.type] ?? p.proposal.type}:</b> <RuleAction p={p} />
          {p.proposal.type === "prompt_rule" && p.proposal.action ? `“${p.proposal.editedText ?? p.proposal.text}”` : (p.proposal.editedText ?? p.proposal.text)}
          {p.proposal.editedText && (
            <>
              {" "}
              <StatusBadge>Editado</StatusBadge>
            </>
          )}
        </p>
      )}
      {p.reviewerDisagreements > 0 && (
        <p className="help m-0">
          {p.reviewerDisagreements} {p.reviewerDisagreements === 1 ? "desacuerdo" : "desacuerdos"} en que los revisores no coinciden entre sí: van a calibración.
        </p>
      )}
      {p.decision?.reason && <p className="help m-0">Motivo del descarte: {p.decision.reason}</p>}
      {p.decision?.at && (
        <p className="help m-0">
          {statusLabel(p)} por {p.decision.by} · {shortDateTime(p.decision.at)}
          {p.decision.versionStatus && ` · versión en estado ${p.decision.versionStatus}`}
        </p>
      )}
    </div>
  );
}

/** Cómo se aplica una regla del prompt al criterio (Cambio 18 §8.2): Agregar, Reemplazar «…» por, o texto libre. */
export function RuleAction({ p }: { p: DiscrepancyPattern }) {
  if (p.proposal?.type !== "prompt_rule") return null;
  if (p.proposal.action === "replace")
    return (
      <>
        <StatusBadge>Reemplazar</StatusBadge> «{p.proposal.find}» por{" "}
      </>
    );
  return (
    <>
      <StatusBadge>{p.proposal.action === "append" ? "Agregar" : "Texto libre"}</StatusBadge>{" "}
    </>
  );
}

/** Acciones sobre la propuesta (D-64). En un análisis anterior se muestra el estado sin botones (H-112). */
export function PatternActions({
  p,
  readOnly,
  onChange,
  showCases = true,
  onAsk,
  shortcuts = false,
  size,
}: {
  p: DiscrepancyPattern;
  readOnly: boolean;
  onChange: (p: DiscrepancyPattern) => void;
  showCases?: boolean;
  /** Si viene, los diálogos los abre quien llama (Cambio 20: también se abren con A y D). */
  onAsk?: (kind: DecisionKind) => void;
  /** Muestra las teclas A y D en los botones: solo el elemento en foco. */
  shortcuts?: boolean;
  size?: "sm";
}) {
  const [dialog, setDialog] = useState<DecisionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = onAsk ?? setDialog;
  const reopen = async () => {
    setBusy(true);
    try {
      onChange(await api.decideProposal(p.id, { decision: "pending" }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {!readOnly && p.status === "pending" && (
        <>
          <Button size={size} variant="primary" shortcut={shortcuts ? "A" : undefined} onClick={() => ask("accept")}>
            Aceptar
          </Button>
          <Button size={size} shortcut={shortcuts ? "D" : undefined} onClick={() => ask("discard")}>
            Descartar
          </Button>
        </>
      )}
      {!readOnly && p.status !== "pending" && p.status !== "included" && (
        <Button size={size} loading={busy} onClick={reopen}>
          Volver a pendiente
        </Button>
      )}
      {showCases && (
        <Link className={size === "sm" ? "btn btn-sm" : "btn"} href={`/admin/discrepancies/patterns/${p.id}`}>
          Ver los {p.caseCount} desacuerdos
        </Link>
      )}
      {dialog && <DecisionDialog p={p} kind={dialog} onClose={() => setDialog(null)} onDone={onChange} />}
    </div>
  );
}

export type DecisionKind = "accept" | "discard";

export function DecisionDialog({
  p,
  kind,
  onClose,
  onDone,
}: {
  p: DiscrepancyPattern;
  kind: DecisionKind;
  onClose: () => void;
  onDone: (p: DiscrepancyPattern) => void;
}) {
  const Component = kind === "accept" ? AcceptDialog : DiscardDialog;
  return <Component p={p} open onOpenChange={(o) => !o && onClose()} onDone={onDone} />;
}

/** Fila compacta de una observación (Cambio 20 §5): se acepta para calibrar o se descarta. */
export function ObservationRow({
  p,
  readOnly,
  onChange,
  onAsk,
  focused,
  onFocus,
  withMotive = false,
}: {
  p: DiscrepancyPattern;
  readOnly: boolean;
  onChange: (p: DiscrepancyPattern) => void;
  onAsk?: (kind: DecisionKind) => void;
  focused?: boolean;
  onFocus?: () => void;
  withMotive?: boolean;
}) {
  return (
    <article
      id={`pattern-${p.id}`}
      tabIndex={-1}
      onFocusCapture={onFocus}
      aria-labelledby={`pattern-title-${p.id}`}
      className={`grid scroll-mt-4 gap-1.5 rounded border-t border-border p-2 outline-none ${focused ? "ring-2 ring-[var(--primary)]" : ""}`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span id={`pattern-title-${p.id}`} className="min-w-0 flex-1">
          {withMotive && `Motivo ${p.criterionId} · `}
          {p.title || p.observationText}
        </span>
        <StatusBadge>
          {p.caseCount} {p.caseCount === 1 ? "desacuerdo" : "desacuerdos"}
        </StatusBadge>
        {p.status !== "pending" && <StatusBadge tone="teal">{statusLabel(p)}</StatusBadge>}
      </div>
      {p.explanation && <p className="help m-0">{p.explanation}</p>}
      {p.proposal?.editedText && <p className="m-0 text-sm">Para calibrar: {p.proposal.editedText}</p>}
      {p.decision?.reason && <p className="help m-0">Motivo del descarte: {p.decision.reason}</p>}
      <PatternActions p={p} readOnly={readOnly} onChange={onChange} onAsk={onAsk} shortcuts={focused} size="sm" />
    </article>
  );
}

export function PatternCard({
  p,
  readOnly,
  onChange,
  onAsk,
  focused,
  onFocus,
}: {
  p: DiscrepancyPattern;
  readOnly: boolean;
  onChange: (p: DiscrepancyPattern) => void;
  onAsk?: (kind: DecisionKind) => void;
  focused?: boolean;
  onFocus?: () => void;
}) {
  return (
    <article
      id={`pattern-${p.id}`}
      tabIndex={-1}
      onFocusCapture={onFocus}
      className={`card grid scroll-mt-4 gap-2 outline-none ${focused ? "ring-2 ring-[var(--primary)]" : ""}`}
      aria-labelledby={`pattern-title-${p.id}`}
    >
      <h3 id={`pattern-title-${p.id}`} className="m-0 text-base font-semibold">
        {p.isObservation ? "Observación" : `${p.rank} ·`} Motivo {p.criterionId} · {p.title}
      </h3>
      <PatternTags p={p} />
      <CaseMix k={p.kindCounts} />
      <PatternAiLines p={p} />
      <PatternBody p={p} />
      <PatternActions p={p} readOnly={readOnly} onChange={onChange} onAsk={onAsk} shortcuts={focused} />
    </article>
  );
}

const ACCEPT_HELP = {
  prompt: "Queda en Seguimiento para incluirla en la próxima versión del prompt. No cambia el prompt vigente.",
  client: "Queda en Seguimiento, en Preguntas a la empresa.",
  calibrate: "Queda en Seguimiento, en Para calibrar con el auditor.",
} as const;

/** Sin perder el contexto al decidir (Cambio 20 §5). */
function DecisionContext({ p }: { p: DiscrepancyPattern }) {
  return (
    <p className="help m-0">
      Motivo {p.criterionId} · {p.title || p.observationText}
    </p>
  );
}

function AcceptDialog({
  p,
  open,
  onOpenChange,
  onDone,
}: {
  p: DiscrepancyPattern;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (p: DiscrepancyPattern) => void;
}) {
  // Se monta al abrir: el estado parte limpio cada vez.
  const [text, setText] = useState(p.proposal?.editedText ?? p.proposal?.text ?? p.observationText ?? "");
  const [note, setNote] = useState("");
  // Con proposal en null, followUpGroup caería en «client»: una observación siempre va a calibrar (D-94).
  const group = p.isObservation ? "calibrate" : followUpGroup(p.proposal?.type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={p.isObservation ? "¿Aceptar esta observación?" : "¿Aceptar esta propuesta?"}
      description={
        <>
          <DecisionContext p={p} />
          <p className="m-0">{ACCEPT_HELP[group]}</p>
        </>
      }
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                onDone(await api.decideProposal(p.id, { decision: "accepted", text, note }));
                onOpenChange(false);
              } catch {
                setError("No pudimos guardar la decisión. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Aceptar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <label className="field">
        <span>
          {p.isObservation
            ? "Texto para calibrar"
            : p.proposal?.type !== "prompt_rule"
            ? "Texto de la propuesta"
            : p.proposal.action === "replace"
              ? `Reemplazar en el criterio del motivo ${p.criterionId}: «${p.proposal.find}» por:`
              : p.proposal.action === "append"
                ? `Agregar al criterio del motivo ${p.criterionId}:`
                : `Texto libre: se agregará al final del criterio del motivo ${p.criterionId}.`}
        </span>
        <textarea className="control min-h-[96px] py-2" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="field">
        <span>Nota (opcional)</span>
        <input className="control" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}

function DiscardDialog({
  p,
  open,
  onOpenChange,
  onDone,
}: {
  p: DiscrepancyPattern;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (p: DiscrepancyPattern) => void;
}) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = choice === "other" ? other.trim() : choice;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={p.isObservation ? "¿Descartar esta observación?" : "¿Descartar esta propuesta?"}
      description={
        <>
          <DecisionContext p={p} />
          <p className="help m-0">El próximo análisis recibe este descarte para no repetir la propuesta.</p>
        </>
      }
      footer={
        <>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              if (!reason) {
                setError("Elige un motivo para descartar.");
                return;
              }
              setBusy(true);
              try {
                onDone(await api.decideProposal(p.id, { decision: "discarded", reason }));
                onOpenChange(false);
              } catch {
                setError("No pudimos guardar la decisión. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Descartar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <ReasonFields choice={choice} setChoice={setChoice} other={other} setOther={setOther} invalid={!!error && !reason} error={error} />
    </Dialog>
  );
}

function ReasonFields({
  choice,
  setChoice,
  other,
  setOther,
  invalid,
  error,
}: {
  choice: string;
  setChoice: (v: string) => void;
  other: string;
  setOther: (v: string) => void;
  invalid: boolean;
  error: string | null;
}) {
  return (
    <>
      <fieldset className="m-0 grid gap-1.5 border-0 p-0" aria-invalid={invalid} aria-describedby={error ? "discard-error" : undefined}>
        <legend className="mb-1 font-medium">Motivo (obligatorio)</legend>
        {DISCARD_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input type="radio" name="discard-reason" checked={choice === r} onChange={() => setChoice(r)} />
            {r}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input type="radio" name="discard-reason" checked={choice === "other"} onChange={() => setChoice("other")} />
          Otro
        </label>
        {choice === "other" && <input className="control" aria-label="Otro motivo" value={other} onChange={(e) => setOther(e.target.value)} />}
      </fieldset>
      {error && (
        <span id="discard-error" className="field-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

/** Descartar las observaciones pendientes de un motivo con un único motivo de descarte (D-95). */
export function BulkDiscardDialog({
  items,
  onClose,
  onDone,
}: {
  items: DiscrepancyPattern[];
  onClose: () => void;
  onDone: (rows: DiscrepancyPattern[]) => void;
}) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = choice === "other" ? other.trim() : choice;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`¿Descartar las ${items.length} observaciones de este motivo?`}
      description={<p className="help m-0">El próximo análisis las recibe para no repetirlas. Puedes volver a pendiente cada una.</p>}
      footer={
        <>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              if (!reason) {
                setError("Elige un motivo para descartar.");
                return;
              }
              setBusy(true);
              try {
                onDone(await api.discardObservations({ ids: items.map((p) => p.id), reason }));
                onClose();
              } catch {
                setError("No pudimos guardar la decisión. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Descartar {items.length}
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
        </>
      }
    >
      <ReasonFields choice={choice} setChoice={setChoice} other={other} setOther={setOther} invalid={!!error && !reason} error={error} />
    </Dialog>
  );
}

/** Diálogo de lanzamiento (§7.3): motivos preseleccionados (3 o más desacuerdos), modelo y costo estimado (D-63, D-66). */
export function AnalyzeDialog({
  open,
  onOpenChange,
  data,
  initialCriteria,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: DiscrepancyOverview;
  /** «Analizar motivos pendientes»: solo los que quedaron sin correr. */
  initialCriteria?: number[];
  onStarted: () => void;
}) {
  const rows = data.criteria.filter((c) => c.disagreements > 0);
  const preselected = (r: DiscrepancyCriterionRow) => r.disagreements >= 3;
  // Se monta al abrir (ver la página): los motivos parten preseleccionados cada vez.
  const [selected, setSelected] = useState<number[]>(() => initialCriteria ?? rows.filter(preselected).map((r) => r.criterionId));
  const [model, setModel] = useState(data.defaultModel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = [...selected].sort((a, b) => a - b).join(",");
  const estimate = useAsync(
    async () => (open && selected.length ? api.estimateDiscrepancyAnalysis({ criteria: [...selected].sort((a, b) => a - b), model }) : null),
    [open, key, model],
  );
  const e = estimate.data;
  const cost = e?.totalUsd != null ? usd(e.totalUsd) : null;
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const option = data.models.find((m) => m.name === model);
  const series = data.currentSeries;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title="¿Analizar las discrepancias de la corrida vigente?"
      description={
        <p className="m-0">
          {series ? `${series.model} · v${series.promptVersion}` : "Corrida vigente"} · {data.calls} llamadas
        </p>
      }
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            disabled={!selected.length || !option?.available || (open && selected.length > 0 && !e)}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.startDiscrepancyAnalysis({ criteria: [...selected].sort((a, b) => a - b), model });
                onStarted();
                onOpenChange(false);
              } catch (err) {
                const code = err instanceof Error ? err.message : "";
                setError(
                  code === "already_running"
                    ? "Ya hay un análisis en curso."
                    : code === "model_unavailable"
                      ? "El servidor no tiene la API key de este modelo."
                      : "No pudimos iniciar el análisis. Intenta de nuevo.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {cost ? `Analizar · ${cost}` : "Analizar sin estimación"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <fieldset className="m-0 grid gap-1 border-0 p-0">
        <legend className="mb-1 flex w-full flex-wrap items-center gap-2 font-medium">
          Motivos a analizar ({selected.length} de {rows.length} con desacuerdos)
        </legend>
        <div className="mb-1 flex gap-2">
          <Button size="sm" onClick={() => setSelected(rows.map((r) => r.criterionId))}>
            Marcar todos
          </Button>
          <Button size="sm" onClick={() => setSelected([])}>
            Desmarcar todos
          </Button>
        </div>
        <div className="max-h-[240px] overflow-auto rounded-md border border-border p-2">
          {rows.map((r) => (
            <label key={r.criterionId} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={selected.includes(r.criterionId)} onChange={() => toggle(r.criterionId)} />
              <span className="flex-1">
                {r.criterionId} · {r.name}
              </span>
              <span className="help tabular">
                {r.disagreements} {r.disagreements < 3 ? "(menos de 3: quedaría como observación)" : "desacuerdos"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Modelo</span>
        <select className="control" value={model} onChange={(ev) => setModel(ev.target.value)}>
          {data.models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.label}
              {m.available ? "" : " (sin API key en el servidor)"}
            </option>
          ))}
        </select>
      </label>
      {selected.length > 0 && !e ? (
        <div className="skel" />
      ) : e ? (
        <div className="grid gap-1">
          <p className="m-0">
            <b>{cost ? `Costo estimado: ${cost}` : "No hay costo registrado para este modelo; no podemos estimarlo."}</b> ({e.criteria.length} motivos · {e.cases} desacuerdos)
            {e.minutes != null && ` · Tiempo estimado: ${String(e.minutes).replace(".", ",")} min`}
          </p>
          {e.discardedProposals > 0 && (
            <p className="m-0">
              {e.discardedProposals === 1
                ? "Se le pasa la propuesta descartada de estos motivos para que no la repita."
                : `Se le pasan las ${e.discardedProposals} propuestas descartadas de estos motivos para que no las repita.`}
            </p>
          )}
        </div>
      ) : null}
      <p className="help m-0">El análisis no cambia el prompt ni los resultados de las llamadas.</p>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}
