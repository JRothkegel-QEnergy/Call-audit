import { StatusBadge } from "@/components/ui/badges";
import type { PromptVersionStatus } from "@/lib/api/admin-types";

export const PROMPT_STATUS: Record<PromptVersionStatus, [string, "neutral" | "teal" | "ink" | "doubt" | "fail"]> = {
  draft: ["Borrador", "neutral"],
  testing: ["En prueba", "doubt"],
  test_failed: ["Error de prueba", "fail"],
  tested: ["Probada", "teal"],
  active: ["Vigente", "ink"],
  retired: ["Retirada", "neutral"],
};

export function PromptStatusBadge({ status }: { status: PromptVersionStatus }) {
  const [label, tone] = PROMPT_STATUS[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
