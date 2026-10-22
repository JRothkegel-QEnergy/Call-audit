"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProductForm } from "@/components/catalog/product-form";
import { CategoryBadge, ChangesTable, ProductView } from "@/components/catalog/product-view";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CatalogProduct, ProductDetail, ProductVersion, VersionOrigin } from "@/lib/api/catalog-types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

type Tab = "sheet" | "identification" | "history";

export function originText(o: VersionOrigin): string {
  switch (o.kind) {
    case "initial_load":
      return "Carga inicial del catálogo";
    case "upload":
      return `Carga · ${o.fileName}${o.batch ? " (confirmado en lote)" : ""}`;
    case "manual":
      return "Edición manual";
    case "restore":
      return `Restaurada desde la v${o.fromVersion}`;
  }
}

export function ProductDetailView({ id }: { id: string }) {
  const router = useRouter();
  const product = useAsync(() => api.getProduct(id), [id]);
  const [tab, setTab] = useState<Tab>("sheet");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/catalog")}>
        <ArrowLeft size={14} aria-hidden />
        Seguros
      </Button>
      <AsyncView state={product} what="la ficha del seguro">
        {(p) => (
          <>
            <div className="mb-3 mt-2 flex flex-wrap items-start gap-3">
              <div>
                <h1 className="m-0 text-[22px] font-semibold leading-7">{p.product.name}</h1>
                <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                  {p.product.insurer ?? "Sin aseguradora"} <CategoryBadge category={p.product.category} />
                  <span>
                    Versión {p.version} · actualizada el {shortDateTime(p.updatedAt)}
                    {p.updatedBy ? ` por ${p.updatedBy.name}` : ""}
                  </span>
                </p>
              </div>
              {!editing && (
                <div className="ml-auto flex gap-2">
                  <Button variant="primary" onClick={() => setEditing(structuredClone(p.product))}>
                    Editar
                  </Button>
                  {p.status === "active" && <Button onClick={() => setArchiveOpen(true)}>Archivar</Button>}
                </div>
              )}
            </div>
            {p.status === "archived" && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2" role="status">
                Este seguro está archivado: la IA no lo usa en validaciones nuevas.
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await api.setProductStatus(id, "active");
                      void product.reload({ silent: true });
                    } catch (e) {
                      toast.error(
                        (e as Error).message === "duplicate_key"
                          ? "Ya existe otro seguro activo con el mismo nombre y aseguradora."
                          : "No pudimos reactivar el seguro.",
                      );
                    }
                  }}
                >
                  Reactivar
                </Button>
              </div>
            )}
            {editing ? (
              <Editor
                detail={p}
                value={editing}
                onChange={setEditing}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  void product.reload({ silent: true });
                }}
              />
            ) : (
              <>
                <div className="tabs" role="tablist">
                  {(
                    [
                      ["sheet", "Ficha"],
                      ["identification", "Identificación"],
                      ["history", "Historial"],
                    ] as const
                  ).map(([k, label]) => (
                    <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                      {label}
                    </button>
                  ))}
                </div>
                {tab === "sheet" && <ProductView product={p.product} />}
                {tab === "identification" && <ProductView product={p.product} only="identification" />}
                {tab === "history" && <History id={id} current={p.version} onRestored={() => void product.reload({ silent: true })} />}
              </>
            )}
            <Dialog
              open={archiveOpen}
              onOpenChange={setArchiveOpen}
              title={`¿Archivar «${p.product.name}»?`}
              description="La IA deja de usarlo en validaciones nuevas. Las llamadas ya validadas lo siguen mostrando. Puedes reactivarlo cuando quieras."
              footer={
                <>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      await api.setProductStatus(id, "archived");
                      setArchiveOpen(false);
                      void product.reload({ silent: true });
                    }}
                  >
                    Archivar
                  </Button>
                  <Button onClick={() => setArchiveOpen(false)}>Cancelar</Button>
                </>
              }
            />
          </>
        )}
      </AsyncView>
    </>
  );
}

