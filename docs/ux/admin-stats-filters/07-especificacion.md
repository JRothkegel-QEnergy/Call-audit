# Filtros de Estadísticas (admin) · Especificación mínima

**Estado:** aprobada por Johannes el 2026-11-09 con las cinco recomendadas, e implementada. Ajustes hechos al implementar: con 8 a 14 barras se muestra una fecha de cada 2, y con 30 barras se omite la fecha que quedaría muy cerca de la última porque se pisaban.
**Pantalla:** `/admin/stats` (`frontend/src/app/(app)/admin/stats/page.tsx`) · **Actor:** Admin · **API:** `GET /api/admin/stats`.
**Fuera de alcance:** pestaña Calidad de la IA, Exportar CSV, tokens o componentes nuevos, re-corridas con IA.

## 1. Lo que encontré en el código y en la base local

| Hallazgo | Consecuencia |
|---|---|
| Las 100 llamadas tuvieron su primera corrida sin error el 15 oct. | El gráfico hoy muestra **una sola barra** (15 oct = 100). Las corridas del 20 y 22 oct son re-corridas y no suman. |
| Contado desde hoy (9 nov), "Últimos 7 días" (3–9 nov) queda vacío. "Últimos 30 días" (11 oct–9 nov) incluye todo. | 30 días empieza a perder datos el 14 nov y queda vacío el 21 nov. |
| "Llamadas procesadas" cuenta `Case`, tenga o no corridas; el gráfico cuenta primeras corridas. | Son dos definiciones distintas bajo el mismo nombre. |
| Solo Gemini corrió el prompt v2.10. | Combinaciones como Haiku + v2.10 dan vacío. |
| `useAsync` no cancela pedidos y `AsyncView` sigue mostrando los datos anteriores mientras carga. | Sin ajuste, se verían números viejos con el filtro nuevo, y una respuesta lenta podría pisar a la última. |
| `setTab` reescribe la URL solo con `tab`. | Sin ajuste, cambiar de pestaña borraría los filtros. |

## 2. Comportamiento

**Ubicación.** La barra de filtros baja de encima de las pestañas a dentro de Operación y Costo. Calidad de la IA no la muestra: sigue con su selector de corridas.

**A qué aplica cada filtro**

| Elemento | Periodo | Modelo | Prompt |
|---|---|---|---|
| Llamadas procesadas · min | Sí | Sí | Sí |
| Mediana hasta el resultado (hoy sin dato) | No | No | No |
| Lotes con error (KPI y tabla) | Sí | Sí | Sí |
| En cola de revisión | No | No | No |
| Casos revisados por día | Sí | No | No |
| Gráfico Llamadas procesadas | Sí | Sí | Sí |
| Tabla de Costo | Sí | Sí | Sí |

**Periodo.** Contado desde hoy, en días calendario de Chile (`America/Santiago`), hoy incluido. Opciones: Todo el historial (por defecto), Últimos 7 días, Últimos 30 días. Se filtra por `ModelRun.run_at`.

**Llamadas procesadas.** Una llamada cuenta una vez, el día de su primera corrida sin error **dentro del modelo y prompt elegidos**. Primero se calcula esa primera corrida sobre toda la historia y después se recorta por periodo: una re-corrida dentro del periodo no cuenta. El KPI es la suma del gráfico y sus minutos son los de esas llamadas.

**Gráfico.** Cubre el periodo completo:

| Periodo | Eje | Barras |
|---|---|---|
| 7 días | Termina hoy | 7, con valor sobre cada barra y todas las fechas |
| 30 días | Termina hoy | 30, valor solo en la barra más alta, una fecha cada 5 días y la última, separación de 1 px, más "Ver datos por día" |
| Todo, hasta 31 días | De la primera a la última fecha con llamadas procesadas | Por día |
| Todo, más de 31 días | Igual | Por semana, con título "por semana" |

Cada barra mide como máximo 48 px y su fecha va alineada debajo de ella.

**Casos revisados por día.** Revisiones del periodo ÷ días del periodo. En Todo el historial, los días desde la primera revisión hasta hoy.

**Opciones de Modelo y Prompt.** Salen de toda la historia y no se recortan entre sí. Prompt va de mayor a menor con orden de versión (v2.10, v2.8, v2.7). Modelo usa la etiqueta de `all_models()`.

**Aplicación.** Cada cambio se aplica al tiro, sin botón "Aplicar". Quitar filtros vuelve a los valores por defecto.

## 3. Resultado esperado con la base local (criterio de aceptación)

| Filtros | Procesadas | Gráfico | Lotes con error | Filas de Costo |
|---|---|---|---|---|
| Todo, todos | 100 | 15 oct: 100 (1 barra) | 3 | 9 |
| Últimos 7 días (9 nov) | 0 | Estado vacío | 0 | Estado vacío |
| Últimos 30 días (9 nov) | 100 | 30 barras, 15 oct: 100 | 3 | 9 |
| Prompt v2.7 | 100 | 15 oct: 100 | 2 | 4 |
| Prompt v2.8 | 100 | 20 oct: 100 | 1 | 4 |
| Prompt v2.10 | 100 | 22 oct: 100 | 0 | 1 |
| Haiku + v2.8 | 99 | 20 oct: 99 | 1 | 1 |
| Haiku + v2.10 | 0 | Estado vacío | 0 | Estado vacío |

## 4. Estados

