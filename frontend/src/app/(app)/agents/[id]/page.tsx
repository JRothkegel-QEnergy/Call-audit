import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { AgentDetailView } from "./agent-detail";

export default function AgentPage({ params }: PageProps<"/agents/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <AgentDetailView id={id} />)}</Suspense>;
}