function Editor({
  detail,
  value,
  onChange,
  onCancel,
  onSaved,
}: {
  detail: ProductDetail;
  value: CatalogProduct;
  onChange: (p: CatalogProduct) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.updateProduct(detail.id, { product: value, baseVersion: detail.version, note: note || undefined });
      toast(`Guardamos la versión ${saved.version} de «${saved.product.name}». Las llamadas ya validadas mantienen la versión con que se validaron.`);
      onSaved();
    } catch (e) {
      const code = (e as Error).message;
      if (code === "duplicate_key") setError(`Ya existe un seguro llamado «${value.name}» en ${value.insurer ?? "Sin aseguradora"}.`);
      else if (code === "version_conflict")
        setError("Otra persona guardó una versión nueva de esta ficha mientras editabas. Revisa sus cambios antes de guardar los tuyos.");
      else if (code === "validation") setError("Revisa los campos: falta el nombre o la categoría no es válida.");
      else setError("No pudimos guardar la ficha. Tus cambios siguen aquí.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 pb-24" style={{ scrollPaddingBottom: 96 }}>
      <p className="help m-0">Los cambios se usan desde la próxima validación.</p>
      <ProductForm value={value} onChange={onChange} />
      <div className="grid gap-1">
        <label htmlFor="edit-note" className="text-[13px] font-medium">
          Nota del cambio (opcional)
        </label>
        <input
          id="edit-note"
          className="control"
          placeholder="Ej.: Cliente actualizó la devolución de primas en octubre"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-wrap items-center gap-2 border-t border-border bg-card px-6 py-3">
        {error && (
          <p role="alert" className="m-0 mr-auto font-medium text-[var(--fail-700,#b42318)]">
            {error}
            {error.startsWith("Otra persona") && (
              <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
                Ver la versión nueva
              </Button>
            )}
          </p>
        )}
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          Guardar versión {detail.version + 1}
        </Button>
        <Button onClick={() => setConfirmDiscard(true)}>Cancelar</Button>
      </div>
      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar los cambios?"
        description="Lo que editaste no se guarda."
        footer={
          <>
            <Button variant="primary" onClick={onCancel}>
              Descartar
            </Button>
            <Button onClick={() => setConfirmDiscard(false)}>Seguir editando</Button>
          </>
        }
      />
    </div>
  );
}

function History({ id, current, onRestored }: { id: string; current: number; onRestored: () => void }) {
  const versions = useAsync(() => api.listProductVersions(id), [id, current]);
  const [open, setOpen] = useState<ProductVersion | null>(null);
  const detail = useAsync(
    () => (open ? api.getProductVersion(id, open.version) : Promise.resolve(null)),
    [id, open?.version],
  );
  return (
    <AsyncView state={versions} what="el historial">
      {(rows) => (
        <div className="grid gap-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>Versión</th>
                <th>Fecha</th>
                <th>Autor</th>
                <th>Origen</th>
                <th>Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.version}>
                  <td className="num">
                    v{v.version} {v.version === current && <StatusBadge tone="teal">Vigente</StatusBadge>}
                  </td>
                  <td>{shortDateTime(v.createdAt)}</td>
                  <td>{v.author?.name ?? "—"}</td>
                  <td className="whitespace-normal">{originText(v.origin)}</td>
                  <td className="whitespace-normal">{v.note ?? "—"}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => setOpen(v)}>
                      Ver cambios
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {open && (
            <section className="rounded-lg border border-border bg-card p-4" aria-live="polite">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-[15px] font-semibold">Versión {open.version}: cambios respecto de la anterior</h2>
                {open.version !== current && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={async () => {
                      try {
                        const saved = await api.restoreProductVersion(id, open.version);
                        toast(`Se creó la versión ${saved.version} con los datos de la v${open.version}.`);
                        setOpen(null);
                        onRestored();
                      } catch (e) {
                        toast.error(
                          (e as Error).message === "duplicate_key"
                            ? "No se puede restaurar: otro seguro ya usa ese nombre y aseguradora."
                            : "No pudimos restaurar la versión.",
                        );
                      }
                    }}
                  >
                    Restaurar esta versión
                  </Button>
                )}
              </div>
              {open.version !== current && <p className="help mt-0">Se crea la versión {current + 1} con estos datos.</p>}
              <AsyncView state={detail} what="los cambios">
                {(d) =>
                  d ? (
                    open.version === 1 ? (
                      <p className="help m-0">Es la primera versión: no hay una anterior con que comparar.</p>
                    ) : (
                      <ChangesTable changes={d.changes} beforeLabel={`v${open.version - 1}`} afterLabel={`v${open.version}`} />
                    )
                  ) : null
                }
              </AsyncView>
            </section>
          )}
        </div>
      )}
    </AsyncView>
  );
}
