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
  AssignPlan,
  FullRunStatus,
  ProgressBlock,
  VerificationOverview,
  VerificationProgress,
  VerificationScope,
} from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { personName, shortDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { scopeQuery, trayPath } from "@/lib/verification-scope";

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
        title={`Calibración · v${version}`}
        description="Cada llamada de la corrida completa, calibrada por una persona: el veredicto correcto de cada criterio en que Qubyt y el revisor no coinciden."
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
  // El nombre del calibrador en vez de «Mí» (22, AE6).
  const myName = personName(useSession().user?.name) || "Mí";
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
              ["me", myName],
              // Compañeros con llamadas compartidas (23 §7, AE22 A).
              ...data.verifiers.map((v): [string, string] => [v.id, personName(v.name) || v.name]),
              ["all", "Todas"],
            ] as [string, string][]
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
  // La tarjeta lleva a las bandejas del verificador (18-verificador-bandeja-y-revisadas, W1 A).
  const nextHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(version)}/calls/${encodeURIComponent(caseId)}?segment=all${scopeQuery({
      source: "full",
      assignee: "me",
      tray: "pending",
    })}`;
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
              <Button className="ml-auto" onClick={() => router.push(trayPath("reviewed"))}>
                Ver calibradas
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
                aria-label="Llamadas calibradas"
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
                <Button onClick={() => router.push(trayPath("pending"))}>
                  Ir a Por calibrar
                </Button>
                {data.me.nextCaseId && (
                  <Button
                    variant="primary"
                    onClick={() => router.push(nextHref(data.me!.nextCaseId!))}
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
  // Diálogo «Asignar llamadas» (24): null = cerrado; «unassigned» o el id del calibrador de origen.
  const [assignFrom, setAssignFrom] = useState<string | null>(null);
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
          Supervisores 2
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
            onClick={() => setAssignFrom("unassigned")}
          >
            Asignar llamadas
          </Button>
        )}
      </div>
      <AsyncView state={state} what="el avance">
        {(p) => (
          <>
            {p.people.length === 0 && (
              <p className="help m-0">
                Aún no hay cuentas con rol Supervisor 2. Créalas en Cuentas con
                el rol «Supervisor 2».
              </p>
            )}
            <ProgressTable
              version={version}
              p={p}
              split={split}
              expanded={expanded}
              onToggle={toggle}
              onMove={canWrite ? setAssignFrom : null}
            />
            {canWrite && assignFrom && (
              <AssignDialog
                version={version}
                initialSource={assignFrom}
                p={p}
                onClose={() => setAssignFrom(null)}
                onDone={refresh}
              />
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
        aria-label="Calibradas"
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
                Reasignar…
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
            <th scope="col">Supervisor 2</th>
            <th scope="col" className="num">
              Asignadas
            </th>
            <th scope="col" className="num">
              Calibradas
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

/** «Asignar llamadas» (24-asignar-cantidad-a-calibrador, AD1-AD4 A): desde lo sin asignar o las pendientes de un
 * calibrador, a uno o varios calibradores (o de vuelta a «Sin asignar»), con cantidad por persona. Reemplaza «Repartir
 * llamadas» y «Pasar pendientes a…». */
function AssignDialog({
  version,
  initialSource,
  p,
  onClose,
  onDone,
}: {
  version: string;
  initialSource: string;
  p: VerificationProgress;
  onClose: () => void;
  onDone: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  // Destinos marcados y su cantidad (texto del campo; vacío = parejo). La clave "" es «Sin asignar».
  const [chosen, setChosen] = useState<Record<string, string>>({});
  // AE22 A: las mismas llamadas para todos los marcados, que las calibran juntos.
  const [share, setShare] = useState(false);
  // Vista previa y error de servidor, cada uno con la combinación (origen + destinos) a la que corresponde: si cambió,
  // no valen.
  const [preview, setPreview] = useState<{ key: string; plan: AssignPlan | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const sourceRef = useRef<HTMLSelectElement>(null);
  useEffect(() => sourceRef.current?.focus(), []);

  const giver = p.people.find((x) => x.id === source) ?? null;
  // Al compartir desde una persona, van todas sus llamadas (también las calibradas) y ella las conserva.
  const available =
    source === "all"
      ? p.total.assigned
      : source === "unassigned"
        ? p.unassigned.pending
        : share
          ? (giver?.assigned ?? 0)
          : (giver?.pending ?? 0);
  const people = p.people.filter((x) => x.active && x.id !== source);
  const ids = Object.keys(chosen);
  const bad = ids.some((k) => chosen[k].trim() !== "" && !(Number.isInteger(Number(chosen[k])) && Number(chosen[k]) >= 1));
  const input = {
    source,
    to: ids.map((k) => ({ userId: k === "" ? null : k, count: chosen[k].trim() === "" ? null : Number(chosen[k]) })),
    share,
  };
  const key = JSON.stringify(input);
  const current = preview?.key === key ? preview : null;
  const plan = current?.plan ?? null;
  const tooMany = (e: unknown) =>
    e instanceof ApiError && e.message === "too_many" ? `Quedan ${int(Number(e.errors[0] ?? available))} llamadas disponibles.` : null;
  const error = bad ? "Ingresa un número mayor que 0." : (current?.error ?? null);

  // Vista previa al cambiar algo, con un respiro para no pedirla en cada tecla.
  useEffect(() => {
    if (ids.length === 0 || bad) return;
    const request = ++latest.current;
    const t = setTimeout(() => {
      api
        .previewAssign(version, input)
        .then((r) => request === latest.current && setPreview({ key, plan: r, error: null }))
        .catch((e: unknown) => {
          if (request !== latest.current) return;
          setPreview({ key, plan: null, error: tooMany(e) ?? "No pudimos calcular la vista previa. Reintenta." });
        });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, key]);

  const toggle = (id: string) =>
    setChosen((c) => {
      const n = { ...c };
      if (id in n) delete n[id];
      else n[id] = "";
      return n;
    });
  const changeSource = (value: string) => {
    setSource(value);
    setChosen({});
  };
  const go = async () => {
    if (!plan || plan.calls === 0 || error) return;
    setBusy(true);
    try {
      const done = await api.assign(version, input);
      toast(
        share
          ? `Compartidas ${int(done.calls)} llamadas.`
          : giver
            ? `Reasignadas ${int(done.calls)} llamadas de ${giver.name}.`
            : `Asignadas ${int(done.calls)} llamadas.`,
      );
      onClose();
      onDone();
    } catch (e) {
      setPreview({ key, plan: null, error: tooMany(e) ?? "No se pudo asignar. Reintenta." });
    } finally {
      setBusy(false);
    }
  };
  const target = (id: string, name: string, help: string | null) => (
    <div key={id || "unassigned"} className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-[220px] items-center gap-2">
        <input type="checkbox" checked={id in chosen} onChange={() => toggle(id)} />
        {name}
        {help && <span className="help">{help}</span>}
      </label>
      {id in chosen && (!share || id === ids[0]) && (
        <>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="control w-24"
            placeholder="Parejo"
            aria-label={`Llamadas para ${name}`}
            aria-invalid={!!error || undefined}
            value={chosen[id]}
            onChange={(e) => setChosen((c) => ({ ...c, [id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void go();
              }
            }}
          />
          {ids.length === 1 && available > 0 && (
            <button type="button" className="underline" onClick={() => setChosen({ [id]: String(available) })}>
              Todas ({int(available)})
            </button>
          )}
        </>
      )}
    </div>
  );
  const sources = [
    ...(share ? [{ value: "all", label: `Todas las llamadas (${int(p.total.assigned)})` }] : []),
    { value: "unassigned", label: `Sin asignar (${int(p.unassigned.pending)})` },
    ...(share
      ? p.people.filter((x) => x.assigned > 0).map((x) => ({ value: x.id, label: `Llamadas de ${x.name} (${int(x.assigned)})` }))
      : p.people.filter((x) => x.pending > 0).map((x) => ({ value: x.id, label: `Pendientes de ${x.name} (${int(x.pending)})` }))),
  ];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={640}
      title="Asignar llamadas"
      description={
        <p className="m-0">
          {share
            ? "Las mismas llamadas quedan para todos los marcados, que las calibran juntos y ven el avance del otro."
            : "Se mueven solo llamadas pendientes. Lo ya calibrado no cambia de dueño."}
        </p>
      }
      footer={
        <>
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!plan || plan.calls === 0 || !!error || busy} onClick={() => void go()}>
            {share ? "Compartir" : "Asignar"} {plan ? int(plan.calls) : ""} llamadas
          </Button>
        </>
      }
    >
      <label className="grid gap-1 text-[13px] font-medium">
        Desde
        <select ref={sourceRef} className="control" value={source} onChange={(e) => changeSource(e.target.value)}>
          {sources.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => {
            setShare(e.target.checked);
            setChosen({});
            // AE22b: al compartir parte en «Todas las llamadas»; «Todas» no existe fuera de este modo.
            setSource(e.target.checked ? "all" : "unassigned");
          }}
        />
        Las mismas llamadas para todos (calibran juntos)
      </label>
      {available === 0 ? (
        <p className="help m-0">{giver ? `${giver.name} no tiene pendientes.` : "No quedan llamadas sin asignar."}</p>
      ) : (
        <fieldset className="m-0 grid gap-1.5 border-0 p-0">
          <legend className="mb-1 text-[13px] font-medium">A quién</legend>
          {giver && !share && target("", "Sin asignar (devolver)", null)}
          {people.length === 0 && (
            <p className="help m-0">{giver ? "No hay otros Supervisores 2 activos." : "No hay cuentas Supervisor 2 activas."}</p>
          )}
          {people.map((x) => target(x.id, x.name, `Tiene ${int(x.pending)} pendientes`))}
          <p className="help m-0">
            {share ? "Cantidad en el primero marcado; vacío = todas." : "Vacío = se reparte parejo lo que quede."}
          </p>
          {error && (
            <p className="m-0 text-[var(--red-800)]" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      )}
      {share && plan && plan.calls > 0 && !error && (
        <p className="help m-0">
          {int(plan.calls - (plan.reviewed ?? 0))} por calibrar · {int(plan.reviewed ?? 0)} ya calibradas
        </p>
      )}
      {plan && plan.calls > 0 && !error && (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Supervisor 2</th>
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
                <tr key={x.id ?? "unassigned"}>
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
    </Dialog>
  );
}
