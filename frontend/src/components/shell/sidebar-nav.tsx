"use client";

import {
  BarChart3,
  Bell,
  FlaskConical,
  GitCompareArrows,
  History,
  Inbox,
  Keyboard,
  FileSpreadsheet,
  LayoutDashboard,
  List,
  PanelLeft,
  Settings,
  ShieldCheck,
  SquareCheckBig,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { DemoDialog } from "@/components/dialogs/demo-dialog";
import type { User } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { useNavCounts } from "./nav-counts";
import { isRealMode } from "@/lib/api";

interface Item {
  label: string;
  href: string;
  icon: typeof Inbox;
  count?: number;
  alert?: boolean;
  /** Rutas hijas que también marcan el ítem como activo. */
  match?: string[];
}

export function SidebarNav({
  user,
  collapsed,
  canToggle,
  onToggle,
  onShortcuts,
}: {
  user: User;
  collapsed: boolean;
  canToggle: boolean;
  onToggle: () => void;
  onShortcuts: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useSession();
  const { counts } = useNavCounts();
  const [demoOpen, setDemoOpen] = useState(false);

  const items: Item[] =
    user.role === "auditor"
      ? [
          { label: "Cola", href: "/queue", icon: Inbox, count: counts.queue, match: ["/calls/"] },
          { label: "Mis revisiones", href: "/my-reviews", icon: History, count: counts.reopened, alert: true },
        ]
      : [
          { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
          { label: "Alertas", href: "/alerts", icon: Bell, count: counts.alerts, alert: true },
          { label: "Revisiones", href: "/reviews", icon: SquareCheckBig, count: counts.approvals, match: ["/calls/"] },
          { label: "Ejecutivos", href: "/agents", icon: Users },
          { label: "Motivos", href: "/dashboard/criteria", icon: BarChart3 },
          { label: "Auditores", href: "/auditors", icon: ShieldCheck },
          { label: "Cola", href: "/queue", icon: List },
          { label: "Discrepancias", href: "/discrepancies", icon: GitCompareArrows },
          // Cambio 11: solo con el permiso manage_catalog (D-28).
          ...(user.permissions.includes("manage_catalog")
            ? [{ label: "Seguros", href: "/catalog", icon: FileSpreadsheet }]
            : []),
        ];

  const isActive = (it: Item) => {
    if (it.href === "/dashboard") return pathname === "/dashboard";
    return pathname === it.href || pathname.startsWith(it.href + "/") || !!it.match?.some((m) => pathname.startsWith(m));
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const rowClass = cn(
    "relative flex h-9 w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left font-medium text-neutral-800 no-underline hover:bg-muted",
    collapsed && "justify-center px-0",
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky top-0 flex h-screen flex-col gap-0.5 border-r border-border bg-card px-2.5 py-4"
    >
      <div className={cn("flex items-center gap-2.5 px-2 pb-[18px]", collapsed && "justify-center px-0")}>
        <LogoMark size={30} />
        {!collapsed && (
          <span>
            <Wordmark className="block text-[15px] leading-none" />
            <small className="mt-[3px] block text-xs text-muted-foreground">Auditoría de llamadas</small>
          </span>
        )}
      </div>

      {items.map((it) => {
        const active = isActive(it);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            title={it.label}
            className={cn(rowClass, active && "bg-accent font-semibold text-accent-foreground hover:bg-accent")}
          >
            {active && <span aria-hidden className="absolute -left-2.5 bottom-1.5 top-1.5 w-[3px] rounded-r-sm bg-primary" />}
            <Icon size={18} aria-hidden />
            {!collapsed && <span>{it.label}</span>}
            {!!it.count &&
              (collapsed ? (
                <span aria-hidden className={cn("absolute right-3 top-1.5 h-2 w-2 rounded-full bg-primary", it.alert && "bg-red-700")} />
              ) : (
                <span className={cn("nav-badge", it.alert && "nav-badge-alert")} aria-label={`${it.count} pendientes`}>
                  {it.count}
                </span>
              ))}
          </Link>
        );
      })}

      <div className="mt-auto grid gap-0.5 border-t border-border pt-2.5">
        {canToggle && (
          <button type="button" className={rowClass} onClick={onToggle} title={collapsed ? "Expandir menú" : "Colapsar menú"}>
            <PanelLeft size={18} aria-hidden />
            {!collapsed && <span>{collapsed ? "Expandir" : "Colapsar"} menú</span>}
          </button>
        )}
        <button type="button" className={rowClass} onClick={onShortcuts} title="Atajos de teclado">
          <Keyboard size={18} aria-hidden />
          {!collapsed && <span>Atajos de teclado</span>}
        </button>
        <Link href="/settings" className={rowClass} title="Preferencias">
          <Settings size={18} aria-hidden />
          {!collapsed && <span>Preferencias</span>}
        </Link>
        {!isRealMode && (
          <button type="button" className={rowClass} onClick={() => setDemoOpen(true)} title="Opciones de la demo">
            <FlaskConical size={18} aria-hidden />
            {!collapsed && <span>Opciones de la demo</span>}
          </button>
        )}
        <button
          type="button"
          className={rowClass}
          title="Cerrar sesión"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
            {initials}
          </span>
          {!collapsed && (
            <span className="leading-4">
              {user.name}
              <br />
              <small className="help">{user.role === "auditor" ? "Auditora" : "Supervisor"} · Cerrar sesión</small>
            </span>
          )}
        </button>
      </div>
      {!isRealMode && <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />}
    </nav>
  );
}
