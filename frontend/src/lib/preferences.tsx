"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Preferencias por usuario (conveniencias locales): atajos de una tecla (WCAG 2.1.4) y velocidad del audio. */
interface Prefs {
  singleKeyShortcuts: boolean;
  playbackRate: number;
}

const DEFAULTS: Prefs = { singleKeyShortcuts: true, playbackRate: 1.5 };
const KEY = "call-audit-prefs";

const PrefsContext = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void } | null>(null);

function readStored(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // Sin almacenamiento: se usan los valores por defecto.
  }
  return DEFAULTS;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    // Se lee después de montar para no desalinear el HTML del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readStored());
  }, []);
  const setPrefs = useCallback(
    (p: Partial<Prefs>) =>
      setState((prev) => {
        const next = { ...prev, ...p };
        try {
          window.localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // Ignorado.
        }
        return next;
      }),
    [],
  );
  return <PrefsContext.Provider value={{ prefs, setPrefs }}>{children}</PrefsContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePreferences debe usarse dentro de PreferencesProvider");
  return ctx;
}
