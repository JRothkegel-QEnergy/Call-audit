"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Dialog / AlertDialog del design system (radio 12, sombra lg). Escape y clic afuera cierran. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer: React.ReactNode;
  width?: number;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[rgb(13_15_18/0.45)]" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-[81] grid max-h-[calc(100vh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 gap-3 overflow-auto rounded-xl bg-card p-5 shadow-lg"
          style={{ maxWidth: width }}
        >
          <RadixDialog.Title className="m-0 text-lg font-semibold leading-6">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description asChild>
              <div>{description}</div>
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children}
          <div className="mt-1 flex flex-wrap gap-2">{footer}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Sheet lateral (drawer): feedback del ejecutivo y ficha del seguro bajo 1280 px. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[70] bg-[rgb(13_15_18/0.2)]" />
        <RadixDialog.Content
          className={cn(
            "fixed bottom-0 right-0 top-0 z-[71] grid w-[min(440px,100%)] content-start gap-3 overflow-auto border-l border-border bg-card p-5 shadow-lg",
            className,
          )}
        >
          <div className="flex items-center">
            <RadixDialog.Title className="m-0 text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close className="btn btn-ghost ml-auto" aria-label="Cerrar">
              <X size={16} aria-hidden />
            </RadixDialog.Close>
          </div>
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
