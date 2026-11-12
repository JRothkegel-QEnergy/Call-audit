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

- Nota fija: **reemplazada por §8.2** (el texto anterior, "Se reintentan solas…", era falso para los audios bloqueados).
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
| Nota de fallas | Reemplazada por el aviso de §8.2. |
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

## 7. Ajuste: agrupar pasadas repetidas en "Últimas pasadas" (D-60, 2026-11-04)

> Revisión rápida sobre §3.5. **Pedido de Johannes (textual):** "me gustaría evitar tanto ruido de llamadas que no funcionaron, quizás esas agruparlas."
> **Contexto en producción:** los 534 audios están bloqueados por fallas de ASR (cuenta de Gemini sin saldo). Cada pasada dura ~2 s, deja todo en 0 y sale como "Completa"; antes hubo una racha de pasadas "Con errores" con 100 errores cada una (mismo error 402). La tabla queda llena de filas iguales.
> **Estado:** especificación lista para implementar. No cambia CUJ, AI ni puntos legales.

### 7.1 Resultado nuevo: "Sin trabajo"

- Una pasada es **sin trabajo** si `status = done` y `transcribed`, `asr_errors`, `asr_rate_limited`, `validated` y `archived` son todos 0 (`audios` puede ser > 0: hay audios, pero ninguno se pudo procesar).
- Lleva la insignia **"Sin trabajo"** (`tone="neutral"`), no "Completa". Vale también para una pasada suelta.
- `title` de la insignia: "La pasada terminó sin transcribir, validar ni archivar audios."

### 7.2 Regla de agrupación

- Se agrupan **solo pasadas consecutivas** (vecinas en la lista ordenada de más nueva a más antigua) con la **misma firma**, y solo si son **2 o más**:

| Resultado | Firma (todo debe coincidir) |
|---|---|
| Sin trabajo | Ser sin trabajo (§7.1). `audios` puede variar |
| Con errores | `transcribed`, `asr_errors`, `asr_rate_limited`, `validated`, `archived` iguales |
| Falló | Mismo `error` (texto exacto) |

- **Nunca se agrupan:** `running` (En curso), `interrupted` (Interrumpida) ni "Completa" con trabajo real. Cualquiera de ellas corta la racha.
- Así no se esconde información: un error nuevo o un cambio en los números abre una fila aparte.

### 7.3 Fila de grupo

| Columna | Contenido |
|---|---|
| Inicio | Botón de disclosure + **"{n} pasadas"**, debajo el rango **"{d mmm} · {hh:mm} – {hh:mm}"** (de la más antigua a la más nueva). Si el rango cruza días: "{d mmm hh:mm} – {d mmm hh:mm}" |
| Duración | Mín–máx, p. ej. "2–3 s"; un solo valor si son iguales |
| Audios | El de la pasada más nueva; si varía, el rango min–máx va en `title` |
| Transcritos … Archivados | El valor de una pasada (es el mismo en todas). Si es > 0 se agrega "c/u" (p. ej. "100 c/u") |
| Resultado | Insignia del grupo: "Sin trabajo" / "Con errores" / "Falló", con el mismo tono que la pasada suelta. En "Falló", el mensaje (`ErrorText`) una sola vez |

- **Expandida:** debajo aparecen las pasadas del grupo como filas normales, con sangría en la primera celda y la misma insignia. Cerrada por defecto.
- El estado abierto/cerrado se guarda por la `id` de la pasada **más antigua** del grupo (no cambia cuando entran pasadas nuevas arriba) y se mantiene entre consultas. No va a la URL ni a localStorage.

### 7.4 Cuántas pasadas se piden y se muestran

- La vista pide `listPipelineRuns(200)` (el máximo del endpoint y la retención de §5) y muestra las **20 filas más recientes**, contando cada grupo como una fila.
- 200 pasadas ≈ 50 h de historia con el bucle de 15 min.
- Si el grupo más antiguo que se muestra incluye la pasada número 200 (puede haber más atrás): el texto dice **"Al menos {n} pasadas"**.
- Pie de la tabla, solo si se agrupó algo: "Las pasadas iguales y seguidas se agrupan en una fila."

### 7.5 Accesibilidad (WCAG 2.2 AA)

