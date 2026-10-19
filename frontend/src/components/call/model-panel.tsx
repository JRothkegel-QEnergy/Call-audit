"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Copy, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { CallVerdictBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import type { ModelRun } from "@/lib/api/types";
import { shortDateTime } from "@/lib/format";

type Tab = "summary" | "input" | "prompt" | "response";
const TABS: [Tab, string][] = [
  ["summary", "Resumen"],
  ["input", "Datos enviados"],
  ["prompt", "Prompt enviado"],
  ["response", "Respuesta (JSON)"],
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy size={14} aria-hidden />
        Copiar
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copiado" : ""}
      </span>
      {copied && <span className="help">Copiado</span>}
    </>
  );
}

/**
 * Panel lateral ancho con la entrada y la salida del modelo (Cambio 09 §3.2).
 * Muestra siempre lo que efectivamente salió al modelo, ya anonimizado.
 */
export function ModelPanel({
  open,
  onOpenChange,
  run,
  rubricId,
  onCriterion,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run: ModelRun;
  rubricId: string;
  onCriterion: (criterionId: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [query, setQuery] = useState("");
  const json = JSON.stringify(run.rawResponse, null, 2);
  const items = (run.rawResponse as { items?: { criterion_id: string; verdict: string }[] }).items ?? [];

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RadixDialog.Portal>
        <RadixDialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed bottom-0 right-0 top-0 z-[71] flex w-[min(60vw,880px)] min-w-[420px] flex-col border-l border-border bg-card shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <RadixDialog.Title className="m-0 text-lg font-semibold">Prompt y respuesta del modelo</RadixDialog.Title>
            <span className="help">
              {run.model} · Prompt v{run.promptVersion}
            </span>
            <RadixDialog.Close className="btn btn-ghost ml-auto" aria-label="Cerrar">
              <X size={16} aria-hidden />
            </RadixDialog.Close>
          </div>
          <RadixDialog.Description className="sr-only">Entrada y salida del modelo para esta llamada</RadixDialog.Description>
          <div className="banner mx-5 mt-3" role="note" style={{ borderLeftColor: "var(--amber-600)" }}>
            <ShieldAlert size={14} aria-hidden className="flex-none" />
            <span>Contenido técnico confidencial de Qubico y datos del cliente. No lo compartas fuera de la app.</span>
          </div>
          <div className="tabs mx-5 mb-0 mt-2" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto px-5 py-4">
            {tab === "summary" && (
              <dl className="m-0 grid grid-cols-[180px_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Modelo</dt>
                <dd className="m-0 font-medium">{run.model}</dd>
                <dt className="text-muted-foreground">Versión del prompt</dt>
                <dd className="m-0 font-medium">v{run.promptVersion}</dd>
                <dt className="text-muted-foreground">Pauta</dt>
                <dd className="m-0 font-medium">
                  {rubricId} v{run.rubricVersion}
                </dd>
                <dt className="text-muted-foreground">Fecha de la corrida</dt>
                <dd className="m-0 font-medium">{shortDateTime(run.runAt)}</dd>
                <dt className="text-muted-foreground">Latencia</dt>
                <dd className="m-0 font-medium tabular">{(run.latencyMs / 1000).toFixed(1).replace(".", ",")} s</dd>
                <dt className="text-muted-foreground">Costo</dt>
                <dd className="m-0 font-medium tabular">{run.costUsd.toFixed(3).replace(".", ",")} USD</dd>
                <dt className="text-muted-foreground">Veredicto del modelo</dt>
                <dd className="m-0">
                  <CallVerdictBadge verdict={run.verdict} />
                </dd>
                <dt className="text-muted-foreground">Regla aplicada</dt>
                <dd className="m-0 font-medium">{run.appliedRule}</dd>
              </dl>
            )}

            {tab === "input" &&
              run.inputData.map((sec) => (
                <div key={sec.section} className="mb-4">
                  <h3 className="m-0 mb-2 text-sm font-semibold">{sec.section}</h3>
                  <table className="tbl flat">
                    <thead>
                      <tr>
                        <th className="w-[220px]">Campo</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((r) => (
                        <tr key={r.field}>
                          <td className="text-muted-foreground">{r.field}</td>
                          <td className="whitespace-normal">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {tab === "prompt" && (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <input
                    className="control search w-[220px]"
                    placeholder="Buscar en el prompt"
                    aria-label="Buscar en el prompt"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <CopyButton text={run.promptSections.map((p) => `## ${p.title}\n${p.text}`).join("\n\n")} />
                </div>
                {run.promptSections.map((sec) => {
                  const hit = !query || sec.text.toLowerCase().includes(query.toLowerCase());
                  return (
                    <details key={sec.title} open={hit} className="mb-2 rounded-md border border-border">
                      <summary className="cursor-pointer px-3 py-2 font-semibold">{sec.title}</summary>
                      <pre className="m-0 whitespace-pre-wrap border-t border-border bg-muted px-3 py-2 font-mono text-[13px] leading-5">
                        {sec.text}
                      </pre>
                    </details>
                  );
                })}
              </>
            )}

            {tab === "response" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <CopyButton text={json} />
                  <span className="help">Ir al motivo:</span>
                  {items.map((it) => {
                    const id = Number(String(it.criterion_id).replace(/\D/g, ""));
                    return (
                      <Button key={it.criterion_id} size="sm" variant="ghost" onClick={() => onCriterion(id)}>
                        {it.criterion_id} · {it.verdict}
                      </Button>
                    );
                  })}
                </div>
                <pre className="m-0 overflow-auto whitespace-pre rounded-md border border-border bg-muted px-3 py-2 font-mono text-[13px] leading-5">
                  {json}
                </pre>
              </>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
