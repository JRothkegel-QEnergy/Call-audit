"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/admin-types";
import { useAsync } from "@/lib/use-async";

export interface PromptFormValue {
  source: "yaml" | "text";
  content: string;
  version: string;
  model: string;
  changelog: string;
  rationale: string;
}

/** X.Y, como `version` de prompt.yaml (12-cambio-admin-qubico.md, ajuste 1). */
export function nextMinor(version: string) {
  const [a, b] = version.split(".").map(Number);
  return `${a}.${(b ?? 0) + 1}`;
}

/**
 * Publicar una versión del prompt (o editar un borrador): prompt.yaml completo o solo el system prompt (D-33).
 * Con el yaml la versión se lee del archivo; con texto se escribe aquí y usa el esquema vigente (H-70).
 */
export function PromptForm({
  initial,
  activeVersion,
  editing,
  starters,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PromptFormValue;
  activeVersion: string;
  editing?: boolean;
  /** Contenido de partida por tipo (el de la vigente): al cambiar de tipo sin haber editado, se cambia también. */
  starters?: Record<PromptFormValue["source"], string>;
  submitLabel: string;
  onSubmit: (v: PromptFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const models = useAsync(() => api.listModels(), []);
  const set = (patch: Partial<PromptFormValue>) => setV((x) => ({ ...x, ...patch }));
  const setSource = (source: PromptFormValue["source"]) =>
    setV((x) => ({ ...x, source, content: starters && x.content === starters[x.source] ? starters[source] : x.content }));

  const loadFile = async (file: File) => {
    const text = await file.text();
    const isYaml = /\.ya?ml$/i.test(file.name);
    set({ content: text, source: editing ? v.source : isYaml ? "yaml" : "text" });
  };

  return (
    <form
      className="grid max-w-[980px] gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const local: string[] = [];
        if (!v.content.trim()) local.push(v.source === "yaml" ? "Sube o pega el prompt.yaml." : "Escribe o pega el system prompt.");
        if (v.source === "text" && !/^\d+\.\d+$/.test(v.version)) local.push("Escribe la versión como X.Y, por ejemplo 2.11.");
        if (!v.changelog.trim()) local.push("Cuenta qué cambió en esta versión.");
        if (!v.model) local.push("Elige el modelo.");
        if (local.length) return setErrors(local);
        setBusy(true);
        setErrors([]);
        try {
          await onSubmit(v);
        } catch (err) {
          setErrors(err instanceof ApiError && err.errors.length ? err.errors : ["No pudimos guardar la versión. Intenta de nuevo."]);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="card grid gap-3">
        {!editing && (
          <fieldset className="m-0 flex flex-wrap gap-4 rounded-md border border-border px-3 py-2">
            <legend className="px-1 text-[13px] font-medium">Qué subes</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="source" checked={v.source === "yaml"} onChange={() => setSource("yaml")} /> prompt.yaml completo
              <span className="help">(con historial y origen por regla)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="source" checked={v.source === "text"} onChange={() => setSource("text")} /> Solo el system prompt
            </label>
          </fieldset>
        )}
        {v.source === "text" && (
          <div className="banner m-0" style={{ borderLeftColor: "var(--amber-600)" }}>
            Esta versión no tendrá historial ni origen por regla. Usa el esquema de salida de la vigente.
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          {v.source === "text" ? (
            <label className="field">
              Versión
              <input className="control w-[120px] tabular" value={v.version} disabled={editing} onChange={(e) => set({ version: e.target.value.trim() })} />
            </label>
          ) : (
            <div className="field">
              Versión
              <span className="help">Se lee del archivo (campo version).</span>
            </div>
          )}
          <label className="field">
            Modelo de la prueba
            <select className="control" value={v.model} onChange={(e) => set({ model: e.target.value })}>
              <option value="">Elige un modelo…</option>
              {(models.data ?? []).map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="help">Vigente: v{activeVersion}. Sube la versión menor si cambian reglas o criterios, y la mayor si cambia el formato de salida.</span>
        <label className="field">
          Qué cambió (obligatorio)
          <textarea className="control" rows={2} value={v.changelog} onChange={(e) => set({ changelog: e.target.value })} />
        </label>
        <label className="field">
          Por qué (opcional: discrepancias o notas que lo motivan)
          <textarea className="control" rows={2} value={v.rationale} onChange={(e) => set({ rationale: e.target.value })} />
        </label>
      </div>

      <div className="card grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <b>{v.source === "yaml" ? "prompt.yaml" : "System prompt"}</b>
          <span className="help">Al pasar a prueba queda inmutable.</span>
          <label className="btn ml-auto cursor-pointer">
            Cargar archivo
            <input
              type="file"
              accept={v.source === "yaml" ? ".yaml,.yml" : ".txt,.md"}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
              }}
            />
          </label>
        </div>
        <textarea
          aria-label={v.source === "yaml" ? "Contenido del prompt.yaml" : "Texto del system prompt"}
          className="control min-h-[360px] font-mono text-[13px] leading-5"
          value={v.content}
          onChange={(e) => set({ content: e.target.value })}
          spellCheck={false}
        />
      </div>

      {errors.length > 0 && (
        <div className="error-state" role="alert">
          <b className="mb-1 block">{errors.length === 1 ? "Hay 1 error" : `Hay ${errors.length} errores`}</b>
          <ul className="m-0 pl-5 text-[13px]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {v.source === "yaml" && <p className="help mb-0 mt-1.5">Corrígelos y vuelve a subir el archivo. Es la misma validación de layer2_prompt.py check.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
