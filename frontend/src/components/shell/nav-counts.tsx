"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api/types";

interface Counts {
  queue: number;
  reopened: number;
  alerts: number;
  approvals: number;
}

const ZERO: Counts = { queue: 0, reopened: 0, alerts: 0, approvals: 0 };
const Ctx = createContext<{ counts: Counts; refresh: () => void }>({ counts: ZERO, refresh: () => {} });

/** Contadores de la sidebar. Se recalculan al navegar y cuando una pantalla llama a refresh(). */
export function NavCountsProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const [counts, setCounts] = useState<Counts>(ZERO);
  const pathname = usePathname();
  const refresh = useCallback(() => {
    const load = async () => {
      try {
        if (role === "qubico_admin") return;
        if (role === "auditor") {
          const [q, mine] = await Promise.all([api.listQueue(), api.listMyReviews()]);
          setCounts({ ...ZERO, queue: q.total, reopened: mine.filter((m) => m.status === "reopened").length });
        } else {
          const [alerts, approvals, q] = await Promise.all([api.listAlerts("new"), api.listPendingApprovals(), api.listQueue()]);
          setCounts({ ...ZERO, alerts: alerts.length, approvals: approvals.length, queue: q.total });
        }
      } catch {
        // Los contadores son informativos: si fallan, se mantienen los anteriores.
      }
    };
    void load();
  }, [role]);
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);
  return <Ctx.Provider value={{ counts, refresh }}>{children}</Ctx.Provider>;
}

export function useNavCounts() {
  return useContext(Ctx);
}
