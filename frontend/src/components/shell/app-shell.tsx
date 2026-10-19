"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShortcutsDialog } from "@/components/dialogs/shortcuts-dialog";
import { LoadingState } from "@/components/ui/states";
import type { Role } from "@/lib/api/types";
import { useSession } from "@/lib/session";
import { NavCountsProvider } from "./nav-counts";
import { SidebarNav } from "./sidebar-nav";

/** Rutas que solo ve el supervisor. El backend también debe validar el rol en cada endpoint. */
const SUPERVISOR_ONLY = ["/dashboard", "/alerts", "/reviews", "/agents", "/auditors", "/discrepancies"];
const AUDITOR_ONLY = ["/my-reviews"];

export function homeFor(role: Role) {
  return role === "supervisor" ? "/dashboard" : "/queue";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const forbidden =
    !!user &&
    ((user.role === "auditor" && SUPERVISOR_ONLY.some((p) => pathname.startsWith(p))) ||
      (user.role === "supervisor" && AUDITOR_ONLY.some((p) => pathname.startsWith(p))));

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
