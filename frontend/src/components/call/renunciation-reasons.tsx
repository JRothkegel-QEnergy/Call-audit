"use client";

/**
 * Modal de motivos de renuncia del criterio 18 (docs/ux/vistas-supervisor/10-criterios-y-motivos-de-renuncia.md §5).
 * Dos variantes: «llamada» (tipificación + sugerencias de la IA + lista plegada) y «agregada» (cómo se evalúa + lista
 * abierta). Solo lectura. La lista oficial sale del prompt de la capa 2 (`/api/reference/renunciation-reasons`).
 */
import * as RadixDialog from "@radix-ui/react-dialog";
import { ListChecks } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemVerdictBadge } from "@/components/ui/badges";
import { api } from "@/lib/api";
import type { RenunciationReasons, SuggestedReason, Typification, Verdict } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { QuoteWarning } from "./suggested-reasons";
import { typificationLabel } from "./typification";

export const RENUNCIATION_CRITERION = 18;
const CRITERION_NAME = "Tipifica motivo de renuncia incorrecto";
const HOW =
  "Cumple si el motivo tipificado tiene sentido con lo que dijo el cliente, aunque no sea el más exacto de la lista. Si el cliente dio varias razones, basta con que calce con una. No cumple si no tiene relación con lo que dijo o lo contradice. «Retracto» solo vale si se cumplen sus condiciones.";
const ORDINAL = ["1.º", "2.º", "3.º", "4.º", "5.º"];

export interface RenunciationCall {
  typification: Typification | null | undefined;
  verdict?: Verdict | null;
  suggestedReasons?: SuggestedReason[];
}

