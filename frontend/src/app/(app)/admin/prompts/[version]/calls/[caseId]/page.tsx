import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import type { CallList } from "@/lib/api/admin-types";
import { dirFromParam, discrepancyFromParam, sortFromParam, trayFromParam } from "@/lib/verification-scope";
import { CaseReviewView } from "./case-review";

type Search = {
  segment?: string;
  motivo?: string;
  criterio?: string;
  fuente?: string;
  asignadas?: string;
  bandeja?: string;
  discrepancia?: string;
  orden?: string;
  dir?: string;
};

export default function PromptCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string; caseId: string }>;
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      {Promise.all([params, searchParams]).then(([{ version, caseId }, q]) => {
        // Las listas mandan el criterio como `motivo`; `criterio` queda por los enlaces antiguos.
        const criterion = q.motivo ?? q.criterio;
        const sort = sortFromParam(q.orden ?? null);
        return (
          <CaseReviewView
            version={decodeURIComponent(version)}
            caseId={decodeURIComponent(caseId)}
            segment={(q.segment as CallList | undefined) ?? null}
            criterion={criterion ? Number(criterion) : null}
            scope={{
              source: q.fuente === "full" ? "full" : "test",
              assignee: q.asignadas ?? null,
              tray: trayFromParam(q.bandeja ?? null),
              discrepancy: discrepancyFromParam(q.discrepancia ?? null),
              sort,
              dir: sort ? (dirFromParam(q.dir ?? null) ?? "asc") : null,
            }}
          />
        );
      })}
    </Suspense>
  );
}
