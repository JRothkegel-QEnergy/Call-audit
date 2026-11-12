import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { CallsListView } from "./calls-list";

export default function PromptCallsPage({ params }: { params: Promise<{ version: string }> }) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ version }) => <CallsListView version={decodeURIComponent(version)} />)}</Suspense>;
}
