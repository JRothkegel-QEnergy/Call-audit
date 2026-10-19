"use client";

import { useEffect, useState } from "react";
import { Button, Kbd } from "@/components/ui/button";

const KEY = "call-audit-welcome-dismissed";

/** Tarjeta de bienvenida del auditor, sin tour (H-43). Se muestra una vez por navegador. */
export function WelcomeCard() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="card mb-3 flex flex-wrap items-center gap-3">
      <span className="flex-1">
        Te damos la bienvenida a Call Audit. Tres atajos para empezar: <Kbd>J</Kbd>/<Kbd>K</Kbd> para moverte entre hallazgos,{" "}
        <Kbd>C</Kbd> para confirmar y <Kbd>Enter</Kbd> para guardar y pasar al siguiente. <Kbd>?</Kbd> muestra todos.
      </span>
      <Button
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Ignorado.
          }
          setShow(false);
        }}
      >
        Entendido
      </Button>
    </div>
  );
}