- El disclosure es un `<button>` nativo en la celda Inicio, con `aria-expanded` y `aria-controls` apuntando a un `<tbody id>` propio del grupo (se puede tener varios `<tbody>` en una tabla), oculto con `hidden` cuando está cerrado.
- **Nombre accesible:** "Ver las {n} pasadas sin trabajo, {rango}" / "Ocultar las {n} pasadas sin trabajo" (o "con errores" / "que fallaron").
- **Ícono:** chevron Lucide (`ChevronRight`, gira 90° al abrir), `aria-hidden`. Objetivo táctil ≥ 24 × 24 px (2.5.8). Foco visible con el token de foco existente.
- El foco queda en el botón al abrir y cerrar. Las filas hijas no se anuncian solas (sin `aria-live`).
- El resultado sigue teniendo texto, no solo color (1.4.1).

### 7.6 Textos (complementan §4)

| Clave | Texto |
|---|---|
| Resultado nuevo | Sin trabajo |
| `title` de "Sin trabajo" | La pasada terminó sin transcribir, validar ni archivar audios. |
| Fila de grupo | {n} pasadas · {rango} / Al menos {n} pasadas · {rango} |
| Botón (nombre accesible) | Ver las {n} pasadas {sin trabajo \| con errores \| que fallaron}, {rango} / Ocultar las {n} pasadas … |
| Valor repetido | {v} c/u |
| Pie | Las pasadas iguales y seguidas se agrupan en una fila. |

- §3.5 queda con los resultados: Completa · **Sin trabajo** · Con errores · Falló · En curso · Interrumpida.

### 7.7 Impacto en el código (orientativo)

- Solo front: `RunResult` (caso "Sin trabajo"), `RunsTable` (agrupación + `tbody` por grupo) y la llamada `listPipelineRuns(200)`. Sin cambios de backend ni de tipos.
- La agrupación es una función pura (`groupRuns(runs, maxRows = 20)`) que conviene probar con: racha de sin trabajo, racha de 402 idénticos, error distinto que corta, `running` arriba, grupo cortado en la pasada 200.

### 7.8 Revisión rápida

- **Trazabilidad:** P-14.1 / R-14.3 (ver el resultado de las últimas pasadas sin ruido).
- **Patrones:** tabla existente + disclosure. Ya se usa `<details>` en `ErrorText`; acá va un botón, porque `<details>` no sirve para filas de tabla.
- **Microcopy:** consistente con §4 ("pasada").
- **Dark patterns:** no aplica. Nada se oculta sin aviso: el grupo dice cuántas pasadas tiene y se puede abrir.

---

## 8. Ajuste: audios bloqueados y "Reintentar" (D-61 a D-63, 2026-11-04)

> Revisión rápida sobre §3.2 y §3.6. **Pedido de Johannes (textual):** "no entiendo lo de audios bloqueados ... Sobre los audios bloqueados quiero más detalles al respecto."
> **Contexto en producción:** 534 audios tienen 3 de 3 intentos con "HTTP Error 402: Payment Required" (2 nov), de antes de que un 429/402 dejara de contar como intento. El pipeline los salta en todas las pasadas y nada los desbloquea solo: por eso hay 171 pasadas seguidas "Sin trabajo". La nota de §3.6 ("Se reintentan solas…") es **falsa** para estos audios.
> **Estado:** especificación lista; **implementable cuando Johannes responda P1 y P2** (§10). Si P1 = no, se implementa solo §8.1–§8.3 (explicación, sin botón).
> **Toca D-50 (solo lectura):** "Reintentar" sería la primera acción que escribe en esta vista. Lo decide Johannes (P1).

### 8.1 Qué es un audio bloqueado (modelo para el admin)

| Estado del audio (`asr_failures`) | Regla | Insignia | Qué hace el worker |
|---|---|---|---|
| Se reintentará | `attempts < MAX_ASR_ATTEMPTS` | **Se reintentará · {a} de 3 intentos** (`tone="warning"`) | Lo intenta en la próxima pasada |
| Bloqueado | `attempts >= MAX_ASR_ATTEMPTS` y sin reintento pedido | **Bloqueado · 3 de 3 intentos** (`tone="danger"`, ícono Lucide `Ban`) | No lo intenta más. No gasta en Gemini ni en OpenRouter |
| Reintento pedido | Bloqueado con `retry_requested_at` posterior a `last_attempt_at` | **Reintento pedido** (`tone="info"`) | Lo intenta en la próxima pasada (1 intento, P2) |

- El backend calcula el estado y lo envía como `status` (`retrying` · `blocked` · `retry_requested`) junto con `max_attempts`. El front no repite la regla.
- Insignias siempre con texto (WCAG 1.4.1).

### 8.2 Pestaña "Fallas de transcripción"

**Título de la pestaña:** "Fallas de transcripción ({n})"; si hay bloqueados: **"Fallas de transcripción ({n} · {b} bloqueados)"**.

