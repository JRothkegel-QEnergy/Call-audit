"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShortcutsDialog } from "@/components/dialogs/shortcuts-dialog";
import { LoadingState } from "@/components/ui/states";
import type { Role } from "@/lib/api/types";
import { useSession } from "@/lib/session";
import { isRealMode } from "@/lib/api";
import { NavCountsProvider } from "./nav-counts";
import { SidebarNav } from "./sidebar-nav";

/**
 * Rutas permitidas por rol (prefijos). El backend también valida el rol en cada endpoint.
 * El admin no ve dashboards de ejecutivos ni aprueba revisiones (H-60); comparte Discrepancias y Seguros.
 */
const COMMON = ["/calls/", "/settings"];
const ALLOWED: Record<Role, string[]> = {
  auditor: ["/queue", "/my-reviews", ...COMMON],
  supervisor: [
    "/analysis",
    "/dashboard",
    "/alerts",
    "/reviews",
    "/agents",
    "/auditors",
    "/queue",
    "/catalog",
    ...COMMON,
  ],
  qubico_admin: ["/admin", "/analysis", "/discrepancies", "/catalog", ...COMMON],
  qubico_viewer: ["/admin", "/analysis", ...COMMON],
  // Verificador (13-rol-verificador): solo la verificación; las rutas de la versión se filtran abajo.
  qubico_verifier: ["/verification", "/settings"],
};

/** El verificador entra a la pestaña Verificación de una versión, a sus listas y a la revisión del caso, nada más. */
const VERIFIER_PATH = /^\/admin\/prompts\/[^/]+\/(verification|calls)(\/|$)/;

function matchesPrefix(pathname: string, prefix: string) {
  const base = prefix.replace(/\/$/, "");
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function homeFor(role: Role) {
  if (role === "qubico_admin" || role === "qubico_viewer") return "/admin/stats";
  if (role === "qubico_verifier") return "/verification";
  // D-20/D-41: en modo real el supervisor entra a Calidad del servicio → Ejecutivos; Inicio sigue en el menú.
  if (role === "supervisor") return isRealMode ? "/analysis/agents" : "/dashboard";
  return "/queue";
}

/**
 * Las vistas del supervisor que dependían de revisiones confirmadas en la app (vacías hoy) llevan a
 * Calidad del servicio (F-4), también en la demo (pedido 2026-11-19).
 */
const REAL_MODE_REDIRECTS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/agents\/([^/]+)$/, (m) => `/analysis/agents/${m[1]}`],
  [/^\/agents\/?$/, () => "/analysis/agents"],
  [/^\/dashboard\/criteria\/?$/, () => "/analysis"],
  [/^\/auditors(\/.*)?$/, () => "/analysis"],
];

function realModeRedirect(role: Role, pathname: string): string | null {
  // Pedido 2026-11-19: también en la demo; esas vistas todavía no están disponibles.
  if (role !== "supervisor") return null;
  for (const [re, to] of REAL_MODE_REDIRECTS) {
    const m = pathname.match(re);
    if (m) return to(m);
  }
  return null;
}

export const ROLE_LABEL: Record<Role, string> = {
  auditor: "Auditor",
  supervisor: "Supervisor",
  qubico_admin: "Administrador Qubico",
  qubico_viewer: "Lectura Qubico",
  qubico_verifier: "Verificador",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const forbidden =
    !!user &&
    !ALLOWED[user.role].some((p) => matchesPrefix(pathname, p)) &&
    !(user.role === "qubico_verifier" && VERIFIER_PATH.test(pathname));

  const redirectTo = user ? realModeRedirect(user.role, pathname) : null;

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (forbidden) router.replace(homeFor(user.role));
    else if (redirectTo) router.replace(redirectTo);
  }, [ready, user, forbidden, redirectTo, router]);

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

  if (!ready || !user || forbidden || redirectTo) {
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
