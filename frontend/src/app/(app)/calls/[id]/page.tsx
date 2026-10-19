import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { CallDetail } from "./call-detail";

export default function CallPage({ params }: PageProps<"/calls/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <CallDetail id={id} />)}</Suspense>;
}
