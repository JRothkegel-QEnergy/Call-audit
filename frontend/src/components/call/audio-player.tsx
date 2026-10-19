"use client";

import { Pause, Play } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { Finding } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { mmss } from "@/lib/format";
import { ITEM_VERDICT } from "@/lib/verdicts";

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2];

/**
 * Reproductor con forma de onda y marcas de hallazgos.
 * En la demo no hay audio real: la reproducción se simula con un reloj (ver useSimulatedClock).
 * Con el backend, `src` apunta al audio y se reemplaza el reloj por wavesurfer.js.
 */
export function AudioPlayer({
  durationMs,
  currentMs,
  playing,
  rate,
  markers,
  focusId,
  unavailable,
  onTogglePlay,
  onSeek,
  onRate,
  onMarker,
}: {
  durationMs: number;
  currentMs: number;
  playing: boolean;
  rate: number;
  markers: Finding[];
  focusId: number | null;
  unavailable?: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onRate: (rate: number) => void;
  onMarker: (criterionId: number) => void;
}) {
  const bars = useMemo(
    () => Array.from({ length: 150 }, (_, i) => 6 + Math.abs(Math.sin(i * 1.7) * 24 + Math.cos(i * 0.6) * 8)),
    [],
  );
  const progress = durationMs ? currentMs / durationMs : 0;

  if (unavailable) {
    return (
      <div className="sticky top-0 z-[5] my-2.5 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="error-state shadow-none" role="alert">
          <b className="block">No pudimos cargar el audio.</b>
          <span className="help">Puedes revisar con la transcripción o escalar el caso con el motivo «Audio inaudible».</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sticky top-0 z-[5] my-2.5 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
      aria-label="Reproductor"
      role="group"
    >
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? "Pausar" : "Reproducir"}
        className="grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-full border-0 bg-primary text-white hover:bg-primary-hover"
      >
        {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>
      <Button variant="ghost" onClick={() => onSeek(Math.max(0, currentMs - 5000))} aria-label="Retroceder 5 segundos">
        −5 s
      </Button>
      <Button variant="ghost" onClick={() => onSeek(Math.min(durationMs, currentMs + 5000))} aria-label="Avanzar 5 segundos">
        +5 s
      </Button>
      <span className="min-w-24 text-[13px] text-muted-foreground tabular" aria-live="off">
        {mmss(currentMs)} / {mmss(durationMs)}
      </span>
      <div
        className="relative h-12 flex-1 cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(Math.round(((e.clientX - r.left) / r.width) * durationMs));
        }}
      >
        <svg viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden className="block h-full w-full">
          {bars.map((h, i) => (
            <rect
              key={i}
              x={i * 8}
              y={(48 - h) / 2}
              width={4.5}
              height={h}
              rx={2}
              fill={i / bars.length < progress ? "var(--primary)" : "var(--neutral-300)"}
            />
          ))}
        </svg>
        {markers.map((f) =>
          f.evidence ? (
            <button
              key={f.criterionId}
              type="button"
              onClick={() => onMarker(f.criterionId)}
              aria-label={`Motivo ${f.criterionId}, ${ITEM_VERDICT[f.verdict].label}, minuto ${mmss(f.evidence.startMs)}`}
              className={cn(
                "absolute -top-1 grid h-6 w-6 -translate-x-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0",
                focusId === f.criterionId && "rounded outline-2 outline-ring [outline-style:solid]",
              )}
              style={{ left: `${(f.evidence.startMs / durationMs) * 100}%` }}
            >
              {f.verdict === "non_compliant" ? (
                <span className="block h-3 w-3 rounded-[2px] bg-red-700 shadow-[0_0_0_2px_#fff]" />
              ) : (
                <span className="block h-3 w-3 rounded-full border-2 border-dashed border-[var(--amber-600)] bg-[var(--amber-100)]" />
              )}
            </button>
          ) : null,
        )}
      </div>
      <select className="control" aria-label="Velocidad" value={rate} onChange={(e) => onRate(Number(e.target.value))}>
        {PLAYBACK_RATES.map((r) => (
          <option key={r} value={r}>
            {String(r).replace(".", ",")}x
          </option>
        ))}
      </select>
    </div>
  );
}
