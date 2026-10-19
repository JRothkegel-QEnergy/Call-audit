"use client";

import { PageHeader } from "@/components/ui/page-header";
import { PLAYBACK_RATES } from "@/components/call/audio-player";
import { usePreferences } from "@/lib/preferences";

export default function SettingsPage() {
  const { prefs, setPrefs } = usePreferences();
  return (
    <>
      <PageHeader title="Preferencias" description="Se guardan en este navegador." />
      <div className="card grid max-w-[560px] gap-4">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.singleKeyShortcuts}
            onChange={(e) => setPrefs({ singleKeyShortcuts: e.target.checked })}
          />
          <span>
            Usar atajos de una sola tecla
            <span className="help block">J, K, C, X, E, A y Espacio. Si los desactivas, las flechas siguen funcionando.</span>
          </span>
        </label>
        <label className="field max-w-[220px]">
          Velocidad del audio por defecto
          <select className="control" value={prefs.playbackRate} onChange={(e) => setPrefs({ playbackRate: Number(e.target.value) })}>
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {String(r).replace(".", ",")}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
