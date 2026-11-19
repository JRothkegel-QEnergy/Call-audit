# Iteración 2 · "Criterio" en vez de "motivo" y modal de motivos de renuncia (criterio 18)

Fecha: 2026-11-19 · Estado: **fases 3 a 6 de la iteración aprobadas (2026-11-19, D-42 a D-47)**. Johannes: "Sí, apruebo todas" (IT-Q15 a IT-Q19 = A). Implementa el coordinador desde este documento.

**Decisiones vigentes:** D-42 alcance: toda la app, incluidas las exportaciones · D-43 "razón" para las acciones · D-44 el modal no muestra el motivo según el auditor · D-45 "Regla de aplicación" · D-46 vistas agregadas sin datos nuevos de la foto · D-47 la lista se lee del prompt vigente (§5.6). Donde este documento dice "según IT-Qn", rige la opción A.

Pedido de Johannes, textual: "Quiero que todo lo que dice motivo en realidad diga criterios o criterios. Los motivos son los motivos de renuncia. Siempre que salga el criterio 18, deberiamos poder revisar en un modal los motivos de renuncia."

Es una iteración de alcance **transversal**. El glosario es común a toda la app (`docs/ux/call-audit/06-ux-writing.md` §5 y §2.8, D-25) y el criterio 18 aparece en la cola del auditor, el detalle de llamada, el admin y Calidad del servicio. Se registra aquí porque la pidió Johannes en este hilo, pero al aprobarla se aplica también al glosario de `call-audit`.

## 1. Qué se reabre

| Fase | Proyecto | Qué cambia |
|---|---|---|
| 3 · AI (taxonomía y glosario) | call-audit y vistas-supervisor | "Criterio" pasa a ser el término de los 33 puntos de la pauta; "motivo" queda reservado (§3) |
| 4 · User flows | vistas-supervisor y call-audit (detalle de llamada) | Nuevo micro-flujo: abrir el modal desde cualquier criterio 18 y volver (§5.3) |
| 5 · Patrones | call-audit | Nuevo componente: modal de referencia de solo lectura con dos variantes, llamada y agregada (§5) |
| 6 · UX writing | ambos | Reemplazo de textos (§4) y textos del modal (§5.4) |
| 7 / 8 | — | No se reabren: Johannes pidió implementar directo desde la especificación (como la Iteración 1) |

**No se reabren:** 0 a 2 del proyecto base. No cambian los cálculos, permisos ni decisiones D-00 a D-41.

## 2. Datos que existen hoy (revisado en el código, sin inventar)

| Dato | Dónde está | Estado |
|---|---|---|
| Nombre oficial del criterio 18: "Tipifica motivo de renuncia incorrecto" | `rubrics/bancoestado_retention/v1.0.1.yaml` (M18, bloque E Tipificación) y `prompts/layer2/prompt.yaml` (`m18`) | Existe |
| Regla de aplicación del 18: basta con que el motivo tipificado **tenga sentido** con lo que dijo el cliente; si da varios, basta con uno; incumple solo si no tiene relación o lo contradice; "Retracto" exige sus condiciones | `prompts/layer2/prompt.yaml` `m18.criterion` (desde v2.6) | Existe (texto del prompt, no de la pauta) |
| **Lista cerrada de motivos de renuncia** | Solo en `prompts/layer2/prompt.yaml`, ítem `renunciation_reasons` (texto separado por `\|`, "Lista oficial de Motivos de Renuncia"). No está en la rúbrica ni en la API | Existe, **no expuesta** |
| Cantidad de la lista | `docs/context.md` y la pregunta #29 dicen **27**; la lista del prompt tiene **28** entradas: 27 + "No informado" | **TBD** (pregunta #30 a la corredora) |
| Motivo de renuncia que tipificó el ejecutivo (+ gestión tipificada) | `Typification.reason` / `outcome` (`frontend/src/lib/api/types.ts`), desde la metadata del lote; componente `TypificationLine` | Existe en el detalle de llamada; **no** en la foto de Calidad del servicio |
| Motivos de renuncia que sugiere la IA, con la frase del cliente y si la cita se validó | `Finding.suggestedReasons` (criterio 18, solo si incumple, prompt ≥ 2.8; ≥ 3 desde v2.10); componente `SuggestedReasons` | Existe en el detalle de llamada; **no** en la foto |
| Motivo de renuncia que el auditor considera correcto | — | **No existe**: el auditor confirma o corrige el veredicto del 18, pero no registra cuál era el motivo correcto |
| Una llamada con varios seguros | El prompt pide sugerencias "en la gestión de ese seguro"; `Typification` trae un solo motivo por llamada | **TBD**: cómo se muestra si hay varias gestiones con motivos distintos |