/** Lista oficial, una sola carga por sesión de la página. */
let cached: Promise<RenunciationReasons> | null = null;
function loadReasons() {
  cached ??= api.getRenunciationReasons().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\s]+$/, "")
    .toLowerCase()
    .trim();

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="m-0 text-[13px] font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function OfficialList({ data, typified, suggested }: { data: RenunciationReasons; typified?: string | null; suggested: string[] }) {
  return (
    <ul className="m-0 grid list-none gap-x-4 gap-y-1 p-0 text-[13px] sm:grid-cols-2">
      {data.reasons.map((r) => {
        const isTyp = typified && norm(typified) === norm(r);
        const sug = suggested.findIndex((s) => norm(s) === norm(r));
        return (
          <li key={r} className={cn("rounded px-1.5 py-0.5", (isTyp || sug >= 0) && "bg-neutral-100 font-medium")}>
            {r}
            {isTyp && <span className="help"> · Tipificado</span>}
            {sug >= 0 && <span className="help"> · Sugerido {ORDINAL[sug] ?? `${sug + 1}.º`}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function RenunciationReasonsDialog({
  open,
  onOpenChange,
  call,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  call?: RenunciationCall;
}) {
  const [data, setData] = useState<RenunciationReasons | null>(null);
  const [failed, setFailed] = useState(false);
  const [showList, setShowList] = useState(!call);
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadReasons()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, attempt]);

  const suggested = call?.suggestedReasons ?? [];
  const typified = call?.typification?.reason ?? null;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[rgb(31_42_55/0.45)]" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-[81] grid max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-auto rounded-xl bg-card p-5 shadow-lg"
          onOpenAutoFocus={(e) => {
            // El foco va al título para que el lector empiece por el contenido (§5.5).
            e.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <div>
            <RadixDialog.Title ref={titleRef} tabIndex={-1} className="m-0 text-lg font-semibold leading-6 outline-none">
              Motivos de renuncia
            </RadixDialog.Title>
            <RadixDialog.Description className="help m-0 mt-0.5 flex flex-wrap items-center gap-2">
              Criterio {RENUNCIATION_CRITERION} · {CRITERION_NAME}
              {call?.verdict && <ItemVerdictBadge verdict={call.verdict} />}
            </RadixDialog.Description>
          </div>

          {call && (
            <>
              <Section title="Tipificó el ejecutivo">
                <p className={cn("m-0 text-[13px]", !typified && "text-muted-foreground")}>
                  {call.typification ? typificationLabel(call.typification, { short: true }) : "No informado en el lote"}
                </p>
              </Section>
              <Section title="Sugiere la IA">
                {call.verdict === "compliant" ? (
                  <p className="m-0 text-[13px]">La IA considera que el motivo tipificado calza con lo que dijo el cliente.</p>
                ) : suggested.length ? (
                  <ol className="m-0 grid list-decimal gap-1 pl-5 text-[13px]">
                    {suggested.map((s) => (
                      <li key={s.reason}>
                        <b className="font-medium">{s.reason}</b>
                        {s.quote && <div className="pl-2 italic text-muted-foreground">«{s.quote}»</div>}
                        {s.quote && !s.quoteValidated && <QuoteWarning />}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="help m-0">Esta corrida no trae sugerencias de la IA.</p>
                )}
              </Section>
            </>
          )}

          {!call && (
            <Section title="Cómo se evalúa">
              <p className="m-0 text-[13px]">{HOW}</p>
            </Section>
          )}

          <Section title={`Lista de motivos de renuncia${data ? ` (${data.reasons.length})` : ""}`}>
            {failed ? (
              <div className="help flex flex-wrap items-center gap-2">
                No pudimos cargar la lista de motivos de renuncia. Intenta de nuevo.
                <button type="button" className="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                  Reintentar
                </button>
              </div>
            ) : !data ? (
              <p className="help m-0">Cargando…</p>
            ) : (
              <>
                {call && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm justify-self-start"
                    aria-expanded={showList}
                    onClick={() => setShowList(!showList)}
                  >
                    {showList ? "Ocultar la lista" : "Ver la lista completa"}
                  </button>
                )}
                {showList && <OfficialList data={data} typified={typified} suggested={suggested.map((s) => s.reason)} />}
              </>
            )}
          </Section>

          {call && (
            <Section title="Cómo se evalúa">
              <p className="m-0 text-[13px]">{HOW}</p>
            </Section>
          )}

          <p className="help m-0">Lista oficial de la corredora{data ? ` · regla según el prompt ${data.promptVersion}` : ""}</p>
          <div>
            <RadixDialog.Close className="btn">Cerrar</RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Disparador del modal. No dibuja nada si el criterio no es el 18 (§5.2: «cada vez que aparece el criterio 18»).
 * - `text`: botón con ícono y «Motivos de renuncia» (checklist, detalle de llamada).
 * - `icon`: botón ícono de 24 px junto a «Criterio 18 · …» (tablas, fichas, gráficos).
 * - `number`: el número del encabezado de un mapa de calor pasa a ser el botón (`children`).
 */
export function RenunciationReasonsButton({
  criterionId,
  call,
  variant = "icon",
  children,
  className,
}: {
  criterionId: number;
  call?: RenunciationCall;
  variant?: "text" | "icon" | "number";
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (criterionId !== RENUNCIATION_CRITERION) return <>{children}</>;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const common = {
    type: "button" as const,
    "aria-haspopup": "dialog" as const,
    onClick: (e: React.MouseEvent) => {
      // Nunca reemplaza el clic de la fila o celda: es un control aparte.
      e.stopPropagation();
      e.preventDefault();
      setOpen(true);
    },
    onKeyDown: stop,
  };
  return (
    <>
      {variant === "text" ? (
        <button {...common} className={cn("btn btn-ghost btn-sm gap-1", className)}>
          <ListChecks size={14} aria-hidden />
          Motivos de renuncia
        </button>
      ) : variant === "number" ? (
        <button
          {...common}
          aria-label={`Ver motivos de renuncia del criterio ${RENUNCIATION_CRITERION}`}
          className={cn("inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center underline decoration-dotted underline-offset-2", className)}
        >
          {children}
        </button>
      ) : (
        <>
          {children}
          <button
            {...common}
            aria-label={`Ver motivos de renuncia del criterio ${RENUNCIATION_CRITERION}`}
            title="Motivos de renuncia"
            className={cn(
              "ml-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded align-middle text-muted-foreground hover:bg-neutral-100 hover:text-foreground",
              className,
            )}
          >
            <ListChecks size={14} aria-hidden />
          </button>
        </>
      )}
      <RenunciationReasonsDialog open={open} onOpenChange={setOpen} call={call} />
    </>
  );
}
