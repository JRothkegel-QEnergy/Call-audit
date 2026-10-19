"use client";

import { Download, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CallVerdictBadge, SourceBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api, isRealMode } from "@/lib/api";
import type { DiscrepancyBranch, DiscrepancyClassification, DiscrepancyRow } from "@/lib/api/types";
import { pct, shortDateTime } from "@/lib/format";
import { useRubric } from "@/lib/rubric";
import { useAsync } from "@/lib/use-async";

/** Ramas en el orden de las pestañas (09 §3.1): la prioritaria primero. */
const BRANCHES: { key: DiscrepancyBranch; label: string; help: string }[] = [
  { key: "ai_only_fail", label: "Solo la IA detectó", help: "La IA dice No cumple y el cliente dice Cumple. Clasifica si la IA tenía razón." },
  { key: "ai_missed_fail", label: "Omitidos por la IA", help: "La IA dice Cumple y el cliente dice No cumple." },
  { key: "ai_uncertain", label: "IA dudosa", help: "La IA no se decidió, con cualquier veredicto del cliente." },
  { key: "match", label: "Coinciden", help: "La IA y el cliente dan el mismo veredicto de llamada." },
];

const CLASS_LABEL: Record<DiscrepancyClassification, string> = { ai_correct: "La IA acertó", ai_wrong: "La IA se equivocó" };

