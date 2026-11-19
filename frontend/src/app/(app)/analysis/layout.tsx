import { Suspense } from "react";
import { AnalysisFrame } from "@/components/analysis/frame";
import { LoadingState } from "@/components/ui/states";

/** «Calidad del servicio» (docs/ux/vistas-supervisor): el encabezado y la foto se cargan una vez para todas las pestañas. */
export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <AnalysisFrame>{children}</AnalysisFrame>
    </Suspense>
  );
}