**Aviso fijo arriba de la tabla** (reemplaza la nota falsa de §3.6):

> Cuando un audio falla al transcribirse, el worker lo vuelve a intentar en las pasadas siguientes, **hasta 3 veces**. Después queda **bloqueado**: el worker lo salta para no seguir pagando por un audio que falla siempre, y no lo vuelve a intentar hasta que lo reintentes desde acá. Las fallas por cuota o falta de saldo del proveedor (errores 429 y 402) ya no cuentan como intento.

**Agrupación por error** (mismo patrón de disclosure que §7.3 y §7.5, un `<tbody>` por grupo):

```
┌ HTTP Error 402: Payment Required ──────────────────────────────────────────────────────┐
│ ▸ 534 audios · 534 bloqueados · último intento 2 nov 18:40      [Reintentar 534 audios] │
└────────────────────────────────────────────────────────────────────────────────────────┘
  (expandido) Archivo · Estado · Intentos · Último intento · [Reintentar]
```

- **Clave del grupo:** el texto de error exacto (tipo + mensaje). Orden: grupos con más bloqueados primero; dentro, del intento más reciente al más antiguo.
- **Fila de grupo:** error (1 línea, completo en `title`), "{n} audios · {b} bloqueados · último intento {fecha hora}" y el botón **"Reintentar {b} audios"** (solo si b > 0; cuenta solo los bloqueados).
- **Expandido:** columnas **Archivo · Estado · Intentos · Último intento · Acción**. Se muestran 50 filas y un botón "Mostrar 50 más". El botón por fila, **"Reintentar"**, solo aparece en los bloqueados.
- Cerrado por defecto si el grupo tiene más de 20 audios; abierto si tiene 20 o menos.
- **Vacía:** "No hay fallas de transcripción." (sin cambios).

### 8.3 Aviso en la tarjeta de Estado (§3.2)

- Si b > 0, debajo del estado va una línea de advertencia (ícono + texto): **"{b} audios están bloqueados y el worker ya no los intenta. Ver fallas de transcripción"** (el enlace abre la pestaña).
- En "Últimas pasadas", el `title` de una pasada o grupo "Sin trabajo" con b > 0 agrega: "Hay {b} audios bloqueados que no se intentan."
- Así, la racha de "Sin trabajo" queda explicada donde se ve.

### 8.4 Reintentar (si P1 = sí)

**Alcance:** un audio (botón por fila) o todos los bloqueados de un mismo error (botón del grupo). Sin casillas de selección múltiple en esta versión.

**Diálogo de confirmación** (`Dialog` existente como alertdialog, foco inicial en **Cancelar**):

- **Título:** "¿Reintentar {b} audios?" / "¿Reintentar {archivo}?"
- **Cuerpo:**
  - "El worker los transcribirá y validará de nuevo en las próximas pasadas. Cada audio tendrá **1 intento nuevo**; si vuelve a fallar, queda bloqueado otra vez." (texto según P2)
  - "**Costo estimado:** US$ {min}–{max} (transcripción ~US$ {a1}–{a2} por audio + validación ~US$ {v} por llamada). Se cobra cada audio que el proveedor procese, aunque el resultado no sirva."
  - "Se procesan hasta 100 por pasada: ~{p} pasadas (~{t})." (solo si b > 100)
  - Solo si el error contiene 402 o 429: "Este error fue por falta de saldo o cuota del proveedor. Confirma que la cuenta tenga saldo antes de reintentar; si no, no se cobra, pero los audios esperarán sin avanzar."
- **Botones:** **"Reintentar {b} audios"** (primario) · **"Cancelar"** (secundario). Sin textos de culpa ni urgencia.
- **Después:** toast "Reintento pedido para {b} audios. Empezarán en la próxima pasada, a las {hora}." Las filas pasan a "Reintento pedido" y el botón del grupo desaparece hasta que haya bloqueados nuevos.
- **Error:** "No pudimos pedir el reintento. Inténtalo de nuevo." El diálogo queda abierto.
- **Con una pasada en curso:** se permite; aplica desde la pasada siguiente (lo dice el toast).

**Costo estimado (backend):**
- Validación: promedio de `ModelRun.cost_usd` de la corrida vigente en los últimos 30 días (ya existe).
- Transcripción: promedio de `asr_cost_usd / transcribed` de las pasadas con desglose (§9); mientras no haya, un rango fijo de configuración (hoy ~US$ 0,01–0,03 por audio, a verificar) [SUPUESTO H-115].
- Se muestra como rango redondeado a 2 decimales; nunca como precio exacto.

