"use client";

import { AlertTriangle, StickyNote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Note } from "@/lib/api/types";
import { shortDateTime } from "@/lib/format";

/** Heurística que no bloquea (H-56): RUT chileno con o sin puntos. */
const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;

/** Editor de nota con ayuda y aviso de RUT (Cambio 09 §3.3, L-30). */
export function NoteEditor({
  initial = "",
  onSave,
  onCancel,
  autoFocus = true,
}: {
  initial?: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [warned, setWarned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (force: boolean) => {
    if (!text.trim()) return setError("Escribe la nota.");
    if (!force && RUT.test(text)) return setWarned(true);
    setBusy(true);
    try {
      await onSave(text.trim());
    } catch {
      setError("No pudimos guardar la nota. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-border bg-[var(--neutral-50)] p-2.5">
      <label className="field">
        Nota
        <textarea
          autoFocus={autoFocus}
          className="control"
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setWarned(false);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        />
      </label>
      <span className="help">No escribas RUT, nombres ni datos de salud del cliente.</span>
      {warned && (
        <div className="flex items-start gap-1.5 rounded-sm border border-[var(--amber-600)] bg-[var(--amber-100)] px-2 py-1.5 text-xs text-amber-800" role="alert">
          <AlertTriangle size={14} aria-hidden className="mt-px flex-none" />
          Parece que la nota incluye un RUT. Revísala antes de guardar.
        </div>
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        {warned ? (
          <>
            <Button onClick={() => setWarned(false)}>Editar nota</Button>
            <Button variant="primary" loading={busy} onClick={() => void save(true)}>
              Guardar igual
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" loading={busy} onClick={() => void save(false)}>
              Guardar nota
            </Button>
            <Button onClick={onCancel}>Cancelar</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function NoteList({
  notes,
  currentUserId,
  onEdit,
}: {
  notes: Note[];
  currentUserId: string;
  onEdit: (noteId: string, text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!notes.length) return null;
  return (
    <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
      {notes.map((n) => (
        <li key={n.id} className="rounded-md border border-border bg-card px-2.5 py-2 text-[13px]">
          {editing === n.id ? (
            <NoteEditor
              initial={n.text}
              onCancel={() => setEditing(null)}
              onSave={async (text) => {
                await onEdit(n.id, text);
                setEditing(null);
              }}
            />
          ) : (
            <>
              <div className="flex items-start gap-1.5">
                <StickyNote size={14} aria-hidden className="mt-0.5 flex-none text-muted-foreground" />
                <span className="flex-1 whitespace-pre-wrap">{n.text}</span>
              </div>
              <div className="help mt-1">
                {n.authorName} · {n.authorRole === "supervisor" ? "Supervisor" : "Auditor"} · {shortDateTime(n.createdAt)}
                {n.editedAt ? " · editada" : ""}
                {n.authorId === currentUserId && (
                  <>
                    {" · "}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditing(n.id);
                      }}
                    >
                      Editar
                    </a>
                  </>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
