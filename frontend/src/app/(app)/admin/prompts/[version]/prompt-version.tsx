"use client";

import { RenunciationReasonsButton } from "@/components/call/renunciation-reasons";
import { AlertTriangle, Check, ChevronLeft, Download, FlaskConical, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AgreementMosaic, CauseAnalysisNotice, DisagreementZoom, LoopEvolution, ReasonMatchBar } from "@/components/admin/agreement-charts";
import { QualityHeader } from "@/components/admin/quality-header";
import { PromptDiff } from "@/components/admin/prompt-diff";
import { PromptForm } from "@/components/admin/prompt-form";
import { PromptReader } from "@/components/admin/prompt-reader";
import { PromptStatusBadge } from "@/components/admin/prompt-status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MetricHelp } from "@/components/ui/metric-help";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CriterionScores, EvaluationMetrics, PromptEvaluation, PromptVersionDetail, ReferenceMetrics } from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";
import { pct, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

type Tab = "read" | "diff" | "test" | "history" | "edit";
const usd = (n: number, d = 4) => `${n.toFixed(d).replace(".", ",")} USD`;

export function PromptVersionView({ version }: { version: string }) {
  const router = useRouter();
  const data = useAsync(async () => {
    const [detail, all] = await Promise.all([api.getPromptVersion(version), api.listPromptVersions()]);
    return { detail, all };
  }, [version]);
  const search = useSearchParams();
  // «Volver a vX» desde la lista de llamadas del mosaico llega con ?tab=test; ?tab=read abre «Leer».
  // Sin tab elegida: «Leer» en la vigente (no tiene diferencias que mostrar) y «Diferencias» en las demás.
  const asked = search.get("tab");
  const [tab, setTab] = useState<Tab | null>(asked === "test" || asked === "read" ? asked : null);
  // «Crear borrador y probar» (Cambio 18) llega con ?test=1 y abre el diálogo de costo de la prueba.
  const [testOpen, setTestOpen] = useState(search.get("test") === "1");
  const [activateOpen, setActivateOpen] = useState(false);

  // La prueba corre en el worker: se consulta su avance mientras está en cola o corriendo.
  const running =
    ["queued", "running"].includes(data.data?.detail.evaluation?.status ?? "") ||
    data.data?.detail.evaluation?.metrics?.agreement?.causeAnalysis.status === "running";
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
          const shown: Tab = tab ?? (meta.version === detail.activeVersion ? "read" : "diff");
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
                    ["read", "Leer"],
                    ["diff", "Diferencias"],
                    ["test", "Prueba"],
                    ["history", "Historial"],
                    ...(meta.status === "draft" ? ([["edit", "Editar borrador"]] as const) : []),
                  ] as [Tab, string][]
                ).map(([k, label]) => (
                  <button key={k} type="button" role="tab" className="tab" aria-selected={shown === k} onClick={() => setTab(k)}>
                    {label}
                  </button>
                ))}
                {/* La corrida completa y los verificadores viven en su propia pantalla (13-rol-verificador). */}
                <Link href={`/admin/prompts/${encodeURIComponent(meta.version)}/verification`} className="tab no-underline">
                  Calibración
                </Link>
              </div>

              {shown === "read" && (
                <PromptReader spec={detail.spec} systemText={detail.systemText} version={meta.version} isYaml={meta.source !== "text"} />
              )}

              {shown === "diff" &&
                (detail.diff ? (
                  <PromptDiff diff={detail.diff} baseLabel={`v${detail.activeVersion} (vigente)`} nextLabel={`v${meta.version}`} />
                ) : (
                  <p className="help">Esta es la versión vigente. Abre otra versión para compararla contra esta.</p>
                ))}

              {shown === "test" && <TestTab detail={detail} onReload={() => void reload({ silent: true })} />}

              {shown === "history" && (
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
                          <span className="help">Razón de la activación:</span> {meta.activationReason}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {shown === "edit" && meta.status === "draft" && (
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

function TestTab({ detail, onReload }: { detail: PromptVersionDetail; onReload: () => void }) {
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
  if (!shown) return <p className="help">No hay llamadas con planilla de calidad para medir.</p>;
  const cols: { key: string; label: string; m: EvaluationMetrics | null }[] = same
    ? [{ key: "shown", label: `v${detail.meta.version}`, m: shown }]
    : [
        { key: "base", label: `v${detail.activeVersion} (vigente)`, m: base },
        { key: "shown", label: `v${detail.meta.version}`, m: shown },
      ];
  const n = shown.criterionScores?.nCalls ?? shown.criterionScores?.n ?? refOf(shown, "client")?.n;
  return (
    <div className="grid gap-4">
      <div>
        <h3 className="m-0 mb-1 text-sm font-semibold">Resultado contra la planilla de la corredora</h3>
        <p className="help m-0">
          Medido sobre las mismas {n ?? "—"} llamadas de validación que la corredora ya revisó. La planilla se toma como la respuesta correcta.
          {!same && " · La vigente se mide con sus corridas actuales, sin gastar."}
        </p>
        <GoalSummary base={same ? null : base} shown={shown} baseLabel={`v${detail.activeVersion}`} shownLabel={`v${detail.meta.version}`} />
      </div>
      {shown.agreement ? (
        <>
          <CauseAnalysisNotice version={detail.meta.version} ca={shown.agreement.causeAnalysis} onStarted={onReload} />
          <QualityHeader
            version={detail.meta.version}
            a={shown.agreement}
            linkVersion={same ? null : detail.meta.version}
            compare={!same && base?.agreement ? { label: `v${detail.activeVersion} (vigente)`, a: base.agreement } : null}
          />
          <AgreementMosaic version={detail.meta.version} a={shown.agreement} linked={!same} />
          <ReasonMatchBar version={detail.meta.version} a={shown.agreement} linked={!same} />
          <DisagreementZoom a={shown.agreement} />
          <LoopEvolution loop={detail.loop} version={detail.meta.version} />
        </>
      ) : (
        <p className="help m-0">Esta prueba no tiene la planilla por criterio, así que no se puede armar el mosaico.</p>
      )}
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Métrica</th>
            <th scope="col">Meta</th>
            {cols.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map((r) => {
            const a = !same && base ? r.get(base) : undefined;
            return (
              <tr key={r.label}>
                <td className="whitespace-normal">
                  <span className="font-semibold">{r.label}</span>
                  <MetricHelp title={r.label}>{r.help}</MetricHelp>
                  {r.sub && <div className="help">{r.sub}</div>}
                </td>
                <td className="num">
                  {r.goal != null ? (
                    `≤ ${r.goal} %`
                  ) : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">Sin meta</span>
                    </>
                  )}
                </td>
                {cols.map((c) => {
                  const v = c.m ? r.get(c.m) : undefined;
                  const count = c.m && r.count ? r.count(c.m) : undefined;
                  const isShown = c.key === "shown";
                  return (
                    <td key={c.key} className={cn("num align-top", isShown && "font-semibold")}>
                      {v != null ? r.fmt(v) : "—"}
                      {count && <span className="font-normal text-muted-foreground"> · {count}</span>}
                      {r.goal != null && v != null && <GoalBadge ok={v <= r.goal} />}
                      {isShown && !same && <Delta row={r} a={a} b={v} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <CriterionErrors detail={detail} base={same ? null : base} shown={shown} rubric={rubric} />
    </div>
  );
}

// --- Métricas contra la planilla (docs/ux/admin-prompt-metrics) ---------------------------------------------------

const p0 = (v: number) => pct(Math.round(v), 0);
/** Tasas de la planilla por criterio (fracción 0-1) a 0-100; si la prueba no trae marca por criterio, cae a references. */
const scoreRate = (m: EvaluationMetrics, key: "callMatchRate" | "callFpRate" | "callFnRate" | "callUncertainRate") => {
  const v = m.criterionScores?.[key];
  return v != null ? v * 100 : undefined;
};

type MetricRow = {
  label: string;
  sub?: string;
  help: string;
  goal?: number;
  get: (m: EvaluationMetrics) => number | undefined;
  count?: (m: EvaluationMetrics) => string | undefined;
  fmt: (n: number) => string;
  higherIsBetter: boolean;
  /** "points": diferencia en puntos; "relative": diferencia en % (costo, tiempo). */
  delta: "points" | "relative";
};

const ofCount = (a: number | undefined, b: number | undefined) => (a != null && b != null ? `${a} de ${b}` : undefined);

const METRIC_ROWS: MetricRow[] = [
  {
    label: "Coincide con el revisor",
    sub: "Mismo veredicto final que la planilla",
    help: "De cada 100 llamadas, en cuántas la IA llegó al mismo veredicto final (Cumple o No cumple) que la planilla del revisor. Las llamadas que la IA deja sin decisión cuentan como no coincidentes.",
    get: (m) => scoreRate(m, "callMatchRate") ?? refOf(m, "client")?.matchRate,
    fmt: p0,
    higherIsBetter: true,
    delta: "points",
  },
  {
    label: "Falsas alarmas (FP)",
    sub: "La IA rechaza una llamada que el revisor aprobó",
    help: "De las llamadas que el revisor aprobó, qué porcentaje rechaza la IA. Cada falsa alarma es una llamada que un auditor revisa sin necesidad. Meta del proyecto: 5 % o menos.",
    goal: 5,
    get: (m) => scoreRate(m, "callFpRate"),
    count: (m) => ofCount(m.criterionScores?.fpCount, m.criterionScores?.nApproved),
    fmt: p0,
    higherIsBetter: false,
    delta: "points",
  },
  {
    label: "Rechazos no detectados (FN)",
    sub: "La IA aprueba una llamada que el revisor rechazó",
    help: "De las llamadas que el revisor rechazó, qué porcentaje aprueba la IA. Son incumplimientos que la IA deja pasar. Meta del proyecto: 20 % o menos.",
    goal: 20,
    get: (m) => scoreRate(m, "callFnRate"),
    count: (m) => ofCount(m.criterionScores?.fnCount, m.criterionScores?.nRejected),
    fmt: p0,
    higherIsBetter: false,
    delta: "points",
  },
  {
    label: "Sin decisión de la IA",
    sub: "Pasan a revisión de un auditor",
    help: "Llamadas en que la IA no se decide y las deriva a un auditor. No cuentan como falsa alarma ni como rechazo no detectado: si este número sube, esas dos tasas pueden bajar sin que la IA sea mejor.",
    get: (m) => scoreRate(m, "callUncertainRate") ?? refOf(m, "client")?.uncertainRate,
    count: (m) => ofCount(m.criterionScores?.uncertainCount, m.criterionScores?.nCalls),
    fmt: (v) => pct(v),
    higherIsBetter: false,
    delta: "points",
  },
  {
    label: "Coincide con los auditores de la app",
    sub: "Mismo veredicto que dejaron en la app",
    help: "Igual que la coincidencia con el revisor, pero contra el veredicto que dejaron los auditores en la app. Se mide sobre menos casos: solo los que ya tienen revisión en la app.",
    get: (m) => refOf(m, "app_auditors")?.matchRate,
    fmt: p0,
    higherIsBetter: true,
    delta: "points",
  },
  {
    label: "Citas que no aparecen en la llamada",
    sub: "No se encontraron textuales en la transcripción",
    help: "La IA respalda cada incumplimiento con una cita de la llamada. Este porcentaje son las citas que no se encontraron textuales en la transcripción: pueden ser paráfrasis o errores de la IA.",
    get: (m) => refOf(m, "client")?.unvalidatedQuoteRate,
    fmt: (v) => pct(v),
    higherIsBetter: false,
    delta: "points",
  },
  {
    label: "Costo por llamada",
    help: "Costo promedio del modelo por llamada en esta prueba.",
    get: (m) => m.costPerCallUsd,
    fmt: (v) => usd(v),
    higherIsBetter: false,
    delta: "relative",
  },
  {
    label: "Tiempo por llamada (p95)",
    sub: "El 95 % termina en este tiempo o menos",
    help: "El 95 % de las llamadas se procesó en este tiempo o menos. Sirve para ver si la versión hace más lenta la cola de trabajo.",
    get: (m) => m.latencyMsP95,
    fmt: (v) => `${(v / 1000).toFixed(1).replace(".", ",")} s`,
    higherIsBetter: false,
    delta: "relative",
  },
];

function GoalBadge({ ok }: { ok: boolean }) {
  const Icon = ok ? Check : X;
  return (
    <div className="mt-1">
      <span className={cn("vt", ok ? "vt-pass" : "vt-fail")}>
        <Icon size={12} aria-hidden />
        {ok ? "Cumple la meta" : "Fuera de meta"}
      </span>
    </div>
  );
}

/** "−25 puntos · mejora" bajo el valor de la versión en prueba (reemplaza el badge "empeora"). */
function Delta({ row, a, b }: { row: MetricRow; a: number | undefined; b: number | undefined }) {
  if (a == null || b == null) return null;
  const d = row.delta === "points" ? b - a : a === 0 ? 0 : ((b - a) / a) * 100;
  if (Math.abs(d) < 1) return <div className="help font-normal">Sin cambio</div>;
  const better = row.higherIsBetter ? d > 0 : d < 0;
  const size = Math.round(Math.abs(d));
  const unit = row.delta === "points" ? (size === 1 ? "punto" : "puntos") : "%";
  return (
    <div className={cn("help font-normal", !better && "text-red-700")}>
      {d > 0 ? "+" : "−"}
      {size} {unit} · {better ? "mejora" : "empeora"}
    </div>
  );
}

/** Resumen en una línea, armado con una regla fija (sin IA). */
function GoalSummary({
  base,
  shown,
  baseLabel,
  shownLabel,
}: {
  base: EvaluationMetrics | null;
  shown: EvaluationMetrics;
  baseLabel: string;
  shownLabel: string;
}) {
  const fp = METRIC_ROWS[1];
  const fn = METRIC_ROWS[2];
  const meets = (m: EvaluationMetrics) => {
    const a = fp.get(m);
    const b = fn.get(m);
    return a != null && b != null ? a <= 5 && b <= 20 : null;
  };
  const s = meets(shown);
  if (s == null) return null;
  if (!base) return <p className="m-0 mt-2 text-sm font-semibold">{s ? `${shownLabel} cumple las metas.` : `${shownLabel} no cumple las metas.`}</p>;
  const b = meets(base);
  const head =
    s && b ? "Ambas versiones cumplen las metas." : s ? `Solo ${shownLabel} cumple las metas.` : b ? `Solo ${baseLabel} cumple las metas.` : "Ninguna versión cumple las metas.";
  const parts: { text: string; better: boolean }[] = [];
  const fa = fp.get(base);
  const fb = fp.get(shown);
  if (fa != null && fb != null && Math.abs(fb - fa) >= 1)
    parts.push({ text: `${fb < fa ? "baja" : "sube"} las falsas alarmas (${p0(fa)} → ${p0(fb)})`, better: fb < fa });
  const na = fn.get(base);
  const nb = fn.get(shown);
  if (na != null && nb != null && Math.abs(nb - na) >= 1)
    parts.push({ text: `deja pasar ${nb > na ? "más" : "menos"} rechazos (${p0(na)} → ${p0(nb)})`, better: nb < na });
  const tail =
    parts.length === 0
      ? ""
      : ` ${shownLabel} ${parts[0].text}${parts[1] ? `${parts[0].better !== parts[1].better ? ", pero " : " y "}${parts[1].text}` : ""}.`;
  return (
    <p className="m-0 mt-2 text-sm font-semibold">
      {head}
      {tail}
    </p>
  );
}

function CriterionErrors({
  detail,
  base,
  shown,
  rubric,
}: {
  detail: PromptVersionDetail;
  base: EvaluationMetrics | null;
  shown: EvaluationMetrics;
  rubric: ReturnType<typeof useRubric>;
}) {
  const cur = shown.criterionScores;
  if (!cur)
    return <p className="help m-0">Esta prueba no trae la marca por criterio de la planilla: no se pueden mostrar los errores por criterio.</p>;
  const prev = base?.criterionScores ?? null;
  const two = base != null;
  const at = (s: CriterionScores | null, id: number) => s?.byCriterion.find((c) => c.criterionId === id);
  const ids = [...new Set([...(prev?.byCriterion ?? []), ...cur.byCriterion].map((c) => c.criterionId))]
    .filter((id) => [at(prev, id), at(cur, id)].some((c) => c && (c.support || c.fp || c.fn)))
    .sort((x, y) => x - y);
  const head = (label: string, help: string) => (
    <>
      {label}
      <MetricHelp title={label}>{help}</MetricHelp>
    </>
  );
  const HELP = {
    marked: "Llamadas en que la planilla marcó este criterio como No cumple.",
    fp: "La IA marcó el criterio como No cumple y la corredora no.",
    fn: "La corredora marcó el criterio como No cumple y la IA no.",
  };
  const cell = (a: number | undefined, b: number | undefined) => {
    if (!two || a == null || b == null || a === b) return <>{b ?? "—"}</>;
    const worse = b > a;
    return (
      <span className={worse ? "text-red-700" : undefined}>
        {b} <span aria-hidden>{worse ? "▲" : "▼"}</span>
        <span className="sr-only">{worse ? "empeora" : "mejora"}</span>
      </span>
    );
  };
  return (
    <div>
      <h3 className="m-0 mb-1 text-sm font-semibold">Errores por criterio</h3>
      <p className="help m-0 mb-2">Compara qué criterios marcó la IA contra los que marcó la planilla, llamada por llamada.</p>
      <table className="tbl">
        <thead>
          {two ? (
            <>
              <tr>
                <th rowSpan={2} scope="col">
                  Criterio
                </th>
                <th rowSpan={2} scope="col">
                  {head("Marcados por la corredora", HELP.marked)}
                </th>
                <th colSpan={2} scope="colgroup">
                  {head("Falsas alarmas", HELP.fp)}
                </th>
                <th colSpan={2} scope="colgroup">
                  {head("No detectados", HELP.fn)}
                </th>
              </tr>
              <tr>
                <th scope="col">v{detail.activeVersion}</th>
                <th scope="col">v{detail.meta.version}</th>
                <th scope="col">v{detail.activeVersion}</th>
                <th scope="col">v{detail.meta.version}</th>
              </tr>
            </>
          ) : (
            <tr>
              <th scope="col">Criterio</th>
              <th scope="col">{head("Marcados por la corredora", HELP.marked)}</th>
              <th scope="col">{head("Falsas alarmas", HELP.fp)}</th>
              <th scope="col">{head("No detectados", HELP.fn)}</th>
            </tr>
          )}
        </thead>
        <tbody>
          {ids.map((id) => {
            const p = at(prev, id);
            const c = at(cur, id);
            const support = c?.support ?? p?.support ?? 0;
            return (
              <tr key={id}>
                <td className="whitespace-normal">
                  Criterio {id} · {rubric?.criteria[id]?.name}
                  <RenunciationReasonsButton criterionId={id} />
                  {support < cur.minSupport && <div className="help">Pocos casos: el resultado varía mucho</div>}
                </td>
                <td className="num">{support}</td>
                {two && <td className="num">{p?.fp ?? "—"}</td>}
                <td className="num font-semibold">{cell(p?.fp, c?.fp)}</td>
                {two && <td className="num">{p?.fn ?? "—"}</td>}
                <td className="num font-semibold">{cell(p?.fn, c?.fn)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
                setError(code === "no_calibration" ? "No hay llamadas con planilla de calidad para probar." : "No pudimos iniciar la prueba. Intenta de nuevo.");
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
        <p className="m-0">No hay llamadas con planilla de calidad para probar.</p>
      ) : (
        <div className="grid gap-2">
          <p className="m-0">
            Se correrá el modelo <b>{e.model}</b> sobre <b>{e.calls} llamadas</b> que traen la planilla de calidad.
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
              if (!reason.trim()) return setError("Escribe la razón de la activación.");
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
            v{detail.activeVersion} → v{v} · Coincidencia con la planilla: {pct(a)} → {pct(b)}
          </span>
        </div>
      )}
      {worse && (
        <div className="flex items-start gap-1.5 rounded-sm border border-[var(--amber-600)] bg-[var(--amber-100)] px-2 py-1.5 text-[13px] text-amber-800" role="alert">
          <AlertTriangle size={14} aria-hidden className="mt-0.5 flex-none" />
          Esta versión baja la coincidencia con la planilla de {pct(a!)} a {pct(b!)}.
        </div>
      )}
      <label className="field">
        {rollback ? "Razón (obligatorio)" : "Razón de la activación (obligatorio)"}
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
