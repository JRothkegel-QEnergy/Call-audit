"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDot, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UPLOAD_ERROR, UPLOAD_STATUS } from "@/components/catalog/labels";
import { ProductForm } from "@/components/catalog/product-form";
import { ChangesTable } from "@/components/catalog/product-view";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CatalogProduct, CatalogUpload, UploadItem, UploadWarning } from "@/lib/api/catalog-types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const DATA_TYPE = { rut: "RUT", email: "correo", phone: "teléfono" } as const;

function warningText(w: UploadWarning, items: UploadItem[]): string {
  switch (w.kind) {
    case "possible_duplicate":
      return `Posible duplicado: comparte ${w.via === "policy" ? `la póliza ${w.value}` : `el nombre en sistema «${w.value}»`} con «${w.productName}» de ${w.insurer ?? "Sin aseguradora"}. Si son seguros distintos, puedes guardarlo; revisa los nombres en sistema para que la IA los distinga.`;
    case "repeated_in_file": {
      const other = items.find((i) => i.id === w.otherItemId);
      return `Este Excel trae dos veces «${other?.proposed.name ?? ""}» de ${other?.proposed.insurer ?? "Sin aseguradora"}. Guarda uno y descarta el otro.`;
    }
    case "missing_required":
      return w.field === "identifier"
        ? "Sin nombre en sistema ni n° de póliza, la IA no podrá encontrar este seguro en las llamadas."
        : w.field === "name"
          ? "Falta el nombre del seguro."
          : "Falta la categoría.";
    case "invalid_category":
      return `Categoría no reconocida: «${w.value}». Elige una de la lista.`;
    case "possible_personal_data":
      return `Este texto parece tener datos personales (${DATA_TYPE[w.dataType]}). Bórralos si no son parte de las condiciones del seguro.`;
  }
}

function MatchBadge({ item }: { item: UploadItem }) {
  if (item.match.status === "new")
    return (
      <span className="inline-flex items-center gap-1">
        <CircleDot size={14} aria-hidden /> Nuevo
      </span>
    );
  const label = { unchanged: "Ya existe sin cambios", changed: "Ya existe con cambios", archived: "Ya existe (archivado)" }[item.match.state];
  return (
    <span className="inline-flex items-center gap-1">
      <Copy size={14} aria-hidden /> {label}
    </span>
  );
}

function decisionText(item: UploadItem): string {
  if (!item.decision) return "Pendiente";
  return { created: "Guardado como nuevo", updated: "Actualizado", discarded: "Descartado" }[item.decision.action];
}

