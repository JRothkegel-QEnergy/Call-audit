"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  ESCALATION_REASONS,
  OVERRIDE_REASONS,
  type EscalationReason,
  type OverrideReason,
} from "@/lib/api/types";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { mmss } from "@/lib/format";

export function EscalateDialog({
  open,
  onOpenChange,
  criterionId,
  atMs,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  criterionId: number | null;
  atMs: number;
  onConfirm: (reason: EscalationReason, comment: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<EscalationReason>("Duda de criterio");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Escalar al supervisor"
      description={<p className="m-0">El caso sale de tu cola y llega a la bandeja del supervisor. Verás su respuesta en Mis revisiones.</p>}
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (reason === "Otro" && !comment.trim()) return setError("Cuéntale al supervisor qué necesitas que revise.");
              setBusy(true);
              try {
                await onConfirm(reason, comment.trim());
              } catch {
                setError("No pudimos escalar el caso. Tu revisión sigue guardada; intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Escalar caso
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <div className="summary-box">
        Sobre: {criterionId != null ? `Motivo ${criterionId} · ` : ""}
        {mmss(atMs)}
      </div>
      <label className="field">
        Motivo
        <select autoFocus className="control" value={reason} onChange={(e) => setReason(e.target.value as EscalationReason)}>
          {ESCALATION_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="field">
        ¿Qué necesitas que revise el supervisor?
        <textarea className="control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <span className="field-error" role="alert">{error}</span>}
    </Dialog>
  );
}

export function ReopenDialog({
  open,
  onOpenChange,
  reviewerId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reviewerId: string;
  onConfirm: (auditorId: string, comment: string) => Promise<void>;
}) {
  const [auditorId, setAuditorId] = useState(reviewerId);
  const auditors = useAsync(() => api.listActiveAuditors(), []);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reabrir caso"
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!comment.trim()) return setError("Escribe un comentario para el auditor.");
              setBusy(true);
              try {
                await onConfirm(auditorId, comment.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            Reabrir caso
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <label className="field">
        Devolver a
        <select autoFocus className="control" value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
          {(auditors.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.id === reviewerId ? " (quien revisó)" : ""}
            </option>
          ))}
        </select>
      </label>
      <span className="help">Solo se muestran auditores activos.</span>
      <label className="field">
        Comentario para el auditor (obligatorio)
        <textarea
          className="control"
          rows={3}
          value={comment}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      {error && <span className="field-error" role="alert">{error}</span>}
    </Dialog>
  );
}

export function OverrideDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: OverrideReason, comment: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<OverrideReason>("Criterio mal aplicado");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Guardar cambio de decisión"
      description={<p className="m-0">La decisión del auditor se conserva junto a la tuya.</p>}
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason, comment.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar cambio y cerrar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <label className="field">
        Motivo del cambio (obligatorio)
        <select autoFocus className="control" value={reason} onChange={(e) => setReason(e.target.value as OverrideReason)}>
          {OVERRIDE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Comentario
        <textarea className="control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
    </Dialog>
  );
}