| Estado | Comportamiento |
|---|---|
| Primera carga | `LoadingState` existente. Periodo activo; Modelo y Prompt deshabilitados hasta tener opciones. |
| Cambio de filtro | Datos anteriores atenuados (`opacity-60`, sin animación), `aria-busy="true"` en el contenedor y "Actualizando…" en lugar del rango. Solo se aplica la respuesta del último pedido. |
| Error | `ErrorState` existente con Reintentar, que repite el pedido con los filtros actuales. La barra sigue disponible. |
| Vacío en Operación | Los KPI se mantienen. Gráfico y tabla muestran su propio mensaje. |
| Vacío en Costo | `EmptyState` en lugar de la tabla. |
| Sin corridas en la base | "Aún no hay corridas registradas.", sin botón. |
| Valor inválido en la URL | Se quita ese parámetro con `router.replace` y se usa el valor por defecto. |

## 5. Textos exactos

| Lugar | Texto |
|---|---|
| Periodo | `Todo el historial` · `Últimos 7 días` · `Últimos 30 días` |
| Modelo | `Modelo: todos` · `Modelo: {etiqueta}` |
| Prompt | `Prompt: todas` · `Prompt: v{versión}` |
| Rango, 7 y 30 días | `{dd mes} – {dd mes}` |
| Rango, Todo | `{dd mes} – {dd mes} · primera y última corrida` |
| Botón (solo con filtros activos) | `Quitar filtros` |
| Hint de En cola de revisión | `Ahora. No cambia con los filtros.` |
| Hint de Casos revisados | `Usa el periodo. No depende de modelo ni prompt.` |
| Título del gráfico | `Llamadas procesadas por día` · `Llamadas procesadas por semana` |
| Ayuda del gráfico, sin modelo ni prompt | `Cada llamada cuenta una vez, el día de su primera corrida sin error.` |
| Ayuda del gráfico, con modelo o prompt | `Cada llamada cuenta una vez, el día de su primera corrida sin error con estos filtros.` |
| Datos del gráfico | `Ver datos por día` · `Ver datos por semana` |
| Gráfico vacío por periodo | `Sin llamadas procesadas en este periodo.` |
| Gráfico vacío con modelo o prompt | `Sin llamadas procesadas con estos filtros.` |
| Referencia en vacíos (si hay corridas para ese modelo y prompt) | `Última corrida: {dd mes}.` |
| Tabla de lotes vacía, sin filtros | `Sin lotes con error.` |
| Tabla de lotes vacía, con filtros | `Sin lotes con error con estos filtros.` |
| Costo vacío | `Sin corridas con estos filtros.` |

## 6. URL y API

- **URL:** `?tab=cost&period=30d&model=claude-haiku-5-5&prompt=2.8`. `period` acepta `7d` o `30d`. Los valores por defecto no se escriben.
- Se usa `router.replace` con `scroll: false`, igual que el resto de la pantalla.
- `setTab` conserva `period`, `model` y `prompt`. En Calidad quedan en la URL sin efecto, para recuperarlos al volver.
- **API:** `GET /api/admin/stats?period=&model=&prompt=`, todos opcionales. Agrega al JSON `filters: { models: [{ id, label }], promptVersions: [string], range: { from, to } | null, lastRunAt: string | null }` y `operation.dailyBucket: "day" | "week"`.

## 7. Accesibilidad (WCAG 2.2 AA)

| Criterio | Cómo se cumple |
|---|---|
| 1.1.1 Contenido no textual | `aria-label` del gráfico con el rango y solo los días con datos, cerrando con "los demás días, 0". Con más de 14 barras, tabla real dentro de `<details>`. |
| 1.3.1 / 4.1.2 Nombre y función | Selects nativos con `aria-label` (`Periodo`, `Modelo`, `Versión del prompt`). Agregar `role="tabpanel"` con `aria-labelledby` al contenedor de cada pestaña. |
| 1.4.10 Reflow | La barra usa `flex-wrap`; con 30 barras la separación baja a 1 px. |
| 1.4.11 Contraste de controles | `--input` ya da 3,15:1 (verificado en tokens). |
| 2.4.3 Orden del foco | Al usar Quitar filtros el botón desaparece: el foco pasa al select Periodo. |
| 2.4.7 Foco visible | `:focus-visible` global existente. |
| 2.5.3 Etiqueta en el nombre | El texto visible parte con el nombre del filtro (`Modelo: …`). |
| 2.5.8 Tamaño del objetivo | `.control` mide 32 px de alto. |
| 3.2.2 Al introducir datos | Cambiar un filtro actualiza datos sin mover el foco ni cambiar de página. |
| 4.1.3 Mensajes de estado | Región `aria-live="polite"`: `Actualizando…`, y al terminar `{n} llamadas procesadas, {rango}` (Operación) o `{n} combinaciones de modelo y prompt, {rango}` (Costo). |

Deuda existente, fuera de este cambio: las pestañas no se mueven con flechas.

## 8. Notas para implementar

1. `useAsync` necesita descartar respuestas antiguas (contador de pedido o `AbortController`).
2. `admin_stats` carga `ModelRun` completo, con `raw_response` y `user_prompt`. Conviene filtrar en SQL y traer solo las columnas necesarias.
3. Actualizar `ApiClient` (`client.ts`), `http-api.ts`, `admin-types.ts` y `admin-mock.ts`.
4. Tests afectados en `tests/test_admin.py`: `test_stats_have_no_people` (espera 3 procesadas; revisar si los casos del fixture tienen corridas) y `test_daily_keeps_last_days_and_handles_no_runs` (ventana de 14 días).
5. Implementar y verificar no requiere correr IA. Se valida contra la tabla de §3.
