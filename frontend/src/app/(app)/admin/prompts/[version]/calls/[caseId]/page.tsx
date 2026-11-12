import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import type { AgreementSegment } from "@/lib/api/admin-types";
import { CaseReviewView } from "./case-review";

export default function PromptCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string; caseId: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      {Promise.all([params, searchParams]).then(([{ version, caseId }, { segment }]) => (
        <CaseReviewView
          version={decodeURIComponent(version)}
          caseId={decodeURIComponent(caseId)}
          segment={(segment as AgreementSegment | undefined) ?? null}
        />
      ))}
    </Suspense>
  );
}
