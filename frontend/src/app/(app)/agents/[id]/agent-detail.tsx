"use client";

import { ChevronLeft, Info, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/dialogs/export-dialog";
import { CallVerdictBadge, SourceBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { KpiCard, PageHeader } from "@/components/ui/page-header";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { AgentDetail, FollowUpStatus } from "@/lib/api/types";
import { pct, shortDate } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const FOLLOW_UP: Record<FollowUpStatus, [string, "neutral" | "teal" | "ink"]> = {
  pending: ["Pendiente", "neutral"],
  with_feedback: ["Con feedback", "teal"],
  handled: ["Gestionada", "ink"],
};

export function AgentDetailView({ id }: { id: string }) {
  const router = useRouter();
  const detail = useAsync(() => api.getAgentDetail(id), [id]);
  const [fbOpen, setFbOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => router.push("/agents")}>
        <ChevronLeft size={14} aria-hidden />
        Volver a Ejecutivos
      </Button>
      <AsyncView state={detail} what="la ficha del ejecutivo">
        {(d) => (
          <>
            <div className="mt-2">
              <PageHeader
                title={d.stats.agent.name}
                description={`${d.stats.agent.team} (ficticio)`}
                actions={
                  <>
                    <ExportButton count={d.stats.audited} />
                    <Button variant="primary" onClick={() => setFbOpen(true)}>
                      Registrar feedback
                    </Button>
                  </>
                }
              />
            </div>
            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              <KpiCard badge={<SourceBadge source="human" />} value={d.stats.audited} label="Llamadas auditadas" />
              <KpiCard badge={<SourceBadge source="human" />} value={pct(d.stats.finalCompliancePct, 0)} label="Cumplimiento final" />
              <KpiCard value={d.stats.pendingFollowUps} label="Seguimientos pendientes" />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="card">
                <b>Llamadas con hallazgos confirmados</b>
                <table className="tbl flat mt-2.5">
                  <tbody>
                    {d.confirmedCalls.map((c) => (
                      <tr key={c.caseId} className="clickable" onClick={() => router.push(`/calls/${c.caseId}?from=agents`)}>
                        <td className="tabular">{c.callId}</td>
                        <td>
                          <span className="vt vt-fail">
                            <X size={14} aria-hidden />
                            Incumple
                          </span>{" "}
                          Motivo {c.criterionId}
                        </td>
                        <td>
                          <StatusBadge tone={FOLLOW_UP[c.followUp][1]}>{FOLLOW_UP[c.followUp][0]}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card border-dashed shadow-none">
                <div className="flex items-center gap-2">
                  <b>Aún sin revisión humana</b>
                  <SourceBadge source="ai" />
                </div>
                <p className="help">No cuentan en los indicadores.</p>
                {d.aiOnlyCalls.length ? (
                  <table className="tbl flat">
                    <tbody>
                      {d.aiOnlyCalls.map((c) => (
                        <tr key={c.caseId}>
                          <td className="tabular">{c.callId}</td>
                          <td>
                            IA: <CallVerdictBadge verdict={c.engineVerdict} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="m-0">No hay llamadas pendientes de este ejecutivo.</p>
                )}
              </div>
            </div>
            <div className="card mt-3">
              <b>Historial de feedback</b>
              {d.feedback.length === 0 && <p className="help">Todavía no hay feedback registrado.</p>}
              {d.feedback.map((f) => (
                <p key={f.id} className="mb-0 mt-2">
                  <span className="help">
                    {shortDate(f.createdAt)} · {f.supervisorName}
                  </span>
                  <br />«{f.text}» {f.commitment && (
                    <>
                      <b>Compromiso:</b> {f.commitment}{" "}
                    </>
                  )}
                  {f.followUpDate && (
                    <>
                      <b>Seguimiento:</b> {shortDate(f.followUpDate)}.
                    </>
                  )}
                </p>
              ))}
            </div>
            <FeedbackDrawer
              open={fbOpen}
              onOpenChange={setFbOpen}
              detail={d}
              onSaved={() => {
                setFbOpen(false);
                toast("Feedback guardado. Las llamadas asociadas quedaron «Con feedback».");
                void detail.reload({ silent: true });
              }}
            />
          </>
        )}
      </AsyncView>
    </>
  );
}

function FeedbackDrawer({
  open,
  onOpenChange,
  detail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  detail: AgentDetail;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [commitment, setCommitment] = useState("");
  const [date, setDate] = useState("");
  const [cases, setCases] = useState<Set<string>>(new Set(detail.confirmedCalls.filter((c) => c.followUp === "pending").slice(0, 1).map((c) => c.caseId)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Registrar feedback a ${detail.stats.agent.name}`}>
      <div className="banner m-0">
        <Info size={14} aria-hidden className="flex-none" />
        <span>Es un registro tuyo de la conversación; no propone ni registra sanciones. No incluyas datos de clientes ni de salud.</span>
      </div>
      <label className="field">
        Feedback entregado
        <textarea autoFocus className="control" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="field">
        Compromiso
        <textarea className="control" rows={2} value={commitment} onChange={(e) => setCommitment(e.target.value)} />
      </label>
      <label className="field">
        Fecha de seguimiento (opcional)
        <input className="control" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <fieldset className="m-0 rounded-md border border-border px-3 py-2">
        <legend className="px-1 text-[13px] font-medium">Llamadas o motivos asociados</legend>
        {detail.confirmedCalls.map((c) => (
          <label key={c.caseId} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cases.has(c.caseId)}
              onChange={() =>
                setCases((s) => {
                  const n = new Set(s);
                  if (n.has(c.caseId)) n.delete(c.caseId);
                  else n.add(c.caseId);
                  return n;
                })
              }
            />
            {c.callId} · Motivo {c.criterionId}
          </label>
        ))}
      </fieldset>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            if (!text.trim()) return setError("Escribe el feedback que entregaste.");
            if (!cases.size) return setError("Agrega al menos una llamada o un motivo.");
            setBusy(true);
            try {
              await api.saveFeedback({
                agentId: detail.stats.agent.id,
                text: text.trim(),
                commitment: commitment.trim(),
                followUpDate: date || null,
                caseIds: [...cases],
              });
              setText("");
              setCommitment("");
              setDate("");
              onSaved();
            } catch {
              setError("No pudimos guardar el feedback. Intenta de nuevo.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar feedback
        </Button>
        <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
      </div>
    </Sheet>
  );
}
