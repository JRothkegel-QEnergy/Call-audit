"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { mockControls } from "@/lib/api/mock/mock-api";

/** Controles solo de la demo: no forman parte del diseño ni existirán con el backend real. */
export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [simulate, setSimulate] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSimulate(mockControls.getSimulateErrors());
        onOpenChange(o);
      }}
      title="Opciones de la demo"
      description={<p className="m-0">Este front usa datos sintéticos en tu navegador. Nada se envía a un servidor.</p>}
      footer={
        <>
          <Button
            onClick={async () => {
              await api.resetDemo();
              onOpenChange(false);
              toast("Datos de la demo reiniciados.");
              router.refresh();
              window.location.reload();
            }}
          >
            Reiniciar datos de la demo
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </>
      }
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={simulate}
          onChange={(e) => {
            setSimulate(e.target.checked);
            mockControls.setSimulateErrors(e.target.checked);
          }}
        />
        Simular errores de red (para ver los estados de error)
      </label>
    </Dialog>
  );
}
