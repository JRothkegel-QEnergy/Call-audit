"use client";

/**
 * Gráficos del análisis de discrepancias (Cambio 19 §7). Todo en HTML/CSS, sin librería: cada gráfico es un `figure`
 * con su equivalente en texto, las barras dibujadas van `aria-hidden` y nada depende solo del color (relleno sólido vs.
 * rayado, posición y rótulo). Cuentan casos (motivo × llamada), no patrones.
 */
import type { CSSProperties, ReactNode } from "react";
import type {
  ActionGroup,
  DiscrepancyCriterionRow,
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

const NEUTRAL = "var(--neutral-500, #737373)";
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

function Tile({ value, label, sub, onClick }: { value: string; label: string; sub?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="text-2xl font-semibold tabular">{value}</span>
      <span className="font-medium">{label}</span>
      {sub && <span className="help">{sub}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className="card grid content-start gap-0.5 text-left hover:border-[var(--ink-500,#555)]" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="card grid content-start gap-0.5">{body}</div>
  );
}

export function SummaryTiles({
  s,
  hasAnalysis,
  followUp,
  stale,
  onFollowUp,
}: {
  s: DiscrepancySummary;
  hasAnalysis: boolean;
  followUp: { accepted: number; resolved: number; discarded: number };
  stale: boolean;
  onFollowUp: () => void;
}) {
  const waiting = followUp.accepted - followUp.resolved;
  return (
    <section className="grid gap-2" aria-labelledby="summary-title">
      <h2 id="summary-title" className="m-0 flex items-center gap-2 text-lg font-semibold">
        Resumen
        {stale && <span className="help font-normal text-[var(--amber-700,#9a6700)]">· Desactualizado</span>}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          value={int(s.disagreements)}
          label="casos en desacuerdo"
          sub={
            <>
              en {s.criteriaWithDisagreements} motivos
              {s.criteriaNotAnalyzed ? ` · ${s.criteriaNotAnalyzed} sin analizar` : ""}
            </>
          }
        />
        {hasAnalysis && (
          <>
            <Tile
              value={`${pct(s.explainedCases, s.analyzedCases)} %`}
              label="explicado por patrones"
              sub={
                <>
                  {int(s.explainedCases)} de {int(s.analyzedCases)} casos analizados
                  {s.staleCases > 0 && (
                    <>
                      <br />
                      {int(s.staleCases)} casos del análisis ya no están en desacuerdo
                    </>
                  )}
                </>
              }
            />
            <Tile
              value={`${s.pendingProposals} ${s.pendingProposals === 1 ? "propuesta" : "propuestas"}`}
              label="por decidir"
              sub={`${int(s.pendingCases)} casos`}
            />
            <Tile
              value={`${followUp.resolved} de ${followUp.accepted}`}
              label="aceptadas ya resueltas"
              sub={waiting > 0 ? `${waiting} ${waiting === 1 ? "espera" : "esperan"} versión, pregunta o calibración` : "Ninguna esperando"}
              onClick={onFollowUp}
            />
          </>
        )}
      </div>
    </section>
  );
}

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
      caption={`casos de los ${criteria} motivos analizados, según la propuesta de cada patrón`}
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

export function WhoIsRightBar({
  s,
  version,
  selected,
  onSelect,
}: {
  s: DiscrepancySummary;
  version: string;
  selected: string | null;
  onSelect: (key: WhoIsRight | null) => void;
}) {
  if (!s.byWhoIsRight) {
    return (
      <div className="grid gap-0.5">
        <span className="font-semibold">¿Quién tiene más razón?</span>
        <NoData version={version} />
      </div>
    );
  }
  const keys = Object.keys(WHO_LABEL) as (WhoIsRight | "unpatterned")[];
  return (
    <StackedBar
      title="¿Quién tiene más razón?"
      caption="según el análisis, no es una medición"
      segments={keys.map((k) => ({
        key: k,
        label: WHO_LABEL[k],
        value: s.byWhoIsRight![k],
        fill: WHO_FILL[k],
      }))}
      selected={selected}
      onSelect={(k) => onSelect(k === "unpatterned" ? null : k)}
    />
  );
}

// --- ¿Dónde están los desacuerdos? (barras divergentes) -------------------------------------------------------------

function Half({
  total,
  inPattern,
  scale,
  color,
  side,
}: {
  total: number;
  inPattern: number | null;
  scale: number;
  color: string;
  side: "left" | "right";
}) {
  const explained = inPattern == null ? total : Math.min(inPattern, total);
  const rest = total - explained;
  const parts = [
    { w: explained, fill: solid(color) },
    { w: rest, fill: striped(color) },
  ];
  if (side === "left") parts.reverse();
  return (
    <div className={`flex h-4 ${side === "left" ? "justify-end" : "justify-start"}`}>
      {parts.map((p, i) =>
        p.w > 0 ? (
          <div
            key={i}
            className="h-full"
            style={{
              ...p.fill,
              width: `${(100 * p.w) / scale}%`,
              opacity: inPattern == null ? 0.55 : 1,
            }}
          />
        ) : null,
      )}
    </div>
  );
}

export function CriteriaChart({
  rows,
  selected,
  onSelect,
  limit,
}: {
  rows: DiscrepancyCriterionRow[];
  selected: number | null;
  onSelect: (criterionId: number) => void;
  /** Cambio 20 §6: solo los primeros motivos. La escala sigue saliendo de todos, para que no cambie al expandir. */
  limit?: number;
}) {
  const all = rows.filter((r) => r.fp + r.fn > 0);
  const withDisagreements = limit ? all.slice(0, limit) : all;
  const quiet = limit ? [] : rows.filter((r) => r.fp + r.fn === 0);
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.fp, r.fn)));
  const row = (r: DiscrepancyCriterionRow) => {
    const analyzed = r.explained != null;
    const ex = r.explained;
    const label = analyzed
      ? `Motivo ${r.criterionId}: ${r.fp} solo la IA detectó, ${r.fn} omitidos por la IA, ${(ex?.fp ?? 0) + (ex?.fn ?? 0)} en un patrón, ${r.fp + r.fn - (ex?.fp ?? 0) - (ex?.fn ?? 0)} sin patrón. Ver sus patrones`
      : `Motivo ${r.criterionId}: ${r.fp} solo la IA detectó, ${r.fn} omitidos por la IA, sin analizar`;
    return (
      <li key={r.criterionId}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={selected === r.criterionId}
          disabled={!analyzed}
          onClick={() => onSelect(r.criterionId)}
          className={`grid w-full grid-cols-1 items-center gap-x-2 gap-y-0.5 rounded px-1 py-1 text-left text-sm enabled:hover:bg-[var(--neutral-100,#f4f4f4)] xl:grid-cols-[minmax(14rem,20rem)_1fr_minmax(9rem,auto)] ${
            selected === r.criterionId ? "bg-[var(--neutral-100,#f4f4f4)]" : ""
          }`}
        >
          <span className="truncate">
            {r.criterionId} · {r.name}
          </span>
          <span aria-hidden className="grid grid-cols-[2.5rem_1fr_2px_1fr_2.5rem] items-center gap-1">
            <span className="text-right tabular">{r.fp}</span>
            <Half total={r.fp} inPattern={ex ? ex.fp : null} scale={scale} color={FP} side="left" />
            <span className="h-5 bg-[var(--neutral-400,#a3a3a3)]" />
            <Half total={r.fn} inPattern={ex ? ex.fn : null} scale={scale} color={FN} side="right" />
            <span className="tabular">{r.fn}</span>
          </span>
          <span aria-hidden className="help">
            {analyzed ? `${r.aiUncertain} dudosas · ${r.patterns} ${r.patterns === 1 ? "patrón" : "patrones"}` : "sin analizar"}
          </span>
        </button>
      </li>
    );
  };
  return (
    <figure className="m-0 grid gap-1">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={solid(FP)} /> Solo la IA detectó (izquierda)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={solid(FN)} /> Omitidos por la IA (derecha)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={solid(NEUTRAL)} /> en un patrón
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={striped(NEUTRAL)} /> sin patrón
        </span>
      </figcaption>
      <ul className="m-0 grid list-none gap-0 p-0">{withDisagreements.map(row)}</ul>
      {quiet.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Mostrar {quiet.length} motivos sin desacuerdos</summary>
          <ul className="m-0 grid list-none gap-0 p-0">{quiet.map(row)}</ul>
        </details>
      )}
      <p className="help m-0">Clic en un motivo: abre sus patrones. Los motivos sin analizar se ven más claros y sin división.</p>
    </figure>
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
  start: ["Empezar aquí", "confianza alta · 10 o más casos"],
  check: ["Revisar casos primero", "confianza media o baja · 10 o más casos"],
  quick: ["Rápidos", "confianza alta · menos de 10 casos"],
  later: ["Dejar para después", "confianza media o baja · menos de 10 casos"],
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
  /** Ficha de un patrón: lleva a su motivo (el patrón puede no estar en la página actual). */
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
                className={`grid content-start gap-1.5 rounded border p-2 ${selected === q ? "border-[var(--ink-700,#333)]" : "border-border"}`}
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
                      aria-label={`Motivo ${p.criterionId}, ${p.caseCount} casos: ${p.title}`}
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
export function CaseMix({ k, label = "Casos" }: { k: KindCounts; label?: string }) {
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
        corregiría {fixed} de {total} casos
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