**Registro de actividad** (`AccessLog`): `action = "asr.retry"`, `target` = el archivo o el error recortado, `details` = "{b} audios · costo estimado US$ {min}–{max}". En `/admin/activity` se lee: "Reintentó {b} audios bloqueados ({error})".

**Backend (orientativo, para `pipeline-architect`):**
- `asr_failures`: + `retry_requested_at?`, `retry_requested_by?`.
- Reintento = poner `attempts = MAX_ASR_ATTEMPTS − 1` (1 intento, P2 recomendado) o borrar la fila (3 intentos) + guardar quién y cuándo.
- `POST /api/admin/processing/asr-failures/retry` con `{stems: [...]}` o `{error: "..."}`; responde cuántos quedaron pedidos. Solo `qubico_admin`.
- `GET /asr-failures` agrega `status`, `max_attempts`, `blocked_count` y `retry_estimate` (`asr_min`, `asr_max`, `validation_avg`). `GET /processing` agrega `blocked_count` para el aviso de §8.3.

### 8.5 Accesibilidad

- Botones con nombre completo: "Reintentar los {b} audios bloqueados por {error recortado}" / "Reintentar {archivo}".
- Diálogo: título y descripción enlazados (`aria-labelledby`/`aria-describedby`), Escape cierra, el foco vuelve al botón que lo abrió.
- El toast usa una región `aria-live="polite"`.

---

## 9. Ajuste: detalle de una pasada (D-64 a D-66, 2026-11-04)

> Revisión rápida sobre §3.5. **Pedido de Johannes (textual):** "me gustaría poder entrar al detalle de los works que fueron success. Ejemplo, tiempo y costos que demoró en revisar sftp, en transcribir, validar y subir y archivar."
> **Estado:** especificación lista; **implementable cuando Johannes responda P3–P5** (§10).
> **Límite:** hoy `pipeline_runs` no guarda tiempos por etapa ni costos. Se agregan columnas nuevas: solo las pasadas desde el despliegue tendrán desglose.

### 9.1 Acceso

- En "Últimas pasadas", la fecha de la celda **Inicio** de cada pasada individual (también las filas hijas de un grupo expandido) es un enlace a **`/admin/processing/runs/{id}`** (P3). Nombre accesible: "Ver el detalle de la pasada del {fecha hora}".
- La fila de grupo no enlaza (su celda Inicio es el disclosure de §7).
- Se puede abrir cualquier resultado (Completa, Con errores, Falló, Interrumpida, En curso, Sin trabajo), no solo las exitosas: las que fallaron también necesitan el detalle.
- Columna nueva **"Costo"** antes de Resultado (P4): "US$ {x}" o "—" si la pasada no tiene desglose. En una fila de grupo, la suma del grupo.

### 9.2 Página `/admin/processing/runs/{id}`

```
Procesamiento / Pasada del 4 nov 14:30                                      [Completa]
Empezó 14:30:05 · terminó 14:52:40 · duró 22 min 35 s

[Duración 22 min 35 s] [Costo estimado US$ 3,42] [Llamadas archivadas 100] [Costo por llamada US$ 0,034]

Etapa              Duración     Procesados                                   Costo estimado     Respaldo OpenRouter
1 Revisar SFTP     12 s         412 audios · 37 esperan metadata · 100 en esta pasada   Sin costo de API   —
2 Transcribir      14 min 2 s   98 de 100 · 2 con error · 0 por cuota        US$ 1,96           3 de 98 (US$ 0,09)
3 Validar          7 min 40 s   98 de 98 · ~4,7 s por llamada                US$ 1,46           —
4 Subir y archivar 41 s         100 archivados                               Sin costo de API   —
Total              22 min 35 s                                               US$ 3,42

Los costos son estimados con los precios del proveedor al momento de la pasada.
```
(cifras ilustrativas)

