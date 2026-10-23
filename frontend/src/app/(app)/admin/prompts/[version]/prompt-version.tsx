"use client";

import { AlertTriangle, ChevronLeft, Download, FlaskConical, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { PromptDiff } from "@/components/admin/prompt-diff";
import { PromptForm } from "@/components/admin/prompt-form";
import { PromptStatusBadge } from "@/components/admin/prompt-status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { EvaluationMetrics, PromptEvaluation, PromptVersionDetail, ReferenceMetrics } from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { pct, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

type Tab = "diff" | "test" | "history" | "edit";
const REF_LABEL = { client: "auditoría del cliente", app_auditors: "auditores de la app" } as const;
const usd = (n: number, d = 4) => `${n.toFixed(d).replace(".", ",")} USD`;

export function PromptVersionView({ version }: { version: string }) {
  const router = useRouter();
  const data = useAsync(async () => {
    const [detail, all] = await Promise.all([api.getPromptVersion(version), api.listPromptVersions()]);
    return { detail, all };
  }, [version]);
  const [tab, setTab] = useState<Tab>("diff");
  const [testOpen, setTestOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  // La prueba corre en el worker: se consulta su avance mientras está en cola o corriendo.
  const running = ["queued", "running"].includes(data.data?.detail.evaluation?.status ?? "");
  const { reload } = data;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void reload({ silent: true }), 2500);
    return () => clearInterval(t);
  }, [running, reload]);

  return (
    <>
      <Button variant="ghost" onClick={() => router.push("/admin/prompts")}>
        <ChevronLeft size={14} aria-hidden />
        Volver a Versiones del prompt
      </Button>
      <AsyncView state={data} what="la versión del prompt">
        {({ detail, all }) => {
          const { meta } = detail;
          const isActive = meta.status === "active";
          const previous = isActive ? all.find((v) => v.status === "retired") : undefined;
          const canActivate = meta.status === "tested" || meta.status === "retired";
          const canTest = meta.status === "draft" || meta.status === "test_failed";
          return (
            <>
              <div className="mt-2">
                <AdminHeader
                  title={`Prompt v${meta.version}`}
                  description={meta.changelog.replaceAll("**", "")}
                  actions={
                    <>
                      <Button
                        onClick={async () => {
                          const blob = await api.exportPromptVersion(meta.version);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `prompt-v${meta.version}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download size={14} aria-hidden />
                        Descargar para el repo
                      </Button>
                      {meta.status === "draft" && (
                        <Button
                          onClick={async () => {
                            await api.discardPromptDraft(meta.version);
                            toast(`Borrador v${meta.version} descartado.`);
                            router.push("/admin/prompts");
                          }}
                        >
                          Descartar borrador
                        </Button>
                      )}
                      {canTest && (
                        <Button variant="primary" onClick={() => setTestOpen(true)}>
                          <FlaskConical size={14} aria-hidden />
                          {meta.status === "test_failed" ? "Reintentar la prueba" : "Probar contra la referencia"}
                        </Button>
                      )}
                      {canActivate && (
                        <Button variant="primary" onClick={() => setActivateOpen(true)}>
                          {meta.status === "retired" ? `Volver a v${meta.version}` : `Activar v${meta.version}`}
                        </Button>
                      )}
                      {isActive && previous && (
                        <Button onClick={() => router.push(`/admin/prompts/${encodeURIComponent(previous.version)}`)}>
                          Volver a v{previous.version}…
                        </Button>
                      )}
                    </>
                  }
                />
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                <PromptStatusBadge status={meta.status} />
                <span className="text-muted-foreground">
                  {meta.model || "sin modelo"} · creada por {meta.createdBy}
                  {meta.createdAt ? ` el ${shortDateTime(meta.createdAt)}` : ""}
                  {meta.activatedAt ? ` · activada el ${shortDateTime(meta.activatedAt)}` : ""}
                </span>
                {meta.rationale && <span className="text-muted-foreground">· Por qué: {meta.rationale}</span>}
              </div>
              {meta.source === "text" && (
                <div className="banner mb-3" style={{ borderLeftColor: "var(--amber-600)" }}>
                  Esta versión no tiene historial ni origen por regla: se subió solo el system prompt.
                </div>
              )}

              <EvaluationBanner detail={detail} onStop={() => void reload({ silent: true })} onRetry={() => setTestOpen(true)} />

              <div className="tabs" role="tablist">
                {(
                  [
                    ["diff", "Diferencias"],
                    ["test", "Prueba"],
                    ["history", "Historial"],
                    ...(meta.status === "draft" ? ([["edit", "Editar borrador"]] as const) : []),
                  ] as [Tab, string][]
                ).map(([k, label]) => (
                  <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "diff" &&
                (detail.diff ? (
                  <PromptDiff diff={detail.diff} baseLabel={`v${detail.activeVersion} (vigente)`} nextLabel={`v${meta.version}`} />
                ) : (
                  <p className="help">Esta es la versión vigente. Abre otra versión para compararla contra esta.</p>
                ))}

              {tab === "test" && <TestTab detail={detail} />}

              {tab === "history" && (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Persona</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.history.length === 0 && (
                      <tr>
                        <td colSpan={3} className="help">
                          Sin historial registrado (versión importada del bench o del repo).
                        </td>
                      </tr>
                    )}
                    {detail.history.map((h, i) => (
                      <tr key={i}>
                        <td className="tabular">{shortDateTime(h.at)}</td>
                        <td>{h.actor}</td>
                        <td className="whitespace-normal">{h.action}</td>
                      </tr>
                    ))}
                    {meta.activationReason && (
                      <tr>
                        <td colSpan={3} className="whitespace-normal">
                          <span className="help">Motivo de la activación:</span> {meta.activationReason}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === "edit" && meta.status === "draft" && (
                <PromptForm
                  editing
                  activeVersion={detail.activeVersion}
                  submitLabel="Guardar borrador"
                  initial={{
                    source: meta.source === "text" ? "text" : "yaml",
                    content: detail.content,
                    version: meta.version,
                    model: meta.model,
                    changelog: meta.changelog,
                    rationale: meta.rationale ?? "",
                  }}
                  onCancel={() => setTab("diff")}
                  onSubmit={async (v) => {
                    await api.updatePromptDraft(meta.version, {
                      content: v.content,
                      model: v.model,
                      changelog: v.changelog.trim(),
                      rationale: v.rationale.trim() || null,
                    });
                    toast("Borrador actualizado.");
                    setTab("diff");
                    void reload({ silent: true });
                  }}
                />
              )}

              <TestDialog
                open={testOpen}
                onOpenChange={setTestOpen}
                version={meta.version}
                model={meta.model}
                onStarted={() => {
                  setTestOpen(false);
                  setTab("test");
                  void reload({ silent: true });
                }}
              />
              <ActivateDialog
                open={activateOpen}
                onOpenChange={setActivateOpen}
                detail={detail}
                onDone={() => {
                  setActivateOpen(false);
                  toast(`Prompt v${meta.version} vigente para los lotes que lleguen desde ahora.`);
                  void reload({ silent: true });
                }}
              />
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

function EvaluationBanner({ detail, onStop, onRetry }: { detail: PromptVersionDetail; onStop: () => void; onRetry: () => void }) {
  const ev = detail.evaluation;
  if (!ev) return null;
  const v = detail.meta.version;
  if (ev.status === "queued" || ev.status === "running")
    return (
      <div className="banner mb-3" role="status" aria-live="polite">
        <span>
          Probando v{v} · {ev.done} de {ev.total} llamadas · {usd(ev.costUsd)}
          {ev.status === "queued" && " · esperando al worker"}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={async () => {
            await api.stopPromptTest(v);
            toast("Prueba detenida.");
            onStop();
          }}
        >
          <Square size={12} aria-hidden />
          Detener prueba
        </Button>
      </div>
    );
  if (ev.status === "stopped")
    return (
      <div className="banner mb-3" style={{ borderLeftColor: "var(--amber-600)" }}>
        <span>
          Prueba detenida{ev.stoppedBy ? ` por ${ev.stoppedBy}` : ""} en {ev.done} de {ev.total} llamadas. Costo: {usd(ev.costUsd)}.
        </span>
        <Button size="sm" className="ml-auto" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  if (ev.status === "failed")
    return (
      <div className="error-state mb-3" role="alert">
        <b>La prueba falló.</b> <span className="help">{ev.error}</span>
      </div>
    );
  return (
    <div className="banner mb-3">
      Prueba terminada · {ev.total} llamadas · Costo real: {usd(ev.costUsd)}
    </div>
  );
}

const refOf = (m: EvaluationMetrics | null | undefined, kind: ReferenceMetrics["kind"]) => m?.references.find((r) => r.kind === kind);

function TestTab({ detail }: { detail: PromptVersionDetail }) {
  const rubric = useRubric();
  const ev: PromptEvaluation | null = detail.evaluation;
  const mine = ev?.status === "done" ? ev.metrics : null;
  const base = detail.activeMetrics;
  const same = detail.meta.version === detail.activeVersion;
  if (!mine && !same)
    return (
      <p className="help">
        {ev ? "La prueba aún no termina." : "Aún no se prueba. Usa «Probar contra la referencia»: la versión queda inmutable desde ese momento."}
      </p>
    );
  const shown = same ? base : mine;
  if (!shown) return <p className="help">No hay llamadas con veredicto del cliente para medir.</p>;
  const row = (label: string, get: (m: EvaluationMetrics) => number | undefined, fmt: (n: number) => string, higherIsBetter: boolean) => {
    const a = base ? get(base) : undefined;
    const b = get(shown);
    const worse = !same && a != null && b != null && (higherIsBetter ? b < a : b > a);
    return (
      <tr key={label}>
        <td>{label}</td>
        {!same && <td className="num">{a != null ? fmt(a) : "—"}</td>}
        <td className="num font-semibold">
          {b != null ? fmt(b) : "—"}
          {worse && (
            <span className="vt vt-doubt ml-1.5" title="Empeora contra la vigente">
              empeora
            </span>
          )}
        </td>
      </tr>
    );
  };
  const fails = new Map((base?.byCriterion ?? []).map((c) => [c.criterionId, c.failCount]));
  const criteria = [...new Set([...(base?.byCriterion ?? []), ...shown.byCriterion].map((c) => c.criterionId))].sort((x, y) => x - y);
  return (
    <div className="grid gap-4">
      <p className="help m-0">
        Referencia: {shown.references.map((r) => `${REF_LABEL[r.kind]} · ${r.n} ${r.kind === "client" ? "llamadas" : "casos"}`).join(" · ")}
        {!same && " · la vigente se mide con sus corridas actuales, sin gastar."}
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Métrica</th>
            {!same && <th>v{detail.activeVersion} (vigente)</th>}
            <th>v{detail.meta.version}</th>
          </tr>
        </thead>
        <tbody>
          {row("Coincidencia con el cliente", (m) => refOf(m, "client")?.matchRate, (n) => pct(n), true)}
          {row("Coincidencia con los auditores de la app", (m) => refOf(m, "app_auditors")?.matchRate, (n) => pct(n), true)}
          {row("Dudosas", (m) => refOf(m, "client")?.uncertainRate, (n) => pct(n), false)}
          {row("Solo la IA detectó", (m) => refOf(m, "client")?.aiOnlyFail, String, false)}
          {row("Omitidos por la IA", (m) => refOf(m, "client")?.aiMissedFail, String, false)}
          {row("Citas no validadas", (m) => refOf(m, "client")?.unvalidatedQuoteRate, (n) => pct(n), false)}
          {row("Costo por llamada", (m) => m.costPerCallUsd, (n) => usd(n), false)}
          {row("Latencia p95", (m) => m.latencyMsP95, (n) => `${(n / 1000).toFixed(1).replace(".", ",")} s`, false)}
        </tbody>
      </table>
      <div>
        <h3 className="m-0 mb-2 text-sm font-semibold">Llamadas con el motivo incumplido</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Motivo</th>
              {!same && <th>v{detail.activeVersion}</th>}
              <th>v{detail.meta.version}</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((id) => (
              <tr key={id}>
                <td className="whitespace-normal">
                  Motivo {id} · {rubric?.criteria[id]?.name}
                </td>
                {!same && <td className="num">{fails.get(id) ?? 0}</td>}
                <td className="num font-semibold">{shown.byCriterion.find((c) => c.criterionId === id)?.failCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestDialog({
  open,
  onOpenChange,
  version,
  model,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  version: string;
  model: string;
  onStarted: () => void;
}) {
  const estimate = useAsync(async () => (open ? api.estimatePromptTest(version, model || undefined) : null), [open, version, model]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = estimate.data;
  const cost = e?.totalUsd != null ? usd(e.totalUsd, 2) : null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`¿Probar v${version} contra la referencia?`}
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            disabled={!e || e.calls === 0}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.startPromptTest(version, model || undefined);
                onStarted();
              } catch (err) {
                const code = err instanceof Error ? err.message : "";
                setError(code === "no_calibration" ? "No hay llamadas con veredicto del cliente para probar." : "No pudimos iniciar la prueba. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {cost ? `Correr prueba · ${cost}` : "Correr sin estimación"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      {!e ? (
        <div className="skel" />
      ) : e.calls === 0 ? (
        <p className="m-0">No hay llamadas con veredicto del cliente para probar.</p>
      ) : (
        <div className="grid gap-2">
          <p className="m-0">
            Se correrá el modelo <b>{e.model}</b> sobre <b>{e.calls} llamadas</b> que traen el veredicto del cliente.
          </p>
          {cost ? (
            <p className="m-0">
              <b>Costo estimado: {cost}</b> ({usd(e.perCallUsd ?? 0)} por llamada, según las últimas corridas de este modelo).
            </p>
          ) : (
            <p className="m-0">No hay costo registrado para este modelo; no podemos estimarlo.</p>
          )}
          {e.minutes != null && <p className="m-0">Tiempo estimado: {String(e.minutes).replace(".", ",")} min. Puedes detener la prueba en cualquier momento.</p>}
          <p className="help m-0">La prueba no cambia resultados ni crea casos en la cola.</p>
        </div>
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}

function ActivateDialog({
  open,
  onOpenChange,
  detail,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  detail: PromptVersionDetail;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const v = detail.meta.version;
  const rollback = detail.meta.status === "retired";
  const a = refOf(detail.activeMetrics, "client")?.matchRate;
  const b = refOf(detail.evaluation?.metrics, "client")?.matchRate;
  const worse = a != null && b != null && b < a;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={rollback ? `¿Volver al prompt v${v}?` : `¿Activar el prompt v${v}?`}
      description={
        <p className="m-0">
          {rollback
            ? `v${detail.activeVersion} queda retirada. Se aplica a los lotes que lleguen desde ahora.`
            : `Reemplaza a v${detail.activeVersion} para los lotes que lleguen desde ahora. Las llamadas ya procesadas no cambian.`}
        </p>
      }
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!reason.trim()) return setError("Escribe el motivo de la activación.");
              setBusy(true);
              setError(null);
              try {
                await api.activatePromptVersion(v, reason.trim());
                setReason("");
                onDone();
              } catch (err) {
                setError(err instanceof ApiError && err.errors.length ? err.errors[0] : "No pudimos activar la versión. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {rollback ? `Volver a v${v}` : `Activar v${v}`}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      {a != null && b != null && (
        <div className="summary-box">
          <span>
            v{detail.activeVersion} → v{v} · Coincidencia con el cliente: {pct(a)} → {pct(b)}
          </span>
        </div>
      )}
      {worse && (
        <div className="flex items-start gap-1.5 rounded-sm border border-[var(--amber-600)] bg-[var(--amber-100)] px-2 py-1.5 text-[13px] text-amber-800" role="alert">
          <AlertTriangle size={14} aria-hidden className="mt-0.5 flex-none" />
          Esta versión baja la coincidencia con el cliente de {pct(a!)} a {pct(b!)}.
        </div>
      )}
      <label className="field">
        {rollback ? "Motivo (obligatorio)" : "Motivo de la activación (obligatorio)"}
        <textarea autoFocus className="control" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}