## 3. Terminología

### 3.1 Los cuatro usos actuales de "motivo" en la app

| Uso | Ejemplos actuales | Qué pasa |
|---|---|---|
| a) Punto de la pauta (33) | "Motivo 18", pestaña "Motivos", "Ver los 33 motivos", "Ir al motivo", "Motivo: todos" | **Pasa a "criterio"** |
| b) Motivo de renuncia (lista cerrada) | "Motivo de renuncia: Problemas Económicos", "Motivos de renuncia que sugiere la IA" | **Se queda**: es el único "motivo" |
| c) Razón de una acción | "Motivo de corrección", "Elige un motivo…", motivo del escalamiento, "Motivo del cambio", "Indica el motivo para incluir datos personales" | IT-Q16 |
| d) "Criterio" ya usado con otro sentido | "Criterio del prompt" (lector del prompt: la regla de aplicación de cada punto), "Prompt o criterio" (Calidad de la IA), "Criterio ambiguo en la pauta", "Duda de criterio", "Criterio mal aplicado", "distinto criterio" | Con el cambio, "criterio" significaría dos cosas en la misma pantalla. IT-Q18 |

Escala: unas 500 apariciones de "motivo"/"Motivo" en ~50 archivos de `frontend/src` (incluye comentarios y mocks), concentradas en admin (discrepancias, prompts, Calidad de la IA), Calidad del servicio, el checklist del auditor y el detalle de llamada.

### 3.2 Glosario propuesto (reemplaza las entradas de `call-audit/06-ux-writing.md` §5 y §2.8)

| Término | Definición | Uso en pantalla |
|---|---|---|
| **Criterio** | Cada uno de los 33 puntos de la pauta de calidad de la corredora. En la pauta oficial y en la planilla se llaman "motivos de no calidad" | "Criterio 18 · Tipifica motivo de renuncia incorrecto"; plural "criterios"; pestaña "Criterios" |
| **Motivo de renuncia** | La razón por la que el cliente renuncia al seguro, elegida por el ejecutivo de una lista cerrada (la tipificación) | Siempre completo: "motivo de renuncia". Nunca "motivo" solo en un rótulo; en texto corrido, después de nombrarlo, "el motivo" se entiende |
| **Bloque** | Grupo de criterios de la pauta (5) | Sin cambio |
| **Regla de aplicación** (si IT-Q18 = A) | Cómo aplica la IA un criterio (el campo `criterion` del prompt) | Reemplaza "Criterio del prompt" |

Los nombres oficiales de cada criterio **no cambian** aunque contengan la palabra: "Tipifica motivo de renuncia incorrecto" ya habla de motivo de renuncia. El prompt de la capa 2 y la rúbrica **no cambian** (texto del dominio de la corredora, regla del repo).

### 3.3 Reglas de reemplazo

