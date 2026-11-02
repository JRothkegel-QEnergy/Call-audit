# Cambio 14 · Estado del worker y avance de la transcripción (admin Qubico)

> Revisión rápida sobre lo aprobado (fases 0–8 y cambios 09–13). Fecha: 2026-11-02. **Estado: aprobado (2026-11-02), implementable.**
> **Pedido de Johannes (textual):** "me gustaría que de la vista de admin pueda ver si se está corriendo algún cron o worker de transcripción de audios y que salga cual es el avance".
> **Aprobación (textual):** "Todas las recomendadas" (1A, 2A, 3A, 4A, 5A). Supuestos H-79 a H-86 sin objeción.
> **Numeración:** D-47 a D-51, H-79 a H-86. Sin ítems L nuevos (preferencia de Johannes).
> **Revisado:** `src/call_audit/ingestion/pipeline.py` (`run_once`, `main`), `frontend/src/app/(app)/admin/stats/page.tsx`, `frontend/src/components/shell/sidebar-nav.tsx`, `components/admin/admin-header.tsx`, `components/ui/states.tsx` (`AsyncView`).
> **No contradice:**
> - Cambio 12: el admin no ve indicadores por persona; las pruebas del prompt ya muestran su avance en `/admin/prompts/[version]`.
> - Cambio 11: las cargas de Excel ya muestran su estado en Seguros.
> - `10-modo-real.md`: lo que el backend todavía no soporta se oculta en vez de fallar.

---

## 0. Decisiones

| # | Decisión | Origen |
|---|---|---|
| D-47 | Sección nueva **"Procesamiento"** en la navegación del admin, ruta `/admin/processing`. Va después de "Estadísticas" | Johannes (1A) |
| D-48 | Avance completo **solo de la pasada del pipeline** (transcripción y validación). Las cargas de Excel y las pruebas del prompt aparecen como una línea con enlace a su pantalla, sin repetir su avance | Johannes (2A) |
| D-49 | Historial de las **últimas 20 pasadas** + lista de **fallas de transcripción** (estas se guardan en la BD) | Johannes (3A) |
| D-50 | **Solo lectura.** Sin "Correr pasada ahora" ni "Detener" en esta versión | Johannes (4A) |
| D-51 | Avance **por etapa con "{k} de {n}"**. El worker actualiza los contadores al terminar cada audio | Johannes (5A) |

## 1. Hechos de partida

- **No hay cron aparte:** "cron" = el bucle del worker (`pipeline --loop 900`, un solo proceso en el EC2) (H-79).
- Cada **15 s** atiende las cargas de Excel y las pruebas del prompt, que ya guardan su avance en la BD.
- Cada **900 s** hace una **pasada**: revisa el SFTP → transcribe hasta 100 audios (16 en paralelo) → valida con la capa 2 (8 en paralelo) → sube a S3, importa y archiva en `output/`.
- Hoy el resultado de la pasada **solo se loguea**: no hay registro de pasadas, latido ni avance en curso. Por eso el cambio necesita backend nuevo (§5).

## 2. Trazabilidad

- **P-14.1** El admin no sabe si el worker está vivo, si hay una pasada corriendo ni cuánto le falta; hoy tiene que entrar al EC2 a leer logs.
- **P-14.2** Las fallas de transcripción y los audios sin metadata no se ven desde la app.
- **R-14.1** Ver si el worker está procesando, en espera o sin señal → §3.2.
- **R-14.2** Ver el avance de la pasada en curso por etapa → §3.3.
- **R-14.3** Ver el resultado de las últimas pasadas y qué audios fallaron → §3.5 y §3.6.

## 3. Vista `/admin/processing`

### 3.1 Estructura

