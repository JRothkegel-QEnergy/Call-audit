"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  ACTION_LABEL,
  ActionBar,
  CriteriaChart,
  FollowUpProgress,
  PriorityMap,
  quadrantOf,
  QUADRANT_LABEL,
  SummaryTiles,
  WHO_LABEL,
  WhoIsRightBar,
  type Quadrant,
} from "@/components/admin/discrepancy-charts";
import { AnalyzeDialog, PatternBody, PatternCard } from "@/components/admin/discrepancy-parts";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { AsyncView, EmptyState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type {
  ActionGroup,
  DiscrepancyCause,
  DiscrepancyCriterionRow,
  DiscrepancyOverview,
  DiscrepancyPattern,
  ProposalType,
  WhoIsRight,
} from "@/lib/api/admin-types";
import { ANALYSIS_STATUS, CAUSE, followUpGroup, PROPOSAL, statusLabel, usd } from "@/lib/discrepancy-labels";
import { int, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Tab = "analysis" | "followup" | "history";

/** Análisis de discrepancias del admin Qubico (Cambio 16). Estado en la URL: ?tab=…&cause=…&type=…&status=…&motivo=…
 * &analysis=… (un análisis anterior se abre en solo lectura, H-112). Cambio 19: &view=table, &quad=…, &action=…,
 * &right=… (filtros desde los gráficos). */
export default function DiscrepancyAnalysisPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DiscrepancyAnalysis />
    </Suspense>
  );
}

function DiscrepancyAnalysis() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = (["followup", "history"] as const).find((t) => t === params.get("tab")) ?? "analysis";
  const setParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const followUp = useAsync(() => api.getDiscrepancyFollowUp(), []);
  // Contador de Seguimiento (H-115): aceptadas que todavía esperan algo (versión, pregunta o calibración).
  const pendingFollowUp = (followUp.data ?? []).filter((p) => p.status === "accepted").length;
  return (
    <>
      <AdminHeader
        title="Análisis de discrepancias"
        description="Por qué la IA y la planilla no coinciden. Son hallazgos para revisar: nada cambia el prompt hasta que una persona sube una versión nueva."
      />
      <div className="tabs" role="tablist">
        {(
          [
            ["analysis", "Análisis", null],
            ["followup", "Seguimiento", pendingFollowUp || null],
            ["history", "Historial", null],
          ] as const
        ).map(([k, label, count]) => (
          <button
            key={k}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === k}
            onClick={() => setParams({ tab: k === "analysis" ? null : k, analysis: null })}
          >
            {label}
            {count ? <span className="cnt">{count}</span> : null}
          </button>
        ))}
      </div>
      {tab === "analysis" && <AnalysisTab params={params} setParams={setParams} onDecision={() => void followUp.reload({ silent: true })} />}
      {tab === "followup" && (
        <AsyncView state={followUp} what="el seguimiento">
          {(rows) => <FollowUpTab rows={rows} onChange={() => void followUp.reload({ silent: true })} />}
        </AsyncView>
      )}
      {tab === "history" && <HistoryTab />}
    </>
  );
}

function AnalysisTab({
  params,
  setParams,
  onDecision,
}: {
  params: URLSearchParams;
  setParams: (c: Record<string, string | null>) => void;
  onDecision: () => void;
}) {
  const analysisId = params.get("analysis") ?? undefined;
  const overview = useAsync(() => api.getDiscrepancyOverview(analysisId), [analysisId]);
  const running = overview.data?.running;
  // Mientras corre, el avance se actualiza solo (D-48).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void overview.reload({ silent: true }), 5000);
    return () => clearInterval(id);
  }, [running, overview]);
  return (
    <AsyncView state={overview} what="el análisis de discrepancias">
      {(data) => (
        <AnalysisView
          data={data}
          params={params}
          setParams={setParams}
          reload={() => void overview.reload({ silent: true })}
          onDecision={onDecision}
        />
      )}
    </AsyncView>
  );
}

