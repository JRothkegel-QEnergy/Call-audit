"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { clampPage, Pager } from "@/components/ui/pager";
import type { DiscrepancyEvaluatorRow, DiscrepancyOverview } from "@/lib/api/admin-types";
import type { SetParams } from "@/lib/discrepancy-url";
import { int } from "@/lib/format";

/** La clave que manda el backend para las llamadas sin evaluador (D-97). */
const NO_EVALUATOR = "sin dato";
const PAGE_SIZE = 15;
const FEW_CALLS = 10;
/** El nombre es encabezado de fila, pero se ve como una celda más (`.tbl th` es el estilo de la cabecera). */
const ROW_HEADER = "bg-transparent font-[inherit] normal-case tracking-normal text-[length:inherit]";

const ratio = (n: number, calls: number) => (calls ? n / calls : 0);
const percent = (n: number, calls: number) => `${Math.round(100 * ratio(n, calls))} %`;
const decimal = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");

type SortKey = "name" | "calls" | "verdict" | "match" | "motives" | "fp" | "fn";

const SORT_VALUE: Record<Exclude<SortKey, "name">, (r: DiscrepancyEvaluatorRow) => number> = {
  calls: (r) => r.calls,
  verdict: (r) => ratio(r.clientCallFails, r.calls),
  match: (r) => ratio(r.callMatch, r.calls),
  motives: (r) => ratio(r.clientFails, r.calls),
  fp: (r) => r.fp,
  fn: (r) => r.fn,
};

const COLUMNS: { key: Exclude<SortKey, "name">; label: string; full: string; unit: string }[] = [
  { key: "calls", label: "Evaluadas", full: "Llamadas evaluadas", unit: "llamadas" },
  { key: "verdict", label: "Veredicto No cumple", full: "Veredicto No cumple", unit: "% de llamadas" },
  { key: "match", label: "Calce de llamada", full: "Calce de llamada", unit: "% de llamadas" },
  { key: "motives", label: "No cumple marcados", full: "Motivos No cumple marcados", unit: "prom. por llamada" },
  { key: "fp", label: "Solo la IA detectó", full: "Solo la IA detectó", unit: "casos" },
  { key: "fn", label: "Omitidos por la IA", full: "Omitidos por la IA", unit: "casos" },
];

const HELP: [string, string][] = [
  ["Llamadas evaluadas", "Sus llamadas con corrida vigente y marca por motivo en la planilla."],
  ["Veredicto No cumple", "De sus llamadas, en qué porcentaje dejó el veredicto de llamada No cumple (en la planilla figura como RECHAZADA)."],
  ["Calce de llamada", "De sus llamadas, en qué porcentaje la IA dio el mismo veredicto de llamada que la planilla."],
  ["Motivos No cumple marcados", "Cuántos motivos marca No cumple, en promedio, en cada llamada que evalúa."],
  ["Solo la IA detectó", "La IA marcó No cumple en ese motivo y el evaluador no."],
  ["Omitidos por la IA", "El evaluador marcó No cumple en ese motivo y la IA no."],
];

function CaseCell({ total, calls }: { total: number; calls: number }) {
  return (
    <td className="num">
      {int(total)} <span className="help">· {decimal(ratio(total, calls), 1)} por llamada</span>
    </td>
  );
}

function Row({ row, name, note, strong }: { row: DiscrepancyEvaluatorRow; name: string; note?: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : undefined}>
      <th scope="row" className={ROW_HEADER}>
        {name}
        {note && <span className="help font-normal"> · {note}</span>}
      </th>
      <td className="num">{int(row.calls)}</td>
      <td className="num">{percent(row.clientCallFails, row.calls)}</td>
      <td className="num">{percent(row.callMatch, row.calls)}</td>
      <td className="num">{decimal(ratio(row.clientFails, row.calls), 2)}</td>
      <CaseCell total={row.fp} calls={row.calls} />
      <CaseCell total={row.fn} calls={row.calls} />
    </tr>
  );
}