export function UploadReview({ id }: { id: string }) {
  const router = useRouter();
  const upload = useAsync(() => api.getCatalogUpload(id), [id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (upload.data?.status !== "processing") return;
    const t = setTimeout(() => void upload.reload({ silent: true }), 3000);
    return () => clearTimeout(t);
  }, [upload]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push("/catalog")}>
        <ArrowLeft size={14} aria-hidden />
        Seguros
      </Button>
      <AsyncView state={upload} what="la carga">
        {(u) => {
          const item = u.items.find((i) => i.id === selected);
          const eligible = u.items.filter((i) => !i.decision && i.match.status === "new" && i.warnings.length === 0);
          const open = u.status === "ready" || u.status === "partial";
          return (
            <>
              <div className="mb-3 mt-2">
                <h1 className="m-0 text-[22px] font-semibold leading-7">{u.fileName}</h1>
                <p className="m-0 mt-1 text-muted-foreground">
                  Subido por {u.uploadedBy.name} · {shortDateTime(u.uploadedAt)} · {UPLOAD_STATUS[u.status]}
                  {u.model && ` · Modelo ${u.model} · Prompt de extracción v${u.extractionPromptVersion}`}
                </p>
              </div>

              {u.status === "processing" && (
                <p aria-live="polite" className="rounded-lg border border-border bg-accent px-3 py-2">
                  La IA está leyendo el Excel. Esta página se actualiza sola.
                </p>
              )}
              {u.status === "failed" && (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                  {UPLOAD_ERROR[u.error ?? "extraction_failed"]}
                  {u.error === "extraction_failed" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await api.retryCatalogUpload(id);
                        void upload.reload({ silent: true });
                      }}
                    >
                      Reintentar
                    </Button>
                  )}
                </div>
              )}

              {u.items.length > 0 && (
                <>
                  <div className="mb-3 flex flex-wrap gap-2" aria-label="Resumen de la carga">
                    <StatusBadge tone="teal">Nuevos {u.counts.new}</StatusBadge>
                    <StatusBadge tone="ink">Ya existen con cambios {u.counts.existsChanged}</StatusBadge>
                    <StatusBadge>Ya existen sin cambios {u.counts.existsUnchanged}</StatusBadge>
                    <StatusBadge tone="doubt">Con advertencias {u.counts.withWarnings}</StatusBadge>
                    <StatusBadge>
                      Decididos {u.counts.decided} de {u.counts.total}
                    </StatusBadge>
                  </div>
                  {u.unusedSheets.length > 0 && <p className="help">No usamos las hojas: {u.unusedSheets.join(", ")}.</p>}

                  {item ? (
                    <ItemReview
                      key={item.id}
                      upload={u}
                      item={item}
                      onBack={() => setSelected(null)}
                      onChanged={() => void upload.reload({ silent: true })}
                      onNext={() => {
                        const next = u.items.find((i) => !i.decision && i.id !== item.id);
                        setSelected(next?.id ?? null);
                      }}
                    />
                  ) : (
                    <div>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Seguro propuesto</th>
                            <th>Estado</th>
                            <th>Coincide con</th>
                            <th>Advertencias</th>
                            <th>Decisión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {u.items.map((i) => (
                            <tr key={i.id}>
                              <td className="whitespace-normal">
                                <a
                                  href="#"
                                  className="font-semibold"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelected(i.id);
                                  }}
                                >
                                  {i.proposed.name}
                                </a>
                                <span className="help block">{i.proposed.insurer ?? "Sin aseguradora"}</span>
                              </td>
                              <td>
                                <MatchBadge item={i} />
                              </td>
                              <td>
                                {i.match.status === "exists" ? (
                                  <a href={`/catalog/${i.match.productId}`} target="_blank" rel="noreferrer">
                                    {i.match.productId} · v{i.match.version}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="whitespace-normal">
                                {i.warnings.length ? (
                                  <span className="inline-flex items-center gap-1">
                                    <AlertTriangle size={14} aria-hidden /> {i.warnings.length}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>
                                {i.decision ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 size={14} aria-hidden /> {decisionText(i)}
                                  </span>
                                ) : (
                                  "Pendiente"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {open && (
                        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-t-lg border border-border bg-card px-4 py-3 shadow-md">
                          <Button variant="primary" disabled={!eligible.length} onClick={() => setBatchOpen(true)}>
                            Guardar {eligible.length} seguros nuevos
                          </Button>
                          <Button onClick={() => setDiscardOpen(true)}>Descartar la carga</Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {u.status === "closed" && (
                <p role="status">
                  Carga cerrada: {u.counts.created} nuevos, {u.counts.updated} actualizados, {u.counts.discarded} descartados.
                </p>
              )}
              {u.items.length === 0 && u.status !== "processing" && u.status !== "failed" && (
                <EmptyState title="Esta carga no tiene seguros." />
              )}

              <Dialog
                open={batchOpen}
                onOpenChange={setBatchOpen}
                title={`Guardar ${eligible.length} seguros nuevos`}
                description={`Vas a guardar ${eligible.length} seguros nuevos sin advertencias: ${eligible
                  .slice(0, 10)
                  .map((i) => i.proposed.name)
                  .join(", ")}${eligible.length > 10 ? "…" : ""}. Quedan marcados como confirmados en lote.`}
                footer={
                  <>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        try {
                          await api.createUploadItemsBatch(id, eligible.slice(0, 50).map((i) => i.id));
                          toast(`Guardamos ${Math.min(eligible.length, 50)} seguros. La IA los usa desde la próxima validación.`);
                        } catch {
                          toast.error("No pudimos guardar el lote. Revisa los seguros uno por uno.");
                        }
                        setBatchOpen(false);
                        void upload.reload({ silent: true });
                      }}
                    >
                      Guardar {Math.min(eligible.length, 50)} seguros
                    </Button>
                    <Button onClick={() => setBatchOpen(false)}>Cancelar</Button>
                  </>
                }
              />
              <Dialog
                open={discardOpen}
                onOpenChange={setDiscardOpen}
                title="¿Descartar esta carga?"
                description="Los seguros que ya guardaste se mantienen; el resto no se agrega al catálogo."
                footer={
                  <>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        await api.discardCatalogUpload(id);
                        setDiscardOpen(false);
                        router.push("/catalog");
                      }}
                    >
                      Descartar carga
                    </Button>
                    <Button onClick={() => setDiscardOpen(false)}>Volver</Button>
                  </>
                }
              />
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

function ItemReview({
  upload,
  item,
  onBack,
  onChanged,
  onNext,
}: {
  upload: CatalogUpload;
  item: UploadItem;
  onBack: () => void;
  onChanged: () => void;
  onNext: () => void;
}) {
  const [draft, setDraft] = useState<CatalogProduct>(item.proposed);
  const [live, setLive] = useState<UploadItem>(item);
  const [choices, setChoices] = useState<Record<string, "keep" | "proposed">>({});
  const [showCompare, setShowCompare] = useState(item.match.status === "exists" && item.match.state !== "unchanged");
  const [busy, setBusy] = useState(false);
  const decided = Boolean(item.decision);
  const open = upload.status === "ready" || upload.status === "partial";
  const first = useRef(true);

  // Autoguardado del borrador (D5): el backend recalcula si ya existe y las advertencias.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (decided || !open) return;
    const t = setTimeout(async () => {
      try {
        setLive(await api.updateUploadItem(upload.id, item.id, draft));
      } catch {
        toast.error("No pudimos guardar el borrador. Tus cambios siguen aquí.");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draft, decided, open, upload.id, item.id]);

  const reviews = useMemo(() => {
    const out: Record<string, string> = {};
    for (const w of live.warnings) if (w.kind === "possible_personal_data") out[w.field] = `posible dato personal (${DATA_TYPE[w.dataType]})`;
    return out;
  }, [live.warnings]);

  const decide = async (action: "create" | "update" | "discard") => {
    setBusy(true);
    try {
      await api.updateUploadItem(upload.id, item.id, draft).catch(() => undefined);
      const done = await api.decideUploadItem(upload.id, item.id, { action, fieldChoices: action === "update" ? choices : undefined });
      if (done.decision?.action === "created") toast(`Guardamos «${draft.name}». La IA lo usa desde la próxima validación.`);
      if (done.decision?.action === "updated")
        toast(`Guardamos la versión ${done.decision.version} de «${draft.name}». Las llamadas ya validadas mantienen la versión con que se validaron.`);
      onChanged();
      onNext();
    } catch (e) {
      const code = (e as Error).message;
      toast.error(
        code === "blocking_warnings"
          ? "Este seguro tiene advertencias que hay que resolver antes de guardarlo."
          : code === "duplicate_key"
            ? `Ya existe un seguro llamado «${draft.name}» en ${draft.insurer ?? "Sin aseguradora"}.`
            : "No pudimos guardar la decisión. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const m = live.match;
  return (
    <div className="grid gap-3">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden />
          Todos los seguros de la carga
        </Button>
      </div>
      <h2 className="m-0 text-[18px] font-semibold">{draft.name}</h2>
      {decided && <p role="status">Decisión: {decisionText(item)} por {item.decision!.by.name}.</p>}
      {m.status === "exists" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent px-3 py-2">
          Ya existe «{draft.name}» de {draft.insurer ?? "Sin aseguradora"} (v{m.version}).
          {m.state === "unchanged" && " No trae cambios."}
          {m.state === "archived" && " Está archivado: actualizarlo lo reactiva."}
          <Button size="sm" onClick={() => setShowCompare((v) => !v)}>
            {showCompare ? "Ocultar comparación" : "Comparar"}
          </Button>
          <a href={`/catalog/${m.productId}`} target="_blank" rel="noreferrer">
            Ver ese seguro
          </a>
        </div>
      )}
      {live.warnings.length > 0 && (
        <ul className="m-0 grid gap-1 pl-0" aria-label="Advertencias">
          {live.warnings.map((w, i) => (
            <li key={i} className="flex list-none items-start gap-1.5 rounded-md border border-border px-3 py-2">
              <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {warningText(w, upload.items)}
                {w.kind === "possible_duplicate" && (
                  <>
                    {" "}
                    <a href={`/catalog/${w.productId}`} target="_blank" rel="noreferrer">
                      Ver ese seguro
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showCompare && m.status === "exists" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="m-0 mb-2 text-[15px] font-semibold">Actual (v{m.version}) · Propuesto</h3>
          <ChangesTable
            changes={m.changes}
            beforeLabel={`Actual (v${m.version})`}
            afterLabel="Propuesto"
            choices={choices}
            onChoose={decided ? undefined : (path, c) => setChoices((s) => ({ ...s, [path]: c }))}
          />
          <p className="help mb-0 mt-2">
            Un campo vacío en el Excel no borra el valor actual. Las pólizas y los nombres en sistema se suman a los que ya tiene.
          </p>
        </section>
      )}
      <fieldset disabled={decided || !open} className="m-0 border-0 p-0">
        <ProductForm value={draft} onChange={setDraft} sources={live.fieldSources} missing={live.missingFields} reviews={reviews} />
      </fieldset>
      {!decided && open && (
        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-t-lg border border-border bg-card px-4 py-3 shadow-md">
          {m.status === "new" ? (
            <Button variant="primary" loading={busy} onClick={() => void decide("create")}>
              Guardar como nuevo
            </Button>
          ) : (
            <>
              <Button variant="primary" loading={busy} disabled={m.state === "unchanged"} onClick={() => void decide("update")}>
                Actualizar el existente
              </Button>
              <span className="help">Si es otro seguro, cámbiale el nombre para distinguirlo (por ejemplo, agrega el plan).</span>
            </>
          )}
          <Button loading={busy} onClick={() => void decide("discard")}>
            Descartar
          </Button>
          <Button variant="ghost" onClick={onNext}>
            Siguiente seguro
          </Button>
        </div>
      )}
    </div>
  );
}
