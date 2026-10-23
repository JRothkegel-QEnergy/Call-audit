import type { PromptDiff as Diff } from "@/lib/api/admin-types";
import { cn } from "@/lib/cn";

type Line = { kind: "same" | "add" | "del"; text: string };

/** Diff de líneas por LCS. Los prompts caben en memoria: basta con O(n·m). */
function diffLines(a: string[], b: string[]): Line[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "del", text: a[i++] });
    else out.push({ kind: "add", text: b[j++] });
  }
  while (i < n) out.push({ kind: "del", text: a[i++] });
  while (j < m) out.push({ kind: "add", text: b[j++] });
  return out;
}

function Lines({ lines, foldSame }: { lines: Line[]; foldSame?: boolean }) {
  // Con muchas líneas iguales seguidas se muestran solo las 2 alrededor de cada cambio.
  const keep = lines.map((l, i) => !foldSame || l.kind !== "same" || lines.slice(Math.max(0, i - 2), i + 3).some((x) => x.kind !== "same"));
  return (
    <pre className="m-0 overflow-auto font-mono text-[13px] leading-5">
      {lines.map((l, i) =>
        keep[i] ? (
          <div
            key={i}
            className={cn(
              "px-3",
              l.kind === "add" && "bg-accent text-accent-foreground",
              l.kind === "del" && "bg-[var(--red-100)] text-[var(--red-800)] line-through decoration-1",
            )}
          >
            <span aria-hidden className="mr-2 inline-block w-3 select-none">
              {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
            </span>
            <span className="sr-only">{l.kind === "add" ? "Agregado: " : l.kind === "del" ? "Quitado: " : ""}</span>
            {l.text || " "}
          </div>
        ) : keep[i - 1] ? (
          <div key={i} className="px-3 text-muted-foreground">
            ⋯
          </div>
        ) : null,
      )}
    </pre>
  );
}

/** Diferencias contra la vigente: por regla si las dos tienen prompt.yaml; si no, el texto del system prompt. */
export function PromptDiff({ diff, baseLabel, nextLabel }: { diff: Diff; baseLabel: string; nextLabel: string }) {
  const legend = (
    <p className="help m-0">
      <span className="mr-3 rounded-sm bg-[var(--red-100)] px-1.5 text-[var(--red-800)]">− {baseLabel}</span>
      <span className="rounded-sm bg-accent px-1.5 text-accent-foreground">+ {nextLabel}</span>
    </p>
  );
  if (diff.kind === "text") {
    const lines = diffLines(diff.base.split("\n"), diff.next.split("\n"));
    return (
      <div className="grid gap-2">
        {legend}
        <div className="rounded-md border border-border">
          {lines.some((l) => l.kind !== "same") ? <Lines lines={lines} foldSame /> : <p className="help m-0 p-3">Sin cambios en el texto.</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {legend}
      {diff.rules.length === 0 && <p className="help">Sin cambios en las reglas.</p>}
      {diff.rules.map((r) => (
        <div key={r.id} className="rounded-md border border-border">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <b className="text-[13px]">{r.title}</b>
            <span className="help">
              {r.id}
              {r.origin ? ` · Origen: ${r.origin}` : ""}
              {!r.before ? " · regla nueva" : !r.after ? " · regla quitada" : ""}
            </span>
          </div>
          {r.note && <p className="help m-0 border-b border-border px-3 py-1.5">{r.note}</p>}
          <Lines lines={diffLines(r.before ? r.before.split("\n") : [], r.after ? r.after.split("\n") : [])} />
        </div>
      ))}
    </div>
  );
}
