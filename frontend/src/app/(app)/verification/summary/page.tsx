"use client";

import { ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import {
  nextSort,
  type SortDir,
  SortableTh,
} from "@/components/ui/sortable-th";
import { AsyncView, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type {
  CriteriaStats,
  CriterionStats,
  VerificationOverview,
} from "@/lib/api/admin-types";
import { int, personName } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { scopeQuery, trayPath } from "@/lib/verification-scope";

const EMPTY =
  "Todavía no hay llamadas para calibrar. Te avisaremos cuando el admin las reparta.";

/** «Resumen» del verificador (19-resumen-avance-y-orden-bandejas, X1-X3 A; 22-resumen-tarjetas-y-metricas-por-criterio):
 * el avance de la corrida completa en tarjetas y una barra contenida, y Cumple / No cumple de Qubyt por criterio. */
export default function VerificationSummaryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SummaryView />
    </Suspense>
  );
}

function SummaryView() {
  const params = useSearchParams();
  // «me», «all» o el id de un compañero con llamadas compartidas (23 §7, AE22 A).
  const assignee = params.get("asignadas") || "me";
  const state = useAsync(async () => {
    const home = await api.getVerificationHome();
    return home.version
      ? await api.getVerificationOverview(home.version, assignee)
      : null;
  }, [assignee]);
  return (
    <>
      <AdminHeader
        title="Resumen"
        description={
          assignee === "all"
            ? "El avance del equipo en la calibración de la corrida completa."
            : assignee === "me"
              ? "Tu avance en la calibración de la corrida completa."
              : "El avance de tu compañero en las llamadas que comparten."
        }
      />
      <AsyncView state={state} what="el resumen">
        {(data) =>
          data == null ? (
            <p className="empty-state">{EMPTY}</p>
          ) : (
            <Summary data={data} assignee={assignee} />
          )
        }
      </AsyncView>
    </>
  );
}

const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);