```
Procesamiento                                                [AdminHeader]
Estado del worker que transcribe y valida las llamadas.

┌ Estado ──────────────────────────────────────────────────────────────┐
│ ● Procesando · Transcribiendo          Último latido: hace 12 s      │
└──────────────────────────────────────────────────────────────────────┘
┌ Pasada en curso · empezó 14:30 · lleva 6 min ────────────────────────┐
│ 1 Revisar SFTP       ✓ 412 audios · 37 esperan metadata · 100 en esta pasada
│ 2 Transcribir        ███████░░░ 68 de 100 · 2 con error · 1 por cuota
│ 3 Validar            Pendiente
│ 4 Subir y archivar   Pendiente
│ Quedan 275 audios en el SFTP para las próximas pasadas.
└──────────────────────────────────────────────────────────────────────┘
Otras tareas: Cargas de Excel en cola: 1 · Ver en Seguros
              Prueba del prompt v2.11: 40 de 120 · Ver prueba
[Últimas pasadas]  [Fallas de transcripción (3)]          ← pestañas
  tabla
```

- **Navegación del admin:** Estadísticas · **Procesamiento** · Prompt · Cuentas · Discrepancias · Seguros · Registro de actividad. Ícono Lucide `Cpu` **[SUPUESTO menor]**.
- **Componentes existentes:** `AdminHeader`, `AsyncView` (carga / error), el patrón `tabs` de Estadísticas, tabla y `KpiCard` si hace falta. No se agregan librerías.
- Sin pasada en curso, el bloque "Pasada en curso" se reemplaza por **"Última pasada"**, con su resumen y su resultado.

### 3.2 Estado (tarjeta superior)

El estado se calcula en el **backend** con el latido y la pasada abierta, y llega como `state`. Así el front no compara relojes.

| `state` | Regla | Indicador | Texto |
|---|---|---|---|
| `running` | Pasada `running` y latido de hace ≤ 3 min | Punto + ícono de giro, color primario | **Procesando · {etapa}** · Último latido: hace {t} |
| `idle` | Sin pasada en curso y latido de hace ≤ 3 min | Punto neutro | **En espera** · Próxima pasada a las {hora} (en ~{m} min) |
| `stale` | Último latido de hace más de 3 min (H-80) | Ícono de alerta, color de advertencia | **El worker no responde** · Último latido: {fecha hora}. Revisa el contenedor `call-audit-worker-1` en el servidor. |
| `last_failed` | Latido vigente y la última pasada terminó en `failed` | Ícono de error, color destructivo | **La última pasada falló** · {hora}: {mensaje}. El worker reintentará en la próxima pasada, a las {hora}. |
| `no_data` | Nunca hubo latido | Neutro | **Todavía no hay datos del worker.** Aparecerán cuando el worker empiece su próxima pasada. |

- `stale` le gana a `running`: una pasada que murió a medias no se muestra como "Procesando".
- El estado nunca se comunica solo con color (WCAG 1.4.1): siempre hay ícono y texto.
- El latido se muestra en tiempo relativo, con la fecha y hora exactas en `title` y en el texto accesible.

### 3.3 Pasada en curso (por etapa, D-51)

| # | Etapa (`stage`) | Mientras corre | Al terminar |
|---|---|---|---|
| 1 | `listing` · Revisar SFTP | "Revisando el SFTP…" | ✓ {audios} audios · {waiting} esperan metadata · {batch} en esta pasada |
| 2 | `transcribing` · Transcribir | Barra + "{k} de {n}" · {e} con error · {q} por cuota | ✓ {ok} transcritos · {e} con error · {q} por cuota |
| 3 | `validating` · Validar | Barra + "{k} de {n}" | ✓ {validated} validadas |
| 4 | `archiving` · Subir y archivar | "Subiendo y archivando…" | ✓ {archived} archivados |

- Las etapas que no empezaron dicen "Pendiente". Si una etapa no tiene trabajo (n = 0), dice "Nada que hacer" y queda marcada como hecha.
- **Barra:** `role="progressbar"` con `aria-valuenow`/`aria-valuemax` y el texto "{k} de {n}" visible. No se muestra porcentaje solo.
- **Lectores de pantalla:** una región `aria-live="polite"` anuncia los cambios de etapa y el final de la pasada, no cada número.
- **Pie:** "Quedan {m} audios en el SFTP para las próximas pasadas." (m = pendientes con metadata, sin contar esta pasada). Se oculta si m = 0.
- **Cabecera:** "Pasada en curso · empezó {hora} · lleva {duración}".
- **Sin pasada en curso:** "Última pasada · {fecha hora} · duró {duración}", con los totales de las 4 etapas y la insignia de resultado.

