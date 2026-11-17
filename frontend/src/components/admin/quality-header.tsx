"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Swatch, VerificationLine } from "@/components/admin/agreement-charts";
import { listHref } from "@/components/admin/verification-labels";
import { MetricHelp } from "@/components/ui/metric-help";
import type { Agreement, CallList } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";

/**
 * Cabecera común «Calidad de v{X}» (docs/ux/admin-prompt-metrics/05-numeros-propuesta.md §3): la misma en Prueba,
 * Calidad de la IA y Análisis de discrepancias. Todo sale del bloque `agreement` (las filas del mosaico), así que las
 * partes suman a la vista (N-R5): FP = amarillo + azul de ese lado; FN = rojo + azul de ese lado.
 */

export interface Goals {
  falsePositivePct: number;
  falseNegativePct: number;
}

export const DEFAULT_GOALS: Goals = { falsePositivePct: 5, falseNegativePct: 20 };

const int = (n: number) => n.toLocaleString("es-CL");
const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);
const llamadas = (n: number) => `${int(n)} ${n === 1 ? "llamada" : "llamadas"}`;

/** Cifras de la cabecera, para reutilizarlas en la comparación entre versiones (§5.1-3). */
export function headerNumbers(a: Agreement) {
  const b = a.byCall;
  const approved = b.approved ?? b.promptFp + b.reviewerFp + b.agree;
  const rejected = b.rejected ?? b.n - approved;
  return {
    n: b.n,
    agree: b.agree,
    reviewer: b.reviewer,
    undecided: b.undecided,
    fp: b.promptFp + b.reviewerFp,
    fn: b.promptFn + b.reviewerFn,
    approved,
    rejected,
    agreePct: pct(b.agree, b.n),
    fpPct: pct(b.promptFp + b.reviewerFp, approved),
    fnPct: pct(b.promptFn + b.reviewerFn, rejected),
  };
}

/** Universo en una línea (N-R1): «218 de las 220 llamadas de validación (2 con error de la IA, fuera)». */
export function scopeText(a: Agreement): string {
  const s = a.scope;
  if (!s || s.total === s.measured) return `${int(a.byCall.n)} llamadas de validación`;
  const out = [s.errors ? `${int(s.errors)} con error de la IA` : null, s.noReference ? `${int(s.noReference)} sin planilla por motivo` : null]
    .filter(Boolean)
    .join(", ");
  return `${int(s.measured)} de las ${int(s.total)} llamadas de validación (${out}, fuera del cálculo)`;
}

/** Universo de la corrida en curso: «87 de 220 llamadas de validación · en curso · 2 con error de la IA, fuera del cálculo». */
export function partialScopeText(a: Agreement, p: { done: number; total: number }): string {
  const errors = a.scope?.errors ?? 0;
  const out = errors ? ` · ${int(errors)} con error de la IA, fuera del cálculo` : "";
  return `${int(p.done)} de ${int(p.total)} llamadas de validación · en curso${out}`;
}

export function GoalBadge({ ok, goal, partial }: { ok: boolean; goal: number; partial?: boolean }) {
  // Con cifras parciales la meta no se evalúa (14-corrida-en-curso.md, U2): badge neutro, sin ✓/✗.
  if (partial) return <span className="vt border-border text-muted-foreground">Parcial · meta ≤ {goal} %</span>;
  const Icon = ok ? Check : X;
  return (
    <span className={cn("vt", ok ? "vt-pass" : "vt-fail")}>
      <Icon size={12} aria-hidden />
      {ok ? "Cumple" : "Fuera de"} meta ≤ {goal} %
    </span>
  );
}

/** Sublínea de una meta sin el posible error del revisor (R3 A, 10-resumen-mas-informacion.md B1). Va en condicional
 * («Cumpliría») y con cuánto del azul está verificado, para que no se lea como meta cumplida. */
function WithoutBlue({ k, n, goal, href, a }: { k: number; n: number; goal: number; href: string | null; a: Agreement }) {
  const value = pct(k, n);
  const ok = value <= goal;
  const v = a.verification?.reviewer;
  const text = `Sin el posible error del revisor: ${value} % · ${int(k)} de ${int(n)}`;
  return (
    <span className="mt-1 block text-[12px]">
      {href ? <Link href={href}>{text}</Link> : text}{" "}
      <span className={cn("vt", ok ? "vt-pass" : "vt-fail")}>{ok ? "Cumpliría" : "No cumpliría"}</span>
      <span className="help block">
        Depende del azul: {int(v?.reviewed ?? 0)} de {int(a.byCall.reviewer)} llamadas verificadas.
      </span>
    </span>
  );
}

