"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FollowUpProgress } from "@/components/admin/discrepancy-charts";
import { PatternBody } from "@/components/admin/discrepancy-parts";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DiscrepancyPattern } from "@/lib/api/admin-types";
import { followUpGroup, statusLabel } from "@/lib/discrepancy-labels";
import { useAsync } from "@/lib/use-async";

/** Pestaña Seguimiento (Cambio 16); separada de la página en el Cambio 20, sin cambios de contenido. */
export function FollowUpTab({ rows, onChange }: { rows: DiscrepancyPattern[]; onChange: () => void }) {
  const active = rows.filter((p) => p.status !== "discarded");
  const prompt = active.filter((p) => followUpGroup(p.proposal?.type) === "prompt");
  const client = active.filter((p) => followUpGroup(p.proposal?.type) === "client");
  const calibrate = active.filter((p) => followUpGroup(p.proposal?.type) === "calibrate");
  const discarded = rows.filter((p) => p.status === "discarded");
  const text = (p: DiscrepancyPattern) => p.proposal?.editedText ?? p.proposal?.text ?? "";
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast("Copiado");
  };
  const act = async (p: DiscrepancyPattern, status: "asked_client" | "calibrated" | "accepted") => {
    await api.setProposalFollowUp(p.id, status);
    onChange();
  };
  const reopen = async (p: DiscrepancyPattern) => {
    await api.decideProposal(p.id, { decision: "pending" });
    onChange();
  };
  // Cambio 18: las reglas aceptadas se marcan (todas por defecto, H-127) y se llevan a una versión nueva.
  const router = useRouter();
  const [unchecked, setUnchecked] = useState<string[]>([]);
  const ready = prompt.filter((p) => p.status === "accepted");
  const checked = ready.filter((p) => !unchecked.includes(p.id));
  const activeHasYaml = useAsync(async () => {
    const a = await api.getActivePrompt();
    return (await api.getPromptVersion(a.version)).meta.source !== "text";
  }, []);
  const why =
    activeHasYaml.data === false
      ? "La versión vigente no tiene prompt.yaml. Súbelo en Prompt para crear versiones desde aquí."
      : ready.length > 0 && checked.length === 0
        ? "Marca al menos una regla."
        : null;
  const resolved = active.filter((p) => ["included", "asked_client", "calibrated"].includes(p.status)).length;
  return (
    <div className="grid gap-4">
      <section className="card grid gap-1">
        <FollowUpProgress resolved={resolved} waiting={active.length - resolved} discarded={discarded.length} />
        <p className="help m-0">
          Para la próxima versión {prompt.length}
          {client.length > 0 ? ` · Preguntas a la empresa ${client.length}` : ""} · Para calibrar {calibrate.length}
        </p>
      </section>
      <FollowUpList
        title="Para la próxima versión del prompt"
        empty="Nada pendiente para la próxima versión."
        rows={prompt}
        select={(p) =>
          p.status === "accepted" && (
            <input
              type="checkbox"
              className="size-[18px]"
              aria-label={`Incluir la regla del motivo ${p.criterionId} en la versión nueva`}
              checked={!unchecked.includes(p.id)}
              onChange={() => setUnchecked((u) => (u.includes(p.id) ? u.filter((x) => x !== p.id) : [...u, p.id]))}
            />
          )
        }
        action={
          ready.length > 0 && (
            <div className="grid justify-items-end gap-1">
              <Button
                size="sm"
                variant="primary"
                disabled={!!why || activeHasYaml.data === undefined}
                aria-describedby={why ? "create-version-why" : undefined}
                onClick={() => router.push(`/admin/prompts/new?from=followup&p=${checked.map((p) => p.id).join(",")}`)}
              >
                Crear versión con {checked.length} {checked.length === 1 ? "regla" : "reglas"}
              </Button>
              {why && (
                <span id="create-version-why" className="help">
                  {why}
                </span>
              )}
            </div>
          )
        }
      >
        {(p) =>
          p.status === "included" ? (
            <Link className="help" href={`/admin/prompts/${encodeURIComponent(p.decision?.includedInVersion ?? "")}`}>
              Incluida en v{p.decision?.includedInVersion}
              {p.decision?.versionStatus === "draft" ? " (borrador)" : ""}
            </Link>
          ) : (
            <Button size="sm" onClick={() => void reopen(p)}>
              Volver a pendiente
            </Button>
          )
        }
      </FollowUpList>
      {client.length > 0 && (
      <FollowUpList
        title="Preguntas a la empresa"
        empty="Sin preguntas a la empresa."
        rows={client}
        action={
          client.length > 0 && (
            <Button size="sm" onClick={() => void copy(client.map((p) => `Motivo ${p.criterionId}: ${text(p)}`).join("\n"))}>
              Copiar todas
            </Button>
          )
        }
      >
        {(p) => (
          <>
            {p.status === "accepted" ? (
              <Button size="sm" onClick={() => void act(p, "asked_client")}>
                Marcar como preguntada
              </Button>
            ) : (
              <Button size="sm" onClick={() => void act(p, "accepted")}>
                Volver a aceptada
              </Button>
            )}
            <Button size="sm" onClick={() => void copy(text(p))}>
              Copiar
            </Button>
          </>
        )}
      </FollowUpList>
      )}
      <FollowUpList title="Para calibrar con el auditor" empty="Nada para calibrar." rows={calibrate}>
        {(p) => (
          <>
            {p.status === "accepted" ? (
              <Button size="sm" onClick={() => void act(p, "calibrated")}>
                Marcar como calibrada
              </Button>
            ) : (
              <Button size="sm" onClick={() => void act(p, "accepted")}>
                Volver a aceptada
              </Button>
            )}
            <Link className="btn btn-sm" href={`/admin/discrepancies/patterns/${p.id}`}>
              Ver casos
            </Link>
          </>
        )}
      </FollowUpList>
      <details className="card">
        <summary className="cursor-pointer font-medium">Descartadas ({discarded.length})</summary>
        <div className="mt-2 grid gap-2">
          {discarded.length === 0 && <p className="help m-0">Sin propuestas descartadas.</p>}
          {discarded.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="flex-1">
                Motivo {p.criterionId} · «{text(p)}» · {p.decision?.reason} · {p.decision?.by}
              </span>
              <Button size="sm" onClick={() => void reopen(p)}>
                Volver a pendiente
              </Button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function FollowUpList({
  title,
  empty,
  rows,
  action,
  select,
  children,
}: {
  title: string;
  empty: string;
  rows: DiscrepancyPattern[];
  action?: React.ReactNode;
  /** Casilla al lado del título (Cambio 18). */
  select?: (p: DiscrepancyPattern) => React.ReactNode;
  children: (p: DiscrepancyPattern) => React.ReactNode;
}) {
  return (
    <section className="card grid gap-2">
      <div className="flex items-center gap-2">
        <h2 className="m-0 flex-1 text-base font-semibold">
          {title} ({rows.length})
        </h2>
        {action}
      </div>
      {rows.length === 0 && <p className="help m-0">{empty}</p>}
      {rows.map((p) => (
        <div key={p.id} className="grid gap-1 border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {select?.(p)}
            <Link href={`/admin/discrepancies/patterns/${p.id}`} className="font-medium">
              Motivo {p.criterionId} · {p.title}
            </Link>
            <StatusBadge tone="teal">{statusLabel(p)}</StatusBadge>
          </div>
          <PatternBody p={{ ...p, explanation: "" }} />
          <div className="flex flex-wrap gap-2">{children(p)}</div>
        </div>
      ))}
    </section>
  );
}
