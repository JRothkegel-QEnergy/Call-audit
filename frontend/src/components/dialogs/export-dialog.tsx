"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";

/** Exportar lo filtrado: sin datos personales por defecto; con ellos, motivo obligatorio y registro (L-04). */
export function ExportButton({ count = 1240 }: { count?: number }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [pii, setPii] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = `Exportar ${count.toLocaleString("es-CL")} llamadas`;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Download size={14} aria-hidden />
        Exportar
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Exportar lo filtrado"
        footer={
          <>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                if (pii && !reason.trim()) return setError("Indica el motivo para incluir datos personales.");
                setBusy(true);
                try {
                  await api.exportFiltered({ format, includePii: pii, piiReason: reason.trim() || undefined });
                  setOpen(false);
                  toast("Estamos preparando el archivo. Te avisaremos cuando esté listo.");
                } catch {
                  setError("No pudimos iniciar la exportación. Intenta de nuevo.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {label}
            </Button>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
          </>
        }
      >
        <div className="summary-box">{count.toLocaleString("es-CL")} llamadas · filtros de la vista actual</div>
        <fieldset className="m-0 rounded-md border border-border px-3 py-2">
          <legend className="px-1 text-[13px] font-medium">Formato</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="fmt" checked={format === "csv"} onChange={() => setFormat("csv")} /> CSV
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="fmt" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} /> Excel
          </label>
        </fieldset>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pii} onChange={(e) => setPii(e.target.checked)} /> Incluir datos personales
        </label>
        <span className="help">Requiere permiso. Debes indicar el motivo y quedará en el registro de accesos.</span>
        {pii && (
          <label className="field">
            Motivo
            <input className="control" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </Dialog>
    </>
  );
}