### 3.4 Otras tareas del worker (D-48)

- Si hay cargas de Excel en cola: "Cargas de Excel en cola: {n}" · enlace **"Ver en Seguros"** (`/catalog`).
- Si hay una prueba del prompt en curso: "Prueba del prompt v{x}: {k} de {n}" · enlace **"Ver prueba"** (`/admin/prompts/{x}`).
- Si no hay ninguna de las dos, la línea no se muestra.

### 3.5 Pestaña "Últimas pasadas" (D-49)

Columnas: **Inicio · Duración · Audios · Transcritos · Errores · Por cuota · Validadas · Archivados · Resultado**.

- **Resultado** (insignia con texto): `Completa` · `Con errores` (terminó, pero con errores > 0) · `Falló` (excepción; se ve el mensaje en `title` y en una fila expandible) · `En curso` · `Interrumpida` (el worker se reinició, H-85).
- Ordenada de la más nueva a la más antigua. Muestra 20 filas y no tiene paginación (H-82).
- **Vacía:** "Todavía no hay pasadas registradas."

### 3.6 Pestaña "Fallas de transcripción ({n})" (D-49)

Columnas: **Archivo · Error · Intentos · Último intento**.

- Nota fija: "Se reintentan solas en las próximas pasadas. Las fallas por cuota de Gemini no aparecen acá: se reintentan sin contar como error."
- **Archivo:** el nombre tal como viene del SFTP (H-86).
- **Error:** el tipo + el mensaje, recortado a 1 línea; el texto completo va en `title` y en una fila expandible.
- **Vacía:** "No hay fallas de transcripción."
- Una falla desaparece de la lista cuando el audio se transcribe bien (igual que `failures.clear` hoy).

### 3.7 Actualización y errores de la vista

- Consulta cada **5 s** con `state = running` y cada **30 s** en los demás estados. Se pausa con la pestaña oculta (`visibilitychange`) y vuelve a consultar al mostrarse (H-83).
- **Error al consultar:** se mantienen los últimos datos y se agrega el aviso "No pudimos actualizar el estado. Reintentaremos en unos segundos." Si no hay datos previos, va el error estándar de `AsyncView`.
- **Backend sin el endpoint** (antes del despliegue): la entrada de navegación se oculta, según `10-modo-real.md`.

## 4. Textos (complementan `06-ux-writing.md`)

| Clave | Texto |
|---|---|
| Nav / título | Procesamiento |
| Descripción | Estado del worker que transcribe y valida las llamadas. |
| `running` | Procesando · {Revisando el SFTP \| Transcribiendo \| Validando \| Subiendo y archivando} |
| `idle` | En espera · Próxima pasada a las {hora} (en ~{m} min) |
| `stale` | El worker no responde · Último latido: {fecha hora}. Revisa el contenedor `call-audit-worker-1` en el servidor. |
| `last_failed` | La última pasada falló · {hora}: {mensaje}. El worker reintentará en la próxima pasada, a las {hora}. |
| `no_data` | Todavía no hay datos del worker. Aparecerán cuando el worker empiece su próxima pasada. |
| Latido | Último latido: hace {t} |
| Cabecera de la pasada | Pasada en curso · empezó {hora} · lleva {duración} / Última pasada · {fecha hora} · duró {duración} |
| Etapas | Revisar SFTP · Transcribir · Validar · Subir y archivar |
| Etapa pendiente / vacía | Pendiente / Nada que hacer |
| Resumen de la etapa 1 | {audios} audios · {waiting} esperan metadata · {batch} en esta pasada |
| Progreso | {k} de {n} · {e} con error · {q} por cuota |
| Pie | Quedan {m} audios en el SFTP para las próximas pasadas. |
| Otras tareas | Cargas de Excel en cola: {n} · Ver en Seguros / Prueba del prompt v{x}: {k} de {n} · Ver prueba |
| Pestañas | Últimas pasadas · Fallas de transcripción ({n}) |
| Resultados | Completa · Con errores · Falló · En curso · Interrumpida |
| Interrumpida (detalle) | El worker se reinició durante esta pasada. |
| Nota de fallas | Se reintentan solas en las próximas pasadas. Las fallas por cuota de Gemini no aparecen acá: se reintentan sin contar como error. |
| Vacíos | Todavía no hay pasadas registradas. / No hay fallas de transcripción. |
| Error al actualizar | No pudimos actualizar el estado. Reintentaremos en unos segundos. |