/** Pestaña Evaluadores (Cambio 20 §7, D-96 y D-97). */
export function EvaluatorsTab({ data, params, setParams }: { data: DiscrepancyOverview; params: URLSearchParams; setParams: SetParams }) {
  if (!data.evaluators) {
    return <p className="help m-0">La planilla de estas llamadas no trae el evaluador. Reimporta la metadata con la planilla nueva para verlo.</p>;
  }
  const named = data.evaluators.filter((r) => r.evaluator !== NO_EVALUATOR);
  const missing = data.evaluators.find((r) => r.evaluator === NO_EVALUATOR) ?? null;
  const total = named.reduce<DiscrepancyEvaluatorRow>(
    (sum, r) => ({
      evaluator: sum.evaluator,
      calls: sum.calls + r.calls,
      clientCallFails: sum.clientCallFails + r.clientCallFails,
      callMatch: sum.callMatch + r.callMatch,
      clientFails: sum.clientFails + r.clientFails,
      fp: sum.fp + r.fp,
      fn: sum.fn + r.fn,
    }),
    { evaluator: "all", calls: 0, clientCallFails: 0, callMatch: 0, clientFails: 0, fp: 0, fn: 0 },
  );

  const sort = (["name", ...COLUMNS.map((c) => c.key)] as SortKey[]).find((k) => k === params.get("evalSort")) ?? "calls";
  const dir = params.get("evalDir") === "asc" || (sort === "name" && params.get("evalDir") !== "desc") ? 1 : -1;
  const sorted = [...named].sort((a, b) => {
    const delta = sort === "name" ? a.evaluator.localeCompare(b.evaluator, "es") : SORT_VALUE[sort](a) - SORT_VALUE[sort](b);
    return dir * delta || a.evaluator.localeCompare(b.evaluator, "es");
  });
  const page = clampPage(params.get("evalPage"), sorted.length, PAGE_SIZE);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const lastPage = page * PAGE_SIZE >= sorted.length;

  const onSort = (key: SortKey) => {
    // Primer clic: nombres de la A a la Z, números de mayor a menor. Segundo: al revés.
    const first = key === "name" ? "asc" : "desc";
    const next = sort === key ? (dir === 1 ? "desc" : "asc") : first;
    setParams({ evalSort: key === "calls" && next === "desc" ? null : key, evalDir: next === first ? null : next, evalPage: null });
  };
  const sortHeader = (key: SortKey, label: string, unit?: string, full?: string) => {
    const active = sort === key;
    const Icon = dir === 1 ? ArrowUp : ArrowDown;
    return (
      <button type="button" className="inline-flex cursor-pointer items-start gap-1 border-0 bg-transparent p-0 text-left font-[inherit]" aria-label={full} onClick={() => onSort(key)}>
        <span className="grid">
          <span className="whitespace-normal">{label}</span>
          {unit && <span className="help font-normal">{unit}</span>}
        </span>
        {active && <Icon size={14} aria-hidden className="mt-0.5 shrink-0" />}
      </button>
    );
  };
  const ariaSort = (key: SortKey) => (sort === key ? (dir === 1 ? "ascending" : "descending") : undefined);

  return (
    <section className="card grid gap-3" aria-labelledby="evaluators-title">
      <div className="grid gap-1">
        <h2 id="evaluators-title" className="m-0 text-lg font-semibold">
          Por evaluador de la planilla
        </h2>
        <p className="help m-0">Un evaluador que marca mucho más o menos que el resto, con la IA pareja, apunta a una diferencia del evaluador, no del prompt.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl flat">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} aria-sort={ariaSort("name")} className="align-bottom">
                {sortHeader("name", "Evaluador")}
              </th>
              <th scope="colgroup" colSpan={3} className="text-center">
                Llamadas
              </th>
              <th scope="colgroup" className="text-center">
                Motivos
              </th>
              <th scope="colgroup" colSpan={2} className="text-center">
                Casos
              </th>
            </tr>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} className="align-bottom">
                  {sortHeader(c.key, c.label, c.unit, c.full)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row row={total} name="Todos los evaluadores" strong />
            {rows.map((r) => (
              <Row key={r.evaluator} row={r} name={r.evaluator} note={r.calls < FEW_CALLS ? "pocas llamadas" : undefined} />
            ))}
            {missing && lastPage && (
              <tr className="text-muted-foreground">
                <th scope="row" className={`${ROW_HEADER} text-muted-foreground`}>
                  Sin evaluador en la planilla
                </th>
                <td className="num">{int(missing.calls)}</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <CaseCell total={missing.fp} calls={missing.calls} />
                <CaseCell total={missing.fn} calls={missing.calls} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager label="Evaluadores" page={page} size={PAGE_SIZE} total={sorted.length} onChange={(p) => setParams({ evalPage: p === 1 ? null : String(p) })} />
      {missing && <p className="m-0 text-sm">{int(missing.calls)} llamadas no traen evaluador en la planilla y no entran en Todos los evaluadores.</p>}
      <p className="m-0 text-sm">Un caso es un motivo de una llamada. Una llamada puede aportar varios casos, por eso estas columnas pueden superar a Llamadas evaluadas.</p>
      <dl className="m-0 grid gap-x-4 gap-y-1 text-sm md:grid-cols-[minmax(12rem,auto)_1fr]">
        {HELP.map(([term, text]) => (
          <div key={term} className="contents">
            <dt className="font-medium">{term}</dt>
            <dd className="help m-0">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
