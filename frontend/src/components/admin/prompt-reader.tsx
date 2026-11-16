"use client";

import { useState } from "react";
import type { PromptReaderItem, PromptReaderSpec } from "@/lib/api/admin-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Pestaña «Leer» del detalle de versión (docs/ux/admin-prompt-reader): el prompt como documento, con índice,
 * texto oficial y criterio Qubico separados, y el historial de cada regla plegado.
 */

type Block = { kind: "p" | "li"; text: string; indent: number };

const LIST = /^(\s*)([-*•]|\d+[.)])\s+/;

/** Une las líneas que el YAML corta por ancho; mantiene las líneas en blanco, las listas y su sangría. */
export function reflow(text: string): Block[] {
  const out: Block[] = [];
  let open = false;
  for (const raw of text.split("\n")) {
    if (!raw.trim()) {
      open = false;
      continue;
    }
    const m = raw.match(LIST);
    if (m) {
      out.push({ kind: "li", text: raw.trim(), indent: m[1].length });
      open = true;
    } else if (open) {
      out[out.length - 1].text += ` ${raw.trim()}`;
    } else {
      out.push({ kind: "p", text: raw.trim(), indent: 0 });
      open = true;
    }
  }
  return out;
}

function Prose({ text }: { text: string }) {
  return (
    <div className="grid gap-2 text-[14px] leading-6">
      {reflow(text).map((b, i) =>
        b.kind === "li" ? (
          <p
            key={i}
            className="m-0"
            style={{
              paddingLeft: `${1.25 + b.indent / 2}em`,
              textIndent: "-1.25em",
            }}
          >
            {b.text}
          </p>
        ) : (
          <p key={i} className="m-0">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}

const sectionTitle = (heading: string | null) => heading ?? "Introducción";

function RuleHistory({
  item,
  open,
}: {
  item: PromptReaderItem;
  open: boolean;
}) {
  const h = item.history;
  if (h.length === 0) return null;
  const last = h[h.length - 1];
  return (
    <details open={open || undefined} className="mt-2 text-[13px]">
      <summary className="cursor-pointer text-muted-foreground">
        Historial · {h.length} {h.length === 1 ? "cambio" : "cambios"} ·{" "}
        {h.length === 1 ? "" : "último "}
        {last.version} ({last.origin})
      </summary>
      <table className="tbl mt-1">
        <thead>
          <tr>
            <th scope="col">Versión</th>
            <th scope="col">Origen</th>
            <th scope="col">Nota</th>
          </tr>
        </thead>
        <tbody>
          {h.map((e, i) => (
            <tr key={i}>
              <td className="tabular">{e.version}</td>
              <td>{e.origin}</td>
              <td className="whitespace-normal">{e.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Rule({
  item,
  version,
  historyOpen,
}: {
  item: PromptReaderItem;
  version: string;
  historyOpen: boolean;
}) {
  const changed = item.history.some((e) => e.version === version);
  const motive = item.number != null;
  return (
    <article
      id={item.id}
      className={cn(
        "scroll-mt-4",
        motive && "rounded-md border border-border p-3",
      )}
    >
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        {motive ? (
          <h4 className="m-0 text-[14px] font-semibold">
            Motivo {item.number}
          </h4>
        ) : (
          <span className="font-mono text-[12px] text-muted-foreground">
            {item.id}
          </span>
        )}
        {changed && (
          <span className="rounded-sm bg-accent px-1.5 text-[12px] font-medium text-accent-foreground">
            Cambió en v{version}
          </span>
        )}
      </div>
      {motive ? (
        <div className="grid gap-2">
          {item.official && (
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Texto oficial
              </div>
              <Prose text={item.official} />
            </div>
          )}
          {item.criterion && (
            <div className="border-l-[3px] border-[var(--primary)] pl-3">
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                Criterio Qubico
              </div>
              <Prose text={item.criterion} />
            </div>
          )}
        </div>
      ) : (
        item.text && <Prose text={item.text} />
      )}
      {item.pending && (
        <p className="help m-0 mt-2">
          Pendiente con la corredora: {item.pending}
        </p>
      )}
      <RuleHistory item={item} open={historyOpen} />
    </article>
  );
}

const jump = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

function ReadSpec({
  spec,
  version,
}: {
  spec: PromptReaderSpec;
  version: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const rules = spec.sections.reduce((n, s) => n + s.items.length, 0);
  const motives = spec.sections
    .flatMap((s) => s.items)
    .filter((i) => i.number != null)
    .sort((a, b) => a.number! - b.number!);
  const changed = spec.sections
    .flatMap((s) => s.items)
    .filter((i) => i.history.some((e) => e.version === version)).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span>
          v{spec.version}
          {spec.date ? ` · ${spec.date}` : ""} · {rules} reglas
          {changed
            ? ` · ${changed} ${changed === 1 ? "cambió" : "cambiaron"} en esta versión`
            : ""}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          {historyOpen ? "Plegar historiales" : "Expandir historiales"}
        </Button>
      </div>

      <label className="field md:hidden">
        Ir a sección
        <select
          className="control"
          defaultValue=""
          onChange={(e) => e.target.value && jump(e.target.value)}
        >
          <option value="" disabled>
            Elige una sección
          </option>
          {spec.sections.map((s) => (
            <option key={s.id} value={`s-${s.id}`}>
              {s.level === 3 ? "— " : ""}
              {sectionTitle(s.heading)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Secciones del prompt" className="hidden md:block">
          <div className="sticky top-4 grid gap-3 text-[13px]">
            <ul className="m-0 grid list-none gap-1 p-0">
              {spec.sections.map((s) => (
                <li key={s.id} className={cn(s.level === 3 && "pl-3")}>
                  <a
                    href={`#s-${s.id}`}
                    className="text-foreground no-underline hover:underline"
                  >
                    {sectionTitle(s.heading)}
                  </a>
                </li>
              ))}
              {spec.jsonOutputInstruction && (
                <li>
                  <a
                    href="#s-json-output"
                    className="text-foreground no-underline hover:underline"
                  >
                    Formato sin herramientas
                  </a>
                </li>
              )}
            </ul>
            {motives.length > 0 && (
              <div>
                <div className="mb-1 font-semibold">Ir a motivo</div>
                <div className="flex flex-wrap gap-1">
                  {motives.map((m) => (
                    <a
                      key={m.id}
                      href={`#${m.id}`}
                      className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border px-1 text-[12px] text-foreground no-underline hover:bg-accent"
                    >
                      {m.number}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="grid max-w-[78ch] gap-6">
          {spec.sections.map((s) => {
            const H = s.level === 3 ? "h3" : "h2";
            return (
              <section
                key={s.id}
                id={`s-${s.id}`}
                className="grid scroll-mt-4 gap-4"
              >
                <H
                  className={cn(
                    "m-0 font-semibold",
                    s.level === 3
                      ? "text-[15px]"
                      : "border-b border-border pb-1 text-[17px]",
                  )}
                >
                  {sectionTitle(s.heading)}
                </H>
                {s.items.map((item) => (
                  <Rule
                    key={item.id}
                    item={item}
                    version={version}
                    historyOpen={historyOpen}
                  />
                ))}
              </section>
            );
          })}
          {spec.jsonOutputInstruction && (
            <section id="s-json-output" className="scroll-mt-4">
              <details>
                <summary className="cursor-pointer text-[15px] font-semibold">
                  Formato de respuesta sin herramientas
                </summary>
                <p className="help m-0 mt-1">
                  Se agrega al final cuando la IA responde sin la herramienta
                  registrar_auditoria.
                </p>
                <div className="mt-2">
                  <Prose
                    text={spec.jsonOutputInstruction
                      .split("\n")
                      .slice(1)
                      .join("\n")}
                  />
                </div>
              </details>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sin yaml (versión subida como texto, o yaml ilegible): las líneas «## » como títulos y el resto reflujado. */
function ReadText({ text }: { text: string }) {
  const parts: { heading: string | null; level: number; body: string[] }[] = [
    { heading: null, level: 2, body: [] },
  ];
  for (const line of text.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (m) parts.push({ heading: m[2], level: m[1].length, body: [] });
    else parts[parts.length - 1].body.push(line);
  }
  return (
    <div className="grid max-w-[78ch] gap-6">
      {parts
        .filter((p) => p.heading || p.body.some((l) => l.trim()))
        .map((p, i) => {
          const H = p.level === 3 ? "h3" : "h2";
          return (
            <section key={i} className="grid gap-3">
              {p.heading && (
                <H
                  className={cn(
                    "m-0 font-semibold",
                    p.level === 3
                      ? "text-[15px]"
                      : "border-b border-border pb-1 text-[17px]",
                  )}
                >
                  {p.heading}
                </H>
              )}
              <Prose text={p.body.join("\n")} />
            </section>
          );
        })}
    </div>
  );
}

export function PromptReader({
  spec,
  systemText,
  version,
  isYaml,
}: {
  spec: PromptReaderSpec | null;
  systemText: string;
  version: string;
  /** La versión se subió como prompt.yaml (si spec viene null igual, el yaml no se pudo leer). */
  isYaml: boolean;
}) {
  if (spec) return <ReadSpec spec={spec} version={version} />;
  return (
    <div className="grid gap-3">
      {isYaml && (
        <p className="help m-0">
          No se pudo leer el prompt como YAML. Se muestra como texto.
        </p>
      )}
      <ReadText text={systemText} />
    </div>
  );
}