function Summary({
  data,
  assignee,
}: {
  data: VerificationOverview;
  assignee: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const p = data.progress ?? { total: 0, reviewed: 0, pending: 0 };
  const mine = assignee === "me";
  // El nombre del calibrador en vez de «Mí» (22, AE6).
  const myName = personName(useSession().user?.name) || "Mí";
  const setAssignee = (value: string) =>
    router.replace(value === "me" ? pathname : `${pathname}?asignadas=${encodeURIComponent(value)}`, {
      scroll: false,
    });
  const options: [string, string][] = [
    ["me", myName],
    ...data.verifiers.map((v): [string, string] => [v.id, personName(v.name) || v.name]),
    ["all", "Todas"],
  ];

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Asignadas a:</span>
        <div className="seg" role="group" aria-label="Asignadas a">
          {options.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={assignee === k} onClick={() => setAssignee(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mine && p.total === 0 ? (
        <p className="empty-state">{EMPTY}</p>
      ) : (
        <>
          <Calls data={data} mine={mine} />
          <Criteria stats={data.criteria} />
        </>
      )}
    </div>
  );
}

function Calls({ data, mine }: { data: VerificationOverview; mine: boolean }) {
  const router = useRouter();
  const p = data.progress ?? { total: 0, reviewed: 0, pending: 0 };
  const reviewedPct = pct(p.reviewed, p.total);
  const pendingPct = p.total ? 100 - reviewedPct : 0;
  const next = mine ? data.me?.nextCaseId : null;
  const done = mine && data.me && data.me.assigned > 0 && data.me.pending === 0;
  const nextHref = (caseId: string) =>
    `/admin/prompts/${encodeURIComponent(data.version)}/calls/${encodeURIComponent(caseId)}?segment=all${scopeQuery(
      {
        source: "full",
        assignee: "me",
        tray: "pending",
      },
    )}`;

  return (
    <section className="grid gap-3" aria-labelledby="calls-h">
      <h2 id="calls-h" className="m-0 text-base font-semibold">
        Llamadas
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Total" value={int(p.total)} note="llamadas" />
        <Kpi
          label="Calibradas"
          value={int(p.reviewed)}
          note={`${reviewedPct} % del total`}
        />
        <Kpi
          label="Por calibrar"
          value={int(p.pending)}
          note={`${pendingPct} % del total`}
        />
      </dl>
      {p.total > 0 && (
        <div className="grid gap-2">
          <div
            role="img"
            aria-label={`${int(p.reviewed)} de ${int(p.total)} llamadas calibradas (${reviewedPct} %)`}
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="bg-primary"
              style={{ width: `${(100 * p.reviewed) / p.total}%` }}
            />
          </div>
          <ul
            className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm"
            aria-hidden
          >
            <li className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full bg-primary" />
              Calibradas {int(p.reviewed)} ({reviewedPct} %)
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full border border-[var(--neutral-300)] bg-muted" />
              Por calibrar {int(p.pending)} ({pendingPct} %)
            </li>
          </ul>
        </div>
      )}
      {done ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 font-semibold">
            ¡Listo! Calibraste tus {int(data.me!.assigned)} llamadas.
          </p>
          <Button onClick={() => router.push(trayPath("reviewed"))}>
            Ver calibradas
          </Button>
        </div>
      ) : (
        next && (
          <div>
            <Button
              variant="primary"
              onClick={() => router.push(nextHref(next))}
            >
              Seguir calibrando <ChevronRight size={14} aria-hidden />
            </Button>
          </div>
        )
      )}
    </section>
  );
}

function Criteria({ stats }: { stats?: CriteriaStats }) {
  if (!stats) return null;
  return (
    <>
      <section className="grid gap-3" aria-labelledby="criteria-h">
        <div className="grid gap-0.5">
          <h2 id="criteria-h" className="m-0 text-base font-semibold">
            Criterios evaluados por Qubyt
          </h2>
          {stats.evaluated > 0 && (
            <p className="help m-0">
              En las {int(stats.calls)} llamadas que evaluó Qubyt.
            </p>
          )}
        </div>
        {stats.evaluated === 0 ? (
          <p className="empty-state">
            Qubyt todavía no ha evaluado estas llamadas.
          </p>
        ) : (
          <>
            <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi
                label="Criterios evaluados"
                value={int(stats.evaluated)}
                note="criterios"
              />
              <Kpi
                label="Cumple"
                value={`${pct(stats.pass, stats.evaluated)} %`}
                note={`${int(stats.pass)} criterios`}
              />
              <Kpi
                label="No cumple"
                value={`${pct(stats.fail, stats.evaluated)} %`}
                note={`${int(stats.fail)} criterios`}
              />
            </dl>
            <p className="help m-0">
              Lo que dijo Qubyt en cada criterio. No incluye los criterios en
              que Qubyt quedó en duda.
            </p>
          </>
        )}
      </section>
      {stats.evaluated > 0 && <ByCriterion rows={stats.byCriterion} />}
    </>
  );
}

type Col = "criterion" | "evaluated" | "pass" | "fail";
const COL_LABEL: Record<Col, string> = {
  criterion: "Criterio",
  evaluated: "Total",
  pass: "Cumple",
  fail: "No cumple",
};

function ByCriterion({ rows }: { rows: CriterionStats[] }) {
  const rubric = useRubric();
  const [sort, setSort] = useState<Col | null>(null);
  const [dir, setDir] = useState<SortDir | null>(null);
  const sorted = useMemo(() => {
    const share = (r: CriterionStats, k: "pass" | "fail") =>
      r.evaluated ? r[k] / r.evaluated : -1;
    const value = (r: CriterionStats, col: Col) =>
      col === "criterion"
        ? r.criterionId
        : col === "evaluated"
          ? r.evaluated
          : share(r, col);
    const out = [...rows];
    if (sort && dir) {
      out.sort(
        (a, b) =>
          (value(a, sort) - value(b, sort)) * (dir === "asc" ? 1 : -1) ||
          a.criterionId - b.criterionId,
      );
    } else {
      // Por defecto: % No cumple de mayor a menor; los sin datos al final.
      out.sort(
        (a, b) =>
          share(b, "fail") - share(a, "fail") || a.criterionId - b.criterionId,
      );
    }
    return out;
  }, [rows, sort, dir]);
  const click = (col: Col) => {
    const n = nextSort(sort, dir, col);
    setSort(n.sort);
    setDir(n.dir);
  };
  const th = (col: Col, className?: string) => (
    <SortableTh
      label={COL_LABEL[col]}
      dir={sort === col ? dir : null}
      onClick={() => click(col)}
      className={className}
    />
  );

  return (
    <section className="grid gap-3" aria-labelledby="by-criterion-h">
      {/* 22, AE9: el título ya dice el orden; sin subtítulo (aria-sort queda en la cabecera). */}
      <h2 id="by-criterion-h" className="m-0 text-base font-semibold">
        Ranking de criterios según tasa de no cumplimiento
      </h2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">
            Cumple y No cumple de Qubyt por criterio
          </caption>
          <thead>
            <tr>
              {th("criterion")}
              {th("pass", "text-right")}
              {th("fail", "text-right")}
              <th scope="col" className="hidden w-48 sm:table-cell">
                <span className="sr-only">Proporción</span>
              </th>
              {th("evaluated", "text-right")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const name = rubric?.criteria[r.criterionId]?.name;
              const none = r.evaluated === 0;
              const dash = (
                <span
                  title="Qubyt no evaluó este criterio en estas llamadas."
                  className="text-[var(--muted-foreground)]"
                >
                  —
                </span>
              );
              return (
                <tr key={r.criterionId}>
                  <td className="max-w-[28rem]">
                    <div
                      className="flex items-center gap-2 overflow-hidden"
                      title={name ? `C${r.criterionId} · ${name}` : undefined}
                    >
                      <span className="font-semibold tabular">
                        C{r.criterionId}
                      </span>
                      {name && (
                        <span className="hidden truncate sm:inline">
                          {name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="num text-right">
                    {none ? dash : <PctCell k={r.pass} n={r.evaluated} />}
                  </td>
                  <td className="num text-right">
                    {none ? dash : <PctCell k={r.fail} n={r.evaluated} />}
                  </td>
                  <td className="hidden sm:table-cell" aria-hidden>
                    {!none && (
                      <div className="flex h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-[var(--neutral-300)]"
                          style={{ width: `${(100 * r.pass) / r.evaluated}%` }}
                        />
                        <div
                          className="bg-[var(--red-200)]"
                          style={{ width: `${(100 * r.fail) / r.evaluated}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="num text-right">{int(r.evaluated)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PctCell({ k, n }: { k: number; n: number }) {
  return (
    <span>
      {pct(k, n)} %{" "}
      <span className="text-[var(--muted-foreground)]">({int(k)})</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="card grid content-start gap-0.5">
      <dt className="help m-0">{label}</dt>
      <dd className="m-0 text-3xl font-semibold tabular">{value}</dd>
      {note && <dd className="help m-0">{note}</dd>}
    </div>
  );
}
