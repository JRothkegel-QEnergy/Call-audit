"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/session";

/** Encabezado de las páginas del admin: muestra el cliente como texto, sin selector (un solo cliente en el MVP, H-62). */
export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  const { user } = useSession();
  return (
    <>
      {/* 23-modulo-de-calibracion: el calibrador no ve la empresa. */}
      {user?.role !== "qubico_verifier" && <p className="help m-0 mb-1">Empresa: {user?.clientName}</p>}
      {/* La cuenta de lectura (G13) no ve las acciones del encabezado: todas cambian algo. */}
      <PageHeader title={title} description={description} actions={user?.role === "qubico_viewer" ? undefined : actions} />
    </>
  );
}
