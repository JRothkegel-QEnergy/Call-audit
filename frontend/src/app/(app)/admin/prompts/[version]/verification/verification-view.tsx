"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  AgreementMosaic,
  CauseAnalysisNotice,
  PART_NAME,
} from "@/components/admin/agreement-charts";
import { listHref } from "@/components/admin/verification-labels";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type {
  AgreementSegment,
  DistributionPlan,
  FullRunStatus,
  ProgressBlock,
  VerificationOverview,
  VerificationProgress,
  VerificationScope,
} from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { shortDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { scopeQuery } from "@/lib/verification-scope";

/**
 * Pestaña Verificación de una versión (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md): el mosaico de la
 * corrida completa filtrado por «Asignadas a» (V3), la tarjeta del verificador (V2) y, para el admin, la corrida
 * completa, el reparto (V5) y el avance por verificador (V6).
 */
const int = (n: number) => n.toLocaleString("es-CL");
const usd = (n: number | null | undefined) =>
  n == null ? "—" : `US$ ${n.toFixed(2).replace(".", ",")}`;
const SEGMENTS: AgreementSegment[] = [
  "promptFn",
  "promptFp",
  "reviewer",
  "undecided",
  "agree",
];
const SPLIT_NAME: Record<string, string> = {
  train: "Entrenamiento",
  val: "Validación",
  test: "Prueba",
  none: "Sin set",
};

export function VerificationView({ version }: { version: string }) {
  const { user } = useSession();
  const params = useSearchParams();
  const isVerifier = user?.role === "qubico_verifier";
  const isAdmin = user?.role === "qubico_admin";
  const assignee = params.get("asignadas") ?? (isVerifier ? "me" : "all");
  const state = useAsync(async () => {
    try {
      return await api.getVerificationOverview(version, assignee);
    } catch (e) {
      if (e instanceof ApiError && e.message === "no_full_run") return null;
      throw e;
    }
  }, [version, assignee]);
  const { reload } = state;
  const running = state.data?.agreement?.causeAnalysis.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void reload({ silent: true }), 4000);
    return () => clearInterval(t);
  }, [running, reload]);

  return (
    <>
      {!isVerifier && (
        <Link
          href={`/admin/prompts/${encodeURIComponent(version)}`}
          className="btn btn-ghost btn-sm mb-2"
        >
          <ChevronLeft size={14} aria-hidden /> Volver a v{version}
        </Link>
      )}
      <AdminHeader
        title={`Verificación · v${version}`}
        description="Cada llamada de la corrida completa, revisada por una persona: quién tenía razón en cada criterio en que la IA y la planilla no coinciden."
      />
      {isAdmin && (
        <FullRunPanel
          version={version}
          onDone={() => void reload({ silent: true })}
        />
      )}
      <AsyncView state={state} what="la verificación">
        {(data) =>
          data == null ? (
            <p className="empty-state">
              {isVerifier
                ? "Todavía no hay llamadas para verificar. Te avisaremos cuando el admin las reparta."
                : "Esta versión aún no tiene una corrida completa terminada."}
            </p>
          ) : (
            <Overview
              version={version}
              data={data}
              assignee={assignee}
              onReload={() => void reload({ silent: true })}
            />
          )
        }
      </AsyncView>
    </>
  );
}

