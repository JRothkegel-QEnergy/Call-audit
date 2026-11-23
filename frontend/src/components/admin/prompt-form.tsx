"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PromptSection } from "@/lib/api/types";

export interface PromptFormValue {
  version: string;
  model: string;
  changelog: string;
  rationale: string;
  sections: PromptSection[];
}

const MODELS = ["Gemini (demo)", "Sonnet (demo)"];
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Formulario de una versión del prompt (Cambio 10 §4.2). Se usa para publicar y para editar borradores. */
export function PromptForm({
  initial,
  activeVersion,
  versionLocked,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PromptFormValue;
  activeVersion: string;
  versionLocked?: boolean;
  submitLabel: string;
  onSubmit: (v: PromptFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PromptFormValue>) => setV((x) => ({ ...x, ...patch }));

  const loadFile = async (file: File) => {
    const text = await file.text();
    // Archivo de texto: secciones separadas por encabezados "## Título".
    const parts = text.split(/^##\s+/m).filter((p) => p.trim());
    if (parts.length > 1) {
      set({ sections: parts.map((p) => ({ title: p.split("\n")[0].trim(), text: p.split("\n").slice(1).join("\n").trim() })) });
    } else {
      set({ sections: v.sections.map((s, i) => (i === 0 ? { ...s, text: text.trim() } : s)) });
    }
  };

  return (
    <form
      className="grid max-w-[920px] gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!SEMVER.test(v.version)) return setError("Escribe la versión como mayor.menor.parche, por ejemplo 2.8.0.");
        if (!v.changelog.trim()) return setError("Cuenta qué cambió en esta versión.");
        if (v.sections.some((s) => !s.text.trim())) return setError("Ninguna sección del prompt puede quedar vacía.");
        setBusy(true);
        setError(null);
        try {
          await onSubmit(v);
        } catch (err) {
          const code = err instanceof Error ? err.message : "";
          setError(
            code === "version_not_greater"
              ? `La versión debe ser mayor que la vigente (v${activeVersion}).`
              : code === "version_exists"
                ? "Ya existe una versión con ese número."
                : "No pudimos guardar la versión. Intenta de nuevo.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="card grid gap-3">
        <div className="flex flex-wrap gap-4">
          <label className="field">
            Versión
            <input
              className="control w-[140px] tabular"
              value={v.version}
              disabled={versionLocked}
              onChange={(e) => set({ version: e.target.value.trim() })}
            />
          </label>
          <label className="field">
            Modelo
            <select className="control" value={v.model} onChange={(e) => set({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <span className="help">
          Vigente: v{activeVersion}. Mayor si cambia el formato de salida; menor si cambian reglas o criterios; parche si son correcciones de redacción.
        </span>
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
          <b>Prompt</b>
          <span className="help">Mismas secciones que el vigente. Al pasar a prueba queda inmutable.</span>
          <label className="btn ml-auto cursor-pointer">
            Cargar archivo
            <input
              type="file"
              accept=".txt,.md"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
              }}
            />
          </label>
        </div>
        {v.sections.map((s, i) => (
          <label key={s.title} className="field">
            {s.title}
            <textarea
              className="control font-mono text-[13px] leading-5"
              rows={Math.min(14, Math.max(4, s.text.split("\n").length + 1))}
              value={s.text}
              onChange={(e) => set({ sections: v.sections.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
          </label>
        ))}
      </div>

      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
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

export function nextMinor(version: string) {
  const [a, b] = version.split(".").map(Number);
  return `${a}.${(b ?? 0) + 1}.0`;
}
