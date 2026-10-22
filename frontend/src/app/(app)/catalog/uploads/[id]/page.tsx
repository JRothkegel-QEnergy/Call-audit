import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { UploadReview } from "./upload-review";

export default function UploadPage({ params }: PageProps<"/catalog/uploads/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <UploadReview id={id} />)}</Suspense>;
}
