"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogProduct, ProductCategory } from "@/lib/api/catalog-types";
import { CATEGORY_LABEL, PREMIUM_TYPE_LABEL } from "@/lib/api/catalog-types";
import { CONDITIONS, IDENTIFICATION, TABLES, isList, type TableField } from "./fields";

type Source = { sheet: string; row: number; raw: string };

/** Origen del dato y marcas "No viene en el Excel" / "Revisar" junto a cada campo (§5.5, R-11.5). */
function Meta({ source, missing, review }: { source?: Source; missing?: boolean; review?: string }) {
  return (
    <>
      {source && (
        <span className="help block" title={source.raw}>
          Hoja {source.sheet} · fila {source.row}
        </span>
      )}
      {missing && <span className="help block">No viene en el Excel</span>}
      {review && (
        <span role="alert" className="block text-[13px] font-medium text-[var(--fail-700,#b42318)]">
          Revisar: {review}
        </span>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  help,
  source,
  missing,
  review,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  help?: string;
  source?: Source;
  missing?: boolean;
  review?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className="control min-h-[64px]" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="control" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {help && <span className="help">{help}</span>}
      <Meta source={source} missing={missing} review={review} />
    </div>
  );
}

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const orNull = (v: string) => (v.trim() === "" ? null : v);
const lines = (v: string) =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function TableEditor({
  table,
  rows,
  onChange,
}: {
  table: TableField;
  rows: Record<string, string | null>[];
  onChange: (rows: Record<string, string | null>[]) => void;
}) {
  const empty = Object.fromEntries(table.columns.map((c) => [c.key, null])) as Record<string, string | null>;
  return (
    <fieldset className="grid gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-[14px] font-semibold">
        {table.label} ({rows.length})
      </legend>
      {table.help && <p className="help m-0">{table.help}</p>}
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
          {table.columns.map((c) => (
            <Field
              key={c.key}
              label={`${c.label} (fila ${i + 1})`}
              value={text(row[c.key])}
              multiline={c.multiline}
              onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [c.key]: orNull(v) } : r)))}
            />
          ))}
          <div className="sm:col-span-2">
            <Button variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 size={14} aria-hidden />
              Quitar fila {i + 1}
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button size="sm" onClick={() => onChange([...rows, { ...empty }])}>
          <Plus size={14} aria-hidden />
          Agregar fila
        </Button>
      </div>
    </fieldset>
  );
}

/** Formulario de la ficha completa (D-30). Sirve para editar una ficha y para revisar una propuesta de la IA. */
export function ProductForm({
  value,
  onChange,
  sources = {},
  missing = [],
  reviews = {},
}: {
  value: CatalogProduct;
  onChange: (next: CatalogProduct) => void;
  sources?: Record<string, Source>;
  missing?: string[];
  reviews?: Record<string, string>;
}) {
  const set = <K extends keyof CatalogProduct>(key: K, v: CatalogProduct[K]) => onChange({ ...value, [key]: v });
  const meta = (key: string) => ({ source: sources[key], missing: missing.includes(key), review: reviews[key] });
  const categoryId = useId();
  const premiumId = useId();
  const knownCategory = value.category in CATEGORY_LABEL;
  return (
    <div className="grid gap-4">
      <section className="grid gap-3">
        <h2 className="m-0 text-[15px] font-semibold">Identificación</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del seguro" value={value.name} onChange={(v) => set("name", v)} {...meta("name")} />
          <Field label="Aseguradora" value={text(value.insurer)} onChange={(v) => set("insurer", orNull(v))} {...meta("insurer")} />
        </div>
        {IDENTIFICATION.map((f) =>
          isList(f) ? (
            <Field
              key={f.key}
              label={f.label}
              help={f.help}
              multiline
              value={(value[f.key] as string[]).join("\n")}
              onChange={(v) => set(f.key, lines(v))}
              {...meta(f.key)}
            />
          ) : (
            <Field
              key={f.key}
              label={f.label}
              multiline={f.multiline}
              value={text(value[f.key])}
              onChange={(v) => set(f.key, orNull(v) as never)}
              {...meta(f.key)}
            />
          ),
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 text-[15px] font-semibold">Condiciones</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={categoryId} className="text-[13px] font-medium">
              Categoría
            </label>
            <select
              id={categoryId}
              className="control"
              value={knownCategory ? value.category : ""}
              onChange={(e) => set("category", e.target.value as ProductCategory)}
            >
              {!knownCategory && <option value="">Elige una categoría</option>}
              {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Meta
              {...meta("category")}
              review={knownCategory ? reviews.category : `Categoría no reconocida: «${value.category}». Elige una de la lista.`}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={premiumId} className="text-[13px] font-medium">
              Tipo de prima
            </label>
            <select id={premiumId} className="control" value={value.premiumType} onChange={(e) => set("premiumType", e.target.value)}>
              {Object.entries(PREMIUM_TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Meta {...meta("premiumType")} />
          </div>
          {CONDITIONS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              multiline={f.multiline}
              value={text(value[f.key])}
              onChange={(v) => set(f.key, orNull(v) as never)}
              {...meta(f.key)}
            />
          ))}
        </div>
      </section>

      {TABLES.map((t) => (
        <TableEditor
          key={t.key}
          table={t}
          rows={value[t.key] as unknown as Record<string, string | null>[]}
          onChange={(rows) => set(t.key, rows as never)}
        />
      ))}

      <Field
        label="Observaciones"
        help="Inconsistencias o dudas del propio Excel. Una por línea."
        multiline
        value={value.observations.join("\n")}
        onChange={(v) => set("observations", lines(v))}
        {...meta("observations")}
      />
    </div>
  );
}