export default function DiscrepanciesPage() {
  const router = useRouter();
  const rubric = useRubric();
  const rows = useAsync(() => api.listDiscrepancies(), []);
  const [branch, setBranch] = useState<DiscrepancyBranch>("ai_only_fail");
  const [presentationFilter, setPresentationFilter] = useState<"all" | "pending">("all");
  const [classifying, setClassifying] = useState<{ row: DiscrepancyRow; value: DiscrepancyClassification } | null>(null);

  const counts = useMemo(() => {
    const data = rows.data ?? [];
    const by = (b: DiscrepancyBranch) => data.filter((r) => r.branch === b);
    return {
      total: data.length,
      match: by("match").length,
      aiOnly: by("ai_only_fail").length,
      aiOnlyPending: by("ai_only_fail").filter((r) => !r.classification).length,
      missed: by("ai_missed_fail").length,
      uncertain: by("ai_uncertain").length,
    };
  }, [rows.data]);

  const visible = (rows.data ?? []).filter(
    (r) => r.branch === branch && (presentationFilter === "all" || r.presentation === "pending"),
  );

  const unclassify = async (r: DiscrepancyRow) => {
    await api.classifyDiscrepancy(r.caseId, { classification: null, criterionIds: [] });
    void rows.reload({ silent: true });
  };

  return (
    <>
      <PageHeader
        title="Discrepancias con el cliente"
        description="Compara la IA con la auditoría del cliente en las llamadas que traen su veredicto."
        actions={
          isRealMode ? undefined : (
            <Button onClick={() => toast("Estamos preparando el archivo. Te avisaremos cuando esté listo.")}>
              <Download size={14} aria-hidden />
              Exportar rama
            </Button>
          )
        }
      />
      <AsyncView state={rows} what="las discrepancias">
        {(data) =>
          data.length === 0 ? (
            <EmptyState
              title="Este periodo no trae veredictos del cliente."
              body="Las discrepancias aparecen cuando un lote incluye la auditoría del cliente."
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <SourceBadge source="client" />
                <span className="help">Referencia: auditoría del cliente · {data.length} llamadas</span>
              </div>
              <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <Metric label="Coinciden" value={`${counts.match}`} hint={`${pct((counts.match / counts.total) * 100)} de coincidencia con el cliente`} />
                <Metric label="Solo la IA detectó" value={`${counts.aiOnly}`} hint={`${counts.aiOnlyPending} sin clasificar`} strong />
                <Metric label="Omitidos por la IA" value={`${counts.missed}`} />
                <Metric label="IA dudosa" value={`${counts.uncertain}`} />
              </div>

              <div className="tabs" role="tablist">
                {BRANCHES.map((b) => (
                  <button key={b.key} type="button" role="tab" className="tab" aria-selected={branch === b.key} onClick={() => setBranch(b.key)}>
                    {b.label} <span className="cnt">{data.filter((r) => r.branch === b.key).length}</span>
                  </button>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="help m-0">{BRANCHES.find((b) => b.key === branch)!.help}</p>
                {branch === "ai_only_fail" && (
                  <select
                    className="control ml-auto"
                    aria-label="Seguimiento"
                    value={presentationFilter}
                    onChange={(e) => setPresentationFilter(e.target.value as "all" | "pending")}
                  >
                    <option value="all">Seguimiento: todos</option>
                    <option value="pending">Por presentar al cliente</option>
                  </select>
                )}
              </div>

              {visible.length === 0 ? (
                <EmptyState title="No hay llamadas en esta rama." />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Llamada</th>
                      <th>Fecha</th>
                      <th>Ejecutivo</th>
                      <th>IA</th>
                      <th>Cliente</th>
                      <th>Auditor de la app</th>
                      <th>Motivos de la IA que incumplen</th>
                      {branch === "ai_only_fail" && <th>Clasificación</th>}
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.caseId}>
                        <td className="tabular font-semibold">
                          <a
                            href={`/calls/${r.caseId}?from=discrepancies`}
                            onClick={(e) => {
                              e.preventDefault();
                              router.push(`/calls/${r.caseId}?from=discrepancies`);
                            }}
                          >
                            {r.callId}
                          </a>
                        </td>
                        <td className="tabular">{shortDateTime(r.callDate)}</td>
                        <td>{r.agentName}</td>
                        <td>
                          <CallVerdictBadge verdict={r.aiVerdict} />
                        </td>
                        <td>
                          <CallVerdictBadge verdict={r.clientVerdict} />
                        </td>
                        <td>{r.appAuditorVerdict ? <CallVerdictBadge verdict={r.appAuditorVerdict} /> : "—"}</td>
                        <td className="whitespace-normal">
                          {r.aiFailCriteria.length
                            ? r.aiFailCriteria.map((c) => (
                                <span key={c} className="mr-1.5" title={rubric?.criteria[c]?.name}>
                                  Motivo {c}
                                </span>
                              ))
                            : "—"}
                        </td>
                        {branch === "ai_only_fail" && (
                          <td>
                            {r.classification ? (
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                <StatusBadge tone={r.classification === "ai_correct" ? "teal" : "doubt"}>{CLASS_LABEL[r.classification]}</StatusBadge>
                                {r.classification === "ai_correct" && (
                                  <label className="help inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={r.presentation === "presented"}
                                      onChange={async (e) => {
                                        await api.setPresentation(r.caseId, e.target.checked);
                                        void rows.reload({ silent: true });
                                      }}
                                    />
                                    {r.presentation === "presented" ? "Presentado" : "Por presentar al cliente"}
                                  </label>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => void unclassify(r)}>
                                  Cambiar
                                </Button>
                              </span>
                            ) : (
                              <div className="seg" role="radiogroup" aria-label={`¿La IA tenía razón en ${r.callId}?`}>
                                {(["ai_correct", "ai_wrong"] as const).map((v) => (
                                  <button key={v} type="button" role="radio" aria-checked={false} onClick={() => setClassifying({ row: r, value: v })}>
                                    {CLASS_LABEL[v]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        )}
                        <td className="num">
                          {r.notesCount ? (
                            <span className="inline-flex items-center gap-1" aria-label={`${r.notesCount} notas`}>
                              <StickyNote size={14} aria-hidden />
                              {r.notesCount}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )
        }
      </AsyncView>

      {classifying && (
        <ClassifyDialog
          row={classifying.row}
          value={classifying.value}
          criterionName={(c) => rubric?.criteria[c]?.name ?? ""}
          onClose={() => setClassifying(null)}
          onDone={() => {
            setClassifying(null);
            toast("Clasificación guardada.");
            void rows.reload({ silent: true });
          }}
        />
      )}
    </>
  );
}

function Metric({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="card" style={strong ? { borderColor: "var(--primary)" } : undefined}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-semibold leading-[34px] tabular">{value}</div>
      {hint && <div className="help">{hint}</div>}
    </div>
  );
}

function ClassifyDialog({
  row,
  value,
  criterionName,
  onClose,
  onDone,
}: {
  row: DiscrepancyRow;
  value: DiscrepancyClassification;
  criterionName: (c: number) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [criteria, setCriteria] = useState<number[]>(row.aiFailCriteria);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrong = value === "ai_wrong";
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${CLASS_LABEL[value]} · ${row.callId}`}
      footer={
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!criteria.length) return setError("Elige al menos un motivo.");
              if (wrong && !note.trim()) return setError("Explica qué entendió mal la IA. Sirve para ajustar el prompt.");
              setBusy(true);
              try {
                await api.classifyDiscrepancy(row.caseId, { classification: value, criterionIds: criteria, note: note.trim() || undefined });
                onDone();
              } catch {
                setError("No pudimos guardar la clasificación. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar clasificación
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
        </>
      }
    >
      <fieldset className="m-0 rounded-md border border-border px-3 py-2">
        <legend className="px-1 text-[13px] font-medium">¿En qué motivos?</legend>
        {row.aiFailCriteria.map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={criteria.includes(c)}
              onChange={() => setCriteria((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]))}
            />
            Motivo {c} · {criterionName(c)}
          </label>
        ))}
      </fieldset>
      <label className="field">
        {wrong ? "Explica qué entendió mal la IA. Sirve para ajustar el prompt." : "Nota (opcional)"}
        <textarea autoFocus className="control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <span className="help">No escribas RUT, nombres ni datos de salud del cliente.</span>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}