| Antes | Después |
|---|---|
| Motivo {n} · {nombre} | Criterio {n} · {nombre} |
| M{n} (forma corta en grillas y listas densas) | C{n} |
| Motivos (pestaña de Calidad del servicio, sidebar del admin) | Criterios |
| los 33 motivos / Ver los 33 motivos | los 33 criterios / Ver los 33 criterios |
| Motivo: todos / Todos los motivos | Criterio: todos / Todos los criterios |
| Ir al motivo / Siguiente motivo con pendientes / Motivo anterior con pendientes | Ir al criterio / Siguiente criterio con pendientes / Criterio anterior con pendientes |
| Agregar nota al motivo en foco | Agregar nota al criterio en foco |
| motivos de no calidad (texto explicativo) | criterios de la pauta ("motivos de no calidad" en la pauta de la corredora) |
| Cada motivo describe algo que no debe ocurrir | Cada criterio describe algo que no debe ocurrir |
| los motivos 19 a 25 de tipificación no se evalúan | los criterios 19 a 25 de tipificación no se evalúan |
| Sin dato de la planilla en este motivo | Sin dato de la planilla en este criterio |
| Se marca distinto (ayuda: "…no coincide con la IA en este motivo") | "…en este criterio" |
| Relevante para el motivo {n} · Sobre: Motivo {n} · {mm:ss} | Relevante para el criterio {n} · Sobre: Criterio {n} · {mm:ss} |
| Llamadas o motivos asociados / Agrega al menos una llamada o un motivo | Llamadas o criterios asociados / Agrega al menos una llamada o un criterio |
| Títulos, tooltips, `aria-label`, `<caption>`, estados vacíos y textos alternativos de `09b` (§C) | Mismo texto con "criterio(s)"; p. ej. "Ejecutivos por criterio: diferencia con el equipo según la IA, en puntos" |
| URLs y parámetros (`/analysis/criteria`, `?criterion=`) | Sin cambio (ya están en inglés) |

**Código:** los identificadores ya están en inglés (`criterion`, `criterionId`, `CRITERIA`) y se quedan. Solo cambian textos visibles: JSX, `aria-*`, `title`, textos de mock que se muestran, mensajes de error de la API que lleguen a pantalla y, según IT-Q15, encabezados de exportación. Comentarios: opcional, sin prioridad. El ID HTML `motive-{id}` puede quedar.

## 4. Alcance del reemplazo por superficie

| Superficie | Ejemplos | Cambia con IT-Q15 = A |
|---|---|---|
| Cola y detalle del auditor | Checklist (`rubric-checklist.tsx`), atajos, diálogos, filtros | Sí |
| Detalle de llamada / revisión del admin | `call-detail.tsx`, `case-review.tsx`, ficha de producto | Sí |
| Calidad del servicio | Pestaña "Criterios" (solo Qubico, D-41), Ejecutivos, Auditores, fichas, lista de llamadas, gráficos de `09b` | Sí |
| Admin | Discrepancias (resumen, patrones, seguimiento), Calidad de la IA, versiones del prompt, `/dashboard/criteria` | Sí |
| Exportaciones (CSV/Excel) | Encabezados de columna | Según IT-Q15 |
| Prompt, rúbrica, nombres oficiales | `prompt.yaml`, `rubrics/` | No |
| Docs de UX cerrados | `docs/ux/*/0x-*.md` | No se reescriben; el glosario nuevo manda desde la fecha de la decisión |

## 5. Modal de motivos de renuncia (criterio 18)

### 5.1 Qué muestra, según el contexto

**Variante "llamada"** (hay una llamada concreta: checklist del auditor, detalle de llamada, revisión del admin, fila de la lista de llamadas de Calidad del servicio si IT-Q19 lo habilita):

1. Encabezado: "Criterio 18 · Tipifica motivo de renuncia incorrecto" + veredicto de la IA en el chip existente (Cumple / No cumple / Dudoso) y, si existe, el del auditor.
2. **Tipificó el ejecutivo**: gestión y motivo de renuncia (`Typification`, mismo texto que `TypificationLine`; "no informado" en gris si falta).
3. **Sugiere la IA** (solo si el 18 incumple y hay `suggestedReasons`): lista ordenada del más al menos adecuado, cada uno con la frase del cliente y el aviso existente si la cita no se validó (`QuoteWarning`). Si el 18 cumple: "La IA considera que el motivo tipificado calza con lo que dijo el cliente."
4. **Lista completa** (plegada por defecto en esta variante): los motivos de renuncia en el orden oficial, con el tipificado marcado "Tipificado" y los sugeridos marcados "Sugerido · 1.º / 2.º / 3.º" (texto, no solo color).
5. Pie: "Cómo se evalúa" (regla del 18 en lenguaje claro, §5.4) y la versión del prompt de la que sale.

