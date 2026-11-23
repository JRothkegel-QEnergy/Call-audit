import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { PromptVersionView } from "./prompt-version";

export default function PromptVersionPage({ params }: PageProps<"/admin/prompts/[version]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ version }) => <PromptVersionView version={decodeURIComponent(version)} />)}</Suspense>;
}
