import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { TrayView } from "./tray-view";

/** Inicio del verificador: «Por revisar» (18-verificador-bandeja-y-revisadas, W1 A). */
export default function VerificationPendingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TrayView tray="pending" />
    </Suspense>
  );
}
