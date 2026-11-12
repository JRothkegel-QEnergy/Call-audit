# Cambio · Métricas de la prueba del prompt (Admin → Versiones del prompt → detalle)

- **Tipo:** cambio menor sobre diseño aprobado (revisión rápida, proceso comprimido pedido por Johannes).
- **Pantalla:** pestaña "Prueba" de `frontend/src/app/(app)/admin/prompts/[version]/prompt-version.tsx` (`TestTab`, ~L.313-380).
- **Base aprobada:** `../call-audit/12-cambio-admin-qubico.md` (prueba del prompt), `../call-audit/15-calce-ia-por-corrida.md` (FP/FN, metas, H-88, H-101), `../call-audit/17-termino-auditoria-corredora.md` (planilla, "cliente").
- **Pedido (2026-11-10, Johannes):** (a) lenguaje más explícito; (b) tasas de FP y FN de llamada contra la meta (FP ≤ 5 %, FN ≤ 20 %); (c) ícono "?" con leyenda corta, accesible con teclado y touch.
- **Problema (P-01):** el jefe de proyecto no entiende "Solo la IA detectó", "Omitidos por la IA" ni "Dudosas"; los dos primeros son conteos sin denominador, así que no se pueden comparar con las metas.
- **Requisitos:** R-01 etiquetas que digan qué pasó y quién tiene la razón; R-02 FP y FN como tasa con la meta al lado; R-03 cumplimiento de la meta sin depender solo del color; R-04 leyenda "?" que funcione con teclado, touch y lector de pantalla (WCAG 2.2 AA).

---

## 1. Decisiones para Johannes (máx. 3)

| # | Pregunta | Recomendación |
|---|---|---|
| Q1 | ¿Cambio el vocabulario solo en esta pantalla o en toda la app? | **Solo aquí y en Calidad de la IA (`ai-quality.tsx`), que son pantallas de métricas contra la planilla.** En Discrepancias y en Análisis de discrepancias se mantiene "Solo la IA detectó / Omitidos por la IA". Ahí todavía no se sabe quién tiene la razón (el supervisor clasifica si la IA acertó), así que "falsa alarma" sería un juicio adelantado. El glosario deja la equivalencia escrita. |
| Q2 | ¿Muestro el conteo junto a la tasa ("33 % · 23 de 70")? Requiere que el backend envíe los denominadores. | **Sí.** Con ~70 aprobadas y ~150 rechazadas, un cambio de 3 puntos puede ser 2 llamadas; sin el conteo, eso no se ve. Hay que agregar `nApproved`, `nRejected`, `fpCount`, `fnCount` y `uncertainCount` a `call_rates()` en `golden_split.py` (son 5 sumas que ya se calculan ahí). Si prefieres no tocar el backend, la v1 muestra solo la tasa. |
| Q3 | En la tabla por motivo, ¿reemplazo "Llamadas con el motivo incumplido" por falsas alarmas y no detectados? | **Sí, reemplazarla** (opción B de §3). El conteo actual ("la IA lo marcó") mezcla aciertos con errores y no sirve para decidir. Precisión, recall y F1 quedan fuera de la UI porque son muy técnicos para el lector objetivo. |

---

## 2. Tabla principal: "Resultado contra la planilla de la corredora"

### 2.1 Encabezado y contexto (sobre la tabla)

- Título de la sección: **Resultado contra la planilla de la corredora**
- Línea de contexto (`.help`): **Medido sobre las mismas {n} llamadas de validación que la corredora ya revisó. La planilla se toma como la respuesta correcta.** Si no es la vigente, se agrega: **· La vigente se mide con sus corridas actuales, sin gastar.**
- **Resumen en una línea (recomendado y opcional):** se genera con una regla y no con IA. Ejemplo con los datos de hoy:
  > **Ninguna versión cumple las metas. v2.12 baja las falsas alarmas (58 % → 33 %), pero deja pasar más rechazos (28 % → 39 %).**
  Plantillas: "{Ninguna versión / Solo v{X} / Ambas versiones} cumple(n) las metas." + por cada métrica con meta: "v{prueba} {baja/sube} {nombre en minúscula} ({a} → {b})". Usa "pero" si una mejora y la otra empeora.

### 2.2 Columnas

| Métrica | Meta | v{vigente} (vigente) | v{prueba} |
|---|---|---|---|

- La columna **Meta** es nueva. Muestra "≤ 5 %", "≤ 20 %" o "—". Para el "—" se agrega el texto oculto "Sin meta" para lectores de pantalla.
- Si se mira la vigente sola (`same`), la tabla queda en tres columnas: Métrica · Meta · v{X}.

