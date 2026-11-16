import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { VerificationView } from "./verification-view";

export default function PromptVerificationPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      {params.then(({ version }) => (
        <VerificationView version={decodeURIComponent(version)} />
      ))}
    </Suspense>
  );
}
