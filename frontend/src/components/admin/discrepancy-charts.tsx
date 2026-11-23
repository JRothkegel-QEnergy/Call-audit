"use client";

/**
 * Gráficos del análisis de discrepancias (Cambio 19 §7). Todo en HTML/CSS, sin librería: cada gráfico es un `figure`
 * con su equivalente en texto, las barras dibujadas van `aria-hidden` y nada depende solo del color (relleno sólido vs.
 * rayado, posición y rótulo). Cuentan casos (criterio × llamada), no patrones.
 */
import type { CSSProperties, ReactNode } from "react";
import type {
  ActionGroup,
  DiscrepancyPattern,
  DiscrepancySummary,
  KindCounts,
  WhoIsRight,
} from "@/lib/api/admin-types";
import { int } from "@/lib/format";

// --- Rellenos -----------------------------------------------------------------------------------------------------

const solid = (color: string): CSSProperties => ({ background: color });
const striped = (color: string): CSSProperties => ({
  background: `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`,
  boxShadow: `inset 0 0 0 1px ${color}`,
});
const dotted = (color: string): CSSProperties => ({
  background: `radial-gradient(${color} 1.2px, transparent 1.4px) 0 0 / 5px 5px`,
  boxShadow: `inset 0 0 0 1px ${color}`,
});
const empty = (color: string): CSSProperties => ({
  background: "transparent",
  boxShadow: `inset 0 0 0 1px ${color}`,
});

const NEUTRAL = "var(--neutral-500)";
const FP = "var(--series-1)";
const FN = "var(--series-2)";

export const ACTION_LABEL: Record<ActionGroup, string> = {
  prompt_rule: "Regla del prompt",
  calibrate_auditor: "Calibrar con el auditor",
  company: "Depende de la empresa",
  none: "Sin propuesta",
  observation: "Observación",
  unpatterned: "Sin patrón",
};
const ACTION_FILL: Record<ActionGroup, CSSProperties> = {
  prompt_rule: solid("var(--series-3)"),
  calibrate_auditor: solid("var(--series-4)"),
  company: solid(NEUTRAL),
  none: striped(NEUTRAL),
  observation: dotted(NEUTRAL),
  unpatterned: empty(NEUTRAL),
};

export const WHO_LABEL: Record<WhoIsRight | "unpatterned", string> = {
  auditor: "El auditor",
  ia: "La IA",
  ambiguo: "Ambiguo",
  unpatterned: "Sin patrón",
};
const WHO_FILL: Record<WhoIsRight | "unpatterned", CSSProperties> = {
  auditor: solid("var(--series-5)"),
  ia: solid("var(--series-6)"),
  ambiguo: solid(NEUTRAL),
  unpatterned: empty(NEUTRAL),
};

const pct = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

// --- Piezas comunes -----------------------------------------------------------------------------------------------

export function Swatch({ fill }: { fill: CSSProperties }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-[2px]" style={fill} />;
}

interface Segment<K extends string> {
  key: K;
  label: string;
  value: number;
  fill: CSSProperties;
}

