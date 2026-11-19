"use client";

import { AlertTriangle, Check, PenLine, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import type { FollowUpCriterionChange, FollowUpRuleResult, RuleApplyState } from "@/lib/api/admin-types";
import { ApiError } from "@/lib/api/admin-types";
import { shortDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const STATE: Record<RuleApplyState, { label: string; Icon: typeof Check }> = {
  applied: { label: "Aplicada", Icon: Check },
  manual: { label: "Aplicada a mano", Icon: PenLine },
  free_text: { label: "Texto libre", Icon: Plus },
  review: { label: "Revisar", Icon: AlertTriangle },
};

type Piece = { kind: "same" | "add" | "del"; text: string };

/** Diff por palabras (LCS), conservando los espacios: los criterios son cortos. */
function diffWords(before: string, after: string): Piece[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Piece[] = [];
  const push = (kind: Piece["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return out;
}

function Changes({ before, after }: { before: string; after: string }) {
  if (before === after) return <p className="help m-0">Sin cambios en el criterio.</p>;
  return (
    <p className="m-0 whitespace-pre-wrap rounded-md border border-border bg-[var(--neutral-50)] p-3 text-[13px] leading-6">
      {diffWords(before, after).map((p, i) =>
        p.kind === "add" ? (
          <ins key={i} className="rounded-sm bg-accent text-accent-foreground underline decoration-1 underline-offset-2">
            <span className="sr-only">Agregado: </span>
            {p.text}
          </ins>
        ) : p.kind === "del" ? (
          <del key={i} className="rounded-sm bg-[var(--red-100)] text-[var(--red-800)] decoration-1">
            <span className="sr-only">Quitado: </span>
            {p.text}
          </del>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

function RuleLine({ rule, onRemove }: { rule: FollowUpRuleResult; onRemove: () => void }) {
  const { label, Icon } = STATE[rule.state];
  return (
    <li className="grid gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={rule.state === "review" ? "vt vt-doubt" : "st"}>
          <Icon size={13} aria-hidden /> {label}
        </span>
        <span className="flex-1 text-[13px]">
          {rule.action === "replace" ? (
            <>
              <b>Reemplazar</b> «{rule.find}» por “{rule.text}”
            </>
          ) : rule.action === "append" ? (
            <>
              <b>Agregar</b> · “{rule.text}”
            </>
          ) : (
            <>
              <b>Texto libre</b> · “{rule.text}” · Se agregará al final del criterio; revisa dónde va.
            </>
          )}
        </span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Quitar esta regla
        </Button>
      </div>
      {rule.reviewReason && <span className="text-[13px] text-[var(--amber-800)]">{rule.reviewReason}</span>}
      <span className="help">
        Patrón #{rule.patternRank} · aceptada por {rule.acceptedBy} el {shortDateTime(rule.acceptedAt)}
      </span>
    </li>
  );
}

function CriterionCard({
  c,
  version,
  override,
  onOverride,
  onRemove,
}: {
  c: FollowUpCriterionChange;
  version: string;
  override: string | undefined;
  onOverride: (text: string | undefined) => void;
  onRemove: (rule: FollowUpRuleResult) => void;
}) {
  const editing = override !== undefined;
  const review = c.rules.some((r) => r.state === "review");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing]);
  return (
    <section className="card grid gap-3" aria-labelledby={`motive-${c.criterionId}`} style={review ? { borderLeft: "3px solid var(--amber-600)" } : undefined}>
      <h2 id={`motive-${c.criterionId}`} tabIndex={-1} className="m-0 text-[15px]">
        Criterio {c.criterionId} · {c.title}
      </h2>
      <ul className="m-0 grid list-none gap-2 p-0">
        {c.rules.map((r) => (
          <RuleLine key={r.proposalId} rule={r} onRemove={() => onRemove(r)} />
        ))}
      </ul>
      <div className="grid gap-1.5">
        <b className="text-[13px]">Cambios</b>
        <Changes before={c.before} after={c.after} />
      </div>
      {editing ? (
        <label className="field">
          Texto final del criterio · Criterio {c.criterionId}
          <textarea ref={areaRef} className="control min-h-[120px] text-[13px] leading-5" value={override} onChange={(e) => onOverride(e.target.value)} />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <Button size="sm" onClick={() => onOverride(undefined)}>
            Volver al texto generado
          </Button>
        ) : (
          <Button size="sm" onClick={() => onOverride(c.after)}>
            Editar el texto final
          </Button>
        )}
      </div>
      <div className="grid gap-1">
        <b className="text-[13px]">Historial que se agregará</b>
        <ul className="m-0 pl-5 text-[13px]">
          {c.rules
            .filter((r) => r.state !== "review")
            .map((r) => (
              <li key={r.proposalId}>
                {version} · Análisis de discrepancias · {r.historyNote}
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

/** «Nueva versión desde Seguimiento» (Cambio 18 §8.3): las reglas aceptadas aplicadas a la regla de aplicación de cada criterio. */
export function FollowUpReview({ proposalIds, onBaseVersion }: { proposalIds: string[]; onBaseVersion?: (version: string) => void }) {
  const router = useRouter();
  const [removed, setRemoved] = useState<{ rule: FollowUpRuleResult; criterionId: number }[]>([]);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [sent, setSent] = useState<Record<number, string>>({});
  const [attempt, setAttempt] = useState(0);
  // Lo que el admin escribe; mientras no lo toque, versión, «Qué cambió» y «Por qué» vienen de la comparación.
  const [edits, setEdits] = useState<{ model?: string; changelog?: string; rationale?: string }>({});
  const [busy, setBusy] = useState<"test" | "draft" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState(false);
  const restoreRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const active = proposalIds.filter((id) => !removed.some((r) => r.rule.proposalId === id));

  // La comparación se recalcula 300 ms después de dejar de escribir en un texto final.
  useEffect(() => {
    const t = setTimeout(() => setSent(overrides), 300);
    return () => clearTimeout(t);
  }, [overrides]);
  const models = useAsync(() => api.listModels(), []);
  const preview = useAsync(
    async () => (active.length ? api.previewPromptFromFollowUp({ proposalIds: active, overrides: sent }) : null),
    [active.join(","), JSON.stringify(sent), attempt],
  );
  const p = preview.data;
  useEffect(() => {
    if (p?.baseVersion) onBaseVersion?.(p.baseVersion);
  }, [p?.baseVersion, onBaseVersion]);
  const form = p ? { model: edits.model ?? p.model, changelog: edits.changelog ?? p.changelog, rationale: edits.rationale ?? p.rationale } : null;
  const setForm = (patch: typeof edits) => setEdits((e) => ({ ...e, ...patch }));

  const code = preview.error instanceof ApiError ? preview.error.message : null;
  if (!proposalIds.length || code === "not_accepted" || code === "no_rules")
    return (
      <div className="card grid gap-3">
        <p className="m-0">Estas reglas ya no están aceptadas o ya se incluyeron en una versión.</p>
        <div>
          <Link className="btn" href="/admin/discrepancies?tab=followup">
            Volver a Seguimiento
          </Link>
        </div>
      </div>
    );
  if (code === "mixed_base") {
    const versions = preview.error instanceof ApiError ? preview.error.errors : [];
    const list = versions.length ? ` (${versions.map((v) => `v${v}`).join(" y ")})` : "";
    return (
      <div className="card grid gap-3">
        <p className="m-0">
          Estas reglas salen de análisis de distintas versiones del prompt{list}, y una versión nueva parte de una sola. Vuelve a Seguimiento y marca solo reglas de un mismo análisis.
        </p>
        <div>
          <Link className="btn" href="/admin/discrepancies?tab=followup">
            Volver a Seguimiento
          </Link>
        </div>
      </div>
    );
  }
  if (code === "no_yaml")
    return (
      <div className="card grid gap-3">
        <p className="m-0">La versión base no tiene prompt.yaml. Súbelo en Prompt para crear versiones desde aquí.</p>
        <div>
          <Link className="btn" href="/admin/prompts">
            Ir a Prompt
          </Link>
        </div>
      </div>
    );
  if (preview.status === "error" && !p) return <ErrorState what="la comparación" onRetry={() => void preview.reload()} />;

  const criteria = active.length ? (p?.criteria ?? []) : [];
  const review = criteria.flatMap((c) => c.rules.filter((r) => r.state === "review").map(() => c));
  const ruleCount = criteria.reduce((n, c) => n + c.rules.length, 0);
  const blocked = !active.length ? "No queda ninguna regla. Vuelve a agregar alguna o cancela." : review.length ? `Resuelve ${review.length} ${review.length === 1 ? "regla" : "reglas"} para revisar: edita el texto final o quita la regla.` : null;

  const remove = (rule: FollowUpRuleResult, criterionId: number) => {
    setRemoved((r) => [...r, { rule, criterionId }]);
    setTimeout(() => restoreRefs.current.get(rule.proposalId)?.focus(), 0);
  };
  const restore = (id: string) => setRemoved((r) => r.filter((x) => x.rule.proposalId !== id));
  const setOverride = (cid: number, text: string | undefined) =>
    setOverrides((o) => {
      const next = { ...o };
      if (text === undefined) delete next[cid];
      else next[cid] = text;
      return next;
    });

  const create = async (test: boolean) => {
    if (!p || !form || blocked) return;
    setBusy(test ? "test" : "draft");
    setErrors([]);
    try {
      const created = await api.createPromptFromFollowUp({
        baseVersion: p.baseVersion,
        proposalIds: active,
        overrides,
        model: form.model,
        changelog: form.changelog.trim(),
        rationale: form.rationale.trim() || null,
      });
      toast(`Borrador v${created.version} creado con ${active.length} ${active.length === 1 ? "regla" : "reglas"}.`);
      router.push(`/admin/prompts/${encodeURIComponent(created.version)}${test ? "?test=1" : ""}`);
    } catch (err) {
      if (err instanceof ApiError && ["base_changed", "rules_changed"].includes(err.message)) setConflict(true);
      else if (err instanceof ApiError && err.errors.length) setErrors(err.errors);
      else if (err instanceof ApiError && err.message === "review_pending") setErrors(["Quedan reglas para revisar."]);
      else setErrors(["No pudimos crear el borrador. Revisa tu conexión e inténtalo de nuevo."]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid max-w-[980px] gap-4">
      <p className="m-0 text-[13px]" role="status">
        {!p && preview.status === "loading"
          ? "Aplicando las reglas…"
          : active.length
            ? `${ruleCount} ${ruleCount === 1 ? "regla" : "reglas"} en ${criteria.length} ${criteria.length === 1 ? "criterio" : "criterios"}${review.length ? ` · ${review.length} para revisar` : ""}`
            : "No queda ninguna regla."}
      </p>
      {review.length > 0 && (
        <ul className="m-0 pl-5 text-[13px]">
          {[...new Set(review)].map((c) => (
            <li key={c.criterionId}>
              <a href={`#motive-${c.criterionId}`} onClick={(e) => (e.preventDefault(), document.getElementById(`motive-${c.criterionId}`)?.focus())}>
                Criterio {c.criterionId} · {c.rules.find((r) => r.state === "review")?.reviewReason}
              </a>
            </li>
          ))}
        </ul>
      )}
      {conflict && (
        <div className="error-state" role="alert">
          <p className="m-0">La versión base o las reglas cambiaron mientras revisabas. Vuelve a generar la comparación; tus ediciones manuales se perderán.</p>
          <Button
            size="sm"
            onClick={() => {
              setConflict(false);
              setOverrides({});
              setSent({});
              setAttempt((a) => a + 1);
            }}
          >
            Generar de nuevo
          </Button>
        </div>
      )}
      {!p && preview.status === "loading" && <LoadingState />}
      {p &&
        criteria.map((c) => (
          <CriterionCard key={c.criterionId} c={c} version={p.version} override={overrides[c.criterionId]} onOverride={(t) => setOverride(c.criterionId, t)} onRemove={(r) => remove(r, c.criterionId)} />
        ))}
      {removed.length > 0 && (
        <section className="card grid gap-2" aria-label="Reglas quitadas">
          <b className="text-[13px]">Quitadas · siguen «Aceptada» en Seguimiento</b>
          {removed.map(({ rule, criterionId }) => (
            <div key={rule.proposalId} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-[13px] line-through decoration-1">
                Criterio {criterionId} · “{rule.text}”
              </span>
              <Button size="sm" ref={(el) => void restoreRefs.current.set(rule.proposalId, el)} onClick={() => restore(rule.proposalId)}>
                Volver a agregar
              </Button>
            </div>
          ))}
        </section>
      )}
      {p && form && (
        <section className="card grid gap-3" aria-label="Datos de la versión">
          <div className="flex flex-wrap gap-4">
            <div className="field">
              Versión
              <span className="tabular">{p.version}</span>
              <span className="help">Basada en v{p.baseVersion}{p.baseIsActive ? " (vigente)" : ""}.</span>
            </div>
            <label className="field">
              Modelo de la prueba
              <select className="control" value={form.model} onChange={(e) => setForm({ model: e.target.value })}>
                {(models.data ?? [{ name: form.model }]).map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Qué cambió (obligatorio)
            <textarea className="control" rows={2} value={form.changelog} onChange={(e) => setForm({ changelog: e.target.value })} />
          </label>
          <label className="field">
            Por qué (opcional)
            <textarea className="control" rows={3} value={form.rationale} onChange={(e) => setForm({ rationale: e.target.value })} />
          </label>
        </section>
      )}
      {errors.length > 0 && (
        <div className="error-state" role="alert">
          <ul className="m-0 pl-5 text-[13px]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="sticky bottom-0 z-10 border-t border-border bg-card py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" loading={busy === "test"} disabled={!!blocked || !p || !form?.changelog.trim() || busy !== null} aria-describedby={blocked ? "follow-up-blocked" : undefined} onClick={() => void create(true)}>
            Crear borrador y probar
          </Button>
          <Button loading={busy === "draft"} disabled={!!blocked || !p || !form?.changelog.trim() || busy !== null} aria-describedby={blocked ? "follow-up-blocked" : undefined} onClick={() => void create(false)}>
            Solo crear borrador
          </Button>
          <Link className="btn" href="/admin/discrepancies?tab=followup">
            Cancelar
          </Link>
          {blocked && (
            <span id="follow-up-blocked" className="help">
              {blocked}
            </span>
          )}
          {!blocked && form && !form.changelog.trim() && <span className="help">Cuenta qué cambió en esta versión.</span>}
        </div>
      </div>
    </div>
  );
}
