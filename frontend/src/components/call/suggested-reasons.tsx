import { AlertTriangle } from "lucide-react";
import type { SuggestedReason } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export function QuoteWarning() {
  return (
    <div className="my-1.5 flex items-start gap-1.5 rounded-sm border border-[var(--red-200)] bg-[var(--red-100)] px-2 py-1.5 text-xs text-[var(--red-800)]">
      <AlertTriangle size={14} aria-hidden className="mt-px flex-none" />
      Esta cita no aparece tal cual en la transcripción. Verifícala en el audio.
    </div>
  );
}

/** Motivo 18: motivos de renuncia que sugiere la IA (prompt v2.8+). Sin sugerencias no se muestra nada.
 * `plainQuotes` (revisión del admin, 12-motivos-sugeridos-en-revision.md S3): la cita va sin la caja ámbar, que en esa
 * tarjeta es la evidencia del veredicto que se escucha. */
export function SuggestedReasons({ reasons, plainQuotes = false }: { reasons: SuggestedReason[] | undefined; plainQuotes?: boolean }) {
  if (!reasons?.length) return null;
  return (
    <div className="mt-1.5">
      <div className="text-xs font-semibold text-muted-foreground">Motivos de renuncia que sugiere la IA</div>
      <ol className="m-0 mt-1 grid list-decimal gap-1 pl-5 text-[13px]">
        {reasons.map((s) => (
          <li key={s.reason}>
            <b className="font-medium">{s.reason}</b>
            {s.quote && (
              <div className={cn(plainQuotes ? "pl-2 italic text-muted-foreground" : "quote")}>
                {plainQuotes ? `«${s.quote}»` : `“${s.quote}”`}
              </div>
            )}
            {s.quote && !s.quoteValidated && <QuoteWarning />}
          </li>
        ))}
      </ol>
    </div>
  );
}
