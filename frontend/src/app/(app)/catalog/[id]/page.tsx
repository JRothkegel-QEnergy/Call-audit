import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { ProductDetailView } from "./product-detail";

export default function ProductPage({ params }: PageProps<"/catalog/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <ProductDetailView id={id} />)}</Suspense>;
}