- **KPIs** (`KpiCard`): Duración · Costo estimado · Llamadas archivadas · **Costo por llamada** = costo total / archivadas ("—" si archivadas = 0).
- **Transcribir:** costo total; debajo, el reparto "Gemini US$ {g} · OpenRouter US$ {o}". **Respaldo OpenRouter:** "{f} de {transcritos}" con su costo.
- **Validar:** costo y latencia promedio por llamada ("~{s} s por llamada").
- **Revisar SFTP** y **Subir y archivar:** "Sin costo de API" (texto, no "US$ 0,00").
- **Falló:** caja de error con el mensaje arriba de la tabla; las etapas que no corrieron dicen "No se ejecutó".
- **Interrumpida:** "El worker se reinició durante esta pasada." Las etapas sin fin registrado dicen "Sin terminar".
- **En curso:** la página consulta cada 5 s (regla de §3.7); etapa actual "lleva {t}", siguientes "Pendiente". Los costos se acumulan por audio.
- **Etapa sin trabajo:** "Nada que hacer", con su duración real (puede ser 0 s).
- **Volver:** el breadcrumb "Procesamiento" vuelve a la vista con la pestaña "Últimas pasadas" activa.
- **No existe:** "No encontramos esa pasada. Puede haberse borrado por antigüedad (se guardan las últimas 200)." + enlace "Volver a Procesamiento".
- Sin detalle por audio en esta versión (P5).

### 9.3 Pasadas antiguas (sin desglose)

- Aviso informativo arriba: **"Esta pasada es anterior al registro de tiempos y costos por etapa. Solo hay la duración total y los contadores."**
- KPIs: Duración y Llamadas archivadas con dato; Costo y Costo por llamada con **"Sin registro"**.
- Tabla de etapas: Procesados con los contadores que hay; Duración y Costo con "Sin registro". Nunca "US$ 0,00" ni "0 s" (se leerían como dato real).
- Regla del backend: tiempos por etapa en null → sin desglose. `0` es un cero real.

### 9.4 Backend (orientativo, para `pipeline-architect`)

- `pipeline_runs` + columnas nullable (null = pasada antigua):
  - tiempos por etapa: inicio y fin de `listing`, `transcribing`, `validating`, `archiving` (columnas o un JSON `stage_timings`, a elección);
  - `asr_cost_usd`, `asr_fallback_count`, `asr_fallback_cost_usd` (suma del `cost_usd` del `_summary.json` por audio, separado por proveedor);
  - `validate_cost_usd`, `validate_latency_ms_total` (suma de `ModelRun.cost_usd` / `latency_ms` de esta pasada).
- Se acumulan al terminar cada audio, igual que los contadores (D-51).
- `GET /api/admin/processing/runs/{id}` y `cost_usd` total en cada fila de `GET /runs`.
- Sin backfill de pasadas antiguas en esta versión [SUPUESTO H-118].

### 9.5 Accesibilidad

- La tabla de etapas tiene `<caption>` ("Tiempos y costos por etapa"), encabezados de fila (`th scope="row"`) en Etapa y la fila de total en `<tfoot>`.
- Montos con formato `es-CL` y "US$" visible. "—" en la columna Costo de "Últimas pasadas" lleva `aria-label="Sin registro"`.
- La insignia de resultado lleva texto.

---

## 10. Decisiones pendientes (§8 y §9)

| # | Pregunta | Recomendación |
|---|---|---|
| P1 | ¿Se agrega "Reintentar" (primera acción que escribe; ajusta D-50)? | **Sí**, solo para bloqueados, por audio y por grupo de error, con confirmación y costo estimado |
| P2 | ¿Cuántos intentos nuevos da un reintento? | **1 intento** (si vuelve a fallar, se bloquea de nuevo). Alternativa: 3 intentos (borrar la fila), hasta 3× el costo |
| P3 | ¿Detalle de pasada como página o panel lateral? | **Página** `/admin/processing/runs/{id}`: se puede enlazar y volver, y no se mezcla con la consulta cada 5 s de la vista |
| P4 | ¿Columna "Costo" en "Últimas pasadas"? | **Sí** ("—" en las antiguas) |
| P5 | ¿Detalle por audio (tiempo, costo, proveedor) dentro de la pasada? | **No por ahora**; agregarlo después si hace falta |

### 10.1 Revisión rápida (§8 y §9)

- **Trazabilidad:** P-14.1, P-14.2 / R-14.3. Nuevo **P-14.3**: el admin no entiende por qué no hay trabajo cuando hay audios bloqueados, y la UI le dice que se reintentan solos. Nuevo **R-14.4**: ver tiempo y costo por etapa de una pasada.
- **Patrones:** disclosure de §7, `Dialog` existente, `KpiCard`, tabla, toast. Sin librerías nuevas.
- **Microcopy:** "bloqueado", "reintento pedido" y "costo estimado" van al glosario de `06-ux-writing.md`. El texto corrige la nota falsa.
- **Dark patterns:** no aplica. La confirmación muestra el costo antes de actuar, Cancelar tiene el foco inicial y nada se reintenta solo.
- **Mínimo privilegio:** solo `qubico_admin`; los nombres de archivo ya se mostraban (H-86); sin contenido de llamadas.
