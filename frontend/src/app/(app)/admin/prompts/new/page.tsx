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
            starters={{ yaml: cur.meta.source === "text" ? "" : cur.content, text: cur.systemText }}
            submitLabel="Guardar como borrador"
            initial={{
              // Se parte del contenido vigente: con yaml, basta subir version, editar y agregar su history.
              source: cur.meta.source === "text" ? "text" : "yaml",
              content: cur.content,
              version: nextMinor(cur.meta.version),
              model: cur.meta.model,
              changelog: "",
              rationale: "",
            }}
            onCancel={() => router.push("/admin/prompts")}
            onSubmit={async (v) => {
              const created = await api.createPromptVersion({
                source: v.source,
                content: v.content,
                version: v.source === "text" ? v.version : undefined,
                model: v.model,
                changelog: v.changelog.trim(),
                rationale: v.rationale.trim() || null,
              });
              toast(`Borrador v${created.version} guardado.`);
              router.push(`/admin/prompts/${encodeURIComponent(created.version)}`);
            }}
          />
        )}
      </AsyncView>
    </>
  );
}