Lo que **no** muestra (no existe el dato): el motivo que el auditor considera correcto (IT-Q17).

**Variante "agregada"** (no hay una llamada: pestaña y ficha del criterio 18, columna 18 de los mapas de calor A-2 y E-2, filas del 18 en FA-2/FA-3/FE-2/FE-3, `/dashboard/criteria`, discrepancias, lector del prompt):

1. Encabezado: "Criterio 18 · Tipifica motivo de renuncia incorrecto".
2. "Cómo se evalúa" (§5.4).
3. **Lista completa** abierta, en el orden oficial, en dos columnas a ≥ 640 px.
4. Según IT-Q19: nada más (A) o un bloque "En esta foto" con los motivos tipificados más frecuentes entre las llamadas que incumplen el 18 (B).

### 5.2 Dónde aparece el disparador

Regla: **cada vez que aparece el criterio 18 con su nombre o número**, junto a él hay un botón para abrir el modal.

| Lugar | Forma del disparador |
|---|---|
| Fila del 18 en el checklist del auditor y en la revisión del admin | Botón de texto con ícono `ListChecks` 14 px: "Motivos de renuncia", al lado de la tipificación ya visible. La caja inline de `SuggestedReasons` se queda (el auditor la usa al revisar); el modal agrega la lista completa |
| Detalle de llamada (cabecera con `TypificationLine`) | Mismo botón junto a la línea de tipificación |
| Tablas y listas con "Criterio 18 · …" (Criterios, fichas, discrepancias, lector del prompt) | Botón ícono `ListChecks` 24 × 24 px después del nombre, con nombre accesible |
| Encabezados compactos de mapas de calor (A-2, E-2, `/dashboard/criteria`) | El número "18" del encabezado pasa a ser botón (subrayado punteado + `cursor: pointer`, objetivo 28 × 28 px). No se agrega ícono: no cabe |
| Puntos y barras de gráficos (FA-2, FE-2…) | El rótulo de la fila (texto) lleva el botón ícono; la marca del gráfico mantiene su clic actual (lista de llamadas) |
| Lista de llamadas `/analysis/calls?criterion=18` | Botón en el título, variante agregada; por fila, variante llamada solo si IT-Q19 = B |

El botón nunca reemplaza el clic existente de la fila o celda (que lleva a llamadas o fichas): es un control aparte.

### 5.3 Flujo

```mermaid
flowchart LR
  A[Pantalla con criterio 18] -->|clic o Enter en "Motivos de renuncia"| M{¿Hay una llamada?}
  M -->|sí| L[Modal variante llamada]
  M -->|no| G[Modal variante agregada]
  L -->|Esc, Cerrar o clic fuera| A
  G -->|Esc, Cerrar o clic fuera| A
```

Solo lectura: el modal no tiene acciones aparte de cerrar y plegar o desplegar la lista. No cambia la URL (no es una página).

### 5.4 Textos

| Elemento | Texto |
|---|---|
| Disparador (texto) | Motivos de renuncia |
| Disparador (ícono), nombre accesible | Ver motivos de renuncia del criterio 18 |
| Título del modal | Motivos de renuncia |
| Subtítulo | Criterio 18 · Tipifica motivo de renuncia incorrecto |
| Sección | Tipificó el ejecutivo |
| Valor sin dato | No informado en el lote |
| Sección | Sugiere la IA |
| Si el 18 cumple | La IA considera que el motivo tipificado calza con lo que dijo el cliente. |
| Si no hay sugerencias (prompt anterior a 2.8) | Esta corrida no trae sugerencias de la IA. |
| Sección | Lista de motivos de renuncia ({n}) |
| Botón de la lista | Ver la lista completa · Ocultar la lista |
| Marcas en la lista | Tipificado · Sugerido 1.º · Sugerido 2.º · Sugerido 3.º |
| Sección | Cómo se evalúa |
| Texto "Cómo se evalúa" (resumen de `m18.criterion`, prompt vigente) | Cumple si el motivo tipificado tiene sentido con lo que dijo el cliente, aunque no sea el más exacto de la lista. Si el cliente dio varias razones, basta con que calce con una. No cumple si no tiene relación con lo que dijo o lo contradice. "Retracto" solo vale si se cumplen sus condiciones. |
| Pie | Lista oficial de la corredora · regla según el prompt {versión} |
| Cerrar | Cerrar |
| Lista no disponible (error de carga) | No pudimos cargar la lista de motivos de renuncia. Intenta de nuevo. · Reintentar |

