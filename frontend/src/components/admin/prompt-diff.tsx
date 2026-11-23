import type { PromptSection } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Line = { kind: "same" | "add" | "del"; text: string };

/** Diff de líneas por LCS. Los prompts son cortos: basta con O(n·m). */
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

/** Diferencias unificadas por sección contra otra versión; las secciones sin cambios quedan plegadas. */
export function PromptDiff({ base, next, baseLabel, nextLabel }: { base: PromptSection[]; next: PromptSection[]; baseLabel: string; nextLabel: string }) {
  const titles = [...new Set([...base.map((s) => s.title), ...next.map((s) => s.title)])];
  return (
    <div className="grid gap-2">
      <p className="help m-0">
        <span className="mr-3 rounded-sm bg-[var(--red-100)] px-1.5 text-[var(--red-800)]">− {baseLabel}</span>
        <span className="rounded-sm bg-accent px-1.5 text-accent-foreground">+ {nextLabel}</span>
      </p>
      {titles.map((t) => {
        const a = (base.find((s) => s.title === t)?.text ?? "").split("\n");
        const b = (next.find((s) => s.title === t)?.text ?? "").split("\n");
        const lines = diffLines(a, b);
        const changed = lines.some((l) => l.kind !== "same");
        return (
          <details key={t} open={changed} className="rounded-md border border-border">
            <summary className="cursor-pointer px-3 py-2 font-semibold">
              {t} <span className="help font-normal">{changed ? "· con cambios" : "· sin cambios"}</span>
            </summary>
            <pre className="m-0 overflow-auto border-t border-border font-mono text-[13px] leading-5">
              {lines.map((l, i) => (
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
              ))}
            </pre>
          </details>
        );
      })}
    </div>
  );
}
