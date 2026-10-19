"use client";

import { SquareCheckBig } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/dialogs/export-dialog";
import { useNavCounts } from "@/components/shell/nav-counts";
import { CallVerdictBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { AsyncView, EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { PendingApproval } from "@/lib/api/types";
import { durationText, plural, shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { REVIEW_FLAG_LABEL } from "@/lib/verdicts";

const MAX_BATCH = 50; // D-19 · H-30
const UNDO_MS = 10_000; // H-38

export default function ReviewsPage() {
  const router = useRouter();
  const { refresh } = useNavCounts();
  const approvals = useAsync(() => api.listPendingApprovals(), []);
  const [lane, setLane] = useState<"clean" | "flagged">("clean");
  const [auditor, setAuditor] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => (approvals.data ?? []).filter((a) => !auditor || a.auditorId === auditor), [approvals.data, auditor]);
  const clean = all.filter((a) => a.flags.length === 0);
  const flagged = all.filter((a) => a.flags.length > 0);
  const auditors = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of approvals.data ?? []) m.set(a.auditorId, a.auditorName);
    return [...m.entries()];
  }, [approvals.data]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BATCH) next.add(id);
      else toast(`Puedes aprobar hasta ${MAX_BATCH} revisiones por lote.`);
      return next;
    });

  const selection = clean.filter((a) => selected.has(a.caseId));

  const approveBatch = async () => {
    const ids = selection.map((a) => a.caseId);
    setBusy(true);
    try {
      await api.approveReviews(ids, { batch: true });
      setConfirmOpen(false);
      setSelected(new Set());
      await approvals.reload({ silent: true });
      refresh();
      toast(`${plural(ids.length, "revisión aprobada", "revisiones aprobadas")}.`, {
        duration: UNDO_MS,
        action: {
          label: "Deshacer",
          onClick: async () => {
            await api.undoApprovals(ids);
            await approvals.reload({ silent: true });
            refresh();
            toast("Aprobación deshecha.");
          },
        },
      });
    } catch {
      toast("No pudimos aprobar el lote. Ninguna revisión cambió; intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Revisiones por aprobar"
        description="Aprueba, reabre o cambia las revisiones antes de que cuenten en los indicadores."
        actions={<ExportButton />}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="control" aria-label="Auditor" value={auditor} onChange={(e) => setAuditor(e.target.value)}>
          <option value="">Auditor: todos</option>
          {auditors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select className="control" aria-label="Fechas">
          <option>Ayer y hoy</option>
        </select>
        <select className="control" aria-label="Motivo">
          <option>Motivo: todos</option>
        </select>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={lane === "clean"} onClick={() => setLane("clean")}>
          Sin señales <span className="cnt">{clean.length}</span>
        </button>
        <button type="button" role="tab" className="tab" aria-selected={lane === "flagged"} onClick={() => setLane("flagged")}>
          Con señales <span className="cnt">{flagged.length}</span>
        </button>
      </div>

      <AsyncView state={approvals} what="las revisiones">
        {() =>
          all.length === 0 ? (
            <EmptyState title="Estás al día." body="No hay revisiones por aprobar." />
          ) : lane === "clean" ? (
            <>
              <p className="help mb-2.5 mt-0">Coinciden con la IA, no tienen correcciones ni escalamientos, y su tiempo de revisión es normal.</p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => setSelected(new Set(clean.slice(0, MAX_BATCH).map((a) => a.caseId)))} disabled={!clean.length}>
                  Seleccionar las primeras {MAX_BATCH}
                </Button>
                <span className="help" aria-live="polite">
                  {plural(selection.length, "seleccionada", "seleccionadas")} · máximo {MAX_BATCH} por lote
                </span>
                <Button variant="primary" className="ml-auto" disabled={!selection.length} onClick={() => setConfirmOpen(true)}>
                  <SquareCheckBig size={14} aria-hidden />
                  Aprobar seleccionadas
                </Button>
              </div>
              {clean.length === 0 ? (
                <EmptyState title="No hay revisiones sin señales." body="Revisa el carril «Con señales»." />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <span className="sr-only">Seleccionar</span>
                      </th>
                      <th>Llamada</th>
                      <th>Auditor</th>
                      <th>Fecha</th>
                      <th>Decisión</th>
                      <th>Tiempo de revisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clean.map((a) => (
                      <tr key={a.caseId}>
                        <td>
                          <input type="checkbox" aria-label={`Seleccionar ${a.callId}`} checked={selected.has(a.caseId)} onChange={() => toggle(a.caseId)} />
                        </td>
                        <td className="tabular font-semibold">
                          <a href={`/calls/${a.caseId}?from=reviews`} onClick={(e) => (e.preventDefault(), router.push(`/calls/${a.caseId}?from=reviews`))}>
                            {a.callId}
                          </a>
                        </td>
                        <td>{a.auditorName}</td>
                        <td className="tabular">{shortDateTime(a.submittedAt)}</td>
                        <td>
                          <CallVerdictBadge verdict={a.finalVerdict} />
                        </td>
                        <td className="num">{durationText(a.reviewSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : flagged.length === 0 ? (
            <EmptyState title="No hay revisiones con señales." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Llamada</th>
                  <th>Auditor</th>
                  <th>Señal</th>
                  <th>Motivo de corrección</th>
                  <th>Tiempo de revisión</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((a) => {
                  const open = () => router.push(`/calls/${a.caseId}?from=reviews`);
                  return (
                    <tr key={a.caseId} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                      <td className="tabular font-semibold">{a.callId}</td>
                      <td>{a.auditorName}</td>
                      <td>
                        <span className="inline-flex flex-wrap gap-1">
                          {a.flags.map((f) => (
                            <StatusBadge key={f} tone="doubt">
                              {REVIEW_FLAG_LABEL[f]}
                            </StatusBadge>
                          ))}
                        </span>
                      </td>
                      <td>{a.correctionReasons.join(", ") || "—"}</td>
                      <td className="num">{durationText(a.reviewSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </AsyncView>

      <BatchDialog open={confirmOpen} onOpenChange={setConfirmOpen} selection={selection} busy={busy} onConfirm={approveBatch} />
    </>
  );
}

function BatchDialog({
  open,
  onOpenChange,
  selection,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selection: PendingApproval[];
  busy: boolean;
  onConfirm: () => void;
}) {
  const byAuditor = new Map<string, number>();
  for (const a of selection) byAuditor.set(a.auditorName, (byAuditor.get(a.auditorName) ?? 0) + 1);
  const nc = selection.filter((a) => a.finalVerdict === "non_compliant").length;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`¿Aprobar ${plural(selection.length, "revisión", "revisiones")}?`}
      footer={
        <>
          <Button variant="primary" loading={busy} onClick={onConfirm} autoFocus>
            Aprobar {plural(selection.length, "revisión", "revisiones")}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
        </>
      }
    >
      <div className="summary-box">
        <span>
          {plural(selection.length, "caso", "casos")} · {nc} No cumple · {selection.length - nc} Cumple
        </span>
        {[...byAuditor.entries()].map(([name, n]) => (
          <span key={name} className="help">
            {name}: {n}
          </span>
        ))}
      </div>
      <p className="m-0">
        <b>Quedarán marcadas como aprobadas en lote con tu nombre.</b>
      </p>
    </Dialog>
  );
}
