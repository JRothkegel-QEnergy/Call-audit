"use client";

import { AlertTriangle, ChevronLeft, Download, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { PromptDiff } from "@/components/admin/prompt-diff";
import { PromptForm } from "@/components/admin/prompt-form";
import { PromptStatusBadge } from "@/components/admin/prompt-status";
import { ReauthDialog } from "@/components/admin/reauth-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { PromptEvaluation, PromptReferenceMetrics, PromptVersionDetail } from "@/lib/api/types";
import { pct, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

type Tab = "diff" | "test" | "history" | "edit";
const REF_LABEL = { client: "Auditoría del cliente", app_auditors: "Auditores de la app" } as const;

export function PromptVersionView({ version }: { version: string }) {
  const router = useRouter();
  const data = useAsync(async () => {
    const [detail, active, all] = await Promise.all([api.getPromptVersion(version), api.getActivePrompt(), api.listPromptVersions()]);
    const activeDetail = active.version === version ? detail : await api.getPromptVersion(active.version);
    return { detail, activeDetail, all };
  }, [version]);
  const [tab, setTab] = useState<Tab>("diff");
  const [activateOpen, setActivateOpen] = useState(false);

  // La prueba corre en segundo plano: se consulta hasta que termine.
  const running = data.data?.detail.meta.status === "testing";
  const { reload } = data;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void reload({ silent: true }), 1500);
    return () => clearInterval(t);
  }, [running, reload]);

  return (
    <>
      <Button variant="ghost" onClick={() => router.push("/admin/prompts")}>
        <ChevronLeft size={14} aria-hidden />
        Volver a Versiones del prompt
      </Button>
      <AsyncView state={data} what="la versión del prompt">
        {({ detail, activeDetail, all }) => {
          const { meta } = detail;
          const isActive = meta.status === "active";
          const previous = isActive
            ? all.find((v) => v.status === "retired" && v.testedAt)
            : undefined;
          const canActivate = meta.status === "tested" || (meta.status === "retired" && !!meta.testedAt);
          return (
            <>
              <div className="mt-2">
                <AdminHeader
                  title={`Prompt v${meta.version}`}
                  description={meta.changelog}
                  actions={
                    <>
                      <Button onClick={() => downloadForRepo(detail)}>
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
                      {(meta.status === "draft" || meta.status === "test_failed") && (
                        <Button
                          variant="primary"
                          onClick={async () => {
                            await api.startPromptEvaluation(meta.version);
                            setTab("test");
                            void data.reload({ silent: true });
                          }}
                        >
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
                        <Button onClick={() => router.push(`/admin/prompts/${previous.version}`)}>Volver a v{previous.version}…</Button>
                      )}
                    </>
                  }
                />
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                <PromptStatusBadge status={meta.status} />
                <span className="text-muted-foreground">
                  {meta.model} · creada por {meta.createdBy} el {shortDateTime(meta.createdAt)}
                  {meta.activatedAt ? ` · activada el ${shortDateTime(meta.activatedAt)}` : ""}
                </span>
                {meta.rationale && <span className="text-muted-foreground">· Por qué: {meta.rationale}</span>}
              </div>

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
                (isActive ? (
                  <p className="help">Esta es la versión vigente. Abre otra versión para compararla contra esta.</p>
                ) : (
                  <PromptDiff base={activeDetail.sections} next={detail.sections} baseLabel={`v${activeDetail.meta.version} (vigente)`} nextLabel={`v${meta.version}`} />
                ))}

              {tab === "test" && <TestTab detail={detail} active={activeDetail} />}

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
                  versionLocked
                  activeVersion={activeDetail.meta.version}
                  submitLabel="Guardar borrador"
                  initial={{ version: meta.version, model: meta.model, changelog: meta.changelog, rationale: meta.rationale ?? "", sections: detail.sections }}
                  onCancel={() => setTab("diff")}
                  onSubmit={async (v) => {
                    await api.updatePromptDraft(meta.version, { model: v.model, changelog: v.changelog.trim(), rationale: v.rationale.trim() || null, sections: v.sections });
                    toast("Borrador actualizado.");
                    setTab("diff");
                    void data.reload({ silent: true });
                  }}
                />
              )}

              <ActivateDialog
                open={activateOpen}
                onOpenChange={setActivateOpen}
                detail={detail}
                active={activeDetail}
                onDone={() => {
                  setActivateOpen(false);
                  toast(`Prompt v${meta.version} vigente para los lotes que lleguen desde ahora.`);
                  void data.reload({ silent: true });
                }}
              />
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

function refOf(ev: PromptEvaluation | null, kind: PromptReferenceMetrics["kind"]) {
  return ev?.status === "done" ? ev.references.find((r) => r.kind === kind) : undefined;
}

function TestTab({ detail, active }: { detail: PromptVersionDetail; active: PromptVersionDetail }) {
  const rubric = useRubric();
  const ev = detail.evaluation;
  if (!ev) return <p className="help">Aún no se prueba. Usa «Probar contra la referencia»: la versión queda inmutable desde ese momento.</p>;
  if (ev.status === "running")
    return (
      <div className="card" aria-busy="true" role="status">
        <b>Probando contra la referencia…</b>
        <p className="help mb-0">Se corre sobre el conjunto de calibración: llamadas con veredicto del cliente y revisiones cerradas de los auditores de la app.</p>
        <div className="skel" style={{ width: "60%" }} />
      </div>
    );
  if (ev.status === "failed") return <div className="error-state">La prueba falló. Puedes reintentarla.</div>;
  const same = detail.meta.version === active.meta.version;
  const cmp = (label: string, get: (e: PromptEvaluation) => number | undefined, fmt: (n: number) => string, higherIsBetter: boolean) => {
    const a = get(active.evaluation!);
    const b = get(ev);
    const worse = a != null && b != null && !same && (higherIsBetter ? b < a : b > a);
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
  return (
    <div className="grid gap-4">
      <p className="help m-0">
        Referencia: {ev.references.map((r) => `${REF_LABEL[r.kind].toLowerCase()} · ${r.n} ${r.kind === "client" ? "llamadas" : "casos"}`).join(" · ")}
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Métrica</th>
            {!same && <th>v{active.meta.version} (vigente)</th>}
            <th>v{detail.meta.version}</th>
          </tr>
        </thead>
        <tbody>
          {cmp("Coincidencia con el cliente", (e) => refOf(e, "client")?.matchRate, (n) => pct(n, 0), true)}
          {cmp("Coincidencia con los auditores de la app", (e) => refOf(e, "app_auditors")?.matchRate, (n) => pct(n, 0), true)}
          {cmp("Dudosas", (e) => refOf(e, "client")?.uncertainRate, (n) => pct(n, 0), false)}
          {cmp("Solo la IA detectó", (e) => refOf(e, "client")?.aiOnlyFail, String, false)}
          {cmp("Omitidos por la IA", (e) => refOf(e, "client")?.aiMissedFail, String, false)}
          {cmp("Citas no validadas", (e) => refOf(e, "client")?.unvalidatedQuoteRate, (n) => pct(n), false)}
          {cmp("Costo por llamada", (e) => e.costPerCallUsd, (n) => `${n.toFixed(4).replace(".", ",")} USD`, false)}
          {cmp("Latencia p95", (e) => e.latencyMsP95, (n) => `${(n / 1000).toFixed(1).replace(".", ",")} s`, false)}
        </tbody>
      </table>
      <div>
        <h3 className="m-0 mb-2 text-sm font-semibold">Coincidencia con el cliente por motivo</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Motivo</th>
              {!same && <th>v{active.meta.version}</th>}
              <th>v{detail.meta.version}</th>
            </tr>
          </thead>
          <tbody>
            {ev.byCriterion.map((c) => {
              const a = active.evaluation?.byCriterion.find((x) => x.criterionId === c.criterionId)?.matchRate;
              return (
                <tr key={c.criterionId}>
                  <td className="whitespace-normal">
                    Motivo {c.criterionId} · {rubric?.criteria[c.criterionId]?.name}
                  </td>
                  {!same && <td className="num">{a != null ? pct(a, 0) : "—"}</td>}
                  <td className="num font-semibold">{pct(c.matchRate, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivateDialog({
  open,
  onOpenChange,
  detail,
  active,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  detail: PromptVersionDetail;
  active: PromptVersionDetail;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const v = detail.meta.version;
  const a = refOf(active.evaluation, "client")?.matchRate;
  const b = refOf(detail.evaluation, "client")?.matchRate;
  const worse = a != null && b != null && b < a;
  return (
    <>
      <Dialog
        open={open && !reauthOpen}
        onOpenChange={onOpenChange}
        title={`¿Activar el prompt v${v}?`}
        description={<p className="m-0">Reemplaza a v{active.meta.version} para los lotes que lleguen desde ahora. Las llamadas ya procesadas no cambian.</p>}
        footer={
          <>
            <Button
              variant="primary"
              onClick={() => {
                if (!reason.trim()) return setError("Escribe el motivo de la activación.");
                setError(null);
                setReauthOpen(true);
              }}
            >
              Activar v{v}
            </Button>
            <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          </>
        }
      >
        <div className="summary-box">
          <span>
            v{active.meta.version} → v{v}
          </span>
          {a != null && b != null && (
            <span>
              Coincidencia con el cliente: {pct(a, 0)} → {pct(b, 0)}
            </span>
          )}
        </div>
        {worse && (
          <div className="flex items-start gap-1.5 rounded-sm border border-[var(--amber-600)] bg-[var(--amber-100)] px-2 py-1.5 text-[13px] text-amber-800" role="alert">
            <AlertTriangle size={14} aria-hidden className="mt-0.5 flex-none" />
            Esta versión baja la coincidencia con el cliente de {pct(a!, 0)} a {pct(b!, 0)}.
          </div>
        )}
        <label className="field">
          Motivo de la activación (obligatorio)
          <textarea autoFocus className="control" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </Dialog>
      <ReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onToken={async (token) => {
          await api.activatePromptVersion(v, { reason: reason.trim(), reauthToken: token });
          setReauthOpen(false);
          setReason("");
          onDone();
        }}
      />
    </>
  );
}

/** Exportar al repo: en el MVP es una descarga manual del archivo con sus metadatos (H-66). */
function downloadForRepo(detail: PromptVersionDetail) {
  const { meta, sections } = detail;
  const header = [
    "---",
    `version: ${meta.version}`,
    `model: ${meta.model}`,
    `status: ${meta.status}`,
    `created_by: ${meta.createdBy}`,
    `created_at: ${meta.createdAt}`,
    `changelog: ${JSON.stringify(meta.changelog)}`,
    "---",
    "",
  ].join("\n");
  const body = sections.map((s) => `## ${s.title}\n${s.text}`).join("\n\n");
  const blob = new Blob([header + body + "\n"], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prompt-v${meta.version}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
