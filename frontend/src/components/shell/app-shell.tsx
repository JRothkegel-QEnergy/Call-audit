"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShortcutsDialog } from "@/components/dialogs/shortcuts-dialog";
import { LoadingState } from "@/components/ui/states";
import type { Role } from "@/lib/api/types";
import { useSession } from "@/lib/session";
import { NavCountsProvider } from "./nav-counts";
import { SidebarNav } from "./sidebar-nav";

/**
 * Rutas permitidas por rol (prefijos). El backend también valida el rol en cada endpoint.
 * El admin no ve dashboards de ejecutivos ni aprueba revisiones (H-60); comparte Discrepancias y Seguros.
 */
const COMMON = ["/calls/", "/settings"];
const ALLOWED: Record<Role, string[]> = {
  auditor: ["/queue", "/my-reviews", ...COMMON],
  supervisor: ["/dashboard", "/alerts", "/reviews", "/agents", "/auditors", "/discrepancies", "/queue", "/catalog", ...COMMON],
  qubico_admin: ["/admin", "/discrepancies", "/catalog", ...COMMON],
};

function matchesPrefix(pathname: string, prefix: string) {
  const base = prefix.replace(/\/$/, "");
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function homeFor(role: Role) {
  if (role === "qubico_admin") return "/admin/stats";
  return role === "supervisor" ? "/dashboard" : "/queue";
}

export const ROLE_LABEL: Record<Role, string> = {
  auditor: "Auditor",
  supervisor: "Supervisor",
  qubico_admin: "Administrador Qubico",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const forbidden = !!user && !ALLOWED[user.role].some((p) => matchesPrefix(pathname, p));

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (forbidden) router.replace(homeFor(user.role));
  }, [ready, user, forbidden, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag && ["input", "textarea", "select"].includes(tag)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready || !user || forbidden) {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );
  }

  // En el detalle de llamada la sidebar se colapsa sola para dar ancho (05 §1.1).
  const isDetail = pathname.startsWith("/calls/");
  const isCollapsed = collapsed || isDetail;

  return (
    <NavCountsProvider role={user.role}>
      <div
        className="grid min-h-screen"
        style={{ gridTemplateColumns: `${isCollapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)"} 1fr` }}
      >
        <SidebarNav
          user={user}
          collapsed={isCollapsed}
          canToggle={!isDetail}
          onToggle={() => setCollapsed((c) => !c)}
          onShortcuts={() => setShortcutsOpen(true)}
        />
        <main id="main" className="min-w-0 px-7 pb-10 pt-6">
          {children}
        </main>
      </div>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </NavCountsProvider>
  );
}
