"use client";

import { AlertTriangle, Check, CircleDashed, Loader2, Moon, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { StatusBadge } from "@/components/ui/badges";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { PipelineRun, PipelineStage, ProcessingStatus, WorkerState } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";
import { durationText, int, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Tab = "runs" | "failures";

const STAGE_RUNNING: Record<PipelineStage, string> = {
  listing: "Revisando el SFTP",
  transcribing: "Transcribiendo",
  validating: "Validando",
  archiving: "Subiendo y archivando",
};
const STAGES: PipelineStage[] = ["listing", "transcribing", "validating", "archiving"];
const STAGE_LABEL: Record<PipelineStage, string> = {
  listing: "Revisar SFTP",
  transcribing: "Transcribir",
  validating: "Validar",
  archiving: "Subir y archivar",
};
// Consulta más seguido con una pasada en curso (H-83).
const POLL_MS: Record<WorkerState, number> = { running: 5_000, idle: 30_000, stale: 30_000, last_failed: 30_000, no_data: 30_000 };

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
const secondsBetween = (from: string, to = Date.now()) => Math.max(0, (to - new Date(from).getTime()) / 1000);

function ago(iso: string): string {
  const s = Math.round(secondsBetween(iso));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

function runDuration(run: PipelineRun): string {
  if (!run.startedAt) return "—";
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  return durationText(secondsBetween(run.startedAt, end));
}

/** Procesamiento (Cambio 14): estado del worker, avance de la pasada en curso, últimas pasadas y fallas de ASR. */
export default function ProcessingPage() {
  const status = useAsync(() => api.getProcessingStatus(), []);
  const runs = useAsync(() => api.listPipelineRuns(20), []);
  const failures = useAsync(() => api.listAsrFailures(), []);
  const [tab, setTab] = useState<Tab>("runs");
  const state = status.data?.state ?? "no_data";
  const { reload: reloadStatus } = status;
  const { reload: reloadRuns } = runs;
  const { reload: reloadFailures } = failures;

  // Se pausa con la pestaña oculta y vuelve a consultar al mostrarse.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      void reloadStatus({ silent: true });
      void reloadRuns({ silent: true });
      void reloadFailures({ silent: true });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") timer = setTimeout(refresh, POLL_MS[state]);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
      else clearTimeout(timer);
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Cada respuesta nueva (status.data) reprograma la siguiente consulta.
  }, [state, status.data, reloadStatus, reloadRuns, reloadFailures]);

  return (
    <>
      <AdminHeader title="Procesamiento" description="Estado del worker que transcribe y valida las llamadas." />
      {status.status === "error" && status.data && (
        <p className="help mb-3 mt-0 flex items-center gap-1.5" role="status">
          <AlertTriangle size={14} aria-hidden /> No pudimos actualizar el estado. Reintentaremos en unos segundos.
        </p>
      )}
      <AsyncView state={status} what="el estado del worker">
        {(s) => (
          <>
            <StateCard status={s} />
            {s.currentRun ? <RunPanel run={s.currentRun} current /> : s.lastRun ? <RunPanel run={s.lastRun} current={false} /> : null}
            <OtherTasks status={s} />
          </>
        )}
      </AsyncView>

      <div className="tabs mt-4" role="tablist">
        {(
          [
            ["runs", "Últimas pasadas"],
            ["failures", `Fallas de transcripción (${failures.data?.length ?? 0})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "runs" ? (
        <AsyncView state={runs} what="las últimas pasadas">
          {(rows) => <RunsTable runs={rows} />}
        </AsyncView>
      ) : (
        <AsyncView state={failures} what="las fallas de transcripción">
          {(rows) => (
            <>
              <p className="help mb-3 mt-0">
                Se reintentan solas en las próximas pasadas. Las fallas por cuota de Gemini no aparecen acá: se reintentan sin contar como error.
              </p>
              {rows.length === 0 ? (
                <EmptyState title="No hay fallas de transcripción." />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Error</th>
                      <th>Intentos</th>
                      <th>Último intento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.stem}>
                        <td className="tabular">{f.stem}</td>
                        <td>
                          <ErrorText text={f.error} />
                        </td>
                        <td className="num">{f.attempts}</td>
                        <td className="tabular">{f.lastAttemptAt ? shortDateTime(f.lastAttemptAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </AsyncView>
      )}
    </>
  );
}

function StateCard({ status }: { status: ProcessingStatus }) {
  const beat = status.lastHeartbeatAt;
  const next = status.nextRunAt;
  const nextText = next ? `${hhmm(next)} (en ~${Math.max(0, Math.round(secondsBetween(new Date().toISOString(), new Date(next).getTime()) / 60))} min)` : null;
  const content: Record<WorkerState, { icon: React.ReactNode; title: string; body?: React.ReactNode; tone: string }> = {
    running: {
      icon: <Loader2 size={18} className="animate-spin text-primary" aria-hidden />,
      title: `Procesando · ${status.stage ? STAGE_RUNNING[status.stage] : "Revisando el SFTP"}`,
      tone: "border-primary",
    },
    idle: {
      icon: <Moon size={18} className="text-muted-foreground" aria-hidden />,
      title: "En espera",
      body: nextText ? `Próxima pasada a las ${nextText}` : undefined,
      tone: "",
    },
    stale: {
      icon: <AlertTriangle size={18} className="text-amber-800" aria-hidden />,
      title: "El worker no responde",
      body: (
        <>
          Último latido: {beat ? shortDateTime(beat) : "—"}. Revisa el contenedor <code>call-audit-worker-1</code> en el servidor.
        </>
      ),
      tone: "border-[var(--amber-600)] bg-[var(--amber-100)]",
    },
    last_failed: {
      icon: <XCircle size={18} className="text-destructive" aria-hidden />,
      title: "La última pasada falló",
      body: `${status.lastRun?.finishedAt ? hhmm(status.lastRun.finishedAt) : "—"}: ${status.lastRun?.error ?? "sin detalle"}. El worker reintentará en la próxima pasada${next ? `, a las ${hhmm(next)}` : ""}.`,
      tone: "border-destructive",
    },
    no_data: {
      icon: <CircleDashed size={18} className="text-muted-foreground" aria-hidden />,
      title: "Todavía no hay datos del worker.",
      body: "Aparecerán cuando el worker empiece su próxima pasada.",
      tone: "",
    },
  };
  const c = content[status.state];
  return (
    <div className={cn("card mb-3 flex flex-wrap items-start justify-between gap-3", c.tone)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{c.icon}</span>
        <div>
          <b>{c.title}</b>
          {c.body && <p className="help m-0 mt-0.5">{c.body}</p>}
        </div>
      </div>
      {beat && status.state !== "stale" && status.state !== "no_data" && (
        <span className="help" title={shortDateTime(beat)}>
          Último latido: {ago(beat)}
        </span>
      )}
    </div>
  );
}

function stageDone(run: PipelineRun, stage: PipelineStage): boolean {
  if (run.status !== "running") return run.status === "done" || STAGES.indexOf(stage) < STAGES.indexOf(lastStageReached(run));
  return run.stage !== null && STAGES.indexOf(stage) < STAGES.indexOf(run.stage);
}

/** Hasta dónde llegó una pasada que terminó con error o se interrumpió. */
function lastStageReached(run: PipelineRun): PipelineStage {
  if (run.archived > 0) return "archiving";
  if (run.validateTotal > 0) return "validating";
  if (run.transcribeTotal > 0) return "transcribing";
  return "listing";
}

function RunPanel({ run, current }: { run: PipelineRun; current: boolean }) {
  const header = current
    ? `Pasada en curso · empezó ${run.startedAt ? hhmm(run.startedAt) : "—"} · lleva ${runDuration(run)}`
    : `Última pasada · ${run.startedAt ? shortDateTime(run.startedAt) : "—"} · duró ${runDuration(run)}`;
  const rows: { stage: PipelineStage; summary: React.ReactNode; progress?: { k: number; n: number } }[] = [
    {
      stage: "listing",
      summary: `${int(run.audios)} audios · ${int(run.waitingMetadata)} esperan metadata · ${int(run.batchSize)} en esta pasada`,
    },
    {
      stage: "transcribing",
      summary:
        current && run.stage === "transcribing"
          ? `${int(run.transcribed + run.asrErrors + run.asrRateLimited)} de ${int(run.transcribeTotal)} · ${run.asrErrors} con error · ${run.asrRateLimited} por cuota`
          : `${int(run.transcribed)} transcritos · ${run.asrErrors} con error · ${run.asrRateLimited} por cuota`,
      progress: { k: run.transcribed + run.asrErrors + run.asrRateLimited, n: run.transcribeTotal },
    },
    {
      stage: "validating",
      summary: current && run.stage === "validating" ? `${int(run.validated)} de ${int(run.validateTotal)}` : `${int(run.validated)} validadas`,
      progress: { k: run.validated, n: run.validateTotal },
    },
    { stage: "archiving", summary: `${int(run.archived)} archivados` },
  ];
  return (
    <div className="card mb-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <b>{header}</b>
        {!current && <RunResult run={run} />}
      </div>
      {/* Solo los cambios de etapa se anuncian, no cada número. */}
      <p className="sr-only" aria-live="polite">
        {current && run.stage ? `Etapa: ${STAGE_LABEL[run.stage]}` : !current ? "Pasada terminada" : ""}
      </p>
      <ol className="m-0 grid list-none gap-2 p-0">
        {rows.map(({ stage, summary, progress }, i) => {
          const done = stageDone(run, stage);
          const active = current && run.stage === stage;
          const empty = progress !== undefined && progress.n === 0 && (done || (!current && run.status === "done"));
          return (
            <li key={stage} className="grid grid-cols-[22px_150px_1fr] items-center gap-2">
              <span aria-hidden className="text-muted-foreground">
                {done ? <Check size={16} className="text-primary" /> : active ? <Loader2 size={16} className="animate-spin text-primary" /> : i + 1}
              </span>
              <span className={cn(active && "font-semibold")}>{STAGE_LABEL[stage]}</span>
              <span className="help m-0">
                {empty ? (
                  "Nada que hacer"
                ) : done || active || !current ? (
                  progress && active ? (
                    <ProgressBar k={progress.k} n={progress.n} label={STAGE_LABEL[stage]} text={summary} />
                  ) : active && stage === "listing" ? (
                    "Revisando el SFTP…"
                  ) : active && stage === "archiving" ? (
                    "Subiendo y archivando…"
                  ) : (
                    summary
                  )
                ) : (
                  "Pendiente"
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {run.remaining > 0 && <p className="help mb-0 mt-2.5">Quedan {int(run.remaining)} audios en el SFTP para las próximas pasadas.</p>}
    </div>
  );
}

function ProgressBar({ k, n, label, text }: { k: number; n: number; label: string; text: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={k}
        aria-valuetext={`${k} de ${n}`}
        className="inline-block h-2 w-40 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full bg-primary transition-[width]" style={{ width: `${n ? (k / n) * 100 : 0}%` }} />
      </span>
      <span>{text}</span>
    </span>
  );
}

function OtherTasks({ status }: { status: ProcessingStatus }) {
  const { catalogUploadsQueued, promptEvaluation } = status.otherTasks;
  if (!catalogUploadsQueued && !promptEvaluation) return null;
  return (
    <div className="help mb-1 grid gap-1">
      <span className="font-medium text-foreground">Otras tareas:</span>
      {catalogUploadsQueued > 0 && (
        <span>
          Cargas de Excel en cola: {catalogUploadsQueued} · <Link href="/catalog">Ver en Seguros</Link>
        </span>
      )}
      {promptEvaluation && (
        <span>
          Prueba del prompt v{promptEvaluation.version}: {promptEvaluation.processed} de {promptEvaluation.n} ·{" "}
          <Link href={`/admin/prompts/${encodeURIComponent(promptEvaluation.version)}`}>Ver prueba</Link>
        </span>
      )}
    </div>
  );
}

function RunResult({ run }: { run: PipelineRun }) {
  if (run.status === "running") return <StatusBadge tone="teal">En curso</StatusBadge>;
  if (run.status === "failed")
    return (
      <StatusBadge tone="fail" title={run.error ?? undefined}>
        Falló
      </StatusBadge>
    );
  if (run.status === "interrupted")
    return (
      <StatusBadge tone="doubt" title="El worker se reinició durante esta pasada.">
        Interrumpida
      </StatusBadge>
    );
  if (run.asrErrors > 0) return <StatusBadge tone="doubt">Con errores</StatusBadge>;
  return <StatusBadge tone="ink">Completa</StatusBadge>;
}

function ErrorText({ text }: { text: string }) {
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= 90 && firstLine === text) return <span>{text}</span>;
  return (
    <details>
      <summary className="cursor-pointer" title={text}>
        {firstLine.slice(0, 90)}
        {firstLine.length > 90 || firstLine !== text ? "…" : ""}
      </summary>
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </details>
  );
}

function RunsTable({ runs }: { runs: PipelineRun[] }) {
  if (runs.length === 0) return <EmptyState title="Todavía no hay pasadas registradas." />;
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Inicio</th>
          <th>Duración</th>
          <th>Audios</th>
          <th>Transcritos</th>
          <th>Errores</th>
          <th>Por cuota</th>
          <th>Validadas</th>
          <th>Archivados</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td className="tabular">{r.startedAt ? shortDateTime(r.startedAt) : "—"}</td>
            <td className="tabular">{runDuration(r)}</td>
            <td className="num">{int(r.audios)}</td>
            <td className="num">{int(r.transcribed)}</td>
            <td className="num">{r.asrErrors}</td>
            <td className="num">{r.asrRateLimited}</td>
            <td className="num">{int(r.validated)}</td>
            <td className="num">{int(r.archived)}</td>
            <td>
              <RunResult run={r} />
              {r.status === "failed" && r.error && (
                <div className="help mt-1 max-w-[320px]">
                  <ErrorText text={r.error} />
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
