"use client";

import * as Popover from "@radix-ui/react-popover";
import { CircleHelp } from "lucide-react";
import { useId } from "react";

/**
 * Leyenda "?" de una métrica (docs/ux/admin-prompt-metrics §4). Abre con clic, toque, Enter o Espacio; cierra con
 * Esc o clic fuera y devuelve el foco al botón. No abre con hover (WCAG 1.4.13).
 */
export function MetricHelp({ title, children }: { title: string; children: React.ReactNode }) {
  const titleId = useId();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Qué significa: ${title}`}
          className="ml-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CircleHelp size={14} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={4}
          collisionPadding={16}
          aria-labelledby={titleId}
          className="z-[60] max-w-[min(320px,calc(100vw-32px))] rounded-md border border-border bg-card p-3 text-left text-sm font-normal normal-case leading-snug text-foreground shadow-md"
        >
          <p id={titleId} className="m-0 mb-1 font-semibold">
            {title}
          </p>
          <div className="m-0 whitespace-normal">{children}</div>
          <Popover.Arrow className="fill-[var(--border)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
