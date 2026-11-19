"use client";

import { AlertTriangle, Maximize2, PanelRight } from "lucide-react";
import { useState } from "react";
import { ProductSheetFullDialog } from "@/components/call/product-sheet-full";
import { Button } from "@/components/ui/button";
import type { Customer, ProductSheet as Sheet, ProductSheetSectionKey } from "@/lib/api/types";
import type { ProductCategory } from "@/lib/api/catalog-types";
import { CATEGORY_LABEL } from "@/lib/api/catalog-types";
import { cn } from "@/lib/cn";

/** Criterios que se revisan contra la Ficha del cliente (31 y 33, acreditación). Mapeo de presentación (H-32, H-78):
 * la rúbrica v1.0.1 es inmutable y no trae la sección "customer". */
export const CUSTOMER_CRITERIA = new Set([31, 33]);

const MISSING = "No viene en la metadata";
const FROM_METADATA = "Vienen de la metadata de la llamada.";

function Badge({ criterionId }: { criterionId: number | null }) {
  if (criterionId == null) return null;
  return (
    <span className="ml-1.5 inline-flex h-[18px] items-center rounded-full border border-primary bg-card px-2 text-[11px] font-semibold text-accent-foreground">
      Relevante para el criterio {criterionId}
    </span>
  );
}

