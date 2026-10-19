import { Button } from "./button";

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h2 className="m-0 mb-1.5 text-lg font-semibold">{title}</h2>
      {body && <p className="m-0 mb-4 text-muted-foreground">{body}</p>}
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <b className="mb-1 block">No pudimos cargar {what}.</b>
      <span className="help">Revisa tu conexión e intenta de nuevo.</span>
      {onRetry && (
        <div className="mt-2.5">
          <Button variant="primary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="card" aria-busy="true">
      <div className="skel" style={{ width: "35%" }} />
      <div className="skel" />
      <div className="skel" />
      <div className="skel" style={{ width: "65%" }} />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Renderiza los estados de una carga async con los componentes estándar. */
export function AsyncView<T>({
  state,
  what,
  children,
}: {
  state: { status: "loading" | "success" | "error"; data: T | undefined; reload: () => unknown };
  what: string;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "error") return <ErrorState what={what} onRetry={() => void state.reload()} />;
  if (state.data === undefined) return <LoadingState />;
  return <>{children(state.data)}</>;
}

/** Estadísticas que el backend v0 todavía no calcula (Cambio 10 de UX, punto 3a). */
export function UnavailableStats() {
  return <EmptyState title="Estas estadísticas todavía no están disponibles. Las activaremos en una próxima versión." />;
}
