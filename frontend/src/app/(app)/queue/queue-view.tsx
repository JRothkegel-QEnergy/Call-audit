"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmployeeCombobox } from "@/components/employee-combobox";
import { WelcomeCard } from "@/components/welcome-card";
import { useNavCounts } from "@/components/shell/nav-counts";
import { CallVerdictBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { CallVerdict, QueueFilters } from "@/lib/api/types";
import { minutesAgo, mmss, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { caseStatusLabel } from "@/lib/verdicts";
import { EndOfDay } from "./end-of-day";

export function QueueView() {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useNavCounts();
  const readOnly = user?.role === "supervisor";

  const filters: QueueFilters = {
    agentId: params.get("agent") ?? undefined,
    engineVerdict: (params.get("verdict") as CallVerdict | "sample" | null) ?? undefined,
    blockId: params.get("block") ?? undefined,
  };
  const rubric = useRubric();
  const agents = useAsync(() => api.listAgents(), []);
  const queue = useAsync(() => api.listQueue(filters), [params.toString()]);
  const [taking, setTaking] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/queue${next.size ? `?${next}` : ""}`);
  };

  const clearAgent = () => setParam("agent", null);

  const takeNext = async () => {
    setTaking(true);
    try {
      const id = await api.takeNextCase(filters);
      if (id) router.push(`/calls/${id}`);
      else toast("No quedan casos pendientes con este filtro.");
    } catch {
      toast("No pudimos tomar el siguiente caso. Intenta de nuevo.");
    } finally {
      setTaking(false);
      refresh();
    }
  };

  const data = queue.data;
  const currentAgent = filters.agentId
    ? (agents.data?.find((a) => a.id === filters.agentId)?.name ?? "ejecutivo seleccionado")
    : null;
  const hasFilters = !!(filters.agentId || filters.engineVerdict || filters.blockId);

  // Fin de jornada: la cola completa está vacía (no solo por los filtros).
  if (!readOnly && data && data.total === 0) return <EndOfDay />;

  const counter = data
    ? hasFilters
      ? `${data.rows.length} de ${data.total} con el filtro`
      : `${data.total} pendientes · ${data.reviewedToday} revisados hoy`
    : "";

  return (
    <>
      <PageHeader
        title={readOnly ? "Cola completa" : "Cola de casos"}
        description={`Ordenada por gravedad y luego por antigüedad.${readOnly ? " Solo lectura." : ""}`}
        actions={
          !readOnly && (
            <>
              <span className="help" aria-live="polite">
                {counter}
              </span>
              <Button variant="primary" onClick={takeNext} loading={taking}>
                Tomar siguiente
              </Button>
            </>
          )
        }
      />

      {!readOnly && <WelcomeCard />}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
        <EmployeeCombobox
          onSelect={(a) => {
            setParam("agent", a.id);
            void api.logAgentSearch(a.id);
          }}
        />
        <select
          className="control"
          aria-label="Decisión del motor"
          value={filters.engineVerdict ?? ""}
          onChange={(e) => setParam("verdict", e.target.value || null)}
        >
          <option value="">Decisión: todas</option>
          <option value="non_compliant">No cumple</option>
          <option value="uncertain">Dudosa</option>
          <option value="sample">Muestra cumple</option>
        </select>
        <select
          className="control"
          aria-label="Bloque"
          value={filters.blockId ?? ""}
          onChange={(e) => setParam("block", e.target.value || null)}
        >
          <option value="">Bloque: todos</option>
          {(rubric?.blocks ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className="control" aria-label="Fechas" defaultValue="today">
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
        </select>
        {currentAgent && (
          <span className="chip">
            Ejecutivo: {currentAgent}
            <button type="button" aria-label="Quitar filtro de ejecutivo" onClick={clearAgent}>
              <X size={14} aria-hidden />
            </button>
          </span>
        )}
      </div>
      <p className="help -mt-1 mb-3">Las búsquedas por ejecutivo quedan registradas.</p>

      {queue.status === "error" ? (
        <ErrorState what="la cola" onRetry={() => void queue.reload()} />
      ) : !data ? (
        <LoadingState />
      ) : data.rows.length === 0 ? (
        filters.agentId ? (
          <EmptyState title={`Terminaste los casos pendientes de ${currentAgent}.`} body="Puedes seguir con el resto de la cola.">
            <Button variant="primary" onClick={clearAgent}>
              Ver toda la cola
            </Button>
            <Button onClick={() => void queue.reload()}>Mantener filtro</Button>
          </EmptyState>
        ) : (
          <EmptyState title="No hay casos con estos filtros." body="Prueba con otros filtros.">
            <Button onClick={() => router.replace("/queue")}>Limpiar filtros</Button>
          </EmptyState>
        )
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Llamada</th>
              <th>Ejecutivo</th>
              <th>Seguros</th>
              <th aria-sort="descending">Decisión del motor ↓</th>
              <th>Incumple</th>
              <th>Dudosos</th>
              <th>Duración</th>
              <th>En cola</th>
              {readOnly && <th>Auditor</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const lockedByOther = !!r.lockedBy && r.lockedBy.id !== user?.id;
              const open = () => router.push(`/calls/${r.id}`);
              return (
                <tr
                  key={r.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open();
                  }}
                >
                  <td className="tabular">{shortDateTime(r.callDate)}</td>
                  <td className="tabular font-semibold">{r.callId}</td>
                  <td>{r.agent.name}</td>
                  <td>{r.products.join(", ")}</td>
                  <td>
                    <span className="inline-flex gap-1.5">
                      {r.sampleCompliant ? (
                        <StatusBadge tone="teal" title="Llamada que la IA marcó como Cumple, incluida al azar para controlar la calidad de la IA.">
                          Muestra cumple
                        </StatusBadge>
                      ) : (
                        <CallVerdictBadge verdict={r.engineVerdict} />
                      )}
                      {r.hasCritical && <StatusBadge tone="ink">Crítico</StatusBadge>}
                      {r.status === "reopened" && <StatusBadge tone="fail">Reabierto</StatusBadge>}
                    </span>
                  </td>
                  <td className="num">{r.nonCompliantCount}</td>
                  <td className="num">{r.uncertainCount}</td>
                  <td className="num">{mmss(r.durationMs)}</td>
                  <td className="num">
                    {minutesAgo(r.queuedAt)}{" "}
                    {lockedByOther && (
                      <StatusBadge locked>{caseStatusLabel("in_review", "auditor", { lockedByName: r.lockedBy!.name })}</StatusBadge>
                    )}
                  </td>
                  {readOnly && <td>{r.lockedBy?.name ?? "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
