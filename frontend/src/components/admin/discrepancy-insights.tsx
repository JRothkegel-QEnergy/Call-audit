"use client";

import Link from "next/link";
import { Swatch } from "@/components/admin/agreement-charts";
import { listHref } from "@/components/admin/verification-labels";
import { MetricHelp } from "@/components/ui/metric-help";
import type { Agreement, Concentration, DiscrepancyInsights } from "@/lib/api/admin-types";
import { int } from "@/lib/format";

/**
 * Bloques del Resumen de Discrepancias que responden las preguntas del analista
 * (docs/ux/admin-prompt-metrics/10-resumen-mas-informacion.md, B2, B3 y B5). Texto con cifras, su base y un clic a
 * sus llamadas; sin gráficos nuevos.
 */

const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);
const pct1 = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(1).replace(".", ",")} %` : "—");

/** B2 · ¿Mejoró? Cambio llamada por llamada contra la versión anterior, con McNemar. */
export function EvolutionLine({ ins, version, listVersion }: { ins: DiscrepancyInsights; version: string; listVersion: string | null }) {
  const e = ins.evolution;
  if (!e) return null;
  const significant = e.p < 0.05;
  const better = e.toAgree > e.fromAgree;
  return (
    <p className="m-0 text-sm">
      <b>Frente a v{e.version}:</b>{" "}
      {significant ? (
        <>
          {better ? "mejora distinguible" : "empeora distinguible"} ({int(e.toAgree)} pasan a coincidir, {int(e.fromAgree)} dejan de coincidir).
        </>
      ) : (
        <>
          {int(e.toAgree)} llamadas pasan a coincidir · {int(e.fromAgree)} dejan de coincidir → no distinguible con {int(e.calls)} llamadas.
        </>
      )}
      <MetricHelp title="¿Mejoró?">
        Se comparan las mismas {int(e.calls)} llamadas en v{e.version} y v{version}. Solo cuentan las que cambian. Con la prueba de McNemar (p ={" "}
        {String(e.p).replace(".", ",")}), una diferencia así {significant ? "difícilmente es azar" : "puede ser azar"}.
      </MetricHelp>{" "}
      {listVersion && e.toAgree + e.fromAgree > 0 && (
        <Link href={listHref(listVersion, "changed", null, { vs: e.version })}>Ver las {int(e.toAgree + e.fromAgree)} que cambian ›</Link>
      )}
      {" · "}
      <Link href="/admin/stats?tab=quality">Ver la evolución en Calidad de la IA ›</Link>
    </p>
  );
}

/** B3 · ¿Cuánto le creemos al azul? Verificación a mano y estabilidad entre análisis. */
export function BlueTrust({ ins, a, listVersion }: { ins: DiscrepancyInsights; a: Agreement; listVersion: string | null }) {
  if (a.causeAnalysis.status !== "done" || a.byCall.reviewer === 0) return null;
  const v = a.verification?.reviewer;
  const s = ins.sample;
  const st = ins.stability;
  return (
    <section className="card grid gap-1 p-3 text-[13px]" aria-label="Confianza en el posible error del revisor">
      <p className="m-0 flex flex-wrap items-center gap-1.5">
        <Swatch part="reviewer" />
        <b>¿Cuánto le creemos al azul?</b> Verificado a mano: {int(v?.reviewed ?? 0)} de {int(a.byCall.reviewer)} llamadas ({int(v?.confirmed ?? 0)}{" "}
        {v?.confirmed === 1 ? "confirmada" : "confirmadas"}).
        {listVersion && s.size > 0 && (
          <Link href={listHref(listVersion, "reviewer", null, { sample: s.size })} className="btn btn-sm btn-default ml-1">
            {s.reviewed === 0 ? `Verificar una muestra de ${s.size}` : `${int(s.reviewed)} de ${s.size} verificadas · seguir`}
          </Link>
        )}
      </p>
      {s.reviewed > 0 && (
        <p className="m-0">
          Muestra: {int(s.confirmed)} de {int(s.reviewed)} revisadas son error del revisor ({pct(s.confirmed, s.reviewed)} %).
        </p>
      )}
      {st && st.repeated > 0 && (
        <p className="m-0">
          Cambió de color en {int(st.changed)} de {int(st.repeated)} desacuerdos repetidos entre los análisis de v{st.versions.join(", v")} y esta versión (
          {pct(st.changed, st.repeated)} %).
          <MetricHelp title="Estabilidad del azul">
            El color azul lo decide la IA de análisis. Si un mismo desacuerdo cambia de color entre un análisis y otro, la cifra no es firme hasta
            verificarla a mano.
          </MetricHelp>
        </p>
      )}
    </section>
  );
}

function Top({ c, listVersion, part }: { c: Concentration; listVersion: string | null; part: "prompt" | "reviewer" }) {
  return (
    <p className="m-0">
      Top 5:{" "}
      {c.top.map((t, i) => (
        <span key={t.criterionId}>
          {i > 0 && " · "}
          {listVersion ? (
            <Link href={listHref(listVersion, part === "prompt" ? "disagree" : "reviewer", part === "prompt" ? t.criterionId : null)}>
              M{t.criterionId}
            </Link>
          ) : (
            `M${t.criterionId}`
          )}{" "}
          {int(t.n)}
        </span>
      ))}
    </p>
  );
}

/** B5 · Dos columnas: qué corregir en el prompt (rojo + amarillo) y qué calibrar con el revisor (azul). */
export function FixColumns({
  ins,
  listVersion,
  onPatterns,
}: {
  ins: DiscrepancyInsights;
  listVersion: string | null;
  onPatterns: (filter: "prompt_rule" | "calibrate_auditor") => void;
}) {
  const p = ins.promptSide;
  const r = ins.reviewerSide;
  const cov = p.coverage;
  const ceil = p.ceiling;
  const unexplained = (cov.observation ?? 0) + (cov.unpatterned ?? 0);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="card grid content-start gap-1.5 p-3 text-[13px]" aria-labelledby="fix-prompt">
        <h3 id="fix-prompt" className="m-0 flex items-center gap-1.5 text-sm font-semibold">
          <Swatch part="promptFn" />
          <Swatch part="promptFp" />
          Corregir en el prompt
        </h3>
        <p className="m-0">
          <b>{int(p.n)} desacuerdos</b> · {int(p.fn)} solo el revisor lo marca + {int(p.fp)} solo la IA lo marca
        </p>
        <p className="m-0">
          <b>{p.concentration.to50 != null && p.concentration.to50 <= 3 ? "Concentrado" : "Disperso"}:</b> {p.concentration.to50 ?? "—"} motivos suman el 50 %;{" "}
          {p.concentration.to80 ?? "—"} el 80 % (de {int(p.concentration.criteria)} con alguno).
        </p>
        {ins.chronic && (
          <p className="m-0">
            <b>Crónico:</b> {int(ins.chronic.n)} de {int(ins.chronic.of)} ({pct(ins.chronic.n, ins.chronic.of)} %) ya estaban en v{ins.chronic.versions.join(" y v")} ·{" "}
            {int(ins.chronic.new)} nuevos
            <MetricHelp title="Crónico">
              Mismo motivo, misma llamada y mismo lado en las dos versiones anteriores. Si un desacuerdo sigue en tres versiones, el loop no lo está
              corrigiendo: conviene escribir la regla a mano.
            </MetricHelp>
          </p>
        )}
        <p className="m-0">
          <b>Con regla propuesta:</b> {int(cov.prompt_rule ?? 0)} de {int(p.n)} ({pct(cov.prompt_rule ?? 0, p.n)} %) · {int(cov.observation ?? 0)} en
          observaciones · {int(cov.unpatterned ?? 0)} sin patrón
          {unexplained + (cov.prompt_rule ?? 0) < p.n && ` · ${int(p.n - unexplained - (cov.prompt_rule ?? 0))} con otra propuesta`}
        </p>
        {p.pendingRules > 0 && (
          <p className="m-0">
            <b>
              Si aceptas {p.pendingRules === 1 ? "la regla pendiente" : `las ${p.pendingRules} reglas pendientes`}:
            </b>{" "}
            como mucho +{int(ceil.calls)} llamadas ({pct1(ceil.agree, ceil.n)} → {pct1(ceil.agree + ceil.calls, ceil.n)}), dentro del margen.
            <MetricHelp title="Techo de aceptar las reglas">
              Es un techo: supone que cada regla arregla todos los desacuerdos que cubre. Las reglas salen de estas mismas llamadas de validación, así que
              medir la versión nueva aquí infla la mejora. Con {int(ceil.n)} llamadas, el margen es de unos ±6 puntos.
            </MetricHelp>
          </p>
        )}
        <Top c={p.concentration} listVersion={listVersion} part="prompt" />
        <p className="m-0 flex flex-wrap gap-x-3">
          {listVersion && <Link href={listHref(listVersion, "disagree")}>Ver las llamadas ›</Link>}
          <button type="button" className="underline" onClick={() => onPatterns("prompt_rule")}>
            Ver las reglas en Patrones ›
          </button>
        </p>
      </section>

      <section className="card grid content-start gap-1.5 p-3 text-[13px]" aria-labelledby="fix-reviewer">
        <h3 id="fix-reviewer" className="m-0 flex items-center gap-1.5 text-sm font-semibold">
          <Swatch part="reviewer" />
          Calibrar con el revisor
        </h3>
        <p className="m-0">
          <b>{int(r.n)} desacuerdos</b> de {int(ins.disagreements)} ({pct(r.n, ins.disagreements)} %) · posible error del revisor
        </p>
        {r.concentration.top.length > 0 && (
          <p className="m-0">
            <b>{r.concentration.to50 != null && r.concentration.to50 <= 3 ? "Concentrado" : "Disperso"}:</b> M{r.concentration.top[0].criterionId} suma el{" "}
            {pct(r.concentration.top[0].n, r.n)} %
            {r.concentration.top.length >= 3 &&
              `; M${r.concentration.top
                .slice(0, 3)
                .map((t) => t.criterionId)
                .join(" + M")}, el ${pct(
                r.concentration.top.slice(0, 3).reduce((t, x) => t + x.n, 0),
                r.n,
              )} %`}
            .
          </p>
        )}
        <p className="m-0">
          <b>Con propuesta de calibración:</b> {int(r.withCalibration)} de {int(r.n)} · {int(r.pendingCalibration)}{" "}
          {r.pendingCalibration === 1 ? "propuesta por decidir" : "propuestas por decidir"}
        </p>
        <Top c={r.concentration} listVersion={listVersion} part="reviewer" />
        <p className="m-0 flex flex-wrap gap-x-3">
          {listVersion && <Link href={listHref(listVersion, "reviewer")}>Ver las llamadas ›</Link>}
          <button type="button" className="underline" onClick={() => onPatterns("calibrate_auditor")}>
            Ver las propuestas en Patrones ›
          </button>
        </p>
      </section>
    </div>
  );
}