function AnalysisView({
  data,
  params,
  setParams,
  reload,
  onDecision,
}: {
  data: DiscrepancyOverview;
  params: URLSearchParams;
  setParams: (c: Record<string, string | null>) => void;
  reload: () => void;
  onDecision: () => void;
}) {
  const [dialog, setDialog] = useState<number[] | "default" | null>(null);
  // Decisiones tomadas en esta vista, sobre lo que trae la última carga (que se refresca mientras corre un análisis).
  const [decided, setDecided] = useState<Record<string, DiscrepancyPattern>>({});
  const patterns = data.patterns.map((p) => decided[p.id] ?? p);
  const patternsTitle = useRef<HTMLHeadingElement>(null);
  const observationsRef = useRef<HTMLDetailsElement>(null);
  const [announce, setAnnounce] = useState("");

  if (data.calls === 0) {
    return <EmptyState title="Aún no hay llamadas con corrida vigente y marca por motivo en la planilla para comparar." />;
  }
  if (data.cases === 0) {
    return <EmptyState title="La corrida vigente coincide con la planilla en todos los motivos. No hay nada que analizar." />;
  }

  const a = data.analysis;
  const run = data.running;
  const series = data.currentSeries;
  const cause = params.get("cause") as DiscrepancyCause | null;
  const type = params.get("type") as ProposalType | null;
  const status = params.get("status") ?? "pending";
  const motive = params.get("motivo") ? Number(params.get("motivo")) : null;
  const view = params.get("view") === "table" ? "table" : "chart";
  const quad = (Object.keys(QUADRANT_LABEL) as Quadrant[]).find((q) => q === params.get("quad")) ?? null;
  const action = (Object.keys(ACTION_LABEL) as ActionGroup[]).find((k) => k === params.get("action")) ?? null;
  const right = (["auditor", "ia", "ambiguo"] as WhoIsRight[]).find((k) => k === params.get("right")) ?? null;
  const visible = patterns.filter(
    (p) =>
      !p.isObservation &&
      (!cause || p.cause === cause) &&
      (!type || p.proposal?.type === type) &&
      (status === "all" || (status === "pending" ? p.status === "pending" : p.status !== "pending")) &&
      (motive == null || p.criterionId === motive) &&
      (!quad || quadrantOf(p) === quad) &&
      (!action || actionOf(p) === action) &&
      (!right || p.whoIsRight === right),
  );
  // D-84: los filtros solo ofrecen las causas y tipos que trae el análisis mostrado.
  const causes = (Object.entries(CAUSE) as [DiscrepancyCause, string][]).filter(([k]) =>
    patterns.some((p) => !p.isObservation && p.cause === k),
  );
  const types = (Object.entries(PROPOSAL) as [ProposalType, string][]).filter(([k]) => patterns.some((p) => p.proposal?.type === k));
  const caps = a?.capabilities;
  const lacking = caps
    ? [
        !caps.whoIsRight && "quién tiene más razón",
        !caps.expectedFix && "casos que corregiría",
        !caps.sideEffects && "posibles efectos",
        !caps.concentration && "concentración",
      ].filter((x): x is string => !!x)
    : [];
  const focusPatterns = () => setTimeout(() => patternsTitle.current?.focus(), 50);
  const observations = patterns.filter((p) => p.isObservation && (motive == null || p.criterionId === motive));
  const pending = a ? a.criteria.filter((c) => !a.doneCriteria.includes(c)) : [];
  const manualPct = data.cases ? Math.round((100 * data.manualCases) / data.cases) : 0;
  const update = (p: DiscrepancyPattern) => {
    setDecided((d) => ({ ...d, [p.id]: p }));
    setAnnounce(`Patrón de motivo ${p.criterionId}: ${statusLabel(p)}`);
    onDecision();
  };
  const filtered = !!(cause || type || motive != null || status !== "pending" || quad || action || right);

  return (
    <div className="grid gap-4">
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {data.readOnly && a && (
        <div className="banner" role="note">
          <span>
            Estás viendo el análisis del {a.createdAt ? shortDateTime(a.createdAt) : "—"}.{" "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({ analysis: null })}>
              Ver el último
            </button>
          </span>
        </div>
      )}

      <section className="card grid gap-1.5">
        <p className="m-0">
          Comparamos la corrida vigente{" "}
          <b>{series ? `${series.model} · v${series.promptVersion}` : "—"}</b> con la planilla de calidad y la revisión manual Qubico.
        </p>
        {a ? (
          <p className="m-0 text-sm">
            {data.readOnly ? "Análisis" : "Último análisis"}: {a.createdAt ? shortDateTime(a.createdAt) : "—"} · {a.model} · prompt de análisis v
            {a.analysisPromptVersion} · {a.doneCriteria.length} motivos · {usd(a.costUsd)}
            {a.status !== "done" && ` · ${ANALYSIS_STATUS[a.status]}`}
          </p>
        ) : (
          !run && <p className="m-0">Todavía no hay análisis con IA. Analizar busca patrones y propone soluciones; no cambia el prompt.</p>
        )}
        {a?.status === "stopped" && (
          <p className="m-0 text-sm">
            Análisis detenido por {a.stoppedBy ?? "—"} en {a.doneCriteria.length} de {a.criteria.length} motivos. Costo: {usd(a.costUsd)}.
          </p>
        )}
        {a?.status === "failed" && (
          <p className="m-0 text-sm" role="alert">
            El análisis falló en {a.failedCriteria.map((f) => `el motivo ${f.criterionId}`).join(", ") || "un motivo"}
            {a.failedCriteria[0] ? `: ${a.failedCriteria[0].error}` : a.error ? `: ${a.error}` : ""}. Los {a.doneCriteria.length} motivos anteriores
            quedaron guardados.
          </p>
        )}
        {data.stale && (
          <p className="m-0 flex items-center gap-1.5 text-sm text-[var(--amber-700,#9a6700)]">
            <AlertTriangle size={14} aria-hidden />
            Desactualizado:{" "}
            {data.stale.currentSeriesChanged && data.stale.currentSeries
              ? `cambió la corrida vigente a ${data.stale.currentSeries.model} · v${data.stale.currentSeries.promptVersion}`
              : `entraron ${data.stale.newReviews} revisiones nuevas`}{" "}
            desde el último análisis.
          </p>
        )}
        {!data.readOnly && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {run ? (
              <RunningLine run={run} onStopped={reload} />
            ) : (
              <>
                <Button variant="primary" onClick={() => setDialog("default")}>
                  {a ? "Analizar de nuevo" : "Analizar discrepancias"}
                </Button>
                {pending.length > 0 && a && a.status !== "done" && (
                  <Button onClick={() => setDialog(pending)}>Analizar motivos pendientes ({pending.length})</Button>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <SummaryTiles
        s={data.summary}
        hasAnalysis={!!a}
        followUp={data.followUp}
        stale={!!data.stale}
        onFollowUp={() => setParams({ tab: "followup", analysis: null })}
      />

      {a ? (
        <section className="card grid gap-3">
          <ActionBar
            s={data.summary}
            criteria={a.doneCriteria.length}
            selected={action}
            onSelect={(k) => {
              if (k === "observation") {
                if (observationsRef.current) observationsRef.current.open = true;
                observationsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                return;
              }
              setParams({ action: k, status: k ? "all" : null });
              if (k && k !== "unpatterned") focusPatterns();
            }}
          />
          {action === "unpatterned" && (
            <p className="m-0 text-sm" role="note">
              {int(data.summary.byAction.unpatterned)} casos analizados sin patrón: la IA no encontró algo en común.{" "}
              <Link href="/admin/stats?tab=quality">Revísalos desde Calidad de la IA →</Link>
            </p>
          )}
          <WhoIsRightBar
            s={data.summary}
            version={a.analysisPromptVersion}
            selected={right}
            onSelect={(k) => {
              setParams({ right: k, status: k ? "all" : null });
              if (k) focusPatterns();
            }}
          />
        </section>
      ) : (
        !run && (
          <p className="help m-0">
            Todavía no hay análisis con IA. Analizar busca patrones y propone dónde se arregla cada uno; no cambia el prompt.
          </p>
        )
      )}

      <p className="help m-0">
        {int(data.calls)} llamadas · {int(data.cases)} casos en desacuerdo · {data.manualCases} casos con revisión manual Qubico ({manualPct} %)
        {Object.entries(data.callsOutside).map(([why, n]) => ` · ${n} llamadas fuera (${why})`)}
        {manualPct < 10 && ". Hay poca revisión manual: la causa Evaluador de la planilla se apoya casi solo en la planilla."}
      </p>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 flex-1 text-lg font-semibold">¿Dónde están los desacuerdos?</h2>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={view === "chart"} onClick={() => setParams({ view: null })}>
              Gráfico
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setParams({ view: "table" })}>
              Tabla
            </button>
          </div>
        </div>
        <p className="help m-0">
          Calce de llamada: {data.callMatch.agree} de {data.callMatch.total} (
          {data.callMatch.total ? Math.round((100 * data.callMatch.agree) / data.callMatch.total) : 0} %) ·{" "}
          <Link href="/admin/stats?tab=quality">Ver en Calidad de la IA →</Link>
        </p>
        {view === "chart" ? (
          <CriteriaChart
            rows={data.criteria}
            selected={motive}
            onSelect={(cid) => {
              setParams({ motivo: motive === cid ? null : String(cid), status: "all" });
              if (motive !== cid) focusPatterns();
            }}
          />
        ) : (
          <CriteriaTable
            rows={data.criteria}
            motive={motive}
            onSelect={(cid) => {
              setParams({ motivo: String(cid), status: "all" });
              focusPatterns();
            }}
          />
        )}
      </section>

      <details className="card">
        <summary className="cursor-pointer font-medium">Por evaluador de la planilla</summary>
        {data.evaluators ? (
          <>
            <p className="help">
              Un evaluador que marca mucho más (o menos) que el resto, con la IA pareja, apunta a una diferencia del evaluador, no del prompt.
            </p>
            <table className="tbl flat">
              <thead>
                <tr>
                  <th scope="col">Evaluador</th>
                  <th scope="col">Llamadas</th>
                  <th scope="col">Rechaza (planilla)</th>
                  <th scope="col">Calce con la IA</th>
                  <th scope="col">NO CUMPLE por llamada</th>
                  <th scope="col">Solo la IA</th>
                  <th scope="col">Omitidos</th>
                </tr>
              </thead>
              <tbody>
                {data.evaluators.map((ev) => (
                  <tr key={ev.evaluator}>
                    <td>{ev.evaluator}</td>
                    <td className="num">{ev.calls}</td>
                    <td className="num">{ev.calls ? Math.round((100 * ev.clientCallFails) / ev.calls) : 0} %</td>
                    <td className="num">{ev.calls ? Math.round((100 * ev.callMatch) / ev.calls) : 0} %</td>
                    <td className="num">{ev.calls ? (ev.clientFails / ev.calls).toFixed(2).replace(".", ",") : "—"}</td>
                    <td className="num">{ev.fp}</td>
                    <td className="num">{ev.fn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="help mb-0">La planilla de estas llamadas no trae el evaluador. Reimporta la metadata con la planilla nueva para verlo.</p>
        )}
      </details>

      {a && <PriorityMap patterns={patterns} selected={quad} onSelect={(q) => setParams({ quad: q, status: null })} />}

      {a && (
        <section className="grid gap-2">
          <h2 ref={patternsTitle} tabIndex={-1} className="m-0 text-lg font-semibold">
            Patrones · ordenados por impacto
          </h2>
          <span className="sr-only" aria-live="polite">
            {visible.length} patrones
          </span>
          {lacking.length > 0 && (
            <p className="help m-0" role="note">
              ⓘ Este análisis usó el prompt de análisis v{a.analysisPromptVersion}: no trae {lacking.slice(0, -1).join(", ")}
              {lacking.length > 1 ? " ni " : ""}
              {lacking[lacking.length - 1]}. Aparecen al correr un análisis nuevo.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <FilterSeg
              label="Causa"
              value={cause}
              options={causes}
              onChange={(v) => setParams({ cause: v })}
            />
            <FilterSeg
              label="Tipo"
              allLabel="Todos"
              value={type}
              options={types}
              onChange={(v) => setParams({ type: v })}
            />
            <select
              className="control"
              aria-label="Estado"
              value={status}
              onChange={(e) => setParams({ status: e.target.value === "pending" ? null : e.target.value })}
            >
              <option value="pending">Pendientes</option>
              <option value="decided">Decididas</option>
              <option value="all">Todas</option>
            </select>
            {motive != null && <StatusBadge>Motivo {motive}</StatusBadge>}
            {quad && <StatusBadge>{QUADRANT_LABEL[quad][0]}</StatusBadge>}
            {action && action !== "unpatterned" && <StatusBadge>{ACTION_LABEL[action]}</StatusBadge>}
            {right && <StatusBadge>Más razón: {WHO_LABEL[right].toLowerCase()}</StatusBadge>}
            {filtered && (
              <Button size="sm" variant="ghost" onClick={() => setParams({ cause: null, type: null, status: null, motivo: null, quad: null, action: null, right: null })}>
                Quitar filtros
              </Button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="help m-0">
              {patterns.some((p) => !p.isObservation) ? "Ningún patrón con estos filtros." : "La IA no encontró patrones: los desacuerdos parecen casos aislados."}
            </p>
          ) : (
            visible.map((p) => <PatternCard key={p.id} p={p} readOnly={data.readOnly} onChange={update} />)
          )}
        </section>
      )}

      {observations.length > 0 && (
        <details className="card" ref={observationsRef}>
          <summary className="cursor-pointer font-medium">
            Observaciones ({observations.length}) · patrones con menos de 3 casos, sin propuesta para aceptar
          </summary>
          <div className="mt-2 grid gap-2">
            {observations.map((p) => (
              <div key={p.id} className="flex flex-wrap items-baseline gap-2 border-t border-border pt-2">
                <span>
                  Motivo {p.criterionId} · {p.title}
                </span>
                <Link href={`/admin/discrepancies/patterns/${p.id}`} className="help">
                  Ver casos ({p.caseCount})
                </Link>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="card">
        <summary className="cursor-pointer font-medium">Cómo leer este análisis</summary>
        <p className="mb-0">
          La IA de análisis agrupa los desacuerdos entre la corrida vigente y la planilla de calidad, y propone una causa y una solución. Son
          hallazgos para revisar: nada cambia el prompt ni los resultados hasta que una persona sube una versión nueva. Un patrón con menos de 3
          casos queda como observación. Si la planilla y la revisión manual Qubico no coinciden, el caso va a calibración y no al prompt.
        </p>
        <p className="mb-0">
          Las barras cuentan casos (llamada × motivo), no patrones; un caso en varios patrones cuenta una vez, en el de mejor prioridad.
          «Según el análisis» quiere decir que lo decidió la IA de análisis y nadie lo ha verificado.
        </p>
      </details>

      {dialog && (
        <AnalyzeDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          data={data}
          initialCriteria={dialog === "default" ? undefined : dialog}
          onStarted={() => {
            toast("Análisis en curso. El worker lo toma en su próxima pasada.");
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Grupo de «¿Dónde se arregla?» de un patrón (igual que el backend). */
function actionOf(p: DiscrepancyPattern): ActionGroup {
  if (p.isObservation) return "observation";
  const t = p.proposal?.type;
  return t === "client_question" || t === "data_request" ? "company" : (t ?? "none");
}

/** La tabla por motivo de siempre (Cambio 16), en «Ver como tabla» (D-83). */
function CriteriaTable({
  rows,
  motive,
  onSelect,
}: {
  rows: DiscrepancyCriterionRow[];
  motive: number | null;
  onSelect: (criterionId: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Motivo</th>
            <th scope="col">Planilla NO CUMPLE</th>
            <th scope="col">IA NO CUMPLE</th>
            <th scope="col">Coinciden</th>
            <th scope="col">Solo la IA detectó</th>
            <th scope="col">Omitidos por la IA</th>
            <th scope="col">IA dudosa</th>
            <th scope="col">Con revisión manual</th>
            <th scope="col">Patrones</th>
            <th scope="col">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.criterionId} aria-current={motive === c.criterionId || undefined}>
              <td>
                {c.criterionId} · {c.name}
                {c.summary && <div className="help">{c.summary}</div>}
              </td>
              <td className="num">{c.clientFails}</td>
              <td className="num">{c.aiFails}</td>
              <td className="num">{c.matchFail}</td>
              <td className="num">{c.fp}</td>
              <td className="num">{c.fn}</td>
              <td className="num">{c.aiUncertain}</td>
              <td className="num">{c.manualItems}</td>
              <td className="num">{c.patterns == null ? <span className="help">sin analizar</span> : c.patterns}</td>
              <td>
                {c.patterns != null && (
                  <button type="button" className="btn btn-ghost btn-sm whitespace-nowrap" onClick={() => onSelect(c.criterionId)}>
                    Ver patrones
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSeg({
  label,
  allLabel = "Todas",
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel?: string;
  value: string | null;
  options: [string, string][];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="help">{label}:</span>
      <div className="seg" role="group" aria-label={label}>
        <button type="button" aria-pressed={!value} onClick={() => onChange(null)}>
          {allLabel}
        </button>
        {options.map(([k, text]) => (
          <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function RunningLine({ run, onStopped }: { run: NonNullable<DiscrepancyOverview["running"]>; onStopped: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = run.doneCriteria.length + run.failedCriteria.length;
  return (
    <>
      <span aria-live="polite">
        {run.status === "queued" ? "En cola: el worker lo toma en su próxima pasada" : `Analizando · ${done} de ${run.criteria.length} motivos`} ·{" "}
        {usd(run.costUsd)}
      </span>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.stopDiscrepancyAnalysis(run.id);
            onStopped();
          } finally {
            setBusy(false);
          }
        }}
      >
        Detener
      </Button>
      <span className="help">Analizar de nuevo queda deshabilitado mientras corre.</span>
    </>
  );
}

function FollowUpTab({ rows, onChange }: { rows: DiscrepancyPattern[]; onChange: () => void }) {
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

function HistoryTab() {
  const runs = useAsync(() => api.listDiscrepancyAnalyses(), []);
  const router = useRouter();
  return (
    <AsyncView state={runs} what="el historial de análisis">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState title="Todavía no hay análisis con IA." />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Quién</th>
                <th scope="col">Corrida de capa 2</th>
                <th scope="col">Modelo</th>
                <th scope="col">Prompt de análisis</th>
                <th scope="col">Motivos</th>
                <th scope="col">Patrones</th>
                <th scope="col">Costo real</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular">{r.createdAt ? shortDateTime(r.createdAt) : "—"}</td>
                  <td>{r.createdBy ?? "—"}</td>
                  <td>{r.layer2Series ? `${r.layer2Series.model} · v${r.layer2Series.promptVersion}` : "—"}</td>
                  <td>{r.model}</td>
                  <td className="tabular">v{r.analysisPromptVersion}</td>
                  <td className="num">
                    {r.doneCriteria.length} de {r.criteria.length}
                  </td>
                  <td className="num">{r.patterns ?? "—"}</td>
                  <td className="num">{usd(r.costUsd)}</td>
                  <td>
                    <StatusBadge tone={r.status === "failed" ? "fail" : r.status === "done" ? "teal" : "neutral"} title={r.error ?? undefined}>
                      {ANALYSIS_STATUS[r.status]}
                    </StatusBadge>
                  </td>
                  <td>
                    {r.doneCriteria.length > 0 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/admin/discrepancies?analysis=${r.id}`)}>
                        Abrir <ChevronRight size={14} aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </AsyncView>
  );
}
