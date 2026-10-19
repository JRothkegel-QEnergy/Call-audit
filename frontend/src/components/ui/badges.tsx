import { Building2, Check, HelpCircle, Lock, X } from "lucide-react";
import type { CallVerdict, Verdict } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { CALL_VERDICT, ITEM_VERDICT, type Tone } from "@/lib/verdicts";

const ICON: Record<Tone, typeof Check> = { fail: X, doubt: HelpCircle, pass: Check };

/** Resultado de un motivo: rectangular (Cumple / Incumple / Dudoso). */
export function ItemVerdictBadge({ verdict }: { verdict: Verdict }) {
  const { label, tone } = ITEM_VERDICT[verdict];
  const Icon = ICON[tone];
  return (
    <span className={cn("vt", `vt-${tone}`)}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}

/** Veredicto de la llamada: píldora (Cumple / No cumple / Dudosa). */
export function CallVerdictBadge({ verdict }: { verdict: CallVerdict }) {
  const { label, tone } = CALL_VERDICT[verdict];
  const Icon = ICON[tone];
  return (
    <span className={cn("ct", `ct-${tone}`)}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  locked,
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "ink" | "fail" | "doubt";
  locked?: boolean;
  title?: string;
}) {
  if (tone === "fail" || tone === "doubt") {
    return (
      <span className={cn("vt", `vt-${tone}`)} title={title}>
        {children}
      </span>
    );
  }
  return (
    <span className={cn("st", tone === "teal" && "st-teal", tone === "ink" && "st-ink")} title={title}>
      {locked && <Lock size={12} aria-hidden />}
      {children}
    </span>
  );
}

/** Fuente del dato: "Según IA" (contorno punteado) o "Confirmado" (sólido tinta). */
export function SourceBadge({ source }: { source: "ai" | "human" | "queue" | "client" }) {
  if (source === "client")
    return (
      <span
        className="src border-solid"
        title="Veredicto de la auditoría del cliente. En su planilla: Aprobado = Cumple · Rechazado = No cumple."
      >
        <Building2 size={12} aria-hidden />
        Auditoría del cliente
      </span>
    );
  if (source === "human")
    return (
      <span className="src src-human" title="Dato revisado por una persona">
        Confirmado
      </span>
    );
  if (source === "queue") return <span className="src">Cola</span>;
  return (
    <span className="src" title="Dato aún sin revisión humana">
      Según IA
    </span>
  );
}
