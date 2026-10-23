"use client";

import { useEffect, useState } from "react";

/**
 * Buscar llamada por ID (prefijo). El valor vive en la URL (?call=): `value` es lo que hay en ella y
 * `onChange` la actualiza 300 ms después de la última tecla, al instante con Enter, y Esc limpia.
 */
export function CallSearch({ value, onChange }: { value?: string; onChange: (next: string | null) => void }) {
  const [text, setText] = useState(value ?? "");
  // Si la URL cambia por fuera (Limpiar filtros, chip, atrás), el campo la sigue.
  const [urlValue, setUrlValue] = useState(value);
  if (urlValue !== value) {
    setUrlValue(value);
    setText(value ?? "");
  }

  useEffect(() => {
    if (text === (value ?? "")) return;
    const t = setTimeout(() => onChange(text || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className="control search"
      style={{ width: 140 }}
      placeholder="ID de llamada"
      aria-label="Buscar llamada por ID"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") onChange(text || null);
        if (e.key === "Escape") {
          setText("");
          onChange(null);
        }
      }}
    />
  );
}
