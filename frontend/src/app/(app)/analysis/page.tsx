"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { analysisHome, useIsQubico } from "@/components/analysis/parts";
import { useSession } from "@/lib/session";

/** Entrada a la sección: cada rol cae en su primera pestaña (D-41). */
export default function AnalysisIndex() {
  const router = useRouter();
  const { user } = useSession();
  const qubico = useIsQubico();
  useEffect(() => {
    if (user) router.replace(analysisHome(qubico));
  }, [user, qubico, router]);
  return null;
}
