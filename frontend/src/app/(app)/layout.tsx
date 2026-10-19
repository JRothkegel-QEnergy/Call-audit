import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { LoadingState } from "@/components/ui/states";

export default function AppLayout({ children }: LayoutProps<"/">) {
  // El shell lee la ruta y la sesión en el navegador; Suspense evita bloquear el prerender.
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
