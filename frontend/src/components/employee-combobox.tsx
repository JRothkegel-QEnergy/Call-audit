"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/api/types";

/**
 * Búsqueda de ejecutivo con autocompletado (O-11). Devuelve el ID interno, nunca el nombre en la URL (L-18).
 * Los nombres repetidos se distinguen por equipo.
 */
export function EmployeeCombobox({ onSelect, width = 240 }: { onSelect: (agent: Agent) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .listAgents(query)
      .then((a) => alive && setAgents(a))
      .catch(() => alive && setAgents([]));
    return () => {
      alive = false;
    };
  }, [query]);

  const firstNames = agents.map((a) => a.name);
  const duplicated = (name: string) => firstNames.filter((n) => n.split(" ")[0] === name.split(" ")[0]).length > 1;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false} label="Buscar ejecutivo" style={{ width }}>
        <Popover.Anchor asChild>
          <Command.Input
            className="control search w-full"
            placeholder="Buscar ejecutivo"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if ((e.target as HTMLElement).closest("[cmdk-input]")) e.preventDefault();
            }}
            className="z-[60] rounded-md border border-border bg-card p-1 shadow-md"
            style={{ width }}
          >
            <Command.List>
              <Command.Empty className="px-2.5 py-2 text-[13px] text-muted-foreground">
                No encontramos ejecutivos con «{query}».
              </Command.Empty>
              {agents.map((a) => (
                <Command.Item
                  key={a.id}
                  value={a.id}
                  onSelect={() => {
                    onSelect(a);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="flex cursor-pointer flex-col rounded-sm px-2.5 py-1.5 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span className="font-medium">{a.name}</span>
                  {duplicated(a.name) && <span className="help">{a.team}</span>}
                </Command.Item>
              ))}
            </Command.List>
          </Popover.Content>
        </Popover.Portal>
      </Command>
    </Popover.Root>
  );
}