### 2.3 Filas (en este orden)

Primero va lo que tiene meta. La etiqueta principal va en negrita y la explicación corta en `.help`, en la misma celda, debajo.

| # | Antes | Etiqueta nueva | Línea de apoyo (bajo la etiqueta) | Meta | Valor | Fuente |
|---|---|---|---|---|---|---|
| 1 | Coincidencia con la planilla | **Coincide con la corredora** | Mismo veredicto final que la planilla | — | `62 %` | `criterionScores.callMatchRate` |
| 2 | Solo la IA detectó (conteo) | **Falsas alarmas (FP)** | La IA rechaza una llamada que la corredora aprobó | ≤ 5 % | `33 % · 23 de 70` | `callFpRate`, `fpGoal` |
| 3 | Omitidos por la IA (conteo) | **Rechazos no detectados (FN)** | La IA aprueba una llamada que la corredora rechazó | ≤ 20 % | `39 % · 58 de 150` | `callFnRate`, `fnGoal` |
| 4 | Dudosas | **Sin decisión de la IA** | Pasan a revisión de un auditor | — | `12 %` | `callUncertainRate` |
| 5 | Coincidencia con los auditores de la app | **Coincide con los auditores de la app** | Mismo veredicto que dejaron en la app | — | `%` | `references[app_auditors].matchRate` |
| 6 | Citas no validadas | **Citas que no aparecen en la llamada** | No se encontraron textuales en la transcripción | — | `%` | `unvalidatedQuoteRate` |
| 7 | Costo por llamada | **Costo por llamada** | — | — | `0,0123 USD` | `costPerCallUsd` |
| 8 | Latencia p95 | **Tiempo por llamada (p95)** | El 95 % termina en este tiempo o menos | — | `8,4 s` | `latencyMsP95` |

Los conteos de las filas 2 y 3 dependen de Q2. Los números de ejemplo de los conteos son ilustrativos.

**Nota de datos para el desarrollo:** las filas 1 a 4 deben salir de la misma fuente (`criterionScores`). Así la coincidencia, FP, FN y "sin decisión" se calculan sobre las mismas llamadas, sin las que tuvieron error. `references.client` las incluye, y dos números de "coincidencia" que no calzan generan justo la confusión que queremos evitar. `callFpRate` y `callFnRate` vienen como fracción (0,333) y `fpGoal`/`fnGoal` también (0,05): hay que multiplicarlos por 100 antes de usar `pct()`, que espera 0-100. Si `criterionScores` es `null` (no hay planilla por motivo), las filas 1 a 4 caen a `references.client` y la meta muestra "—".

### 2.4 Cómo se muestra la meta y el cumplimiento (sin depender del color)

En cada celda de valor de las filas 2 y 3:

```
33 % · 23 de 70
[✕ Fuera de meta]                ← badge vt-fail: ícono X + texto
−25 puntos · mejora              ← solo en la columna de prueba, texto .help
```

- **Cumple:** badge `vt-pass` con el ícono Check y el texto **"Cumple la meta"**.
- **No cumple:** badge `vt-fail` con el ícono X y el texto **"Fuera de meta"**. No se muestra la distancia a la meta en el badge: ya está la columna Meta al lado.
- **Comparación con la vigente** (todas las filas, solo en la columna de prueba): texto **"{+/−}{d} puntos · mejora"** o **"· empeora"**; en costo y tiempo, "{+/−}{d} %". Reemplaza al badge "empeora" actual, que solo marcaba lo malo y usaba el estilo de "dudoso". Si la diferencia es menor a 1 punto: **"Sin cambio"**.
- El estado se lee siempre en texto, con ícono y forma además del color (WCAG 1.4.1). El ícono va con `aria-hidden` porque el texto ya lo dice.
- Sin semáforo de fondo en la celda: si la fila entera se pinta de rojo, se pierde el contraste de los números.

### 2.5 Leyendas "?" (texto exacto)

Van en tono neutro, con "tú" y un máximo de tres frases. El título del popover es el nombre de la métrica.

