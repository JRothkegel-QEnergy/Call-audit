import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { InviteView } from "./invite-view";

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ token }) => <InviteView token={token} />)}</Suspense>;
}
