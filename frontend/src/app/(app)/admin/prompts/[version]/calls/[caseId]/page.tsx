import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import type { CallList } from "@/lib/api/admin-types";
import { CaseReviewView } from "./case-review";

export default function PromptCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string; caseId: string }>;
  searchParams: Promise<{ segment?: string; motivo?: string; fuente?: string; asignadas?: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      {Promise.all([params, searchParams]).then(([{ version, caseId }, { segment, motivo, fuente, asignadas }]) => (
        <CaseReviewView
          version={decodeURIComponent(version)}
          caseId={decodeURIComponent(caseId)}
          segment={(segment as CallList | undefined) ?? null}
          criterion={motivo ? Number(motivo) : null}
          scope={{ source: fuente === "full" ? "full" : "test", assignee: asignadas ?? null }}
        />
      ))}
    </Suspense>
  );
}