| Fila | Texto de la leyenda |
|---|---|
| Coincide con la corredora | De cada 100 llamadas, en cuántas la IA llegó al mismo veredicto final (Cumple o No cumple) que la planilla de la corredora. Las llamadas que la IA deja sin decisión cuentan como no coincidentes. |
| Falsas alarmas (FP) | De las llamadas que la corredora aprobó, qué porcentaje rechaza la IA. Cada falsa alarma es una llamada que un auditor revisa sin necesidad. Meta del proyecto: 5 % o menos. |
| Rechazos no detectados (FN) | De las llamadas que la corredora rechazó, qué porcentaje aprueba la IA. Son incumplimientos que la IA deja pasar. Meta del proyecto: 20 % o menos. |
| Sin decisión de la IA | Llamadas en que la IA no se decide y las deriva a un auditor. No cuentan como falsa alarma ni como rechazo no detectado: si este número sube, esas dos tasas pueden bajar sin que la IA sea mejor. |
| Coincide con los auditores de la app | Igual que la coincidencia con la corredora, pero contra el veredicto que dejaron los auditores en la app. Se mide sobre menos casos: solo los que ya tienen revisión en la app. |
| Citas que no aparecen en la llamada | La IA respalda cada incumplimiento con una cita de la llamada. Este porcentaje son las citas que no se encontraron textuales en la transcripción: pueden ser paráfrasis o errores de la IA. |
| Costo por llamada | Costo promedio del modelo por llamada en esta prueba. |
| Tiempo por llamada (p95) | El 95 % de las llamadas se procesó en este tiempo o menos. Sirve para ver si la versión hace más lenta la cola de trabajo. |

---

## 3. Tabla por motivo

**Opción B (recomendada, Q3): reemplazar.** Título: **Errores por motivo**. Contexto (`.help`): **Compara qué motivos marcó la IA contra los que marcó la planilla, llamada por llamada.**

Encabezado en dos niveles, con `scope="colgroup"` y `scope="col"`:

| Motivo | Marcados por la corredora | Falsas alarmas: v{vigente} | Falsas alarmas: v{prueba} | No detectados: v{vigente} | No detectados: v{prueba} |
|---|---|---|---|---|---|
| Motivo 13 · {nombre} | 14 | 6 | 3 | 5 | 7 |

- Fuente: `criterionScores.byCriterion[].support`, `.fp` y `.fn`. "Marcados por la corredora" es igual para ambas versiones, así que va en una sola columna.
- Al nivel de motivo no se habla de "rechazos": la columna dice **No detectados**.
- En la columna de prueba, el número que empeora contra la vigente lleva el texto "▲" más un `sr-only` "empeora"; el que mejora lleva "▼" más "mejora". El color solo refuerza.
- Si el motivo tiene `support < 5` (`minSupport`), se agrega bajo su nombre el texto `.help` **"Pocos casos: el resultado varía mucho"**.
- Se mantiene el orden por número de motivo, que es el mismo que en el resto de la app.
- "?" en tres encabezados:
  - **Marcados por la corredora:** Llamadas en que la planilla marcó este motivo como No cumple.
  - **Falsas alarmas:** La IA marcó el motivo como No cumple y la corredora no.
  - **No detectados:** La corredora marcó el motivo como No cumple y la IA no.
- Cuando se mira la vigente sola, la tabla queda en cuatro columnas: Motivo · Marcados por la corredora · Falsas alarmas · No detectados.

**Opción A (alternativa):** mantener la tabla actual y agregar las columnas. Se descarta porque la tabla pasa a 7 columnas y el conteo "la IA lo marcó" no aporta a la decisión.

---

## 4. Patrón de la leyenda "?" (accesible)

- **Componente:** `@radix-ui/react-popover`, que ya está en el proyecto y se usa en `ai-quality.tsx`. Se crea un componente chico reutilizable, `MetricHelp` (`{ title, children }`), en `components/ui/`.
- **No usar `@radix-ui/react-tooltip`:** no abre con touch y solo se activa con hover o foco, así que no cumple lo pedido. Tampoco usar el atributo `title=`, que no funciona en touch ni con teclado.
- **Disparador:** `<button type="button">` con el ícono `CircleHelp` de 14 px y `aria-hidden`. Lleva `aria-label="Qué significa: {métrica}"`. El área táctil es de al menos 24 × 24 px (WCAG 2.5.8) y el foco visible usa el anillo estándar del proyecto (2.4.7 / 2.4.11). El color del ícono es el tinta suave del sistema, con contraste ≥ 3:1 sobre la tarjeta (1.4.11). Va inmediatamente después de la etiqueta, en la misma línea.
- **Interacción:**
  - Abre con clic, toque, Enter o Espacio.
  - Cierra con Esc, con clic o toque fuera, o al volver a activar el disparador.
  - Al cerrar, el foco vuelve al botón. Radix ya hace esto.
  - Se usa el comportamiento por defecto de Radix: el foco entra al contenido, que es `role="dialog"` no modal con `aria-labelledby` apuntando al título. Así el lector de pantalla lee la leyenda al abrir.
  - No se abre con hover. Así hay una sola forma de abrir y no aparece contenido emergente sin pedirlo (1.4.13).
  - Solo puede haber un popover abierto a la vez. Abrir otro cierra el anterior; Radix lo hace con el clic fuera.
