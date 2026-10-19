"use client";

import { PanelRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProductSheet as Sheet, ProductSheetSectionKey } from "@/lib/api/types";
import { cn } from "@/lib/cn";

function Section({
  title,
  rows,
  highlighted,
  criterionId,
}: {
  title: string;
  rows: { label: string; value: string }[];
  highlighted: boolean;
  criterionId: number | null;
}) {
  return (
    <div
      data-relevant={highlighted || undefined}
      className={cn(
        "border-t border-[var(--neutral-100)] px-3 py-2.5",
        highlighted && "m-1.5 rounded-md border-2 border-primary bg-accent",
      )}
    >
      <b className="text-[13px]">{title}</b>
      {highlighted && criterionId != null && (
        <span className="ml-1.5 inline-flex h-[18px] items-center rounded-full border border-primary bg-card px-2 text-[11px] font-semibold text-accent-foreground">
          Relevante para el motivo {criterionId}
        </span>
      )}
      <dl className="m-0 mt-1.5">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="m-0 mb-1.5 font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Contenido de la ficha: secciones clave a la vista; coberturas y el resto, plegables (O-03, H-15). */
export function ProductSheetContent({
  sheets,
  relevant,
  criterionId,
}: {
  sheets: Sheet[];
  relevant: ProductSheetSectionKey | undefined;
  criterionId: number | null;
}) {
  const [tab, setTab] = useState(0);
  if (!sheets.length) return <p className="help p-3">Esta llamada no tiene un seguro identificado en el catálogo.</p>;
  const s = sheets[Math.min(tab, sheets.length - 1)];
  const hl = (k: ProductSheetSectionKey) => relevant === k;
  return (
    <>
      <div className="tabs m-0 px-2" role="tablist">
        {sheets.map((sh, i) => (
          <button key={sh.productId} type="button" role="tab" className="tab" aria-selected={i === tab} onClick={() => setTab(i)}>
            Seguro {i + 1} · {sh.name}
          </button>
        ))}
      </div>
      <Section title="Datos de la llamada" rows={s.callData} highlighted={hl("call")} criterionId={criterionId} />
      <Section
        title="Categoría"
        rows={[
          { label: "Compañía", value: s.insurer },
          { label: "Categoría", value: s.category === "RETENIBLE" ? "Retenible" : s.category === "NO RETENIBLE" ? "No retenible" : "Irrenunciable" },
          { label: "Regla", value: s.categoryRule },
        ]}
        highlighted={hl("category")}
        criterionId={criterionId}
      />
      <Section title="Prima" rows={[{ label: "Tipo de prima", value: s.premiumType }]} highlighted={hl("premium")} criterionId={criterionId} />
      <Section title="Devolución" rows={[{ label: "Devolución de prima al renunciar", value: s.premiumRefund }]} highlighted={hl("refund")} criterionId={criterionId} />
      <Section title="Retracto" rows={[{ label: "Retracto", value: s.withdrawal }]} highlighted={hl("withdrawal")} criterionId={criterionId} />
      <div className={cn("border-t border-[var(--neutral-100)] px-3 py-2.5", hl("coverages") && "m-1.5 rounded-md border-2 border-primary bg-accent")}>
        <details open={hl("coverages")} key={String(hl("coverages"))}>
          <summary className="cursor-pointer">
            <b className="text-[13px]">Coberturas</b>
          </summary>
          <dl className="m-0 mt-1.5">
            {s.coverages.map((c) => (
              <div key={c.name}>
                <dt className="text-xs text-muted-foreground">{c.name}</dt>
                <dd className="m-0 mb-1.5 font-medium">{c.detail}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
      <div className="border-t border-[var(--neutral-100)] px-3 py-2.5">
        <details>
          <summary className="cursor-pointer">
            <b className="text-[13px]">Asistencias · Primas · Siniestros · Observaciones</b>
          </summary>
          <p className="help">Detalle del catálogo.</p>
        </details>
      </div>
    </>
  );
}

export function ProductSheetColumn(props: {
  sheets: Sheet[];
  relevant: ProductSheetSectionKey | undefined;
  criterionId: number | null;
  onCollapse: () => void;
}) {
  return (
    <section className="col" aria-label="Ficha del seguro">
      <div className="col-h">
        <b className="text-sm font-semibold">Ficha del seguro</b>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={props.onCollapse} aria-label="Plegar ficha">
          <PanelRight size={14} aria-hidden />
        </Button>
      </div>
      <ProductSheetContent sheets={props.sheets} relevant={props.relevant} criterionId={props.criterionId} />
    </section>
  );
}
