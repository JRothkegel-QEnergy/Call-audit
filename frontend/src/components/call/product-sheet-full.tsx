"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ProductSheet as Sheet, ProductSheetSectionKey, SheetDetailSection, SheetDetailTable } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** Secciones de la ficha completa que se resaltan según la sección de la pauta del criterio en foco (11, K4). */
const RELEVANT_DETAIL: Partial<Record<ProductSheetSectionKey, string[]>> = {
  coverages: ["coverages", "assistances", "exclusions"],
  premium: ["premiums"],
  refund: ["summary"],
  withdrawal: ["summary"],
  category: ["summary"],
};

export function relevantDetailKeys(relevant: ProductSheetSectionKey | undefined): string[] {
  return (relevant && RELEVANT_DETAIL[relevant]) || [];
}

export function RelevantBadge({ criterionId }: { criterionId: number | null }) {
  if (criterionId == null) return null;
  return (
    <span className="ml-1.5 inline-flex h-[18px] items-center rounded-full border border-primary bg-card px-2 text-[11px] font-semibold text-accent-foreground">
      Relevante para el criterio {criterionId}
    </span>
  );
}

function DetailTable({ table, sectionTitle }: { table: SheetDetailTable; sectionTitle: string }) {
  const [first, ...rest] = table.columns;
  return (
    <>
      {/* Desde md: tabla con scroll horizontal propio y primera columna fija. */}
      <div
        className="hidden overflow-x-auto rounded-md border border-[var(--neutral-100)] md:block"
        tabIndex={0}
        role="region"
        aria-label={table.title}
      >
        <table className="w-full border-collapse text-[13px]">
          {table.title !== sectionTitle && <caption className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">{table.title}</caption>}
          <thead>
            <tr className="bg-[var(--neutral-50)]">
              {table.columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground", i === 0 && "sticky left-0 bg-[var(--neutral-50)]")}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={ri} className="border-t border-[var(--neutral-100)] align-top">
                {table.columns.map((c, i) =>
                  i === 0 ? (
                    <th key={c.key} scope="row" className="sticky left-0 bg-card px-2 py-1.5 text-left font-medium">
                      {r[c.key]}
                    </th>
                  ) : (
                    <td key={c.key} className={cn("px-2 py-1.5", (r[c.key]?.length ?? 0) <= 12 ? "whitespace-nowrap" : "[overflow-wrap:anywhere]")}>
                      {r[c.key]}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Bajo md: tarjetas apiladas. */}
      <div className="grid gap-2 md:hidden">
        {table.title !== sectionTitle && <p className="m-0 text-xs font-semibold text-muted-foreground">{table.title}</p>}
        {table.rows.map((r, ri) => (
          <dl key={ri} className="m-0 rounded-md border border-[var(--neutral-100)] p-2">
            <dt className="sr-only">{first.label}</dt>
            <dd className="m-0 mb-1 font-semibold">{r[first.key] || "—"}</dd>
            {rest
              .filter((c) => r[c.key])
              .map((c) => (
                <div key={c.key}>
                  <dt className="text-xs text-muted-foreground">{c.label}</dt>
                  <dd className="m-0 mb-1 [overflow-wrap:anywhere]">{r[c.key]}</dd>
                </div>
              ))}
          </dl>
        ))}
      </div>
    </>
  );
}

function DetailSection({ section, relevant, criterionId }: { section: SheetDetailSection; relevant: boolean; criterionId: number | null }) {
  return (
    <section
      id={`full-sheet-${section.key}`}
      aria-labelledby={`full-sheet-${section.key}-title`}
      data-relevant={relevant || undefined}
      className={cn("grid scroll-mt-2 gap-2 rounded-md p-3", relevant ? "border-2 border-primary bg-accent" : "border border-[var(--neutral-100)]")}
    >
      <h3 id={`full-sheet-${section.key}-title`} className="m-0 text-sm font-semibold">
        {section.title}
        {relevant && <RelevantBadge criterionId={criterionId} />}
      </h3>
      {section.rows?.length ? (
        <dl className="m-0 grid gap-x-4 sm:grid-cols-2">
          {section.rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="m-0 mb-1.5 font-medium [overflow-wrap:anywhere]">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {section.tables?.map((t) => <DetailTable key={t.title} table={t} sectionTitle={section.title} />)}
      {section.texts?.map((t, i) => (
        <div key={i}>
          <p className="m-0 text-xs text-muted-foreground">{t.title}</p>
          <p className="m-0 whitespace-pre-line [overflow-wrap:anywhere]">{t.text}</p>
        </div>
      ))}
    </section>
  );
}

/** Modal «Ficha completa» (11-ficha-completa.md): todo el catálogo del seguro, desplegado, con índice. */
export function ProductSheetFullDialog({
  open,
  onOpenChange,
  sheets,
  initialTab,
  relevant,
  criterionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheets: Sheet[];
  initialTab: number;
  relevant: ProductSheetSectionKey | undefined;
  criterionId: number | null;
}) {
  // Se remonta en cada apertura (key en product-sheet.tsx), así parte en la pestaña activa de la columna.
  const [tab, setTab] = useState(initialTab);

  const s = sheets[Math.min(tab, sheets.length - 1)];
  const sections = s?.detail ?? [];
  const relevantKeys = relevantDetailKeys(relevant);
  const firstRelevant = sections.find((x) => relevantKeys.includes(x.key))?.key;

  // Abre desplazado a la primera sección relevante para el criterio en foco (K4).
  useEffect(() => {
    if (!open || !firstRelevant) return;
    const id = window.setTimeout(() => {
      document.getElementById(`full-sheet-${firstRelevant}`)?.scrollIntoView({ block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, tab, firstRelevant]);

  if (!s) return null;
  const description = (
    <p className="help m-0">
      {[s.insurer, s.version ? `Ficha v${s.version}` : null].filter(Boolean).join(" · ")}
      {s.version && s.latestVersion && s.latestVersion > s.version
        ? ` · Hay una versión más nueva de esta ficha (v${s.latestVersion}). Esta llamada se validó con la v${s.version}.`
        : ""}
    </p>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={s.name}
      description={description}
      width={880}
      footer={<Button onClick={() => onOpenChange(false)}>Cerrar</Button>}
    >
      {sheets.length > 1 && (
        <div className="tabs m-0 min-w-0 overflow-x-auto" role="tablist">
          {sheets.map((sh, i) => (
            <button key={sh.productId || i} type="button" role="tab" className="tab" aria-selected={i === tab} onClick={() => setTab(i)}>
              Seguro {i + 1} · {sh.name}
            </button>
          ))}
        </div>
      )}
      {sections.length ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
          <nav aria-label="Secciones de la ficha" className="min-w-0 md:sticky md:top-0 md:self-start">
            <ul className="m-0 flex list-none gap-1.5 overflow-x-auto p-0 pb-1 md:flex-col md:overflow-visible md:pb-0">
              {sections.map((x) => {
                const rel = relevantKeys.includes(x.key);
                return (
                  <li key={x.key} className="flex-none">
                    <a
                      href={`#full-sheet-${x.key}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(`full-sheet-${x.key}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
                      }}
                      className={cn(
                        "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--neutral-100)] px-2.5 py-1 text-[13px] no-underline hover:bg-[var(--neutral-50)] md:rounded-md md:border-0 md:px-2",
                        rel && "font-semibold text-accent-foreground",
                      )}
                    >
                      {x.title}
                      {rel && (
                        <>
                          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                          <span className="sr-only"> (relevante)</span>
                        </>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="grid min-w-0 gap-3">
            {sections.map((x) => (
              <DetailSection key={x.key} section={x} relevant={relevantKeys.includes(x.key)} criterionId={criterionId} />
            ))}
          </div>
        </div>
      ) : (
        <p className="help m-0">Este seguro no tiene una ficha en el catálogo.</p>
      )}
    </Dialog>
  );
}
