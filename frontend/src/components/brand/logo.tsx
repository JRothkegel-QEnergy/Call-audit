/**
 * Aproximación vectorial PROVISIONAL del logo Qubico (cubo con nodos).
 * Reemplazar por el SVG oficial cuando esté disponible (H-28).
 */
export function LogoMark({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? "#fff" : "var(--ink-900)";
  const fill = inverted ? "var(--ink-900)" : "#fff";
  const nodes: [number, number][] = [
    [6, 13],
    [26, 13],
    [6, 33],
    [26, 33],
    [14, 5],
    [34, 5],
    [14, 25],
    [34, 25],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="flex-none">
      <g fill="none" stroke={ink} strokeWidth={2.6}>
        <path d="M6 13h20v20H6zM14 5h20v20H14zM6 13l8-8M26 13l8-8M26 33l8-8M6 33l8-8" />
      </g>
      <g fill={fill} stroke={ink} strokeWidth={2.4}>
        {nodes.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} rx={2} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={`font-bold tracking-[0.14em] ${className ?? ""}`}>QUBICO</span>;
}
