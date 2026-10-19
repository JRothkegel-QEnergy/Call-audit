import { Suspense } from "react";
import { QueueView } from "./queue-view";

export default function QueuePage() {
  return (
    <Suspense>
      <QueueView />
    </Suspense>
  );
}