## 5. Lo que necesita el backend (no es código; detalle para `pipeline-architect`)

**Tablas (nombres en inglés)**
- `pipeline_runs`:
  - `id`, `started_at`, `finished_at?`;
  - `status` (`running` | `done` | `failed` | `interrupted`), `stage` (`listing` | `transcribing` | `validating` | `archiving` | `null`);
  - `audios`, `waiting_metadata`, `batch_size`, `remaining`;
  - `transcribe_total`, `transcribed`, `asr_errors`, `asr_rate_limited`;
  - `validate_total`, `validated`, `archived`;
  - `error?` (mensaje corto, sin PII).
- `worker_heartbeat` (una fila): `last_seen_at`, `state` (`idle` | `running`), `next_run_at`, `loop_seconds`.
- `asr_failures`: `stem`, `error`, `attempts`, `last_attempt_at`. Reemplaza `work/asr_failures.json`; misma semántica de `blocked` / `clear`.

**Worker**
- Al empezar una pasada: crea la fila `running` y fija `stage` en cada transición.
- Actualiza los contadores al terminar cada audio, en `as_completed` de la transcripción y en la validación (D-51). Cada actualización es una escritura corta, en una sesión propia.
- **Latido:** un hilo cada ~30 s, también en medio de una transcripción larga (H-81). En el bucle de 15 s actualiza `next_run_at = last_pass + loop`.
- **Al terminar:** `done`, con las stats que hoy van al log (se sigue logueando igual). **Si hay excepción:** `failed` con `error`.
- **Al arrancar:** cierra como `interrupted` cualquier `running` huérfana (H-85).
- **Retención:** se puede podar a las últimas ~200 pasadas; la vista pide 20.

**API (solo lectura, `qubico_admin`; 403 para otros roles, H-84)**
- `GET /admin/processing` → `{ state, stage?, lastHeartbeatAt?, nextRunAt?, currentRun?: PipelineRun, lastRun?: PipelineRun, otherTasks: { catalogUploadsQueued, promptEvaluation?: { version, processed, n } } }`. El `state` se calcula en el servidor con el umbral de 3 min.
- `GET /admin/processing/runs?limit=20` → `PipelineRun[]`.
- `GET /admin/processing/asr-failures` → `AsrFailure[]`.

**Front (`types.ts` / `ApiClient`)**
- `WorkerState = "running" | "idle" | "stale" | "last_failed" | "no_data"`, `PipelineStage`, `PipelineRun`, `AsrFailure`, `ProcessingStatus`.
- `getProcessingStatus()`, `listPipelineRuns(limit)`, `listAsrFailures()`, más su mock en `lib/api/mock`.

## 6. Revisión rápida contra lo aprobado

- **Trazabilidad:** cada bloque cubre un R-14.x (§2).
- **Patrones:** sección de la sidebar del admin y patrones existentes (`AdminHeader`, `tabs`, tabla, `AsyncView`). Sin modales ni acciones (D-50).
- **WCAG 2.2 AA:**
  - estado con texto e ícono además del color;
  - `progressbar` con valores;
  - `aria-live` solo en los cambios de etapa;
  - pestañas con `role="tab"`, como en Estadísticas;
  - tablas con encabezados;
  - fila expandible operable con teclado.
- **Microcopy:** tuteo, errores que dicen qué pasó y qué hacer, sin culpar. Términos nuevos para el glosario: **pasada** y **latido**.
- **Dark patterns:** no aplica.
- **Mínimo privilegio:** solo el admin; sin datos por persona; no muestra contenido de las llamadas.
