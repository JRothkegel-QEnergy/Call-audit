"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import logo from "@/assets/brand/qubyt-logo.png";
import logoOnDark from "@/assets/brand/qubyt-logo-on-dark.png";
import symbol from "@/assets/brand/qubyt-symbol.png";
import wordmarkOnDark from "@/assets/brand/qubyt-wordmark-on-dark.png";
import animatedPoster from "@/assets/brand/qubyt-symbol-animated-poster.png";

/**
 * Logo de Qubyt (Cambio 21). PNG transparentes recortados del original y exportados a 2× del uso.
 * `full`: símbolo + "Qubyt" (variante C, azul marino → celeste) para fondos claros.
 * `symbol`: solo el símbolo, para la sidebar colapsada.
 * `onDark`: variante A (degradado cian → lila) para el panel marino del login.
 */
export function BrandLogo({
  variant = "full",
  onDark = false,
  height = 28,
  className,
}: {
  variant?: "full" | "symbol";
  onDark?: boolean;
  height?: number;
  className?: string;
}) {
  const src = variant === "symbol" ? symbol : onDark ? logoOnDark : logo;
  const width = Math.round((src.width / src.height) * height);
  return <Image src={src} alt="Qubyt" width={width} height={height} priority className={className} style={{ height, width }} />;
}

/** Separación símbolo–texto del logo original (16 % del alto). */
const GAP_RATIO = 0.158;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true, // en el servidor: estático
  );
}

/**
 * Logo del login sobre fondo marino con el símbolo animado (D-99).
 * El video (webm VP9 con alfa, 4 s) se reproduce una sola vez y queda en el último cuadro; el poster es ese
 * mismo cuadro, así que si el navegador no reproduce webm con alfa (p. ej. Safari) se ve el logo estático.
 * Con prefers-reduced-motion: reduce no se monta el video. Arranca en estático hasta conocer la preferencia.
 */
export function AnimatedBrandLogo({ height = 40 }: { height?: number }) {
  const reduced = usePrefersReducedMotion();
  const wordWidth = Math.round((wordmarkOnDark.width / wordmarkOnDark.height) * height);
  return (
    <span role="img" aria-label="Qubyt" className="inline-flex items-center" style={{ gap: Math.round(height * GAP_RATIO) }}>
      {reduced ? (
        <Image src={animatedPoster} alt="" width={height} height={height} priority style={{ height, width: height }} />
      ) : (
        <video
          src="/brand/qubyt-symbol-animated.webm"
          poster={animatedPoster.src}
          width={height}
          height={height}
          autoPlay
          // 23 §7 (AE21): en loop continuo; con «reducir movimiento» queda el póster fijo.
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          style={{ height, width: height }}
        />
      )}
      <Image src={wordmarkOnDark} alt="" width={wordWidth} height={height} priority style={{ height, width: wordWidth }} />
    </span>
  );
}
