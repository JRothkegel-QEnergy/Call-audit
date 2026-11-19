"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
/**
 * Gráficos de Calidad del servicio (docs/ux/vistas-supervisor/09b-graficos-especificacion.md §B). A mano, sin
 * librería (R-13): mapas de calor como <table>, el resto en SVG o div. Cada cifra va también en texto y la tabla de
 * la pantalla queda debajo como alternativa accesible (R-12). Las celdas se pulsan con el mouse; con teclado se llega
 * al mismo destino por el nombre de la fila y por la tabla (D-40).
 */
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { AnalysisPeriod } from "@/lib/api/analysis-types";
import type { Rubric } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";

// ---- Escalas de color (§B.2) ----

/** Magnitud «cuánto marca distinto»: tramos fijos (no relativos al máximo) para comparar fotos. */
export function seqTone(pct: number) {
  const step = pct < 5 ? 1 : pct < 10 ? 2 : pct < 15 ? 3 : pct < 25 ? 4 : 5;
  return { bg: `var(--seq-${step})`, fg: step >= 4 ? "#fff" : "var(--foreground)" };
}

/** Divergente «más o menos que el equipo»: ±equal en gris, ±5 pts el tono fuerte. */
export function divTone(pts: number, equal = 2) {
  if (Math.abs(pts) <= equal) return { bg: "var(--div-mid)", fg: "var(--foreground)" };
  if (pts > 0) return pts > 5 ? { bg: "var(--div-pos-2)", fg: "#fff" } : { bg: "var(--div-pos-1)", fg: "var(--foreground)" };
  return pts < -5 ? { bg: "var(--div-neg-2)", fg: "#fff" } : { bg: "var(--div-neg-1)", fg: "var(--foreground)" };
}

export const signed = (v: number, digits = 0) => {
  const r = digits ? Math.abs(v).toFixed(digits).replace(".", ",") : String(Math.abs(Math.round(v)));
  if (Number(r.replace(",", ".")) === 0) return "0";
  return `${v > 0 ? "+" : "−"}${r}`;
};
export const dec = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");
/** Columnas en el orden de la pauta, agrupadas por bloque (§B.3 A-2). */
export function blockGroups<T>(rubric: Rubric | null, make: (id: number) => T, only?: Set<number>) {
  const groups = rubric
    ? rubric.blocks.map((b) => ({ label: b.name, columns: b.criterionIds.filter((id) => !only || only.has(id)).map(make) }))
    : [{ label: "Criterios", columns: Array.from({ length: 33 }, (_, i) => i + 1).filter((id) => !only || only.has(id)).map(make) }];
  return groups.filter((g) => g.columns.length);
}

export const periodLabel =(p: AnalysisPeriod) => `${shortDate(p.from)} – ${shortDate(p.to)}`;

// ---- Tooltip compartido: un solo nodo por gráfico, no uno por celda ----

type Tip = { content: ReactNode; x: number; y: number } | null;

/** El contenedor del gráfico lleva `{...t.box}`; el tooltip se ubica relativo a él. */
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const box = { "data-tip-host": "" };
  const show = (content: ReactNode) => (e: React.MouseEvent | React.FocusEvent) => {
    const host = (e.currentTarget as Element).closest("[data-tip-host]")?.getBoundingClientRect();
    const r = (e.currentTarget as Element).getBoundingClientRect();
    if (!host) return;
    setTip({ content, x: r.left - host.left + r.width / 2, y: r.top - host.top });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-max max-w-[280px] -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded border border-border bg-popover px-2.5 py-1.5 text-[12px] leading-snug text-popover-foreground shadow-md"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
  return { box, show, hide, node };
}

// ---- Marco ----

export function ChartFigure({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("card m-0 min-w-0", className)}>
      <figcaption className="mb-3">
        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
        {subtitle && <span className="help mt-0.5 block">{subtitle}</span>}
      </figcaption>
      {children}
      {legend && <div className="help mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}
    </figure>
  );
}

