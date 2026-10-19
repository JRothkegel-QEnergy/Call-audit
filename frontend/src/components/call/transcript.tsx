"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { isRealMode } from "@/lib/api";
import type { Evidence, TranscriptTurn } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { mmss } from "@/lib/format";

const SPEAKER: Record<TranscriptTurn["speaker"], string> = { agent: "Ejecutivo", customer: "Cliente", other: "Otro" };

/** Tramo de `text` que coincide con la cita: la cita completa o, si el modelo la recortó o le cambió palabras, el
 * tramo más largo de palabras enteras (mínimo 3) que sí aparece. Así el resaltado nunca corta una palabra. */
export function quoteSpan(text: string, quote: string): [number, number] | null {
  const words = quote.replace(/\.{2,}|…/g, " ").replace(/[«»"“”]/g, " ").split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  for (let start = 0; start < Math.min(4, words.length); start++) {
    for (let end = words.length; end - start >= 3; end--) {
      const piece = words.slice(start, end).join(" ").toLowerCase();
      const i = lower.indexOf(piece);
      if (i >= 0) return [i, i + piece.length];
    }
  }
  return null;
}

function highlight(text: string, span: [number, number] | null) {
  if (!span) return text;
  const [i, j] = span;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, j)}</mark>
      {text.slice(j)}
    </>
  );
}

function searchSpan(text: string, query: string): [number, number] | null {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  return i < 0 ? null : [i, i + query.length];
}

/**
 * Transcripción por hablante, con el turno activo y la cita del hallazgo en foco resaltados.
 * Las llamadas reales llegan a ~300 turnos: si pesa, virtualizar con TanStack Virtual.
 */
export function Transcript({
  turns,
  currentMs,
  evidence,
  badTurns,
  readOnly,
  onSeek,
  onMarkBad,
}: {
  turns: TranscriptTurn[];
  currentMs: number;
  evidence: Evidence | null;
  badTurns: number[];
  readOnly: boolean;
  onSeek: (ms: number) => void;
  onMarkBad: (turnIndex: number) => void;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const current = useMemo(() => turns.reduce((acc, t, i) => (t.startMs <= currentMs ? i : acc), 0), [turns, currentMs]);
  const evidenceTurn = useMemo(() => {
    if (!evidence) return -1;
    const byQuote = evidence.quote ? turns.findIndex((t) => quoteSpan(t.text, evidence.quote)) : -1;
    return byQuote >= 0 ? byQuote : turns.findIndex((t) => t.startMs <= evidence.startMs && evidence.startMs < t.endMs);
  }, [turns, evidence]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-turn="${current}"]`);
    const col = listRef.current?.closest(".col");
    if (!el || !col) return;
    const top = el.getBoundingClientRect().top - col.getBoundingClientRect().top;
    if (top < 48 || top > col.clientHeight - 40) col.scrollTop += top - 80;
  }, [current]);


  return (
    <section className="col" aria-label="Transcripción">
      <div className="col-h">
        <b className="text-sm font-semibold">Transcripción</b>
        <span className="help">{isRealMode ? "Transcripción automática; puede tener errores." : "Datos personales enmascarados"}</span>
        <input
          className="control search ml-auto h-7 w-[150px]"
          placeholder="Buscar"
          aria-label="Buscar en la transcripción"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div ref={listRef}>
        {turns.map((t, i) => {
          const hidden = query && !t.text.toLowerCase().includes(query.toLowerCase());
          if (hidden) return null;
          return (
            <div
              key={t.index}
              data-turn={i}
              role="button"
              tabIndex={0}
              onClick={() => onSeek(t.startMs)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSeek(t.startMs);
              }}
              className={cn(
                "grid cursor-pointer grid-cols-[48px_72px_1fr] gap-2 border-b border-[var(--neutral-100)] px-3 py-2 text-[15px] leading-[22px] hover:bg-[#fafbfc]",
                i === current && "bg-accent shadow-[inset_3px_0_0_var(--primary)] hover:bg-accent",
              )}
            >
              <span className="pt-0.5 text-xs text-subtle-foreground tabular">{mmss(t.startMs)}</span>
              <span className={cn("pt-0.5 text-xs font-semibold text-muted-foreground", t.speaker === "customer" && "text-[var(--teal-800)]")}>
                {SPEAKER[t.speaker]}
              </span>
              <span>
                {query
                  ? highlight(t.text, searchSpan(t.text, query))
                  : i === evidenceTurn && evidence
                    ? highlight(t.text, quoteSpan(t.text, evidence.quote))
                    : t.text}
                {badTurns.includes(t.index) && (
                  <>
                    {" "}
                    <StatusBadge>Mal transcrito</StatusBadge>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <div className="px-3 py-2.5">
          <Button variant="ghost" onClick={() => onMarkBad(turns[current]?.index ?? 0)}>
            Marcar el turno actual como mal transcrito
          </Button>
        </div>
      )}
    </section>
  );
}
