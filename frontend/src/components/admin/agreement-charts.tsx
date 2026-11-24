"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MetricHelp } from "@/components/ui/metric-help";
import { api } from "@/lib/api";
import type {
  AgreeList,
  Agreement,
  AgreementBreakdown,
  CauseAnalysis,
  CauseEstimate,
  PromptLoopChain,
  ReasonMatch,
  VerificationScope,
  VerificationSource,
} from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";
import { shortDateTime } from "@/lib/format";
import { scopeQuery } from "@/lib/verification-scope";
import { useSession } from "@/lib/session";

/**
 * Mosaico de acuerdo IA vs revisor (docs/ux/admin-prompt-metrics/02-mosaico-propuesta.md §11): A (Marimekko por
 * llamada), B (zoom al desacuerdo por criterio), C (evolución del loop), leyenda y aviso del análisis de causa.
 * Sin librería de gráficos: bloques con flex. Los % se calculan aquí desde conteos enteros.
 */

type Part = "promptFn" | "promptFp" | "reviewer" | "undecided" | "agree";

/** Nombre corto de cada parte para títulos y enlaces (04-verificacion-propuesta.md §6.2). */
export const PART_NAME: Record<Part, string> = {
  promptFn: "IA Sí / Revisor No",
  promptFp: "IA No / Revisor Sí",
  reviewer: "Posible error del revisor",
  undecided: "Sin decisión de la IA",
  agree: "Coincide con el revisor",
};

export const partHref = (version: string, part: Part, scope?: VerificationScope | null) =>
  `/admin/prompts/${encodeURIComponent(version)}/calls?segment=${part}${scopeQuery(scope)}`;

export const PARTS: Record<Part, { name: string; support: string; style: React.CSSProperties; ink: string }> = {
  promptFn: {
    name: "IA Sí / Revisor No",
    support: "La IA dice que cumple y el revisor que no. Rechazo no detectado.",
    style: { background: "var(--prompt-fn-bg)" },
    ink: "var(--white)",
  },
  promptFp: {
    name: "IA No / Revisor Sí",
    support: "La IA dice que no cumple y el revisor que sí. Falsa alarma.",
    style: { background: "var(--prompt-fp-bg)", boxShadow: "inset 0 0 0 1px var(--prompt-fp-border)" },
    ink: "var(--ink-900)",
  },
  reviewer: {
    name: "Posible error del revisor (según la IA de análisis)",
    support: "La IA de análisis cree que se equivocó el revisor al llenar la planilla. Sin confirmar.",
    style: {
      background:
        "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.25) 0 4px, transparent 4px 9px), var(--reviewer-bg)",
    },
    ink: "var(--white)",
  },
  undecided: {
    name: "Sin decisión de la IA",
    support: "Pasan a revisión de un auditor.",
    style: { background: "var(--undecided-bg)", boxShadow: "inset 0 0 0 1px var(--undecided-border)" },
    ink: "var(--ink-900)",
  },
  agree: {
    name: "Coincide con el revisor",
    support: "Mismo resultado que la planilla.",
    style: { background: "var(--agree-bg)" },
    ink: "var(--white)",
  },
};

/** Orden fijo de colores en todas las barras (§3.3): rojo, amarillo, azul, gris, verde. */
const ORDER: Part[] = ["promptFn", "promptFp", "reviewer", "undecided", "agree"];

const share = (a: number, n: number) => (n ? (a * 100) / n : 0);
export function fmtPct(v: number): string {
  const d = v >= 10 || Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1;
  return `${v.toFixed(d).replace(".", ",")} %`;
}
const int = (n: number) => n.toLocaleString("es-CL");
const usd = (n: number | null | undefined) => (n == null ? "—" : `US$ ${n.toFixed(2).replace(".", ",")}`);

export function Swatch({ part }: { part: Part | ReasonMatch }) {
  const style = part in PARTS ? PARTS[part as Part].style : REASON_PARTS[part as ReasonMatch].style;
  return <span aria-hidden className="inline-block h-3 w-3 flex-none rounded-sm" style={style} />;
}