function AssigneeFilter({
  data,
  assignee,
  isVerifier,
}: {
  data: VerificationOverview;
  assignee: string;
  isVerifier: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (value: string) =>
    router.replace(`${pathname}?asignadas=${encodeURIComponent(value)}`, {
      scroll: false,
    });
  if (isVerifier)
    return (
      <div className="flex items-center gap-2 text-sm">
        Asignadas a:
        <div className="seg" role="group" aria-label="Asignadas a">
          {(
            [
              ["me", "Mí"],
              ["all", "Todas"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={assignee === k}
              onClick={() => go(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <label className="flex items-center gap-2 text-sm">
      Asignadas a:
      <select
        className="control"
        value={assignee}
        onChange={(e) => go(e.target.value)}
      >
        <option value="all">Todos</option>
        {data.verifiers.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
        <option value="unassigned">Sin asignar</option>
      </select>
    </label>
  );
}

function Overview({
  version,
  data,
  assignee,
  onReload,
}: {
  version: string;
  data: VerificationOverview;
  assignee: string;
  onReload: () => void;
}) {
  const router = useRouter();
  const { user } = useSession();
  const isVerifier = user?.role === "qubico_verifier";
  const scope: VerificationScope = { source: "full", assignee };
  const caseHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(version)}/calls/${encodeURIComponent(caseId)}?segment=all${scopeQuery(scope)}`;
  // Lista plana de las llamadas propias, con filtro por criterio (16-lista-verificador-por-motivo, L1 A).
  const myListHref = `${listHref(version, "all")}${scopeQuery({ source: "full", assignee: "me" })}`;
  return (
    <div className="grid gap-4">
      {data.me && (
        <section
          className="card flex flex-wrap items-center gap-3"
          aria-live="polite"
        >
          {data.me.assigned === 0 ? (
            <p className="m-0">Aún no tienes llamadas asignadas.</p>
          ) : data.me.pending === 0 ? (
            <>
              <p className="m-0 font-semibold">
                ¡Listo! Completaste tus {int(data.me.assigned)} llamadas.
              </p>
              <Button className="ml-auto" onClick={() => router.push(myListHref)}>
                Ver mis llamadas
              </Button>
            </>
          ) : (
            <>
              <p className="m-0 text-base">
                Te quedan <b>{int(data.me.pending)}</b> de{" "}
                {int(data.me.assigned)} llamadas
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={data.me.assigned}
                aria-valuenow={data.me.assigned - data.me.pending}
                aria-label="Llamadas revisadas"
                className="h-2 w-40 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${(100 * (data.me.assigned - data.me.pending)) / data.me.assigned}%`,
                  }}
                />
              </div>
              <span className="ml-auto flex flex-wrap gap-2">
                <Button onClick={() => router.push(myListHref)}>
                  Ver mis llamadas
                </Button>
                {data.me.nextCaseId && (
                  <Button
                    variant="primary"
                    onClick={() => router.push(caseHref(data.me!.nextCaseId!))}
                  >
                    Seguir revisando <ChevronRight size={14} aria-hidden />
                  </Button>
                )}
              </span>
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <AssigneeFilter
          data={data}
          assignee={assignee}
          isVerifier={isVerifier}
        />
        <span className="help">
          {int(data.n)} llamadas · {data.model}
        </span>
        {data.n > 0 && (
          <Link
            className="ml-auto text-sm"
            href={`${listHref(version, "all")}${scopeQuery(scope)}`}
          >
            {assignee === "me"
              ? `Ver mis ${int(data.n)} llamadas ›`
              : `Ver las ${int(data.n)} llamadas ›`}
          </Link>
        )}
      </div>

      {data.agreement ? (
        <>
          {!isVerifier && (
            <CauseAnalysisNotice
              version={version}
              ca={data.agreement.causeAnalysis}
              onStarted={onReload}
              source="full"
            />
          )}
          <AgreementMosaic
            version={version}
            a={data.agreement}
            linked
            scope={scope}
            title={`Acuerdo con el revisor · v${version} · corrida completa`}
          />
        </>
      ) : (
        <p className="empty-state">
          {data.n === 0
            ? "No hay llamadas con este filtro."
            : "La corrida aún no tiene resultados."}
        </p>
      )}

      {!isVerifier && <Verifiers version={version} onChanged={onReload} />}
    </div>
  );
}

// --- Corrida completa (solo admin) ---------------------------------------------------------------------------------

function FullRunPanel({
  version,
  onDone,
}: {
  version: string;
  onDone: () => void;
}) {
  const state = useAsync(() => api.getFullRun(version), [version]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { reload } = state;
  const status = state.data?.run?.status;
  const active = status === "queued" || status === "running";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void reload({ silent: true }), 5000);
    return () => clearInterval(t);
  }, [active, reload]);
  useEffect(() => {
    if (status === "done") onDone();
  }, [status, onDone]);
  if (!state.data) return null;
  const { run, estimate: est }: FullRunStatus = state.data;
  const start = async () => {
    setBusy(true);
    try {
      await api.startFullRun(version);
      setOpen(false);
      toast(`Corrida completa de v${version} en cola.`);
      await reload({ silent: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.message : "";
      toast.error(
        code === "already_running"
          ? "Ya hay una corrida completa en curso."
          : "No se pudo lanzar la corrida.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card mb-4 grid gap-2" aria-labelledby="full-run-h">
      <h2 id="full-run-h" className="m-0 text-sm font-semibold">
        Corrida completa
      </h2>
      {run && active ? (
        <p className="m-0 flex items-center gap-2 text-sm" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          {status === "queued" ? "En cola" : "Corriendo"} · {int(run.done)} de{" "}
          {int(run.n)} llamadas · {usd(run.costUsd)} de{" "}
          {usd(run.estimatedCostUsd)} estimados
        </p>
      ) : run ? (
        <p className="m-0 text-sm">
          {status === "done"
            ? "Terminó"
            : status === "failed"
              ? "Falló"
              : "Se detuvo"}
          {run.finishedAt ? ` el ${shortDateTime(run.finishedAt)}` : ""} ·{" "}
          {int(run.done)} de {int(run.n)} llamadas · {usd(run.costUsd)} ·{" "}
          {run.model}
          {run.errors > 0 ? ` · ${int(run.errors)} con error` : ""}
        </p>
      ) : (
        <p className="m-0 text-sm">
          Esta versión todavía no corre sobre todas las llamadas con planilla.
        </p>
      )}
      {!active && est.missing > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Faltan {int(est.missing)} de {int(est.calls)} llamadas (
            {int(est.reused)} ya tienen resultado de v{version} con {est.model}
            ).
          </span>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <Play size={14} aria-hidden /> Correr las {int(est.missing)} que
            faltan
          </Button>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Correr v${version} en ${int(est.missing)} llamadas?`}
        description={
          <p className="m-0">
            Modelo {est.model}. Costo estimado {usd(est.totalUsd)} (
            {usd(est.perCallUsd)} por llamada, del promedio de corridas
            anteriores)
            {est.minutes != null
              ? `, unos ${Math.round(est.minutes)} minutos`
              : ""}
            . Las {int(est.reused)} llamadas que ya tienen resultado no se
            vuelven a pagar. No cambia la prueba ni el estado de la versión.
          </p>
        }
        footer={
          <>
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void start()}
            >
              Correr · {usd(est.totalUsd)}
            </Button>
          </>
        }
      />
    </section>
  );
}

// --- Verificadores: avance, reparto y reasignación (admin y lectura) ----------------------------------------------

function Verifiers({
  version,
  onChanged,
}: {
  version: string;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const canWrite = user?.role === "qubico_admin";
  const state = useAsync(() => api.getVerificationProgress(version), [version]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [split, setSplit] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const refresh = () => {
    void state.reload({ silent: true });
    onChanged();
  };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <section className="card grid gap-3" aria-labelledby="verifiers-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="verifiers-h" className="m-0 flex-1 text-sm font-semibold">
          Verificadores
        </h2>
        <label className="help flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={split}
            onChange={(e) => setSplit(e.target.checked)}
          />
          Desglose por set
        </label>
        {canWrite && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setDistributeOpen(true)}
          >
            Repartir llamadas
          </Button>
        )}
      </div>
      <AsyncView state={state} what="el avance">
        {(p) => (
          <>
            {p.people.length === 0 && (
              <p className="help m-0">
                Aún no hay cuentas con rol Verificador. Créalas en Cuentas con
                el rol «Verificador».
              </p>
            )}
            <ProgressTable
              version={version}
              p={p}
              split={split}
              expanded={expanded}
              onToggle={toggle}
              onMove={canWrite ? setMoveFrom : null}
            />
            {canWrite && (
              <>
                {distributeOpen && (
                  <DistributeDialog
                    version={version}
                    open={distributeOpen}
                    onOpenChange={setDistributeOpen}
                    people={p.people.filter((x) => x.active)}
                    unassigned={p.unassigned.pending}
                    onDone={refresh}
                  />
                )}
                <MoveDialog
                  key={moveFrom ?? "none"}
                  version={version}
                  from={p.people.find((x) => x.id === moveFrom) ?? null}
                  people={p.people.filter((x) => x.active && x.id !== moveFrom)}
                  onClose={() => setMoveFrom(null)}
                  onDone={refresh}
                />
              </>
            )}
          </>
        )}
      </AsyncView>
    </section>
  );
}

function Bar({
  b,
}: {
  b: ProgressBlock | { assigned: number; reviewed: number };
}) {
  const pct = b.assigned ? Math.round((100 * b.reviewed) / b.assigned) : 0;
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Revisadas"
        className="inline-block h-2 w-24 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="block h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular">{pct} %</span>
    </span>
  );
}

function ProgressTable({
  version,
  p,
  split,
  expanded,
  onToggle,
  onMove,
}: {
  version: string;
  p: VerificationProgress;
  split: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onMove: ((id: string) => void) | null;
}) {
  const pendingHref = (assignee: string) =>
    `${listHref(version, "all")}${scopeQuery({ source: "full", assignee })}&estado=pending`;
  const breakdown = (b: ProgressBlock) => {
    const keys = split
      ? Object.keys(b.bySplit).sort()
      : SEGMENTS.filter((s) => b.bySegment[s]);
    return keys.map((k) => {
      const c = split ? b.bySplit[k] : b.bySegment[k];
      return (
        <tr key={k} className="text-[13px]">
          <td className="pl-8 text-muted-foreground">
            {split ? (SPLIT_NAME[k] ?? k) : PART_NAME[k as AgreementSegment]}
          </td>
          <td className="num">{int(c.assigned)}</td>
          <td className="num">{int(c.reviewed)}</td>
          <td className="num">{int(c.pending)}</td>
          <td>
            <Bar b={c as ProgressBlock} />
          </td>
          <td />
          {onMove && <td />}
        </tr>
      );
    });
  };
  const row = (
    id: string,
    name: string,
    b: ProgressBlock,
    last: string | null | undefined,
    assignee: string,
    movable: boolean,
  ) => (
    <Fragment key={id}>
      <tr>
        <th scope="row" className="font-normal">
          <button
            type="button"
            className="flex items-center gap-1"
            aria-expanded={expanded.has(id)}
            onClick={() => onToggle(id)}
          >
            {expanded.has(id) ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
            {name}
          </button>
        </th>
        <td className="num">{int(b.assigned)}</td>
        <td className="num">{int(b.reviewed)}</td>
        <td className="num">
          {b.pending > 0 ? (
            <Link href={pendingHref(assignee)}>{int(b.pending)}</Link>
          ) : (
            int(b.pending)
          )}
        </td>
        <td>
          <Bar b={b} />
        </td>
        <td>{last ? shortDateTime(last) : <span className="help">—</span>}</td>
        {onMove && (
          <td>
            {movable && b.pending > 0 && (
              <Button size="sm" variant="ghost" onClick={() => onMove(id)}>
                Pasar pendientes a…
              </Button>
            )}
          </td>
        )}
      </tr>
      {expanded.has(id) && breakdown(b)}
    </Fragment>
  );
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Verificador</th>
            <th scope="col" className="num">
              Asignadas
            </th>
            <th scope="col" className="num">
              Revisadas
            </th>
            <th scope="col" className="num">
              Pendientes
            </th>
            <th scope="col">Avance</th>
            <th scope="col">Última actividad</th>
            {onMove && <th scope="col" />}
          </tr>
        </thead>
        <tbody>
          {p.people.map((x) =>
            row(
              x.id,
              x.active ? x.name : `${x.name} (desactivada)`,
              x,
              x.lastActivityAt,
              x.id,
              true,
            ),
          )}
          {row(
            "unassigned",
            "Sin asignar",
            p.unassigned,
            null,
            "unassigned",
            false,
          )}
          {row("total", "Total", p.total, null, "all", false)}
        </tbody>
      </table>
    </div>
  );
}

function DistributeDialog({
  version,
  open,
  onOpenChange,
  people,
  unassigned,
  onDone,
}: {
  version: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: { id: string; name: string }[];
  unassigned: number;
  onDone: () => void;
}) {
  // Casillas sin marcar de entrada (V5 A). El diálogo se monta al abrirse, así parte limpio cada vez.
  const [chosen, setChosen] = useState<string[]>([]);
  const [plan, setPlan] = useState<DistributionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const toggle = (id: string) => {
    const next = chosen.includes(id)
      ? chosen.filter((x) => x !== id)
      : [...chosen, id];
    setChosen(next);
    setPlan(null);
    if (next.length === 0) return;
    const request = ++latest.current;
    api
      .previewDistribution(version, next)
      .then((p) => request === latest.current && setPlan(p))
      .catch(() => request === latest.current && setPlan(null));
  };
  const go = async () => {
    setBusy(true);
    try {
      const done = await api.distribute(version, chosen);
      toast(`Repartidas ${int(done.calls)} llamadas.`);
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("No se pudo repartir. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={640}
      title="Repartir llamadas"
      description={
        <p className="m-0">
          Se reparten solo las llamadas sin asignar y pendientes (
          {int(unassigned)}), parejas por parte del mosaico y por set. Lo ya
          asignado no se mueve.
        </p>
      }
      footer={
        <>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!plan || plan.calls === 0 || busy}
            onClick={() => void go()}
          >
            Repartir {plan ? int(plan.calls) : ""} llamadas
          </Button>
        </>
      }
    >
      <fieldset className="m-0 grid gap-1 border-0 p-0">
        <legend className="mb-1 text-[13px] font-medium">Verificadores</legend>
        {people.length === 0 && (
          <p className="help m-0">No hay cuentas Verificador activas.</p>
        )}
        {people.map((x) => (
          <label key={x.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen.includes(x.id)}
              onChange={() => toggle(x.id)}
            />
            {x.name}
          </label>
        ))}
      </fieldset>
      {plan && plan.calls > 0 && (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Verificador</th>
                <th scope="col" className="num">
                  Llamadas
                </th>
                {SEGMENTS.map((s) => (
                  <th key={s} scope="col" className="num">
                    {PART_NAME[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.people.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className="font-normal">
                    {x.name}
                  </th>
                  <td className="num">{int(x.calls)}</td>
                  {SEGMENTS.map((s) => (
                    <td key={s} className="num">
                      {int(x.bySegment[s] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {plan && plan.calls === 0 && (
        <p className="help m-0">No quedan llamadas sin asignar.</p>
      )}
    </Dialog>
  );
}

function MoveDialog({
  version,
  from,
  people,
  onClose,
  onDone,
}: {
  version: string;
  from: { id: string; name: string; pending: number } | null;
  people: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!from) return null;
  const go = async () => {
    setBusy(true);
    try {
      const { moved } = await api.movePending(version, from.id, chosen);
      toast(`Pasadas ${int(moved)} llamadas pendientes de ${from.name}.`);
      onClose();
      onDone();
    } catch {
      toast.error("No se pudieron pasar las llamadas.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Pasar las ${int(from.pending)} pendientes de ${from.name}`}
      description={
        <p className="m-0">
          Se reparten entre las personas que elijas. Lo que ya revisó se queda
          con su nombre.
        </p>
      }
      footer={
        <>
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={chosen.length === 0 || busy}
            onClick={() => void go()}
          >
            Pasar {int(from.pending)} llamadas
          </Button>
        </>
      }
    >
      <fieldset className="m-0 grid gap-1 border-0 p-0">
        <legend className="mb-1 text-[13px] font-medium">A quién</legend>
        {people.map((x) => (
          <label key={x.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen.includes(x.id)}
              onChange={() =>
                setChosen((c) =>
                  c.includes(x.id) ? c.filter((y) => y !== x.id) : [...c, x.id],
                )
              }
            />
            {x.name}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
