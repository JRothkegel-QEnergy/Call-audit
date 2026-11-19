"use client";

/**
 * Piezas de «Calidad del servicio» (docs/ux/vistas-supervisor/08-alta-fidelidad.md §2). Textos de 06-ux-writing.md.
 * Nada depende solo del color: cada fuente lleva ícono y texto, y cada barra repite su valor en texto (1.4.1).
 */
import { Info, Sparkles, TriangleAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnalysisSnapshotMeta, AnalysisSource, CriterionStatus } from "@/lib/api/analysis-types";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { useSession } from "@/lib/session";

/** Porcentaje en listas: sin decimales (06 §1). */
export const pct0 = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} %`);
/** Porcentaje en el detalle: un decimal con coma. */
export const pct1 = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);
export const ptsText = (v: number | null | undefined) =>
  v == null ? "—" : v === 0 ? "±0 pts" : `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))} pts`;

// ---- Filtros en la URL (§4.5) ----

export function useAnalysisParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = (k: string) => params.get(k) ?? "";
  const set = (changes: Record<string, string | number | null | undefined>, opts?: { keepPage?: boolean }) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    // Cambiar un filtro reinicia la página.
    if (!opts?.keepPage && !("page" in changes)) next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  return {
    type: get("type"),
    flow: get("flow"),
    criterion: get("criterion") ? Number(get("criterion")) : undefined,
    page: Math.max(1, Number(get("page")) || 1),
    all: get("all") === "true",
    params,
    set,
    clear: () => router.push(pathname),
  };
}

/** Lleva los filtros de tipo y flujo a otra ruta de la sección. */
export function withFilters(path: string, f: { type?: string; flow?: string }, extra: Record<string, string | number | undefined> = {}) {
  const q = new URLSearchParams();
  if (f.type) q.set("type", f.type);
  if (f.flow) q.set("flow", f.flow);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

// ---- Encabezado de la sección ----

/** D-31: la referencia es el auditor; la banda dice cuántas llamadas vienen de la app y cuántas de la planilla. */
function referenceText(meta: AnalysisSnapshotMeta) {
  const parts = [
    meta.reference.auditor ? `${meta.reference.auditor} revisadas en la app` : null,
    meta.reference.sheet ? `${meta.reference.sheet} de la planilla${meta.sheetUntil ? ` hasta ${shortDate(meta.sheetUntil)}` : ""}` : null,
  ].filter(Boolean);
  return parts.length ? ` · auditor: ${parts.join(" · ")}` : "";
}

export function SnapshotBand({ meta }: { meta: AnalysisSnapshotMeta }) {
  const mixed = meta.runs.perCall !== meta.runs.perCriterion;
  return (
    <div className="banner mb-3 flex-wrap" role="note">
      <span className="tabular">
        Datos al {shortDate(meta.createdAt)} ·{" "}
        {mixed ? (
          <>
            por llamada: corrida {meta.runs.perCall} · por criterio: corrida {meta.runs.perCriterion}
          </>
        ) : (
          <>corrida {meta.runs.perCall}</>
        )}
        {referenceText(meta)}
        {meta.filters.flows.length === 1 ? ` · flujo ${meta.filters.flows[0]}` : ""}
      </span>
      {mixed && <span className="help">Las cifras por llamada y por criterio vienen de versiones distintas de la IA.</span>}
      {!meta.reference.auditor && !meta.reference.sheet && (
        <span className="help">Esta foto no trae revisiones del auditor ni planilla de calidad. Se muestra solo lo que marcó la IA.</span>
      )}
    </div>
  );
}

const TABS = [
  // D-41: Criterios, por ahora, solo para Qubico; el supervisor entra por Ejecutivos.
  { href: "/analysis/criteria", label: "Criterios", qubicoOnly: true },
  { href: "/analysis/agents", label: "Ejecutivos" },
  { href: "/analysis/evaluators", label: "Auditores", qubicoOnly: true },
  { href: "/analysis/reports", label: "Informes" },
];

export function useIsQubico() {
  const { user } = useSession();
  return user?.role === "qubico_admin" || user?.role === "qubico_viewer";
}

/** Primera pestaña que ve cada rol: Criterios para Qubico, Ejecutivos para el supervisor (D-41). */
export const analysisHome = (qubico: boolean) => (qubico ? "/analysis/criteria" : "/analysis/agents");

/** Las pestañas son rutas: navegación con aria-current, no tablist (08 §2). */
export function AnalysisTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qubico = useIsQubico();
  const f = { type: params.get("type") ?? "", flow: params.get("flow") ?? "" };
  return (
    <nav className="tabs" aria-label="Secciones de Calidad del servicio">
      {TABS.filter((t) => !t.qubicoOnly || qubico).map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href === "/analysis/reports" ? t.href : withFilters(t.href, f)}
            className="tab"
            aria-current={active ? "page" : undefined}
            data-state={active ? "active" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function FilterBar({
  meta,
  children,
  announce,
}: {
  meta: AnalysisSnapshotMeta;
  children?: React.ReactNode;
  announce?: string;
}) {
  const p = useAnalysisParams();
  const active = !!(p.type || p.flow || p.criterion);
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <label className="field">
        <span className="text-[13px] font-medium">Tipo de seguro</span>
        <select className="control" value={p.type} onChange={(e) => p.set({ type: e.target.value })}>
          <option value="">Todos</option>
          {meta.filters.insuranceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {/* C-04: con un solo flujo el filtro no sirve; la banda lo dice como texto. */}
      {meta.filters.flows.length > 1 && (
        <label className="field">
          <span className="text-[13px] font-medium">Flujo</span>
          <select className="control" value={p.flow} onChange={(e) => p.set({ flow: e.target.value })}>
            <option value="">Todos</option>
            {meta.filters.flows.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
      {children}
      {active && (
        <button type="button" className="btn btn-ghost" onClick={p.clear}>
          Quitar filtros
        </button>
      )}
      {announce && (
        <span className="sr-only" role="status">
          {announce}
        </span>
      )}
    </div>
  );
}

// ---- Fuente, barras, estados ----

export function SourceChip({ source }: { source: AnalysisSource }) {
  if (source === "sheet")
    return (
      <span className="src border-solid">
        <UserCheck size={12} aria-hidden />
        Según el auditor
      </span>
    );
  if (source === "mismatch")
    return (
      <span className="src border-solid">
        <TriangleAlert size={12} aria-hidden />
        La IA y el auditor no coinciden
      </span>
    );
  return (
    <span className="src">
      <Sparkles size={12} aria-hidden />
      Según la IA
    </span>
  );
}

/** Barras pareadas IA / auditor (decorativas: el valor va en texto al lado). */
export function PairedBars({ ai, sheet, max = 100 }: { ai: number; sheet: number | null; max?: number }) {
  const w = (v: number) => `${Math.max(2, Math.min(100, (100 * v) / Math.max(max, 1)))}%`;
  return (
    <span aria-hidden className="inline-grid w-24 gap-0.5 align-middle">
      <span className="block h-1.5 rounded-sm" style={{ width: w(ai), background: "var(--analysis-ai)" }} />
      {sheet != null && (
        <span
          className="block h-1.5 rounded-sm border"
          style={{
            width: w(sheet),
            borderColor: "var(--analysis-sheet)",
            background:
              "repeating-linear-gradient(135deg, var(--analysis-sheet) 0 2px, color-mix(in srgb, var(--analysis-sheet) 40%, white) 2px 4px)",
          }}
        />
      )}
    </span>
  );
}

const STATUS: Record<CriterionStatus, { label: string; tone: string; icon?: typeof Info }> = {
  consistent: { label: "Parejo", tone: "st" },
  divergent: { label: "Se marca distinto", tone: "vt vt-doubt", icon: TriangleAlert },
  data_explained: { label: "Explicado por los datos", tone: "st", icon: Info },
  na: { label: "Sin auditor", tone: "st" },
};

export function CriterionStatusBadge({ status }: { status: CriterionStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={s.tone}>
      {Icon && <Icon size={12} aria-hidden />}
      {s.label}
    </span>
  );
}

/** Cifra que lleva a sus llamadas. Sin llamadas detrás (href null) se muestra igual, pero no enlaza. */
export function MetricLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) return <span className="tabular">{children}</span>;
  return (
    <Link href={href} aria-label={label} className="tabular inline-flex min-h-6 min-w-6 items-center font-semibold text-teal-700 underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export function DeviationText({ pts, equal }: { pts: number; equal: number }) {
  if (Math.abs(pts) <= equal) return <span>Igual que el equipo</span>;
  const v = Math.abs(Math.round(pts));
  return pts > 0 ? <span className="font-semibold">+{v} pts sobre el equipo</span> : <span>−{v} pts bajo el equipo</span>;
}

export function LowSampleMark() {
  return <span className="help"> · pocas llamadas</span>;
}

export function HelpList({ items }: { items: [string, string][] }) {
  return (
    <ul className="help mt-2 grid list-none gap-1 p-0">
      {items.map(([term, text]) => (
        <li key={term}>
          <b>{term}:</b> {text}
        </li>
      ))}
    </ul>
  );
}

export function NoticeDataExplained({ note }: { note: string }) {
  return (
    <div className="banner mb-3" role="note">
      <Info size={16} aria-hidden />
      <span>{note}</span>
    </div>
  );
}

export function rowClass(lowSample: boolean) {
  return cn(lowSample && "[&>td]:bg-neutral-50");
}