/** Tramos de «¿Coinciden también en los criterios?» (15-acuerdo-en-motivos-brief.md §9-§10): zoom del verde, sin rayado. */
export const REASON_PARTS: Record<ReasonMatch, { name: string; list: AgreeList; style: React.CSSProperties; ink: string }> = {
  bothPass: {
    name: "Ambos aprueban",
    list: "agreePass",
    style: { background: "var(--reason-pass-bg)", boxShadow: "inset 0 0 0 1px var(--reason-pass-border)" },
    ink: "var(--ink-900)",
  },
  same: { name: "Mismos criterios", list: "agreeSame", style: { background: "var(--reason-same-bg)" }, ink: "var(--white)" },
  partial: {
    name: "Desacuerdo parcial",
    list: "agreePartial",
    style: { background: "var(--reason-partial-bg)", boxShadow: "inset 0 0 0 1px var(--reason-partial-border)" },
    ink: "var(--ink-900)",
  },
  none: { name: "Desacuerdo total", list: "agreeNone", style: { background: "var(--reason-none-bg)" }, ink: "var(--white)" },
};
const REASON_ORDER: ReasonMatch[] = ["bothPass", "same", "partial", "none"];
const reasonHref = (version: string, part: ReasonMatch, scope?: VerificationScope | null) =>
  `/admin/prompts/${encodeURIComponent(version)}/calls?segment=${REASON_PARTS[part].list}${scopeQuery(scope)}`;