- **Contenido:** título en negrita (el nombre de la métrica) y 1 a 3 frases. Ancho máximo de 320 px, `side="top"` con volteo automático y la misma clase visual que el popover de `ai-quality.tsx`. Sin enlaces ni botones dentro.
- **En móvil:** el popover se ajusta al ancho de la pantalla menos 16 px por lado (`collisionPadding={16}`).
- La leyenda complementa la línea de apoyo bajo la etiqueta, no la reemplaza. Lo esencial se lee sin abrir nada.

---

## 5. Glosario (agrega al de `../call-audit/06-ux-writing.md`)

| Término en la UI | Uso | Equivale a | Código |
|---|---|---|---|
| **Falsas alarmas (FP)** | Métricas contra la planilla: la IA rechaza una llamada (o marca un motivo) que la corredora aprobó | "Solo la IA detectó" en Discrepancias, donde aún no se sabe quién tiene la razón | `callFpRate`, `fp` |
| **Rechazos no detectados (FN)** | Métricas contra la planilla, a nivel de llamada: la IA aprueba una llamada que la corredora rechazó | "Omitidos por la IA" en Discrepancias | `callFnRate` |
| **No detectados** | Lo mismo, a nivel de motivo | "Omitidos por la IA" | `fn` |
| **Sin decisión de la IA** | Veredicto Dudosa visto como métrica. El badge de la llamada sigue diciendo "Dudosa" | Dudosas | `callUncertainRate` |
| **Coincide con la corredora** | Calce del veredicto de llamada contra la planilla | Coincidencia con la planilla | `callMatchRate` |

Si Q1 se aprueba como se recomienda, `ai-quality.tsx` cambia "Falsos positivos · Solo la IA detectó" por **"Falsas alarmas (FP)"** y "Falsos negativos · Omitidos por la IA" por **"Rechazos no detectados (FN)"**. Lo mismo para el encabezado "Dudosas" de la lista `admin/prompts/page.tsx`, que pasa a "Sin decisión".

---

## 6. Revisión rápida contra lo aprobado

| Chequeo | Resultado |
|---|---|
| Trazabilidad | P-01 → R-01..R-04 → §2.3, §2.4, §2.5, §4 |
| Patrones y navegación | Sin cambios de navegación. Se reutilizan la tabla `.tbl`, los badges `vt-*` y el Popover de Radix ya usados en el admin |
| Accesibilidad WCAG 2.2 AA | 1.4.1 (estado con texto e ícono), 1.4.11, 1.4.13, 2.1.1 (teclado), 2.4.7/2.4.11 (foco), 2.5.8 (24 px), 4.1.2 (nombre accesible del botón), encabezados con `scope` |
| Microcopy y glosario | "Cliente" no aparece (solo es la persona que llama). "La corredora" se usa como sujeto, igual que la planilla de calidad. Se trata de "tú" |
| Dark patterns | No aplica |

## 7. Supuestos y riesgos

- **[SUPUESTO] H-01:** las palabras "falsa alarma" y "rechazo no detectado" se entienden sin capacitación. Se valida mostrándole la pantalla a Agustín y pidiéndole que explique con sus palabras qué significa 33 %.
- **[SUPUESTO] H-02:** "aprobada/rechazada por la corredora" equivale a Cumple/No cumple en la planilla, que es como lo dice Johannes.
- **Riesgo R-a:** "Sin decisión" baja FP y FN de forma artificial. Por eso su leyenda lo advierte y la fila va justo debajo de FP y FN.
- **Riesgo R-b:** con ~70 aprobadas, cada falsa alarma mueve la tasa en ~1,4 puntos. El conteo (Q2) evita leer de más diferencias chicas.
- **Riesgo R-c:** el ícono "?" se parece al del badge "Dudoso" (`HelpCircle`). Se mitiga con estilo neutro (sin color ámbar ni fondo) y con el cambio de "Dudosas" a "Sin decisión". Si aun así confunde, la alternativa es el ícono `Info`.