export function Swatch({ color, label, dashed }: { color: string; label: ReactNode; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn("inline-block h-3 w-3 rounded-sm", dashed && "border border-dashed border-neutral-300")}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// ---- Cifras clave ----

export function KpiCards({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="card m-0">
          <div className="text-[13px] font-medium text-muted-foreground">{k.label}</div>
          <div className="mt-1 text-[28px] font-semibold leading-tight tabular">{k.value}</div>
          {k.hint && <div className="help mt-1">{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}

// ---- Mapa de calor (A-2, E-2) ----

export interface HeatColumn {
  id: number;
  label: string;
  marked?: boolean;
  highlight?: boolean;
  headerTip?: ReactNode;
}
export interface HeatCell {
  text: string;
  bg: string;
  fg: string;
  low?: boolean;
  href?: string | null;
  tip: ReactNode;
  label?: string;
}
export interface HeatRow {
  key: string;
  header: ReactNode;
  cells: Record<number, HeatCell>;
}

export function Heatmap({
  caption,
  groups,
  rows,
  cellWidth = 28,
}: {
  caption: string;
  groups: { label: string; columns: HeatColumn[] }[];
  rows: HeatRow[];
  cellWidth?: number;
}) {
  const router = useRouter();
  const t = useTip();
  const cols = groups.flatMap((g) => g.columns);
  return (
    <div {...t.box} className="relative">
      {t.node}
      <div className="overflow-x-auto pb-1">
        <table className="border-separate text-[12px]" style={{ borderSpacing: 2 }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-10 bg-card" />
              {groups.map((g) => (
                <th
                  key={g.label}
                  scope="colgroup"
                  colSpan={g.columns.length}
                  className="truncate border-b border-neutral-300 px-1 pb-1 text-left text-[11px] font-medium text-muted-foreground"
                  style={{ maxWidth: g.columns.length * (cellWidth + 2) }}
                  title={g.label}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card pr-2 text-left text-[12px] font-medium text-muted-foreground">
                <span className="sr-only">Persona</span>
              </th>
              {cols.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn("p-0 text-center font-semibold tabular", c.marked && "border-t-2 border-foreground", c.highlight && "bg-neutral-100")}
                  style={{ width: cellWidth, minWidth: cellWidth }}
                  onMouseEnter={t.show(c.headerTip ?? <>Criterio {c.id}</>)}
                  onMouseLeave={t.hide}
                >
                  {c.marked && <TriangleAlert size={11} className="mx-auto block" aria-label="Se marca distinto" />}
                  <RenunciationReasonsButton criterionId={c.id} variant="number">
                    {c.label}
                  </RenunciationReasonsButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 z-10 max-w-[180px] bg-card pr-2 text-left font-normal">
                  {r.header}
                </th>
                {cols.map((c) => {
                  const cell = r.cells[c.id];
                  if (!cell) return <td key={c.id} />;
                  return (
                    <td
                      key={c.id}
                      aria-label={cell.label}
                      className={cn(
                        "h-7 rounded-[3px] p-0 text-center tabular",
                        cell.low && "border border-dashed border-neutral-300",
                        cell.href && "cursor-pointer hover:outline hover:outline-2 hover:outline-foreground",
                      )}
                      style={{ background: cell.low ? "transparent" : cell.bg, color: cell.low ? "var(--muted-foreground)" : cell.fg }}
                      onMouseEnter={t.show(cell.tip)}
                      onMouseLeave={t.hide}
                      onClick={cell.href ? () => router.push(cell.href!) : undefined}
                    >
                      {cell.low ? "—" : cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Barras horizontales (A-3) ----

export function HBars({
  rows,
  max,
  reference,
  label,
  color = "var(--seq-4)",
}: {
  rows: { key: string; name: string; href: string; value: number; valueText: string; sub: string; low?: boolean; tip: ReactNode }[];
  max: number;
  reference?: { value: number; label: string };
  label: string;
  color?: string;
}) {
  const t = useTip();
  const w = (v: number) => `${Math.max(0.5, Math.min(100, (100 * v) / Math.max(max, 0.0001)))}%`;
  return (
    <div {...t.box} className="relative" role="img" aria-label={label}>
      {t.node}
      <div className="grid gap-2" aria-hidden>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-2 text-[13px]">
            <Link href={r.href} className="truncate font-medium text-foreground" tabIndex={-1}>
              {r.name}
            </Link>
            <div className="relative h-3" onMouseEnter={t.show(r.tip)} onMouseLeave={t.hide}>
              <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: w(r.value), background: color, opacity: r.low ? 0.3 : 1 }} />
              {reference && (
                <div className="absolute -inset-y-1 w-0.5" style={{ left: w(reference.value), background: "var(--neutral-700)" }} />
              )}
            </div>
            <span className="whitespace-nowrap tabular">
              {r.valueText} <span className="help">· {r.sub}</span>
            </span>
          </div>
        ))}
      </div>
      {reference && (
        <div className="help mt-1 grid grid-cols-[minmax(90px,140px)_1fr_auto] gap-2" aria-hidden>
          <span />
          <span className="relative h-4">
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: w(reference.value) }}>
              {reference.label}
            </span>
          </span>
          <span />
        </div>
      )}
    </div>
  );
}

// ---- Dispersión (A-4) ----

export function Scatter({
  points,
  xLeft,
  xRight,
  yLabel,
  reference,
  label,
}: {
  points: { key: string; name: string; href: string; x: number; y: number; low?: boolean; tip: ReactNode }[];
  xLeft: string;
  xRight: string;
  yLabel: string;
  reference?: { value: number; label: string };
  label: string;
}) {
  const router = useRouter();
  const t = useTip();
  const W = 560;
  const H = 300;
  const pad = { l: 44, r: 20, t: 14, b: 34 };
  const xMax = Math.max(0.5, ...points.map((p) => Math.abs(p.x))) * 1.2;
  const yMax = Math.max(0.5, reference?.value ?? 0, ...points.map((p) => p.y)) * 1.15;
  const sx = (v: number) => pad.l + ((v + xMax) / (2 * xMax)) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, yMax / 2, yMax].map((v) => Math.round(v * 10) / 10);
  return (
    <div {...t.box} className="relative">
      {t.node}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px]" role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="var(--neutral-200)" />
            <text x={pad.l - 6} y={sy(v) + 4} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
              {dec(v)}
            </text>
          </g>
        ))}
        <line x1={sx(0)} x2={sx(0)} y1={pad.t} y2={H - pad.b} stroke="var(--neutral-300)" />
        {reference && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={sy(reference.value)} y2={sy(reference.value)} stroke="var(--neutral-700)" strokeDasharray="4 3" />
            <text x={W - pad.r} y={sy(reference.value) - 4} textAnchor="end" fontSize={10} fill="var(--neutral-700)">
              {reference.label}
            </text>
          </g>
        )}
        <text x={pad.l} y={H - 8} fontSize={11} fill="var(--muted-foreground)">
          ← {xLeft}
        </text>
        <text x={W - pad.r} y={H - 8} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
          {xRight} →
        </text>
        <text x={10} y={pad.t + 2} fontSize={10} fill="var(--muted-foreground)" transform={`rotate(-90 10 ${pad.t + 2})`} textAnchor="end">
          {yLabel}
        </text>
        {points.map((p, i) => {
          const near = points.slice(0, i).some((q) => Math.abs(sx(q.x) - sx(p.x)) < 40 && Math.abs(sy(q.y) - sy(p.y)) < 12);
          return (
            <g
              key={p.key}
              className="cursor-pointer"
              onMouseEnter={t.show(p.tip)}
              onMouseLeave={t.hide}
              onClick={() => router.push(p.href)}
            >
              <circle
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={5}
                fill={p.low ? "#fff" : "var(--ink-900)"}
                stroke="var(--ink-900)"
                strokeWidth={2}
              />
              <text
                x={sx(p.x) + (sx(p.x) > W * 0.6 ? -9 : 9)}
                y={sy(p.y) + (near ? 15 : 4)}
                textAnchor={sx(p.x) > W * 0.6 ? "end" : "start"}
                fontSize={12}
                fill="var(--foreground)"
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Punto frente al equipo (FA-2) ----

export function DotVsTeam({
  rows,
  label,
}: {
  rows: { key: string; title: ReactNode; value: number; team: number; right: string; sub: string; href: string | null; tip: ReactNode }[];
  label: string;
}) {
  const router = useRouter();
  const t = useTip();
  const max = Math.max(10, ...rows.flatMap((r) => [r.value, r.team])) * 1.1;
  const x = (v: number) => `${(100 * v) / max}%`;
  return (
    <div {...t.box} className="relative" role="img" aria-label={label}>
      {t.node}
      <div className="grid gap-1" aria-hidden>
        {rows.map((r) => (
          <div
            key={r.key}
            className={cn("grid min-h-8 grid-cols-[minmax(140px,240px)_1fr_auto] items-center gap-3 rounded px-1 text-[13px]", r.href && "cursor-pointer hover:bg-neutral-50")}
            onClick={r.href ? () => router.push(r.href!) : undefined}
            onMouseEnter={t.show(r.tip)}
            onMouseLeave={t.hide}
          >
            <span className="truncate">{r.title}</span>
            <span className="relative h-4">
              <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" />
              <span
                className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-neutral-300"
                style={{ left: x(Math.min(r.value, r.team)), width: `${(100 * Math.abs(r.value - r.team)) / max}%` }}
              />
              <span className="absolute -top-0.5 h-5 w-0.5" style={{ left: x(r.team), background: "var(--neutral-700)" }} />
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(r.value), background: "var(--ink-900)" }} />
            </span>
            <span className="whitespace-nowrap text-right tabular">
              {r.right}
              <span className="help block">{r.sub}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Barras divergentes desde 0 (FA-3, FE-2) ----

export function DivergingBars({
  rows,
  equal,
  leftLabel,
  rightLabel,
  label,
}: {
  rows: { key: string; title: ReactNode; value: number; text: string; href: string | null; tip: ReactNode }[];
  equal: number;
  leftLabel: string;
  rightLabel: string;
  label: string;
}) {
  const router = useRouter();
  const t = useTip();
  const max = Math.max(5, Math.ceil(Math.max(...rows.map((r) => Math.abs(r.value))) / 5) * 5);
  return (
    <div {...t.box} className="relative" role="img" aria-label={label}>
      {t.node}
      <div className="help mb-1 grid grid-cols-[minmax(140px,240px)_1fr_90px] gap-3" aria-hidden>
        <span />
        <span className="flex justify-between">
          <span>← {leftLabel}</span>
          <span>{rightLabel} →</span>
        </span>
        <span />
      </div>
      <div className="grid gap-1" aria-hidden>
        {rows.map((r) => {
          const tone = divTone(r.value, equal);
          const w = (50 * Math.min(Math.abs(r.value), max)) / max;
          return (
            <div
              key={r.key}
              className={cn("grid min-h-8 grid-cols-[minmax(140px,240px)_1fr_90px] items-center gap-3 rounded px-1 text-[13px]", r.href && "cursor-pointer hover:bg-neutral-50")}
              onClick={r.href ? () => router.push(r.href!) : undefined}
              onMouseEnter={t.show(r.tip)}
              onMouseLeave={t.hide}
            >
              <span className="truncate">{r.title}</span>
              <span className="relative h-3">
                <span className="absolute -inset-y-1 left-1/2 w-px bg-neutral-300" />
                <span
                  className={cn("absolute inset-y-0", r.value >= 0 ? "rounded-r" : "rounded-l")}
                  style={{
                    left: r.value >= 0 ? "50%" : `${50 - w}%`,
                    width: `${Math.max(w, 0.6)}%`,
                    background: Math.abs(r.value) <= equal ? "var(--neutral-300)" : tone.bg,
                  }}
                />
              </span>
              <span className="whitespace-nowrap tabular">{r.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Puntos de desvío sobre un eje con 0 al centro (E-3) ----

export function DeviationStrip({
  rows,
  equal,
  label,
}: {
  rows: { key: string; name: string; href: string; value: number; low?: boolean; tip: ReactNode }[];
  equal: number;
  label: string;
}) {
  const router = useRouter();
  const t = useTip();
  const max = Math.max(5, Math.ceil(Math.max(...rows.map((r) => Math.abs(r.value)), 0) / 5) * 5);
  const x = (v: number) => `${50 + (50 * Math.max(-max, Math.min(max, v))) / max}%`;
  return (
    <div {...t.box} className="relative" role="img" aria-label={label}>
      {t.node}
      <div className="grid gap-0.5" aria-hidden>
        <div className="help grid grid-cols-[minmax(110px,180px)_1fr_64px] gap-3">
          <span />
          <span className="relative h-4">
            <span className="absolute -translate-x-1/2" style={{ left: x(-max) }}>
              −{max}
            </span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: "50%" }}>
              Igual que el equipo
            </span>
            <span className="absolute -translate-x-full" style={{ left: x(max) }}>
              +{max} pts
            </span>
          </span>
          <span />
        </div>
        {rows.map((r) => {
          const tone = divTone(r.value, equal);
          return (
            <div
              key={r.key}
              className="grid min-h-7 cursor-pointer grid-cols-[minmax(110px,180px)_1fr_64px] items-center gap-3 rounded px-1 text-[13px] hover:bg-neutral-50"
              onClick={() => router.push(r.href)}
              onMouseEnter={t.show(r.tip)}
              onMouseLeave={t.hide}
            >
              <span className="truncate">{r.name}</span>
              <span className="relative h-5">
                <span className="absolute inset-y-0" style={{ left: x(-equal), width: `${(100 * equal) / max}%`, background: "var(--div-mid)" }} />
                <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" />
                <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-300" />
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: x(r.value),
                    borderColor: Math.abs(r.value) <= equal ? "var(--neutral-700)" : tone.bg,
                    background: r.low ? "#fff" : Math.abs(r.value) <= equal ? "var(--neutral-700)" : tone.bg,
                  }}
                />
              </span>
              <span className="text-right tabular">{signed(r.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Pesas IA vs auditor (E-4, FE-3) ----

export function Dumbbell({ ai, sheet, max = 100, width = 120 }: { ai: number; sheet: number | null; max?: number; width?: number }) {
  const x = (v: number) => 6 + ((width - 12) * Math.min(v, max)) / Math.max(max, 1);
  return (
    <svg width={width} height={16} aria-hidden className="inline-block align-middle">
      <line x1={6} x2={width - 6} y1={8} y2={8} stroke="var(--neutral-200)" />
      {sheet != null && <line x1={x(ai)} x2={x(sheet)} y1={8} y2={8} stroke="var(--neutral-300)" strokeWidth={2} />}
      <circle cx={x(ai)} cy={8} r={4.5} fill="var(--analysis-ai)" />
      {sheet != null && <circle cx={x(sheet)} cy={8} r={4} fill="#fff" stroke="var(--analysis-sheet)" strokeWidth={2} />}
    </svg>
  );
}

export function DumbbellLegend() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <svg width={12} height={12} aria-hidden>
          <circle cx={6} cy={6} r={4.5} fill="var(--analysis-ai)" />
        </svg>
        Según la IA
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width={12} height={12} aria-hidden>
          <circle cx={6} cy={6} r={4} fill="#fff" stroke="var(--analysis-sheet)" strokeWidth={2} />
        </svg>
        Según el auditor
      </span>
    </>
  );
}

// ---- Evolución en 3 tramos (FA-4, FE-4) ----

export interface LineSeries {
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** Punto con borde y relleno blanco (auditor) o por «pocas llamadas». */
  hollow?: boolean;
  low?: boolean[];
}

export function TrendChart({
  periods,
  series,
  format,
  label,
  lowNote,
}: {
  periods: AnalysisPeriod[];
  series: LineSeries[];
  format: (v: number) => string;
  label: string;
  lowNote?: boolean[];
}) {
  const W = 520;
  const H = 200;
  const pad = { l: 16, r: 150, t: 22, b: 40 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const yMax = Math.max(...all, 0.1) * 1.2;
  const sx = (i: number) => pad.l + 30 + (i * (W - pad.l - pad.r - 60)) / Math.max(periods.length - 1, 1);
  const sy = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  // Rótulos al final de cada línea sin encimarse: se ordenan por altura y se separan 14 px como mínimo.
  const lastOf = (s: LineSeries) => s.values.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
  const ends = series
    .map((s, k) => ({ k, y: lastOf(s) >= 0 ? sy(s.values[lastOf(s)]!) + 4 : null }))
    .filter((e): e is { k: number; y: number } => e.y != null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  const endY = new Map(ends.map((e) => [e.k, e.y]));
  // Cifra sobre el punto más alto de cada tramo y bajo los demás, para que no se tapen.
  const above = (k: number, i: number) => {
    const v = series[k].values[i];
    return series.every(
      (s, j) => j === k || s.dashed || s.values[i] == null || v == null || v > s.values[i]! || (v === s.values[i] && k < j),
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[640px]" role="img" aria-label={label}>
      <line x1={pad.l} x2={W - pad.r + 10} y1={sy(0)} y2={sy(0)} stroke="var(--neutral-300)" />
      {periods.map((p, i) => (
        <g key={p.id}>
          <text x={sx(i)} y={H - pad.b + 16} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
            {periodLabel(p)}
          </text>
          {lowNote?.[i] && (
            <text x={sx(i)} y={H - pad.b + 30} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
              pocas llamadas
            </text>
          )}
        </g>
      ))}
      {series.map((s, k) => {
        const pts = s.values.map((v, i) => (v == null ? null : ([sx(i), sy(v)] as const)));
        const path = pts
          .map((p, i) => (p ? `${i === 0 || !pts[i - 1] ? "M" : "L"}${p[0]},${p[1]}` : ""))
          .join(" ");
        const lastIdx = lastOf(s);
        return (
          <g key={s.label}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} />
            {pts.map(
              (p, i) =>
                p && (
                  <g key={i}>
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={4}
                      fill={s.hollow || s.low?.[i] ? "#fff" : s.color}
                      stroke={s.color}
                      strokeWidth={2}
                    />
                    {!s.dashed && (
                      <text
                        x={p[0]}
                        y={above(k, i) ? p[1] - 9 : p[1] + 17}
                        textAnchor="middle"
                        fontSize={11}
                        fill="var(--foreground)"
                        className="tabular"
                      >
                        {format(s.values[i]!)}
                      </text>
                    )}
                  </g>
                ),
            )}
            {lastIdx >= 0 && (
              <text x={sx(lastIdx) + 12} y={endY.get(k)} fontSize={11} fill="var(--foreground)">
                {s.label}
                {s.dashed ? ` ${format(s.values[lastIdx]!)}` : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