/** Leyenda compartida de A y B: color + nombre + "x % · a de n". */
export function AgreementLegend({
  b,
  parts = ORDER,
  version,
  scope,
}: {
  b: AgreementBreakdown;
  parts?: Part[];
  version?: string;
  scope?: VerificationScope | null;
}) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] sm:grid-cols-2">
      {parts.map((k) => (
        <li key={k} className="flex items-start gap-2">
          <span className="mt-1">
            <Swatch part={k} />
          </span>
          <span>
            <b>{PARTS[k].name}</b>
            <span className="tabular"> · {fmtPct(share(b[k], b.n))} · {int(b[k])} de {int(b.n)}</span>
            {version && b[k] > 0 && (
              <>
                {" · "}
                <Link href={partHref(version, k, scope)} aria-label={`Ver las ${int(b[k])} llamadas: ${PART_NAME[k]}`}>
                  Ver llamadas ›
                </Link>
              </>
            )}
            <span className="help block">{PARTS[k].support}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const pct0 = (x: number) => `${Math.round(x * 100)}`;

/** Línea de verificación bajo el mosaico (§6.1): cuánto del azul se confirmó a mano. */
export function VerificationLine({ version, a, scope }: { version: string; a: Agreement; scope?: VerificationScope | null }) {
  const v = a.verification?.reviewer;
  if (!v || a.byCall.reviewer === 0) return null;
  const href = partHref(version, "reviewer", scope);
  if (v.reviewed === 0)
    return (
      <p className="m-0 text-[13px]">
        Aún no se verifica a mano. <Link href={href}>Revisa las {int(v.calls)} llamadas ›</Link>
      </p>
    );
  if (v.pending === 0)
    return (
      <p className="m-0 text-[13px]">
        <b>Calibración completa:</b> {int(v.confirmed)} de {int(v.calls)} llamadas confirmadas como error del revisor (
        {pct0(v.confirmed / v.reviewed)} %). <Link href={href}>Ver llamadas ›</Link>
      </p>
    );
  return (
    <p className="m-0 text-[13px]">
      <b>Calibración del posible error del revisor:</b> {int(v.confirmed)} confirmadas de {int(v.reviewed)} revisadas (
      {pct0(v.confirmed / v.reviewed)} %{v.ci95 ? `, margen ${pct0(v.ci95[0])}-${pct0(v.ci95[1])} %` : ""}) ·{" "}
      <Link href={href}>Ver llamadas ›</Link>
    </p>
  );
}

function AsTable({ b, unit }: { b: AgreementBreakdown; unit: string }) {
  return (
    <table className="tbl mt-2">
      <thead>
        <tr>
          <th scope="col">Parte</th>
          <th scope="col" className="num">
            % del total
          </th>
          <th scope="col" className="num">
            {unit}
          </th>
        </tr>
      </thead>
      <tbody>
        {ORDER.map((k) => (
          <tr key={k}>
            <th scope="row" className="font-normal">
              {PARTS[k].name}
            </th>
            <td className="num">{fmtPct(share(b[k], b.n))}</td>
            <td className="num">
              {int(b[k])} de {int(b.n)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const summary = (b: AgreementBreakdown, prefix: string) =>
  `${prefix}: ${ORDER.map((k) => `${fmtPct(share(b[k], b.n))} ${PARTS[k].name}`).join(", ")}.`;

function Block({
  part,
  value,
  n,
  vertical = 1,
  showLabel,
  href,
}: {
  part: Part;
  value: number;
  n: number;
  vertical?: number;
  showLabel: boolean;
  href?: string;
}) {
  const className = "relative flex min-h-0 items-center justify-center overflow-hidden text-[13px] font-semibold";
  const style = { ...PARTS[part].style, color: PARTS[part].ink, flexGrow: vertical, flexBasis: 0 };
  const label = showLabel && <span className="hidden px-1 text-center leading-tight sm:block">{fmtPct(share(value, n))}</span>;
  if (!href)
    return (
      <div className={className} style={style}>
        {label}
      </div>
    );
  return (
    <Link
      href={href}
      className={cn(className, "no-underline outline-offset-2 hover:brightness-110 focus-visible:outline focus-visible:outline-2")}
      style={style}
      aria-label={`Ver las ${int(value)} llamadas: ${PART_NAME[part]}`}
    >
      {label}
    </Link>
  );
}

/** A · Marimekko por llamada (§3.1): el ancho de cada columna es su %; rojo sobre amarillo dentro de "Prompt o regla de aplicación". */
export function AgreementMosaic({
  version,
  a,
  linked = false,
  scope,
  title,
}: {
  version: string;
  a: Agreement;
  linked?: boolean;
  scope?: VerificationScope | null;
  title?: string;
}) {
  const [table, setTable] = useState(false);
  const b = a.byCall;
  const prompt = b.promptFn + b.promptFp;
  const cols: { key: string; value: number; label: string; parts: Part[] }[] = [
    { key: "prompt", value: prompt, label: "Prompt o regla de aplicación", parts: ["promptFn", "promptFp"] },
    { key: "reviewer", value: b.reviewer, label: "Posible error del revisor", parts: ["reviewer"] },
    { key: "undecided", value: b.undecided, label: "Sin decisión", parts: ["undecided"] },
    { key: "agree", value: b.agree, label: "Acuerdo", parts: ["agree"] },
  ];
  return (
    <section className="card grid gap-3" aria-labelledby="mosaic-a">
      <div>
        <h3 id="mosaic-a" className="m-0 text-sm font-semibold">
          {title ?? `Acuerdo con el revisor · v${version}`}
          <MetricHelp title="Acuerdo con el revisor">
            Cada llamada cae en una sola parte. El ancho de cada bloque es su porcentaje del total. Rojo y amarillo son lo que hay
            que corregir en el prompt o en el criterio; la meta es llevarlos cerca de cero.
            <br />
            <br />
            Posible error del revisor (según la IA de análisis): una IA revisó cada desacuerdo y concluyó que se equivocó el revisor
            al llenar la planilla. Es su juicio y aún no está confirmado con el call center. Solo cuenta si todos sus criterios en
            desacuerdo apuntan a la planilla.
            <br />
            <br />
            Revisor: quien llenó la planilla de calidad de la corredora.
          </MetricHelp>
        </h3>
        <p className="help m-0">
          % del total de llamadas · n = {int(b.n)} llamadas{linked ? " · Clic en un bloque para ver sus llamadas" : ""}
        </p>
      </div>
      <p className="sr-only">{summary(b, "Por llamada")}</p>
      <div className="flex h-24 w-full gap-[2px] sm:h-32">
        {cols
          .filter((c) => c.value > 0)
          .map((c) => {
            const wide = share(c.value, b.n) >= 8;
            return (
              <div key={c.key} className="flex min-w-[4px] flex-col gap-[2px]" style={{ flexGrow: c.value, flexBasis: 0 }}>
                {c.parts
                  .filter((p) => b[p] > 0)
                  .map((p) => (
                    <Block
                      key={p}
                      part={p}
                      value={b[p]}
                      n={b.n}
                      vertical={b[p]}
                      showLabel={wide && share(b[p], c.value) >= 30}
                      href={linked ? partHref(version, p, scope) : undefined}
                    />
                  ))}
              </div>
            );
          })}
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {cols.map((c) => (
          <span key={c.key}>
            <b>{c.label}</b> · <span className="tabular">{fmtPct(share(c.value, b.n))}</span>
          </span>
        ))}
      </p>
      {linked && <VerificationLine version={version} a={a} scope={scope} />}
      <AgreementLegend b={b} version={linked ? version : undefined} scope={scope} />
      <div>
        <Button size="sm" variant="ghost" aria-expanded={table} onClick={() => setTable((t) => !t)}>
          {table ? "Ocultar tabla" : "Ver como tabla"}
        </Button>
        {table && <AsTable b={b} unit="Llamadas" />}
      </div>
      {a.causeAnalysis.status === "done" && (
        <p className="help m-0">
          Causa analizada{a.causeAnalysis.finishedAt ? ` el ${shortDateTime(a.causeAnalysis.finishedAt)}` : ""} · {usd(a.causeAnalysis.costUsd)}
        </p>
      )}
    </section>
  );
}

/** Zoom del verde (15-acuerdo-en-motivos-brief.md): las llamadas que coinciden con el revisor, según sus criterios. */
export function ReasonMatchBar({
  version,
  a,
  linked = false,
  scope,
}: {
  version: string;
  a: Agreement;
  linked?: boolean;
  scope?: VerificationScope | null;
}) {
  const [table, setTable] = useState(false);
  const r = a.reasonMatch;
  if (!r) return null;
  const total = a.byCall.n;
  const n = r.n;
  const rejected = r.same + r.partial + r.none;
  const full = r.bothPass + r.same;
  const split = r.partial + r.none;
  const parts = REASON_ORDER.filter((p) => r[p] > 0);
  const title = (
    <h3 id="reason-match" className="m-0 text-sm font-semibold">
      ¿Coinciden también en los criterios?
      <MetricHelp title="¿Coinciden también en los criterios?">
        Una llamada coincide con el revisor si ambos dan el mismo veredicto, aunque rechacen por criterios distintos. Este gráfico
        separa esas llamadas según sus criterios de rechazo. Un criterio que la IA dejó dudoso no cuenta como rechazo de la IA.
      </MetricHelp>
    </h3>
  );
  if (n === 0)
    return (
      <section className="card grid gap-3" aria-labelledby="reason-match">
        {title}
        <p className="help m-0">Ninguna llamada coincide con el revisor en esta prueba.</p>
      </section>
    );
  return (
    <section className="card grid gap-3" aria-labelledby="reason-match">
      <div>
        {title}
        <p className="help m-0">
          Dentro de «Coincide con el revisor» · <b>{int(n)} llamadas, vistas al 100 %</b>
          {linked ? " · Clic en un tramo para ver sus llamadas" : ""}
        </p>
      </div>
      <div
        role="img"
        aria-label={`De ${int(n)} llamadas que coinciden con el revisor: ${int(r.bothPass)} ambos aprueban, ${int(r.same)} con los mismos criterios, ${int(r.partial)} con desacuerdo parcial y ${int(r.none)} con desacuerdo total en los criterios de rechazo.`}
        className="flex h-8 w-full gap-[2px]"
        style={{
          // Zigzag a la derecha, como «Detalle por criterio»: es un zoom, no la escala del total.
          clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 25%, calc(100% - 6px) 50%, 100% 75%, calc(100% - 6px) 100%, 0 100%)",
        }}
      >
        {parts.map((p) => {
          const className = "flex min-w-[4px] items-center justify-center overflow-hidden text-[13px] font-semibold";
          const style = { ...REASON_PARTS[p].style, color: REASON_PARTS[p].ink, flexGrow: r[p], flexBasis: 0 };
          // En pantallas chicas las cifras quedan en la leyenda, como en el mosaico.
          const label = share(r[p], n) >= 12 && <span className="hidden whitespace-nowrap px-1 sm:block">{fmtPct(share(r[p], n))}</span>;
          return linked ? (
            <Link
              key={p}
              href={reasonHref(version, p, scope)}
              className={cn(className, "no-underline outline-offset-2 hover:brightness-110 focus-visible:outline focus-visible:outline-2")}
              style={style}
              aria-label={`Ver las ${int(r[p])} llamadas: ${REASON_PARTS[p].name}`}
            >
              {label}
            </Link>
          ) : (
            <div key={p} className={className} style={style}>
              {label}
            </div>
          );
        })}
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <span>
          <b>Coinciden en todo</b> · <span className="tabular">{fmtPct(share(full, n))} ({int(full)})</span>
        </span>
        <span>
          <b>Desacuerdo en criterio de rechazo</b> · <span className="tabular">{fmtPct(share(split, n))} ({int(split)})</span>
        </span>
      </p>
      <p className="m-0 text-[13px]">
        {rejected > 0 ? (
          <>
            De los <b>{int(rejected)}</b> rechazos en que coinciden,{" "}
            <b>
              {int(r.same)} ({fmtPct(share(r.same, rejected))})
            </b>{" "}
            marcan los mismos criterios.
          </>
        ) : (
          "No hay rechazos en común con el revisor."
        )}
      </p>
      <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] sm:grid-cols-2">
        {REASON_ORDER.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="mt-1">
              <Swatch part={p} />
            </span>
            <span>
              <b>{REASON_PARTS[p].name}</b>
              <span className="tabular">
                {" "}
                · {fmtPct(share(r[p], n))} · {int(r[p])} de {int(n)} · {fmtPct(share(r[p], total))} del total
              </span>
              {linked && r[p] > 0 && (
                <>
                  {" · "}
                  <Link href={reasonHref(version, p, scope)} aria-label={`Ver las ${int(r[p])} llamadas: ${REASON_PARTS[p].name}`}>
                    Ver llamadas ›
                  </Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button size="sm" variant="ghost" aria-expanded={table} onClick={() => setTable((t) => !t)}>
          {table ? "Ocultar tabla" : "Ver como tabla"}
        </Button>
        {table && (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th scope="col">Tramo</th>
                <th scope="col" className="num">
                  Llamadas
                </th>
                <th scope="col" className="num">
                  % de las que coinciden
                </th>
                <th scope="col" className="num">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody>
              {REASON_ORDER.map((p) => (
                <tr key={p}>
                  <th scope="row" className="font-normal">
                    {REASON_PARTS[p].name}
                  </th>
                  <td className="num">{int(r[p])}</td>
                  <td className="num">{fmtPct(share(r[p], n))}</td>
                  <td className="num">{fmtPct(share(r[p], total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const DISAGREE: Part[] = ["promptFn", "promptFp", "reviewer"];

/** B · Detalle por criterio (§3.2): el verde como número y el desacuerdo ampliado al 100 %. */
export function DisagreementZoom({ a }: { a: Agreement }) {
  const [table, setTable] = useState(false);
  const b = a.byCallCriterion;
  const calls = a.byCall.n;
  const k = b.promptFn + b.promptFp + b.reviewer;
  return (
    <section className="card grid gap-3" aria-labelledby="mosaic-b">
      <div>
        <h3 id="mosaic-b" className="m-0 text-sm font-semibold">
          Detalle por criterio
          <MetricHelp title="Detalle por criterio">
            Cada llamada se cuenta {a.criteria} veces, una por criterio. Como casi todos los criterios coinciden, el desacuerdo se
            muestra aparte y ampliado para que se vea.
            <br />
            <br />
            En la tabla de abajo, las falsas alarmas se miden sobre las llamadas que el revisor aprobó y los rechazos no detectados
            sobre las que rechazó. Aquí todo se mide sobre el total de llamadas, por eso los números son más bajos.
          </MetricHelp>
        </h3>
        <p className="help m-0">
          % del total de llamadas × criterio · n = {int(calls)} × {a.criteria} = {int(b.n)}
        </p>
      </div>
      <p className="m-0 text-[13px]">
        <b>Coincide con el revisor:</b> <span className="tabular">{fmtPct(share(b.agree, b.n))}</span> ({int(b.agree)} de {int(b.n)}) ·{" "}
        <b>Sin decisión:</b> <span className="tabular">{fmtPct(share(b.undecided, b.n))}</span>
      </p>
      {k > 0 ? (
        <>
          <p className="m-0 text-[13px]">
            Los {fmtPct(share(k, b.n))} que no coinciden ({int(k)}), vistos al 100 %:
          </p>
          <div
            role="img"
            aria-label={`Desacuerdos por criterio, vistos al 100 %: ${DISAGREE.map((p) => `${fmtPct(share(b[p], k))} ${PARTS[p].name}`).join(", ")}.`}
            className="flex h-8 w-full gap-[2px]"
            style={{
              // Zigzag a la derecha: es un zoom, no la escala del total.
              clipPath:
                "polygon(0 0, calc(100% - 6px) 0, 100% 25%, calc(100% - 6px) 50%, 100% 75%, calc(100% - 6px) 100%, 0 100%)",
            }}
          >
            {DISAGREE.filter((p) => b[p] > 0).map((p) => (
              <div
                key={p}
                className="flex min-w-[4px] items-center justify-center overflow-hidden text-[13px] font-semibold"
                style={{ ...PARTS[p].style, color: PARTS[p].ink, flexGrow: b[p], flexBasis: 0 }}
              >
                {share(b[p], k) >= 12 && fmtPct(share(b[p], k))}
              </div>
            ))}
          </div>
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {DISAGREE.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <Swatch part={p} />
                {p === "reviewer" ? "Posible error del revisor" : PARTS[p].name} <span className="tabular">{fmtPct(share(b[p], b.n))} del total</span>
              </span>
            ))}
          </p>
          {b.reviewer > 0 && (
            <p className="help m-0">
              Posible error del revisor: una IA revisó estos desacuerdos y cree que se equivocó el revisor, no el prompt. Aún sin
              confirmar.
            </p>
          )}
        </>
      ) : (
        <p className="help m-0">No hay desacuerdos por criterio.</p>
      )}
      <div>
        <Button size="sm" variant="ghost" aria-expanded={table} onClick={() => setTable((t) => !t)}>
          {table ? "Ocultar tabla" : "Ver como tabla"}
        </Button>
        {table && <AsTable b={b} unit="Llamadas × criterio" />}
      </div>
    </section>
  );
}

/** C · Evolución del loop en validación (§3.3). */
export function LoopEvolution({ loop, version }: { loop: PromptLoopChain | null | undefined; version: string }) {
  const [unit, setUnit] = useState<"byCall" | "byCallCriterion">("byCall");
  if (!loop)
    return (
      <section className="card grid gap-2" aria-labelledby="mosaic-c">
        <h3 id="mosaic-c" className="m-0 text-sm font-semibold">
          Evolución del loop (validación)
        </h3>
        <p className="help m-0">Esta versión no es parte de un loop de mejora.</p>
      </section>
    );
  const n = loop.rounds.find((r) => r.agreement)?.agreement?.byCall.n;
  const pending = loop.rounds.some((r) => r.agreement && r.agreement.causeAnalysis.status !== "done");
  // Rojo + amarillo (% del total) de cada vuelta, para la columna Cambio contra la fila anterior.
  const bads = loop.rounds.map((r) => {
    const x = r.agreement?.[unit];
    return x ? share(x.promptFn + x.promptFp, x.n) : null;
  });
  return (
    <section className="card grid gap-3" aria-labelledby="mosaic-c">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <h3 id="mosaic-c" className="m-0 text-sm font-semibold">
            Evolución del loop (validación)
          </h3>
          <p className="help m-0">
            Mismas {n != null ? int(n) : "—"} llamadas de validación en todas las vueltas. Meta: rojo y amarillo cerca de cero.
          </p>
        </div>
        <div className="ml-auto inline-flex gap-1" role="group" aria-label="Unidad">
          {(
            [
              ["byCall", "Por llamada"],
              ["byCallCriterion", "Por criterio"],
            ] as const
          ).map(([k, label]) => (
            <Button key={k} size="sm" variant={unit === k ? "primary" : "default"} aria-pressed={unit === k} onClick={() => setUnit(k)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Versión</th>
              <th scope="col" className="w-[22%] min-w-[96px]">
                <span className="sr-only">Barra</span>
              </th>
              <th scope="col" className="num">
                IA Sí / Revisor No
              </th>
              <th scope="col" className="num">
                IA No / Revisor Sí
              </th>
              <th scope="col" className="num">
                Posible error del revisor
              </th>
              <th scope="col" className="num">
                Sin decisión
              </th>
              <th scope="col" className="num">
                Coincide
              </th>
              <th scope="col">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {loop.rounds.map((r, i) => {
              const here = r.version === version;
              const label = `v${r.version} · ${r.round === 0 ? "base" : `vuelta ${r.round}`}`;
              const a = r.agreement;
              if (!a)
                return (
                  <tr key={r.version} className={cn(here && "bg-accent")}>
                    <th scope="row" className="font-normal">
                      {label}
                      {here && <span className="help block">esta versión</span>}
                    </th>
                    <td colSpan={7} className="help">
                      Sin prueba de validación
                    </td>
                  </tr>
                );
              const b = a[unit];
              const star = a.causeAnalysis.status !== "done" ? "*" : "";
              const before = bads.slice(0, i).filter((x) => x != null).at(-1);
              const diff = before == null ? null : (bads[i] ?? 0) - before;
              const bar: Part[] = unit === "byCall" ? ORDER : DISAGREE;
              return (
                <tr key={r.version} className={cn(here && "bg-accent")}>
                  <th scope="row" className="font-normal">
                    {label}
                    {here && <span className="help block">esta versión</span>}
                    {star && <span className="help block">Causa sin analizar</span>}
                  </th>
                  <td aria-hidden>
                    <div className="flex h-4 w-full gap-[2px]">
                      {bar
                        .filter((p) => b[p] > 0)
                        .map((p) => (
                          <div key={p} className="min-w-[3px]" style={{ ...PARTS[p].style, flexGrow: b[p], flexBasis: 0 }} />
                        ))}
                    </div>
                  </td>
                  <td className="num">
                    {fmtPct(share(b.promptFn, b.n))}
                    {star}
                  </td>
                  <td className="num">
                    {fmtPct(share(b.promptFp, b.n))}
                    {star}
                  </td>
                  <td className="num">{fmtPct(share(b.reviewer, b.n))}</td>
                  <td className="num">{fmtPct(share(b.undecided, b.n))}</td>
                  <td className="num">{fmtPct(share(b.agree, b.n))}</td>
                  <td className="whitespace-nowrap text-[13px]">
                    {diff == null
                      ? "—"
                      : Math.abs(diff) < 1
                        ? "Sin cambio"
                        : `${diff < 0 ? "−" : "+"}${Math.abs(diff).toFixed(0)} puntos rojo + amarillo · ${diff < 0 ? "mejora" : "empeora"}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pending && <p className="help m-0">* Rojo y amarillo incluyen lo que el análisis podría marcar como error del revisor.</p>}
    </section>
  );
}

/** Aviso según el estado del análisis de causa + «Analizar causa» con confirmación de costo (E1). */
export function CauseAnalysisNotice({
  version,
  ca,
  onStarted,
  source,
}: {
  version: string;
  ca: CauseAnalysis;
  onStarted: () => void;
  source?: VerificationSource;
}) {
  const canWrite = useSession().user?.role === "qubico_admin";
  const [open, setOpen] = useState(false);
  const [est, setEst] = useState<CauseEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  if (ca.status === "done") return null;
  if (ca.status === "running")
    return (
      <div className="banner" role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Analizando la causa de {int(ca.disagreements)} desacuerdos… El azul aparece al terminar.
      </div>
    );
  if (!ca.findingsStored)
    return (
      <div className="banner">
        Esta prueba no guardó los hallazgos de la IA, así que no se puede analizar la causa. Rojo y amarillo incluyen lo que podría
        ser un error del revisor.
      </div>
    );
  const ask = async () => {
    setOpen(true);
    setEst(null);
    try {
      setEst(await api.estimateCauseAnalysis(version, source));
    } catch {
      toast.error("No pudimos calcular el costo. Intenta de nuevo.");
      setOpen(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      await api.startCauseAnalysis(version, source);
      setOpen(false);
      onStarted();
    } catch (e) {
      const code = e instanceof ApiError ? e.message : "";
      toast.error(code === "already_running" ? "Ya hay un análisis corriendo. Intenta cuando termine." : "No se pudo lanzar el análisis.");
    } finally {
      setBusy(false);
    }
  };
  const failed = ca.status === "failed";
  return (
    <>
      <div className={failed ? "error-state" : "banner"} role={failed ? "alert" : undefined}>
        <span>
          {failed
            ? "No se pudo analizar la causa. Rojo y amarillo incluyen todo el desacuerdo."
            : "Aún no se analiza la causa de los desacuerdos. Rojo y amarillo incluyen lo que podría ser un error del revisor."}
        </span>
        {canWrite && (
          <Button size="sm" variant="default" className="ml-auto" onClick={() => void ask()}>
            {failed ? "Reintentar" : "Analizar causa"}
          </Button>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Analizar la causa de ${int(ca.disagreements)} desacuerdos?`}
        description={
          <p className="m-0">
            Una IA revisa cada desacuerdo de validación para separar los que parecen error del revisor. Costo estimado:{" "}
            {est ? usd(est.totalUsd) : "calculando…"}. Sus propuestas de regla no se usan.
          </p>
        }
        footer={
          <>
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!est || busy} onClick={() => void start()}>
              Analizar · {est ? usd(est.totalUsd) : "…"}
            </Button>
          </>
        }
      />
    </>
  );
}
