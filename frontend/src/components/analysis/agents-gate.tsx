"use client";

import Link from "next/link";
import { useIsQubico } from "@/components/analysis/parts";
import { EmptyState } from "@/components/ui/states";
import type { AgentsGate } from "@/lib/api/analysis-types";

/** C-02 / D-27: con pocos ejecutivos con volumen suficiente, compararlos llevaría a feedback injusto. */
export function AgentsGateNotice({ gate, low }: { gate: AgentsGate; low: number }) {
  // D-41: Criterios solo para Qubico; al supervisor no se le ofrece.
  const qubico = useIsQubico();
  const body = `Solo ${gate.agentsWithEnough} de ${gate.totalAgents} ejecutivos tienen ${low} llamadas o más en esta foto.`;
  return (
    <EmptyState title="Todavía no hay llamadas suficientes por ejecutivo para comparar." body={qubico ? `${body} Mientras tanto, Criterios sí sirve para ver dónde está la diferencia.` : body}>
      {qubico && (
        <Link href="/analysis/criteria" className="btn">
          Ver Criterios
        </Link>
      )}
    </EmptyState>
  );
}
