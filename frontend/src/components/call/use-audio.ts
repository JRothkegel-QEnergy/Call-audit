"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reproducción del audio de la llamada. Con `src` (URL firmada de S3 que entrega la API) usa un elemento <audio>
 * real. Sin `src`: en la demo (`simulate`) avanza con un reloj; en modo real el audio queda no disponible, para que
 * nadie crea que escuchó una llamada que no sonó. En los dos casos `currentMs` sigue siendo el
 * estado de la pantalla: el audio lo actualiza al avanzar y salta cuando la pantalla lo mueve (evidencia, ±5 s).
 */
export function useAudio({
  src,
  simulate,
  durationMs,
  playing,
  rate,
  currentMs,
  setCurrentMs,
  setPlaying,
}: {
  src: string | null;
  simulate: boolean;
  durationMs: number;
  playing: boolean;
  rate: number;
  currentMs: number;
  setCurrentMs: (update: number | ((ms: number) => number)) => void;
  setPlaying: (playing: boolean) => void;
}): { unavailable: boolean } {
  const audio = useRef<HTMLAudioElement | null>(null);
  // URL que falló al cargar: si cambia la URL (otro caso), el error deja de aplicar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Posición vigente para el <audio> nuevo: la URL firmada cambia cada vez que se recarga el caso.
  const positionMs = useRef(currentMs);
  useEffect(() => {
    positionMs.current = currentMs;
  }, [currentMs]);

  // Crea el <audio> una vez por URL y lo conecta al estado de la pantalla.
  useEffect(() => {
    if (!src) return;
    const el = new Audio(src);
    el.preload = "metadata";
    el.currentTime = positionMs.current / 1000;
    audio.current = el;
    const onTime = () => setCurrentMs(el.currentTime * 1000);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setFailedSrc(src);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeAttribute("src");
      el.load();
      audio.current = null;
    };
  }, [src, setCurrentMs, setPlaying]);

  // Play / pausa.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, setPlaying]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  // Saltos desde la pantalla: si la posición pedida difiere de la del audio, se mueve el audio.
  useEffect(() => {
    const el = audio.current;
    if (el && Math.abs(el.currentTime * 1000 - currentMs) > 750) el.currentTime = currentMs / 1000;
  }, [currentMs]);

  // Demo sin archivo de audio: reloj simulado.
  useEffect(() => {
    if (src || !simulate || !playing) return;
    const t = setInterval(() => {
      setCurrentMs((ms) => {
        const next = ms + 250 * rate;
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [src, simulate, playing, rate, durationMs, setCurrentMs, setPlaying]);

  return { unavailable: src === null ? !simulate : failedSrc === src };
}