function Card({
  title,
  help,
  value,
  sub,
  extra,
  href,
  label,
  swatch,
}: {
  title: string;
  help: ReactNode;
  value: string;
  sub: ReactNode;
  extra?: ReactNode;
  href: string | null;
  label: string;
  swatch?: ReactNode;
}) {
  return (
    <div className="card grid content-start gap-1 p-3">
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold">
        {swatch}
        {title}
        <MetricHelp title={title}>{help}</MetricHelp>
      </p>
      <p className="m-0 text-2xl font-semibold tabular leading-tight">{value}</p>
      <div className="text-[13px] tabular">{sub}</div>
      {extra && <div className="text-[13px]">{extra}</div>}
      {href && (
        <Link href={href} className="mt-auto text-[13px]" aria-label={label}>
          Ver llamadas ›
        </Link>
      )}
    </div>
  );
}

/**
 * @param linkVersion versión cuya lista de llamadas abre cada cifra; null sin lista (la vigente medida con sus corridas).
 * @param compare otra medición sobre las mismas llamadas para el «vs vX» de Coincide (solo si su n es el mismo).
 */
export function QualityHeader({
  version,
  a,
  goals = DEFAULT_GOALS,
  linkVersion,
  compare,
  action,
  note,
  partial,
}: {
  version: string;
  a: Agreement;
  goals?: Goals;
  linkVersion: string | null;
  compare?: { label: string; a: Agreement } | null;
  action?: ReactNode;
  note?: ReactNode;
  /** Corrida completa en curso: llamadas de validación terminadas de las que trae (14-corrida-en-curso.md). */
  partial?: { done: number; total: number } | null;
}) {
  const h = headerNumbers(a);
  const b = a.byCall;
  const analyzed = a.causeAnalysis.status === "done";
  const href = (list: CallList) => (linkVersion ? listHref(linkVersion, list) : null);
  const other = compare && compare.a.byCall.n === b.n ? headerNumbers(compare.a) : null;
  const diff = other ? h.agreePct - other.agreePct : null;
  const fpOk = h.fpPct <= goals.falsePositivePct;
  const fnOk = h.fnPct <= goals.falseNegativePct;
  const split = (prompt: number, reviewer: number) =>
    analyzed ? (
      <>
        = {int(prompt)} a corregir + {int(reviewer)} posible error del revisor
      </>
    ) : (
      <>sin separar el posible error del revisor (causa sin analizar)</>
    );

  return (
    <section className="grid gap-2" aria-labelledby="quality-header">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="quality-header" className="m-0 text-base font-semibold">
          Calidad de v{version}
          {partial && " · corrida completa en curso"}
        </h2>
        <span className="help">{partial ? partialScopeText(a, partial) : scopeText(a)}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {note}
      {!!a.sameCallRules && (
        <p className="m-0 text-[13px]" role="note">
          Medido en las mismas llamadas de donde salieron {a.sameCallRules} {a.sameCallRules === 1 ? "regla" : "reglas"} de esta versión: la mejora
          se ve más grande de lo que es.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Coincide con el revisor"
          help="De cada 100 llamadas, en cuántas la IA llegó al mismo veredicto final (Cumple o No cumple) que la planilla del revisor. Las que la IA deja sin decisión no cuentan como coincidentes."
          value={`${h.agreePct} %`}
          sub={`${int(h.agree)} de ${llamadas(h.n)}`}
          extra={
            diff != null && compare ? (
              <span className="help">
                vs {compare.label}: {diff === 0 ? "sin cambio" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${Math.abs(diff) === 1 ? "punto" : "puntos"}`}
              </span>
            ) : null
          }
          href={href("agree")}
          label={`Coincide con el revisor: ${h.agreePct} %, ${int(h.agree)} de ${llamadas(h.n)}. Ver llamadas`}
          swatch={<Swatch part="agree" />}
        />
        <Card
          title="Posible error del revisor"
          help="Llamadas en que una IA de análisis revisó cada motivo en desacuerdo y concluyó que se equivocó el revisor al llenar la planilla, no el prompt. Es su juicio: la verificación a mano dice cuánto se confirma."
          value={analyzed ? `${pct(h.reviewer, h.n)} %` : "—"}
          sub={analyzed ? llamadas(h.reviewer) : "Causa sin analizar"}
          extra={linkVersion && analyzed ? <VerificationLine version={linkVersion} a={a} /> : null}
          href={analyzed && h.reviewer > 0 ? href("reviewer") : null}
          label={`Posible error del revisor: ${pct(h.reviewer, h.n)} %, ${llamadas(h.reviewer)}. Ver llamadas`}
          swatch={<Swatch part="reviewer" />}
        />
        <Card
          title="Falsas alarmas"
          help={`De las llamadas que el revisor aprobó, cuántas rechaza la IA. Cada falsa alarma es una llamada que un auditor revisa sin necesidad. Meta del proyecto: ${goals.falsePositivePct} % o menos. Se separa en lo que hay que corregir en el prompt (amarillo) y lo que la IA de análisis atribuye a la planilla (azul).`}
          value={`${h.fpPct} %`}
          sub={
            <>
              {int(h.fp)} de {llamadas(h.approved)} que el revisor aprobó <GoalBadge ok={fpOk} goal={goals.falsePositivePct} partial={!!partial} />
            </>
          }
          extra={
            <>
              <span className="help">{split(b.promptFp, b.reviewerFp)}</span>
              {analyzed && (
                <WithoutBlue
                  k={b.promptFp}
                  n={h.approved}
                  goal={goals.falsePositivePct}
                  href={linkVersion ? listHref(linkVersion, "promptFp") : null}
                  a={a}
                />
              )}
            </>
          }
          href={h.fp > 0 ? href("fp") : null}
          label={`Falsas alarmas: ${h.fpPct} %, ${int(h.fp)} de ${llamadas(h.approved)} que el revisor aprobó, ${partial ? "cifra parcial, la meta se evalúa al terminar" : `${fpOk ? "cumple" : "no cumple"} la meta de ${goals.falsePositivePct} %`}. Ver llamadas`}
          swatch={<Swatch part="promptFp" />}
        />
        <Card
          title="Rechazos no detectados"
          help={`De las llamadas que el revisor rechazó, cuántas aprueba la IA. Son incumplimientos que la IA deja pasar. Meta del proyecto: ${goals.falseNegativePct} % o menos. Se separa en lo que hay que corregir en el prompt (rojo) y lo que la IA de análisis atribuye a la planilla (azul).`}
          value={`${h.fnPct} %`}
          sub={
            <>
              {int(h.fn)} de {llamadas(h.rejected)} que el revisor rechazó <GoalBadge ok={fnOk} goal={goals.falseNegativePct} partial={!!partial} />
            </>
          }
          extra={
            <>
              <span className="help">{split(b.promptFn, b.reviewerFn)}</span>
              {analyzed && (
                <WithoutBlue
                  k={b.promptFn}
                  n={h.rejected}
                  goal={goals.falseNegativePct}
                  href={linkVersion ? listHref(linkVersion, "promptFn") : null}
                  a={a}
                />
              )}
            </>
          }
          href={h.fn > 0 ? href("fn") : null}
          label={`Rechazos no detectados: ${h.fnPct} %, ${int(h.fn)} de ${llamadas(h.rejected)} que el revisor rechazó, ${partial ? "cifra parcial, la meta se evalúa al terminar" : `${fnOk ? "cumple" : "no cumple"} la meta de ${goals.falseNegativePct} %`}. Ver llamadas`}
          swatch={<Swatch part="promptFn" />}
        />
      </div>
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px]">
        <Swatch part="undecided" />
        <span>
          <b>Sin decisión de la IA:</b> {llamadas(h.undecided)} ({pct(h.undecided, h.n)} %) pasan a un auditor; no cuentan como falsa alarma ni
          como rechazo no detectado.
        </span>
        {h.undecided > 0 && linkVersion && <Link href={listHref(linkVersion, "undecided")}>Ver llamadas ›</Link>}
      </p>
    </section>
  );
}