### 5.5 Accesibilidad (WCAG 2.2 AA)

| Criterio | Cómo se cumple |
|---|---|
| 4.1.2 Nombre, función, valor | `Dialog` de Radix (ya instalado): `role="dialog"`, `aria-modal`, `aria-labelledby` = título, `aria-describedby` = subtítulo. Disparador con `aria-haspopup="dialog"` |
| 2.4.3 Orden del foco / 2.1.2 Sin trampa | Al abrir, foco en el título (no en "Cerrar", para que el lector empiece por el contenido); Tab recorre las secciones; Esc cierra y devuelve el foco al disparador |
| 1.3.1 Estructura | Secciones con `<h3>`; listas con `<ol>` (sugeridos, tienen orden) y `<ul>` (lista oficial) |
| 1.4.1 Uso del color | Tipificado y sugeridos con texto ("Tipificado", "Sugerido 1.º"), no solo resaltado |
| 2.5.8 Tamaño del objetivo | Disparador ícono 24 × 24 px; número del encabezado 28 × 28 px |
| 1.4.10 Reflujo | Ancho máx. 560 px; bajo 640 px la lista en una columna y el modal a pantalla casi completa con desplazamiento interno |
| 1.4.13 Contenido al pasar el mouse | No se usa tooltip para la lista: el modal es explícito |

### 5.6 Datos y contrato

| Necesidad | Propuesta | Estado |
|---|---|---|
| Lista oficial | **Decisión del coordinador (D-47):** la fuente única sigue siendo el prompt. `GET /api/reference/renunciation-reasons` lee `renunciation_reasons` de `prompts/layer2/prompt.yaml` vigente → `{ "source": "prompt {versión}", "reasons": ["No desea contraer más obligaciones", "Problemas Económicos", …, "No informado"] }`, en el orden oficial. No se mueve a la rúbrica por ahora (obligaría a subir la versión de la rúbrica y del prompt). El pie del modal dice "Lista oficial de la corredora · regla según el prompt {versión}" | Decidido |
| Variante llamada | Usa lo que ya trae el detalle de llamada: `typification`, `findings[criterionId=18].verdict` y `.suggestedReasons`. Sin cambios de contrato | Existe |
| Variante llamada desde `/analysis/calls` | No se hace (D-46): la fila abre la llamada, y ahí está la variante llamada | Descartado por ahora |
| Bloque "En esta foto" | No se hace (D-46) | Descartado por ahora |
| Motivo según el auditor | Requiere un campo en la revisión del auditor | Fuera de alcance (D-44); mejora aparte en el proceso `call-audit` |

## 6. Supuestos y riesgos

- **Riesgo de vocabulario con la corredora:** la pauta oficial y la planilla de Verónica dicen "motivo" para los 33 puntos. La app dirá "criterio". Mitigación: la primera vez en cada pantalla de ayuda y en el glosario se aclara "(en la pauta: motivos de no calidad)". Hipótesis **H-24**: Verónica entiende "criterio 18" sin aclaración. Validar en la reunión (P-8).
- **Riesgo de regresión de copy:** ~500 apariciones en ~50 archivos. Recomendación para la implementación: revisar con `grep -rn "[Mm]otivo" frontend/src` y dejar solo los usos b) (y c) según IT-Q16).
- **[TBD]** 27 o 28 motivos de renuncia ("No informado" incluido o no): pregunta #30 en `docs/client-open-questions.md`. El modal muestra la cantidad que traiga la lista ("({n})"), así que no bloquea.
- **[TBD]** Llamadas con varias gestiones y motivos distintos: hoy `Typification` trae uno solo; el modal muestra ese.
