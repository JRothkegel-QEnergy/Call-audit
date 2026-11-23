"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/admin-header";
import { PromptForm, nextMinor } from "@/components/admin/prompt-form";
import { Button } from "@/components/ui/button";
import { AsyncView } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";

export default function NewPromptPage() {
  const router = useRouter();
  const active = useAsync(async () => {
    const a = await api.getActivePrompt();
    return api.getPromptVersion(a.version);
  }, []);
  return (
    <>
      <Button variant="ghost" onClick={() => router.push("/admin/prompts")}>
        <ChevronLeft size={14} aria-hidden />
        Volver a Versiones del prompt
      </Button>
      <div className="mt-2">
        <AdminHeader title="Publicar versión nueva" description="Queda como borrador. Puedes editarla hasta que la pases a prueba." />
      </div>
      <AsyncView state={active} what="la versión vigente">
        {(cur) => (
          <PromptForm
            activeVersion={cur.meta.version}
            submitLabel="Guardar como borrador"
            initial={{ version: nextMinor(cur.meta.version), model: cur.meta.model, changelog: "", rationale: "", sections: cur.sections }}
            onCancel={() => router.push("/admin/prompts")}
            onSubmit={async (v) => {
              await api.createPromptDraft({ ...v, rationale: v.rationale.trim() || null, changelog: v.changelog.trim() });
              toast(`Borrador v${v.version} guardado.`);
              router.push(`/admin/prompts/${v.version}`);
            }}
          />
        )}
      </AsyncView>
    </>
  );
}
