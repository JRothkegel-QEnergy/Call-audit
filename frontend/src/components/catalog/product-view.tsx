"use client";

import { StatusBadge } from "@/components/ui/badges";
import type { CatalogProduct, FieldChange, ProductCategory } from "@/lib/api/catalog-types";
import { CATEGORY_LABEL, PREMIUM_TYPE_LABEL } from "@/lib/api/catalog-types";
import { CONDITIONS, IDENTIFICATION, TABLES, isList, show } from "./fields";

export function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABEL[category as ProductCategory] ?? category;
  return <StatusBadge tone={category === "RETENIBLE" ? "teal" : "ink"}>{label}</StatusBadge>;
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label}>
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className="m-0 whitespace-pre-wrap font-medium">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="m-0 mb-1 text-[15px] font-semibold">{title}</h2>
      {help && <p className="help mb-2 mt-0">{help}</p>}
      {children}
    </section>
  );
}

/** Ficha completa en modo lectura (pestaña Ficha e Identificación). */
export function ProductView({ product, only }: { product: CatalogProduct; only?: "identification" }) {
  const ident = IDENTIFICATION.map((f) => ({
    label: f.label,
    value: show(isList(f) ? product[f.key] : product[f.key]),
  }));
  if (only === "identification")
    return (
      <Block title="Identificación">
        <Rows rows={[{ label: "Nombre del seguro", value: product.name }, { label: "Aseguradora", value: product.insurer ?? "Sin aseguradora" }, ...ident]} />
      </Block>
    );
  return (
    <div className="grid gap-3">
      <Block title="Condiciones generales">
        <Rows
          rows={[
            { label: "Categoría", value: CATEGORY_LABEL[product.category] ?? product.category },
            { label: "Tipo de prima", value: PREMIUM_TYPE_LABEL[product.premiumType] ?? product.premiumType },
            ...CONDITIONS.map((f) => ({ label: f.label, value: show(product[f.key]) })),
          ]}
        />
      </Block>
      {TABLES.map((t) => {
        const rows = product[t.key] as unknown as Record<string, string | null>[];
        if (!rows?.length) return null;
        return (
          <Block key={t.key} title={`${t.label} (${rows.length})`} help={t.help}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    {t.columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {t.columns.map((c) => (
                        <td key={c.key} className="whitespace-pre-wrap align-top">
                          {show(r[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        );
      })}
      {product.observations.length > 0 && (
        <Block title="Observaciones">
          <ul className="m-0 pl-5">
            {product.observations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

const KIND_LABEL: Record<FieldChange["kind"], string> = { changed: "Cambiada", added: "Agregada", removed: "Quitada" };

/** Comparación "Actual vs Propuesto" (solo diferencias), con marcas en texto y no solo color (WCAG 1.4.1). */
export function ChangesTable({
  changes,
  beforeLabel,
  afterLabel,
  choices,
  onChoose,
}: {
  changes: FieldChange[];
  beforeLabel: string;
  afterLabel: string;
  choices?: Record<string, "keep" | "proposed">;
  onChoose?: (path: string, choice: "keep" | "proposed") => void;
}) {
  if (!changes.length) return <p className="help m-0">No hay diferencias.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Cambio</th>
            <th>{beforeLabel}</th>
            <th>{afterLabel}</th>
            {onChoose && <th>Quedarse con</th>}
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.path}>
              <td className="font-medium">{c.label}</td>
              <td>{KIND_LABEL[c.kind]}</td>
              <td className="max-w-[360px] whitespace-pre-wrap align-top">{show(c.before)}</td>
              <td className="max-w-[360px] whitespace-pre-wrap align-top">{show(c.after)}</td>
              {onChoose && (
                <td>
                  <div className="seg" role="radiogroup" aria-label={`Valor para ${c.label}`}>
                    {(["keep", "proposed"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={(choices?.[c.path] ?? "proposed") === v}
                        onClick={() => onChoose(c.path, v)}
                      >
                        {v === "keep" ? "Actual" : "Propuesto"}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