function Rows({ rows }: { rows: { label: string; value: string | null }[] }) {
  return (
    <dl className="m-0 mt-1.5">
      {rows.map((r) => (
        <div key={r.label}>
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className={cn("m-0 mb-1.5 [overflow-wrap:anywhere]", r.value ? "font-medium" : "text-muted-foreground")}>{r.value || MISSING}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  rows,
  highlighted,
  criterionId,
  help,
  children,
}: {
  title: string;
  rows: { label: string; value: string | null }[];
  highlighted: boolean;
  criterionId: number | null;
  help?: string;
  children?: React.ReactNode;
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
      {highlighted && <Badge criterionId={criterionId} />}
      {help && <p className="help m-0 mt-0.5">{help}</p>}
      <Rows rows={rows} />
      {children}
    </div>
  );
}

/** Ficha del cliente (Cambio 13): una por llamada, arriba de las pestañas de seguros. Se resalta con los criterios 31 y 33. */
function CustomerBlock({
  customer,
  highlighted,
  criterionId,
}: {
  customer: Customer | null | undefined;
  highlighted: boolean;
  criterionId: number | null;
}) {
  return (
    <section
      aria-labelledby="customer-sheet-title"
      data-relevant={highlighted || undefined}
      className={cn("px-3 py-2.5", highlighted && "m-1.5 rounded-md border-2 border-primary bg-accent")}
    >
      <details open key={String(highlighted)}>
        <summary className="cursor-pointer">
          <b id="customer-sheet-title" className="text-[13px]">
            Ficha del cliente
          </b>
          {highlighted && <Badge criterionId={criterionId} />}
        </summary>
        {customer ? (
          <>
            <p className="help m-0 mt-0.5">{FROM_METADATA}</p>
            <Rows
              rows={[
                { label: "Nombre", value: customer.fullName },
                { label: "RUT", value: customer.rut },
                { label: "Fecha de nacimiento", value: customer.birthDate },
                { label: "Email", value: customer.email },
                { label: "Teléfono", value: customer.phone },
                { label: "Flujo", value: customer.flow },
              ]}
            />
          </>
        ) : (
          <p className="help m-0 mt-1.5">Esta llamada no trae datos del cliente en la metadata.</p>
        )}
      </details>
    </section>
  );
}

const FIELD_LABEL = { renounceable: "Renunciable", retainable: "Retenible" } as const;

function MismatchNotice({ sheet, category }: { sheet: Sheet; category: string }) {
  const mismatch = sheet.categoryMismatch ?? [];
  if (!mismatch.length) return null;
  const said = mismatch.map((m) => `${FIELD_LABEL[m.field]}: ${m.metadata}`).join(" · ");
  return (
    <p className="m-0 flex items-start gap-1.5 rounded-sm border border-[var(--amber-600)] bg-[var(--amber-100)] px-2 py-1.5 text-[13px] text-amber-800">
      <AlertTriangle size={14} aria-hidden className="mt-0.5 flex-none" />
      <span>
        La metadata y la ficha no coinciden: la metadata dice «{said}» y la ficha dice «{category}». Revisa cuál corresponde antes de
        decidir el criterio.
      </span>
    </p>
  );
}

/** Contenido de la ficha: secciones clave a la vista; coberturas y el resto, plegables (O-03, H-15). */
export function ProductSheetContent({
  sheets,
  customer,
  relevant,
  criterionId,
  header,
}: {
  sheets: Sheet[];
  customer?: Customer | null;
  relevant: ProductSheetSectionKey | undefined;
  criterionId: number | null;
  /** Encabezado de la columna; recibe cómo abrir la ficha completa (null si el seguro no tiene ficha). */
  header?: (openFull: (() => void) | null) => React.ReactNode;
}) {
  const [tab, setTab] = useState(0);
  const [fullOpen, setFullOpen] = useState(false);
  const [opens, setOpens] = useState(0);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const hl = (k: ProductSheetSectionKey) => relevant === k;
  const customerBlock = <CustomerBlock customer={customer} highlighted={hl("customer")} criterionId={criterionId} />;
  if (!sheets.length)
    return (
      <>
        {header?.(null)}
        {customerBlock}
        <p className="help border-t border-[var(--neutral-100)] p-3">Esta llamada no tiene un seguro identificado en el catálogo.</p>
      </>
    );
  const s = sheets[Math.min(tab, sheets.length - 1)];
  const categoryLabel = CATEGORY_LABEL[s.category as ProductCategory] ?? s.category;
  const hasDetail = sheets.some((sh) => sh.detail?.length);
  const openFull = () => {
    setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOpens((n) => n + 1);
    setFullOpen(true);
  };
  // Al cerrar, el foco vuelve al botón que abrió la ficha completa (Esc o «Cerrar»).
  const onFullOpenChange = (open: boolean) => {
    setFullOpen(open);
    if (!open) window.setTimeout(() => opener?.focus(), 0);
  };
  const assistances = s.detail?.find((x) => x.key === "assistances")?.tables?.[0];
  return (
    <>
      {header?.(hasDetail ? openFull : null)}
      {customerBlock}
      <div className="tabs m-0 px-2" role="tablist">
        {sheets.map((sh, i) => (
          <button key={sh.productId} type="button" role="tab" className="tab" aria-selected={i === tab} onClick={() => setTab(i)}>
            Seguro {i + 1} · {sh.name}
          </button>
        ))}
      </div>
      {s.version ? (
        <p className="help m-0 px-3 pt-2">
          Ficha v{s.version}
          {s.latestVersion && s.latestVersion > s.version
            ? ` · Hay una versión más nueva de esta ficha (v${s.latestVersion}). Esta llamada se validó con la v${s.version}.`
            : ""}
        </p>
      ) : null}
      <Section title="Datos de la llamada" rows={s.callData} highlighted={hl("call")} criterionId={criterionId} help={FROM_METADATA} />
      <Section
        title="Categoría"
        rows={[
          { label: "Compañía", value: s.insurer },
          { label: "Categoría", value: categoryLabel },
          { label: "Regla", value: s.categoryRule },
          ...(s.customerCategory
            ? [
                { label: "Renunciable según la metadata", value: s.customerCategory.renounceable },
                { label: "Retenible según la metadata", value: s.customerCategory.retainable },
              ]
            : []),
        ]}
        highlighted={hl("category")}
        criterionId={criterionId}
      >
        <MismatchNotice sheet={s} category={categoryLabel} />
      </Section>
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
      {assistances && (
        <div className={cn("border-t border-[var(--neutral-100)] px-3 py-2.5", hl("coverages") && "m-1.5 rounded-md border-2 border-primary bg-accent")}>
          <details open={hl("coverages")} key={String(hl("coverages"))}>
            <summary className="cursor-pointer">
              <b className="text-[13px]">Asistencias</b>
              {hl("coverages") && <Badge criterionId={criterionId} />}
            </summary>
            <dl className="m-0 mt-1.5">
              {assistances.rows.map((a, i) => (
                <div key={`${a.name}-${i}`}>
                  <dt className="text-xs text-muted-foreground">{a.name}</dt>
                  <dd className="m-0 font-medium">{a.detail || "—"}</dd>
                  {(a.events || a.cap) && (
                    <dd className="m-0 mb-1.5 text-xs text-muted-foreground">{[a.events, a.cap && `Tope ${a.cap}`].filter(Boolean).join(" · ")}</dd>
                  )}
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
      {hasDetail && (
        <div className="border-t border-[var(--neutral-100)] px-3 py-2.5">
          <Button className="w-full justify-center" onClick={openFull}>
            <Maximize2 size={14} aria-hidden />
            Ver ficha completa
          </Button>
        </div>
      )}
      {/* La key cambia en cada apertura: parte en la pestaña activa. Queda montado al cerrar para devolver el foco. */}
      <ProductSheetFullDialog
        key={opens}
        open={fullOpen}
        onOpenChange={onFullOpenChange}
        sheets={sheets}
        initialTab={Math.min(tab, sheets.length - 1)}
        relevant={relevant}
        criterionId={criterionId}
      />
    </>
  );
}

export function ProductSheetColumn(props: {
  sheets: Sheet[];
  customer?: Customer | null;
  relevant: ProductSheetSectionKey | undefined;
  criterionId: number | null;
  onCollapse: () => void;
}) {
  return (
    <section className="col" aria-label="Ficha del seguro">
      <ProductSheetContent
        sheets={props.sheets}
        customer={props.customer}
        relevant={props.relevant}
        criterionId={props.criterionId}
        header={(openFull) => (
          <div className="col-h">
            <b className="text-sm font-semibold">Ficha del seguro</b>
            <span className="ml-auto flex">
              {openFull && (
                <Button variant="ghost" size="sm" onClick={openFull} aria-label="Ver ficha completa" title="Ver ficha completa">
                  <Maximize2 size={14} aria-hidden />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={props.onCollapse} aria-label="Plegar ficha">
                <PanelRight size={14} aria-hidden />
              </Button>
            </span>
          </div>
        )}
      />
    </section>
  );
}
