"use client";

import { Button, Kbd } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePreferences } from "@/lib/preferences";

const SHORTCUTS: [string, string][] = [
  ["Espacio", "Reproducir o pausar"],
  ["← →", "Retroceder o avanzar 5 s"],
  ["J  /  ↓", "Hallazgo siguiente"],
  ["K  /  ↑", "Hallazgo anterior"],
  ["C", "Confirmar"],
  ["X", "Corregir (elige Cumple o Incumple)"],
  ["E", "Escalar"],
  ["N", "Agregar nota al motivo en foco"],
  ["Enter", "Guardar y siguiente"],
  ["A", "Aprobar y siguiente (supervisor)"],
  ["?", "Esta ayuda"],
];

/** Cambio 20 §5: solo en Análisis de discrepancias › Patrones. */
const PATTERN_SHORTCUTS: [string, string][] = [
  ["J  /  K", "Elemento siguiente o anterior"],
  ["A", "Aceptar el elemento en foco"],
  ["D", "Descartar el elemento en foco"],
  ["M", "Siguiente motivo con pendientes"],
  ["Shift + M", "Motivo anterior con pendientes"],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { prefs, setPrefs } = usePreferences();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atajos de teclado"
      footer={
        <Button variant="primary" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      }
    >
      <table className="tbl flat">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <td className="w-[120px]">
                <Kbd>{k}</Kbd>
              </td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="m-0 text-sm font-semibold">En Análisis de discrepancias · Patrones</h3>
      <table className="tbl flat">
        <tbody>
          {PATTERN_SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <td className="w-[120px]">
                <Kbd>{k}</Kbd>
              </td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="help">Los atajos no funcionan mientras escribes en un campo.</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.singleKeyShortcuts}
          onChange={(e) => setPrefs({ singleKeyShortcuts: e.target.checked })}
        />
        Usar atajos de una sola tecla
      </label>
    </Dialog>
  );
}
