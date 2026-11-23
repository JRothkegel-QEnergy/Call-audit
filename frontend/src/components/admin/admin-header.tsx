"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/session";

/** Encabezado de las páginas del admin: muestra el cliente como texto, sin selector (un solo cliente en el MVP, H-62). */
export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  const { user } = useSession();
  return (
    <>
      <p className="help m-0 mb-1">Cliente: {user?.clientName}</p>
      <PageHeader title={title} description={description} actions={actions} />
    </>
  );
}