/** Barra 100 % con la lista de segmentos y sus números debajo (el equivalente en texto). */
function StackedBar<K extends string>({
  title,
  caption,
  segments,
  selected,
  onSelect,
  note,
}: {
  title: string;
  caption: string;
  segments: Segment<K>[];
  selected?: string | null;
  onSelect?: (key: K | null) => void;
  note?: ReactNode;
}) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((n, s) => n + s.value, 0);
  return (
    <figure className="m-0 grid gap-1.5">
      <figcaption className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{title}</span>
        <span className="help">{caption}</span>
      </figcaption>
      <div aria-hidden className="flex h-6 w-full gap-[2px] overflow-hidden rounded-[3px]">
        {shown.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${int(s.value)} (${pct(s.value, total)} %)`}
            className="h-full min-w-[3px]"
            style={{
              ...s.fill,
              flexGrow: s.value,
              flexBasis: 0,
              opacity: selected && selected !== s.key ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-sm">
        {shown.map((s) => {
          const text = (
            <>
              <Swatch fill={s.fill} />
              {s.label} <b className="tabular">{int(s.value)}</b> <span className="help">({pct(s.value, total)} %)</span>
            </>
          );
          return (
            <li key={s.key}>
              {onSelect ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
                  aria-pressed={selected === s.key}
                  onClick={() => onSelect(selected === s.key ? null : s.key)}
                >
                  {text}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5">{text}</span>
              )}
            </li>
          );
        })}
      </ul>
      {note}
    </figure>
  );
}

/** Aviso de lo que solo trae el prompt de análisis v1.1+ (§7.7). */
export function NoData({ version, what }: { version: string; what?: string }) {
  return (
    <p className="help m-0">
      {what ? `${what}: s` : "S"}in dato en este análisis: el prompt de análisis v{version} no lo decide. Aparece al correr un análisis
      nuevo.
    </p>
  );
}

// --- Resumen ------------------------------------------------------------------------------------------------------

// --- ¿Dónde se arregla? / ¿Quién tiene más razón? -----------------------------------------------------------------

export function ActionBar({
  s,
  criteria,
  selected,
  onSelect,
}: {
  s: DiscrepancySummary;
  criteria: number;
  selected: string | null;
  onSelect: (key: ActionGroup | null) => void;
}) {
  const keys = Object.keys(ACTION_LABEL) as ActionGroup[];
  return (
    <StackedBar
      title="¿Dónde se arregla?"
      caption={`desacuerdos por criterio de los ${criteria} criterios analizados, según la propuesta de cada patrón`}
      segments={keys.map((k) => ({
        key: k,
        label: ACTION_LABEL[k],
        value: s.byAction[k],
        fill: ACTION_FILL[k],
      }))}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

// --- Prioridad de los patrones ------------------------------------------------------------------------------------

/** H-139: 10 o más casos; H-114: confianza alta ≥ 0,7. */
export const MANY_CASES = 10;
export type Quadrant = "start" | "check" | "quick" | "later";
export function quadrantOf(p: DiscrepancyPattern): Quadrant {
  const many = p.caseCount >= MANY_CASES;
  const high = (p.confidence ?? 0) >= 0.7;
  return many ? (high ? "start" : "check") : high ? "quick" : "later";
}
export const QUADRANT_LABEL: Record<Quadrant, [string, string]> = {
  start: ["Empezar aquí", "confianza alta · 10 o más desacuerdos"],
  check: ["Revisar desacuerdos primero", "confianza media o baja · 10 o más desacuerdos"],
  quick: ["Rápidos", "confianza alta · menos de 10 desacuerdos"],
  later: ["Dejar para después", "confianza media o baja · menos de 10 desacuerdos"],
};

export function PriorityMap({
  patterns,
  selected,
  onSelect,
  onPick,
}: {
  patterns: DiscrepancyPattern[];
  selected: Quadrant | null;
  onSelect: (q: Quadrant | null) => void;
  /** Ficha de un patrón: lleva a su criterio (el patrón puede no estar en la página actual). */
  onPick: (p: DiscrepancyPattern) => void;
}) {
  const pending = patterns.filter((p) => !p.isObservation && p.status === "pending");
  return (
    <details className="card" open={selected != null || undefined}>
      <summary className="cursor-pointer font-medium">Prioridad de los patrones ({pending.length} pendientes)</summary>
      {pending.length === 0 ? (
        <p className="help mb-0">No hay patrones pendientes para priorizar.</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {(Object.keys(QUADRANT_LABEL) as Quadrant[]).map((q) => {
            const mine = pending.filter((p) => quadrantOf(p) === q).sort((a, b) => b.caseCount - a.caseCount);
            const [title, desc] = QUADRANT_LABEL[q];
            return (
              <div
                key={q}
                role="group"
                aria-label={title}
                className={`grid content-start gap-1.5 rounded border p-2 ${selected === q ? "border-[var(--ink-800)]" : "border-border"}`}
              >
                {mine.length ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm justify-start text-left"
                    aria-pressed={selected === q}
                    onClick={() => onSelect(selected === q ? null : q)}
                  >
                    <b>{title}</b>&nbsp;· {mine.length}
                  </button>
                ) : (
                  <span className="px-2 font-semibold">{title} · Ninguno</span>
                )}
                <span className="help px-2">{desc}</span>
                <div className="flex flex-wrap gap-1 px-2">
                  {mine.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="chip min-h-6 cursor-pointer pr-3"
                      title={p.title}
                      aria-label={`Criterio ${p.criterionId}, ${p.caseCount} desacuerdos: ${p.title}`}
                      onClick={() => onPick(p)}
                    >
                      M{p.criterionId} · {p.caseCount}
                    </button>
                  ))}
                  {mine.length > 8 && <span className="help">y {mine.length - 8} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="help mb-0 mt-2">Clic en un cuadrante: filtra la lista. Clic en una ficha: va a ese patrón.</p>
    </details>
  );
}

// --- En la tarjeta y el detalle del patrón ----------------------------------------------------------------------------

/** Mini barra de casos del patrón: solo la IA · omitidos · dudosas (§7.3). */
export function CaseMix({ k, label = "Desacuerdos" }: { k: KindCounts; label?: string }) {
  const total = k.fp + k.fn + k.uncertain;
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span aria-hidden className="flex h-3 w-40 gap-[1px] overflow-hidden rounded-[2px]">
        {k.fp > 0 && <span style={{ ...solid(FP), flexGrow: k.fp }} />}
        {k.fn > 0 && <span style={{ ...solid(FN), flexGrow: k.fn }} />}
        {k.uncertain > 0 && <span style={{ ...striped(NEUTRAL), flexGrow: k.uncertain }} />}
        {total === 0 && <span className="flex-1" style={empty(NEUTRAL)} />}
      </span>
      <span>
        {k.fp} solo la IA · {k.fn} omitidos · {k.uncertain} dudosas
      </span>
    </p>
  );
}

/** Barra «corregiría X de N» (v1.1+). */
export function FixBar({ fixed, total }: { fixed: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>
        corregiría {fixed} de {total} desacuerdos
      </span>
      <span aria-hidden className="flex h-3 w-32 overflow-hidden rounded-[2px]" style={empty(NEUTRAL)}>
        <span
          style={{
            ...solid("var(--series-3)"),
            width: `${pct(fixed, total)}%`,
          }}
        />
      </span>
    </span>
  );
}

/** Líneas de v1.1+ en la tarjeta: más razón, corregiría, podría cambiar, concentración. Sin dato = no aparecen. */
export function PatternAiLines({ p }: { p: DiscrepancyPattern }) {
  if (p.whoIsRight == null && p.expectedFix == null && !p.sideEffects && !p.concentration) return null;
  return (
    <div className="grid gap-0.5 text-sm">
      {p.whoIsRight && (
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Swatch fill={WHO_FILL[p.whoIsRight]} />
            Más razón: <b>{WHO_LABEL[p.whoIsRight].toLowerCase()}</b> · según el análisis
          </span>
          {p.tentative && <span className="chip">Tentativo</span>}
        </p>
      )}
      {p.expectedFix != null && p.proposal && (
        <p className="m-0">
          Si se acepta: <FixBar fixed={p.expectedFix.length} total={p.caseCount} />
        </p>
      )}
      {p.sideEffects && <p className="m-0">Podría cambiar: {p.sideEffects}</p>}
      {p.concentration && <p className="m-0">Concentración: {p.concentration}</p>}
    </div>
  );
}

// --- Seguimiento --------------------------------------------------------------------------------------------------

export function FollowUpProgress({ resolved, waiting, discarded }: { resolved: number; waiting: number; discarded: number }) {
  return (
    <StackedBar
      title={`Avance de las propuestas aceptadas (${resolved + waiting})`}
      caption={discarded ? `· ${discarded} descartadas` : ""}
      segments={[
        {
          key: "resolved",
          label: "Resueltas",
          value: resolved,
          fill: solid("var(--series-3)"),
        },
        {
          key: "waiting",
          label: "Esperan",
          value: waiting,
          fill: empty(NEUTRAL),
        },
      ]}
    />
  );
}
