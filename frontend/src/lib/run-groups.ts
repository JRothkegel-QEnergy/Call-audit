import type { PipelineRun } from "@/lib/api/admin-types";

/** Fila de "Últimas pasadas": una pasada suelta o una racha de pasadas iguales y seguidas (Cambio 14 §7, D-60). */
export type RunRow =
  | { kind: "run"; run: PipelineRun }
  | { kind: "group"; key: string; signature: "idle" | "errors" | "quota" | "failed"; runs: PipelineRun[]; truncated: boolean };

/** Terminó sin transcribir, validar ni archivar nada (puede haber audios bloqueados en la raíz). */
export function isIdle(run: PipelineRun): boolean {
  return (
    run.status === "done" &&
    run.transcribed === 0 &&
    run.asrErrors === 0 &&
    run.asrRateLimited === 0 &&
    run.validated === 0 &&
    run.archived === 0
  );
}

/** Firma con la que se agrupa; null = nunca se agrupa (en curso, interrumpida o completa con trabajo). */
function signature(run: PipelineRun): string | null {
  if (isIdle(run)) return "idle";
  if (run.status === "failed") return `failed:${run.error ?? ""}`;
  const counts = [run.transcribed, run.asrErrors, run.asrRateLimited, run.validated, run.archived].join(",");
  if (run.status === "done" && run.asrErrors > 0) return `errors:${counts}`;
  // Desde que un 429/402 no cuenta como intento, una cuenta sin saldo deja pasadas solo "por cuota", todas iguales.
  if (run.status === "done" && run.asrRateLimited > 0) return `quota:${counts}`;
  return null;
}

/** Agrupa pasadas vecinas con la misma firma (mínimo 2) y devuelve las maxRows filas más recientes.
 *  `runs` viene de la más nueva a la más antigua; `complete` = no hay pasadas más antiguas que estas. */
export function groupRuns(runs: PipelineRun[], maxRows = 20, complete = true): RunRow[] {
  const rows: RunRow[] = [];
  let i = 0;
  while (i < runs.length && rows.length < maxRows) {
    const sig = signature(runs[i]);
    let j = i + 1;
    while (sig != null && j < runs.length && signature(runs[j]) === sig) j++;
    if (sig != null && j - i >= 2) {
      const group = runs.slice(i, j);
      rows.push({
        kind: "group",
        key: String(group[group.length - 1].id),
        signature: sig === "idle" ? "idle" : (sig.split(":")[0] as "errors" | "quota" | "failed"),
        runs: group,
        truncated: j === runs.length && !complete,
      });
    } else {
      rows.push({ kind: "run", run: runs[i] });
    }
    i = j;
  }
  return rows;
}
