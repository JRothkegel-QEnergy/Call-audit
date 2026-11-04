import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { PatternDetailView } from "./pattern-detail";

export default function PatternDetailPage({ params }: PageProps<"/admin/discrepancies/patterns/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <PatternDetailView id={decodeURIComponent(id)} />)}</Suspense>;
}
