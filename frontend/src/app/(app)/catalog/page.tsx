"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UPLOAD_ERROR, UPLOAD_STATUS } from "@/components/catalog/labels";
import { CategoryBadge } from "@/components/catalog/product-view";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CatalogUpload, ProductCategory, ProductFilters } from "@/lib/api/catalog-types";
import { CATEGORY_LABEL } from "@/lib/api/catalog-types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const STEPS = [
  { key: "reading", label: "Leyendo el Excel" },
  { key: "extracting", label: "Extrayendo los seguros con IA" },
  { key: "matching", label: "Buscando seguros que ya existen" },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;

export default function CatalogPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "uploads">("products");
  const [filters, setFilters] = useState<ProductFilters>({ status: "active" });
  const [queryText, setQueryText] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const products = useAsync(() => api.listProducts(filters), [JSON.stringify(filters)]);
  const all = useAsync(() => api.listProducts({ status: "all" }), []);
  const uploads = useAsync(() => api.listCatalogUploads(), []);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, query: queryText || undefined })), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  const insurers = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.insurer).filter((x): x is string => Boolean(x)))].sort(),
    [all.data],
  );
  const inReview = (uploads.data ?? []).find((u) => u.status === "ready" || u.status === "partial");
  const filtered = Boolean(filters.query || filters.insurer || filters.category || filters.incomplete || filters.status !== "active");

  return (
    <>
      <PageHeader
        title="Seguros"
        description="Fichas que usa la IA para validar las llamadas."
        actions={
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <Upload size={14} aria-hidden />
            Subir Excel
          </Button>
        }
      />
      {inReview && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent px-3 py-2" role="status">
          Tienes una carga con {inReview.counts.total - inReview.counts.decided} seguros por revisar.
          <Button size="sm" onClick={() => router.push(`/catalog/uploads/${inReview.id}`)}>
            Continuar revisión
          </Button>
        </div>
      )}
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === "products"} onClick={() => setTab("products")}>
          Seguros <span className="cnt">{(all.data ?? []).filter((p) => p.status === "active").length}</span>
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "uploads"} onClick={() => setTab("uploads")}>
          Cargas <span className="cnt">{uploads.data?.length ?? 0}</span>
        </button>
      </div>

      {tab === "products" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              className="control min-w-[280px]"
              type="search"
              aria-label="Buscar seguros"
              placeholder="Busca por nombre, nombre en sistema o n° de póliza"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            <select
              className="control"
              aria-label="Aseguradora"
              value={filters.insurer ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, insurer: e.target.value || undefined }))}
            >
              <option value="">Aseguradora: todas</option>
              {insurers.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <select
              className="control"
              aria-label="Categoría"
              value={filters.category ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, category: (e.target.value || undefined) as ProductCategory | undefined }))}
            >
              <option value="">Categoría: todas</option>
              {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="control"
              aria-label="Estado"
              value={filters.status ?? "active"}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ProductFilters["status"] }))}
            >
              <option value="active">Activos</option>
              <option value="archived">Archivados</option>
              <option value="all">Todos</option>
            </select>
            <label className="help inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={Boolean(filters.incomplete)}
                onChange={(e) => setFilters((f) => ({ ...f, incomplete: e.target.checked || undefined }))}
              />
              Incompletos
            </label>
          </div>
          <AsyncView state={products} what="los seguros">
            {(rows) =>
              rows.length === 0 ? (
                filtered ? (
                  <EmptyState title="No hay seguros con estos filtros.">
                    <Button
                      onClick={() => {
                        setQueryText("");
                        setFilters({ status: "active" });
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </EmptyState>
                ) : (
                  <EmptyState title="Aún no hay seguros en el catálogo." body="Sube el Excel del cliente para empezar.">
                    <Button variant="primary" onClick={() => setUploadOpen(true)}>
                      Subir Excel
                    </Button>
                  </EmptyState>
                )
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Seguro</th>
                      <th>Categoría</th>
                      <th>Pólizas</th>
                      <th>Nombres en sistema</th>
                      <th className="num">Versión</th>
                      <th>Actualizado</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => a.name.localeCompare(b.name, "es"))
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="whitespace-normal">
                            <a
                              href={`/catalog/${p.id}`}
                              className="font-semibold"
                              onClick={(e) => {
                                e.preventDefault();
                                router.push(`/catalog/${p.id}`);
                              }}
                            >
                              {p.name}
                            </a>
                            <span className="help block">{p.insurer ?? "Sin aseguradora"}</span>
                          </td>
                          <td>
                            <CategoryBadge category={p.category} />
                          </td>
                          <td className="tabular">{more(p.policies, 2)}</td>
                          <td className="whitespace-normal">{more(p.systemNames, 1)}</td>
                          <td className="num">v{p.version}</td>
                          <td>
                            {shortDateTime(p.updatedAt)}
                            <span className="help block">{p.updatedBy?.name ?? "Carga inicial"}</span>
                          </td>
                          <td>
                            {p.status === "archived" ? (
                              <StatusBadge>Archivado</StatusBadge>
                            ) : p.incomplete ? (
                              <StatusBadge tone="doubt" title="Sin nombre en sistema ni n° de póliza">
                                Incompleto
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="teal">Activo</StatusBadge>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )
            }
          </AsyncView>
        </>
      ) : (
        <AsyncView state={uploads} what="las cargas">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState title="Todavía no hay cargas." body="Cuando subas un Excel de seguros, aparece aquí." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Subido</th>
                    <th>Estado</th>
                    <th>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td className="whitespace-normal">
                        <a
                          href={`/catalog/uploads/${u.id}`}
                          className="font-semibold"
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/catalog/uploads/${u.id}`);
                          }}
                        >
                          {u.fileName}
                        </a>
                      </td>
                      <td>
                        {shortDateTime(u.uploadedAt)}
                        <span className="help block">{u.uploadedBy.name}</span>
                      </td>
                      <td>
                        <StatusBadge tone={u.status === "failed" ? "fail" : u.status === "ready" || u.status === "partial" ? "teal" : "neutral"}>
                          {UPLOAD_STATUS[u.status]}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-normal">
                        {u.counts.total
                          ? `${u.counts.new} nuevos · ${u.counts.existsChanged} ya existen con cambios · ${u.counts.existsUnchanged} sin cambios · ${u.counts.decided} de ${u.counts.total} decididos`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </AsyncView>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onReady={(u) => {
          void uploads.reload({ silent: true });
          toast(`La carga «${u.fileName}» está lista para revisar.`, {
            action: { label: "Revisar", onClick: () => router.push(`/catalog/uploads/${u.id}`) },
          });
        }}
        onBackground={() => {
          void uploads.reload({ silent: true });
          setTab("uploads");
        }}
      />
    </>
  );
}

function more(values: string[], n: number) {
  if (!values.length) return "—";
  return values.slice(0, n).join(", ") + (values.length > n ? ` +${values.length - n}` : "");
}

function UploadDialog({
  open,
  onOpenChange,
  onReady,
  onBackground,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: (u: CatalogUpload) => void;
  onBackground: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<CatalogUpload | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!upload || upload.status !== "processing") return;
    const t = setTimeout(async () => {
      const next = await api.getCatalogUpload(upload.id).catch(() => upload);
      setUpload(next);
      if (next.status === "ready") onReady(next);
    }, 3000);
    return () => clearTimeout(t);
  }, [upload, onReady]);

  const reset = () => {
    setFile(null);
    setError(null);
    setUpload(null);
  };

  const choose = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) setError(UPLOAD_ERROR.invalid_format);
    else if (f.size > MAX_BYTES)
      setError(`El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es 10 MB. Quita hojas que no tengan seguros o divídelo en dos.`);
    setFile(f);
  };

  const send = async () => {
    if (!file) return;
    setSending(true);
    try {
      const { uploadId } = await api.uploadCatalog(file);
      setUpload(await api.getCatalogUpload(uploadId));
    } catch (e) {
      setError(UPLOAD_ERROR[(e as Error).message] ?? "No pudimos subir el archivo. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const stepIndex = upload ? STEPS.findIndex((s) => s.key === upload.step) : -1;
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Subir Excel de seguros"
      description={
        <div className="grid gap-1.5">
          <p className="m-0">Excel .xlsx de hasta 10 MB.</p>
          <p className="m-0 font-medium">Sube solo condiciones de seguros. No incluyas datos de clientes ni de ejecutivos.</p>
          <p className="help m-0">La IA lee el archivo y propone las fichas. Nada se guarda en el catálogo hasta que lo revises.</p>
        </div>
      }
      footer={
        upload ? (
          upload.status === "processing" ? (
            <Button
              onClick={() => {
                onBackground();
                close(false);
              }}
            >
              Seguir en segundo plano
            </Button>
          ) : upload.status === "ready" ? (
            <Button variant="primary" onClick={() => router.push(`/catalog/uploads/${upload.id}`)}>
              Revisar
            </Button>
          ) : (
            <Button onClick={() => close(false)}>Cerrar</Button>
          )
        ) : (
          <>
            <Button variant="primary" disabled={!file || Boolean(error)} loading={sending} onClick={() => void send()}>
              Procesar con IA
            </Button>
            <Button onClick={() => close(false)}>Cancelar</Button>
          </>
        )
      }
    >
      {!upload ? (
        <div
          className="grid gap-2 rounded-lg border-2 border-dashed border-border p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0] ?? null);
          }}
        >
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="m-0">
              <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB
            </p>
          ) : null}
          <div>
            <Button onClick={() => input.current?.click()}>{file ? "Cambiar archivo" : "Elegir archivo"}</Button>
          </div>
          <span className="help">o arrástralo aquí</span>
          {error && (
            <p role="alert" className="m-0 font-medium text-[var(--fail-700,#b42318)]">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div aria-live="polite" className="grid gap-1.5">
          <p className="m-0">
            <b>{upload.fileName}</b>
          </p>
          {upload.status === "failed" ? (
            <p role="alert" className="m-0 font-medium text-[var(--fail-700,#b42318)]">
              {UPLOAD_ERROR[upload.error ?? "extraction_failed"]}
            </p>
          ) : (
            <ol className="m-0 grid gap-1 pl-5">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  {s.label} ·{" "}
                  {upload.status === "ready" || i < stepIndex ? "listo" : i === stepIndex ? "en curso…" : "pendiente"}
                </li>
              ))}
              <li>{upload.status === "ready" ? "Listo para revisar" : "Listo para revisar · pendiente"}</li>
            </ol>
          )}
          {upload.status === "processing" && (
            <p className="help m-0">Te avisamos aquí cuando esté lista. Si sales, la encuentras en Seguros › Cargas.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
