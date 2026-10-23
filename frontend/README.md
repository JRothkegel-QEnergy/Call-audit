# Call Audit · Frontend (dummy)

Front de Call Audit para el auditor y el supervisor, construido según el diseño aprobado en
`docs/ux/call-audit/` (fases 0–8). Hoy funciona **sin backend**: los datos son 100 % sintéticos y viven
en el navegador (`sessionStorage`), para probar los flujos.

## Correr

```bash
npm install
npm run dev
```

Abrir http://localhost:3000 y entrar con «entrar como auditora» o «entrar como supervisor».
En la sidebar, **Opciones de la demo** permite reiniciar los datos y simular errores de red.

## Estructura

```
src/
  app/
    login/, privacy/            acceso y textos legales en lenguaje claro
    (app)/                      pantallas con sesión (sidebar por rol)
      queue/                    Cola (auditor) · Cola completa en lectura (supervisor)
      calls/[id]/               Detalle de llamada: modos auditor, supervisor y lectura
      my-reviews/               Mis revisiones (auditor)
      dashboard/, alerts/, reviews/, agents/, dashboard/criteria/, auditors/   supervisor
      discrepancies/            Discrepancias con el cliente (supervisor, Cambio 09)
      settings/                 Preferencias (atajos de una tecla, velocidad del audio)
  components/
    ui/                         Button, badges, Dialog/Sheet, estados vacío/error/carga
    call/                       AudioPlayer, Transcript, RubricChecklist (FindingItem), ProductSheet,
                                ModelPanel (prompt y respuesta del modelo), notas, diálogos
    shell/                      AppShell, SidebarNav, contadores
  lib/
    api/types.ts                tipos del dominio = contrato con el backend
    api/client.ts               interfaz ApiClient
    api/mock/                   implementación mock (datos sintéticos + estado en el navegador)
  styles/tokens.css             copia de docs/ux/call-audit/08-tokens.css
```

## Conectar el backend

Las pantallas solo usan `api` (`src/lib/api/index.ts`), que implementa `ApiClient`. Para el backend:

1. Crear `src/lib/api/http-api.ts` que implemente `ApiClient` contra FastAPI con los mismos tipos de `types.ts`.
2. Elegirlo en `src/lib/api/index.ts` con `NEXT_PUBLIC_API_MODE=http`.
3. Mover la sesión a una cookie leída en el servidor y reactivar `cacheComponents` en `next.config.ts`.

Pendientes técnicos que afectan al contrato (ver `docs/ux/call-audit/08-alta-fidelidad.md` §6):
- H-34: estado `awaiting_approval` del caso.
- H-48: `not_applicable` se muestra como «Cumple» (D-20).
- H-32: el mapeo motivo → sección de la ficha debe venir de la rúbrica (`Criterion.productSheetSection`).

## Cambio 09 (calibración contra el cliente)

Ver `docs/ux/call-audit/09-cambio-auditoria-ia.md`.
- **Notas** por caso y por motivo (tecla N), con autor y fecha, y aviso si el texto parece traer un RUT.
- **Panel «Modelo X · Prompt vY»**: resumen de la corrida, datos enviados, prompt enviado y respuesta JSON.
  Lo ven el supervisor y los auditores con el permiso `view_model_io` (la auditora de la demo lo tiene).
- **Veredicto del cliente** (`ESTADO_CALIDAD`) opcional: por llamada, y por motivo si algún día viene.
  Solo lo recibe el supervisor; el auditor nunca lo ve (D-24). El mock lo quita en las respuestas al auditor;
  **el backend real debe hacer lo mismo** (H-58).
- **Discrepancias** (`/discrepancies`, supervisor): ramas Solo la IA detectó · Omitidos por la IA · IA dudosa ·
  Coinciden, clasificación «La IA acertó / se equivocó» y seguimiento «Por presentar al cliente».

## Qué está simulado

- **Audio:** no hay archivo; el reproductor avanza con un reloj. Con el backend se usa wavesurfer.js con `audioUrl`.
- **Ingreso:** solo correo y contraseña (sin SSO, D-28). En la demo cualquier ingreso entra; si el correo contiene «sup», entra como supervisor, y si contiene «admin», como Administrador Qubico.
- **Exportar e invitaciones:** en la demo muestran la confirmación, pero no generan archivos ni correos. Con el backend, las invitaciones salen por correo (`EMAIL_BACKEND`).
- **Gravedad de los motivos:** los críticos (28, 9, 17, 12) son solo de la demo; la gravedad real es `TBD` con el cliente.
- **Logo:** el oficial de Qubico (`src/assets/brand/`, recortado de `qubico-cloud`).
- **Prompt y JSON del modelo:** textos sintéticos; con el backend vienen de la corrida real (anonimizada).
