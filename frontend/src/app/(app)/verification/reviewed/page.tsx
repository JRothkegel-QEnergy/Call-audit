import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { TrayView } from "../tray-view";

/** «Revisadas» del verificador (18-verificador-bandeja-y-revisadas, W4 A). */
export default function VerificationReviewedPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TrayView tray="reviewed" />
    </Suspense>
  );
}
