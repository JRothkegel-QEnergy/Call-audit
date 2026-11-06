# Cambio 17 · "Cliente" ya no nombra a la corredora en la UI

> Revisión rápida (copy y glosario) sobre lo aprobado. Fecha: 2026-11-05. **Estado: aprobado (2026-11-05), implementable.** Solo copy: sin cambios de API, tipos ni valores de código.
> **Origen:** decisión de actores de Johannes (`CLAUDE.md`, `docs/context.md` § Actores): **cliente = SIEMPRE la persona que llama**.
> **Aprobación (textual):** "Aprobar todo". H-121 a H-123 sin objeción.
> **Numeración:** D-71 a D-74, H-121 a H-123. Sin ítems L nuevos (preferencia de Johannes).

## 0. Decisiones

| # | Pregunta | Respuesta de Johannes |
|---|---|---|
| 1 | Término para el veredicto que llega con el lote | **"Planilla de calidad"** (corto: **"la planilla"**) → D-71 |
| 2 | Término para la empresa como contraparte | **"la empresa"**; `{clientName}` solo en el encabezado del admin, Cuentas y la invitación. No se usa "Preguntas a {clientName}" → D-72 |
| 3 | "Por presentar al cliente" | **"Por presentar"** → D-73 |
| 4 | Aviso del panel del modelo (L-29) | "Datos del cliente" se refería a ambas (empresa y personas que llaman). Texto: "Contenido técnico confidencial de Qubico y de la empresa, con datos de clientes. No lo compartas fuera de la app." (H-123) |
| 5 | Alcance | Copy visible y mocks de la demo. **No** se tocan comentarios ni JSDoc → D-74 |

| ID | Decisión |
|---|---|
| D-71 | El veredicto, la marca por motivo y el comentario que llegan con el lote se llaman **Planilla de calidad** (corto: **la planilla**). Reemplaza "Veredicto / Auditoría / Comentario del cliente" y "Excel del cliente" |
| D-72 | La empresa como contraparte se llama **la empresa**; `{clientName}` se interpola en el encabezado del admin, Cuentas e invitación |
| D-73 | "Por presentar al cliente" pasa a **"Por presentar"** |
| D-74 | Etiquetas de la fuente centralizadas en una constante del front (`SOURCE_LABEL`). Alcance: copy visible + mocks de la demo; comentarios y JSDoc quedan igual |

## 1. Problema

La UI usaba "cliente" para dos cosas que no son la persona que llama:

- **(A) La fuente del veredicto humano previo:** `ESTADO_CALIDAD`, marca C01..C33 y comentario que vienen en la planilla del lote (`externalQualityVerdict`, `externalItemVerdicts`, `externalComment`, `source/kind = "client"`).
- **(B) La empresa como contraparte** (`clientName`).

Auditor, supervisor y el equipo que llena la planilla son todos de la corredora (D-11, H-06): lo que distingue a (A) es **la fuente**, no la empresa. Por eso "la corredora" o "{client_name}" no desambiguan.

## 2. Opciones evaluadas

| Opción | Pros | Contras |
|---|---|---|
| "la corredora" | Coincide con la prosa de los docs | Para el supervisor son ellos mismos; no distingue la planilla de los auditores de la app; no sirve para otra empresa |
| `{client_name}` | Multi-empresa | Largo, sin nombre corto; mismo problema de perspectiva |
| "auditoría externa" | Calza con `external*` | Estaba en "Evitar" de C09; para la corredora es interna |
| "Calidad" / "QA BancoEstado" | Nombre del área | Choca con "Calidad de la IA" (C15); "QA BancoEstado" acopla a un cliente |
| "auditoría previa / original" | Neutra | Abstracta, larga, mala como columna |
| **"Planilla de calidad" / "la planilla"** (elegida) | La reconoce el supervisor; neutra; multi-empresa sin interpolar; corta para columnas | Nombra el medio: si llega por API se revisa (H-122, barato por D-74) |

## 3. Supuestos

- **H-121** El supervisor reconoce "la planilla" como la planilla de aprobado/rechazado de su equipo de calidad. Pendiente.
- **H-122** El veredicto seguirá llegando en planilla durante el MVP. Pendiente.
- **H-123** "Datos del cliente" del aviso L-29 cubría empresa y personas que llaman. Validada por Johannes.

## 4. Docs actualizados (2026-11-05)

`06-ux-writing.md` (privacidad, glosario C16, bloque nuevo "Ajuste 2026-11-05" y palabras prohibidas), `09` (§0, §2, §3, §4 glosario, §5 copy), `10` (aviso del panel), `11` (vacío del catálogo, placeholder de nota), `12` (invitación, diálogo de prueba), `15` (hechos, flujo, wireframe, estados, §7.5 glosario), `16` (propuestas, causas, wireframes, estados, §7.5 glosario). Cada uno lleva una nota "Ajuste 2026-11-05 (Cambio 17)" en la cabecera. Los prototipos `07`/`08` (html) no tenían usos de (A) ni (B). La prosa histórica de decisiones (p. ej. D-70 "Preguntas a la corredora") no se reescribe.

## 5. No cambian (cliente = persona que llama)

- Ficha del cliente (C13): `product-sheet.tsx:91, 110`.
- Hablante: `transcript.tsx:11`; `[nombre del cliente]` (`data.ts:245, 270`); `[NOMBRE_CLIENTE]` (`model-panel.tsx:87`).
- Avisos de PII: `notes.tsx:59`, `app/(app)/discrepancies/page.tsx:308`, `agent-detail.tsx:164`, `catalog/page.tsx:362`, `privacy/page.tsx:43`.
- Nombres de motivos y reglas de categoría: `data.ts:23, 24, 33, 41, 43, 45, 143, 157, 171, 339, 410, 540`.
- Ejemplos de conversación en mocks: `discrepancy-mock.ts:173, 183`; `mock-api.ts:63, 90, 99`.
- Comentarios y JSDoc (D-74).

## 6. Tabla para implementar (actual → nuevo)

Rutas relativas a `frontend/src/`. Líneas al 2026-11-05. **[nuevo]** = ajuste respecto del borrador.

### 6.1 Componentes compartidos y constante

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `components/ui/badges.tsx:64` | title "Veredicto de la auditoría del cliente. En su planilla: Aprobado = Cumple · Rechazado = No cumple." | Veredicto de la planilla de calidad. Aprobado = Cumple · Rechazado = No cumple. |
| `components/ui/badges.tsx:67` | Auditoría del cliente | Planilla de calidad |
| (nuevo) constante, p. ej. `lib/source-labels.ts` | — | `SOURCE_LABEL = { full: "Planilla de calidad", short: "la planilla", column: "Planilla" }` (D-74). Opcional pero recomendado |

### 6.2 Supervisor: detalle de llamada (C09)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `app/(app)/calls/[id]/call-detail.tsx:398` | Cliente: | Planilla: **[nuevo: queda "Planilla:" + badge "Planilla de calidad", sin repetir el nombre completo]** |
| `app/(app)/calls/[id]/call-detail.tsx:403` | Comentario del cliente | Comentario en la planilla |
| `components/call/rubric-checklist.tsx:336` | → Cliente: | → Planilla: |
| `components/call/rubric-checklist.tsx:340` | title y aria-label "Sin dato del cliente en este motivo" | Sin dato de la planilla en este motivo |
| `components/call/model-panel.tsx:91` | Contenido técnico confidencial de Qubico y datos del cliente. No lo compartas fuera de la app. | Contenido técnico confidencial de Qubico y de la empresa, con datos de clientes. No lo compartas fuera de la app. |

### 6.3 Supervisor: Discrepancias (C09)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `app/(app)/discrepancies/page.tsx:20` | La IA dice No cumple y el cliente dice Cumple. Clasifica si la IA tenía razón. | La IA dice No cumple y la planilla dice Cumple. Clasifica si la IA tenía razón. |
| `…:21` | La IA dice Cumple y el cliente dice No cumple. | La IA dice Cumple y la planilla dice No cumple. |
| `…:22` | La IA no se decidió, con cualquier veredicto del cliente. | La IA no se decidió, con cualquier veredicto de la planilla. |
| `…:23` | La IA y el cliente dan el mismo veredicto de llamada. | La IA y la planilla dan el mismo veredicto de llamada. |
| `…:61` | Discrepancias con el cliente | Discrepancias con la planilla |
| `…:62` | Compara la IA con la auditoría del cliente en las llamadas que traen su veredicto. | Compara la IA con la planilla de calidad en las llamadas que la traen. |
| `…:76` | Este periodo no trae veredictos del cliente. | Este periodo no trae planilla de calidad. |
| `…:77` | Las discrepancias aparecen cuando un lote incluye la auditoría del cliente. | Las discrepancias aparecen cuando un lote incluye la planilla de calidad. |
| `…:83` | Referencia: auditoría del cliente · {n} llamadas | Referencia: planilla de calidad · {n} llamadas |
| `…:86` | {%} de coincidencia con el cliente | {%} de coincidencia con la planilla |
| `…:109` | Por presentar al cliente | Por presentar |
| `…:124` | Cliente (columna) | Planilla |
| `…:178` | Por presentar al cliente | Por presentar |

### 6.4 Admin: Prompt (C12)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `app/(app)/admin/prompts/page.tsx:42` | Coincidencia con el cliente | Coincidencia con la planilla |
| `app/(app)/admin/prompts/[version]/prompt-version.tsx:22` | `client: "auditoría del cliente"` | `client: "planilla de calidad"` |
| `…prompt-version.tsx:307` | No hay llamadas con veredicto del cliente para medir. | No hay llamadas con planilla de calidad para medir. |
| `…:344` | Coincidencia con el cliente | Coincidencia con la planilla |
| `…:418` | No hay llamadas con veredicto del cliente para probar. | No hay llamadas con planilla de calidad para probar. |
| `…:433` | No hay llamadas con veredicto del cliente para probar. | No hay llamadas con planilla de calidad para probar. |
| `…:437` | …sobre {n} llamadas que traen el veredicto del cliente. | …sobre {n} llamadas que traen la planilla de calidad. |
| `…:519` | Coincidencia con el cliente: {a} → {b} | Coincidencia con la planilla: {a} → {b} |
| `…:526` | Esta versión baja la coincidencia con el cliente de {a} a {b}. | Esta versión baja la coincidencia con la planilla de {a} a {b}. |

### 6.5 Admin: Calidad de la IA (C15)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `components/admin/ai-quality.tsx:110` | Aún no hay llamadas con veredicto del cliente para medir. | Aún no hay llamadas con planilla de calidad para medir. |
| `…:131` | Referencia: veredicto del auditor del cliente · {n} llamadas (…) | Referencia: planilla de calidad · {n} llamadas (…) |
| `…:135` | El Excel de estas llamadas no trae la marca por motivo: … | La planilla de estas llamadas no trae la marca por motivo: … **[nuevo, consistencia]** |
| `…:157` | ¿Qué corrida calza mejor con el cliente? | ¿Qué corrida calza mejor con la planilla? |
| `…:205` | …+n = la IA lo marca en una No cumple y el cliente no · … | …+n = la IA lo marca en una No cumple y la planilla no · … |
| `…:207` | Ninguna corrida ni el cliente marcaron los motivos {…}. | Ninguna corrida ni la planilla marcaron los motivos {…}. |
| `…:242` | `t="Marca del cliente por motivo"` · Motivos que el auditor del cliente marcó NO CUMPLE en el Excel. | `t="Marca de la planilla por motivo"` · Motivos marcados NO CUMPLE en la planilla de calidad. |
| `…:243` | De las llamadas que el cliente marcó No cumple, … | De las llamadas que la planilla marcó No cumple, … |
| `…:245–246` | Llamadas Cumple según el cliente que la IA marca No cumple. … la IA marca un motivo que el cliente no marcó. | Llamadas Cumple según la planilla que la IA marca No cumple. … la IA marca un motivo que la planilla no marcó. |
| `…:249` | Llamadas No cumple según el cliente que … Por motivo: el cliente lo marcó y la IA no. | Llamadas No cumple según la planilla que … Por motivo: la planilla lo marcó y la IA no. |
| `…:252` | …donde la IA dijo lo mismo que el cliente. | …donde la IA dijo lo mismo que la planilla. |
| `…:253` | La IA y el cliente difieren en el veredicto… | La IA y la planilla difieren en el veredicto… |
| `…:256` | La marca del cliente se toma como verdad. Si el auditor del cliente pasó por alto un incumplimiento, … | La planilla se toma como verdad. Si quien la llenó pasó por alto un incumplimiento, … |
| `…:486` | Cliente No cumple | Planilla: No cumple |
| `…:493` | Cliente Cumple | Planilla: Cumple |
| `…:542` | Ninguna corrida ni el cliente marcaron motivos en estas llamadas. | Ninguna corrida ni la planilla marcaron motivos en estas llamadas. |
| `…:554` | No cumple: detecta lo del cliente (de {n}) | No cumple: detecta lo de la planilla (de {n}) |
| `…:570` | Cliente (columna) | Planilla |
| `…:808` | {Cumple / No cumple} según el cliente ({n}) | {Cumple / No cumple} según la planilla ({n}) |
| `…:855` | Coincide con el cliente | Coincide con la planilla |
| `…:968` | {corrida} coincide con el cliente en todas las llamadas. | {corrida} coincide con la planilla en todas las llamadas. |
| `…:984` | Cliente (columna) | Planilla |
| `components/admin/quality-banner.tsx:32` | IA {x} · Cliente {Cumple / No cumple} · Revisión manual: | IA {x} · Planilla {Cumple / No cumple} · Revisión manual: |

### 6.6 Admin: Análisis de discrepancias (C16)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `app/(app)/admin/discrepancies/page.tsx:52` | Por qué la IA y el cliente no coinciden. … | Por qué la IA y la planilla no coinciden. … |
| `…:140` | Aún no hay llamadas con corrida vigente y marca por motivo del cliente para comparar. | Aún no hay llamadas con corrida vigente y marca por motivo en la planilla para comparar. |
| `…:143` | La corrida vigente coincide con el cliente en todos los motivos. … | La corrida vigente coincide con la planilla en todos los motivos. … |
| `…:190` | …con el Excel del cliente y la revisión manual Qubico. | …con la planilla de calidad y la revisión manual Qubico. |
| `…:244` | …la causa Evaluador del cliente se apoya casi solo en el Excel. | …la causa Evaluador de la planilla se apoya casi solo en la planilla. |
| `…:259` | Cliente NO CUMPLE | Planilla NO CUMPLE |
| `…:309` | Por evaluador del cliente | Por evaluador de la planilla |
| `…:320` | Rechaza (Excel) | Rechaza (planilla) **[nuevo, consistencia]** |
| `…:343` | El Excel de estas llamadas no trae el evaluador. Reimporta la metadata con el Excel nuevo para verlo. | La planilla de estas llamadas no trae el evaluador. Reimporta la metadata con la planilla nueva para verlo. **[nuevo, consistencia]** |
| `…:416` | …entre la corrida vigente y el Excel del cliente, … | …entre la corrida vigente y la planilla de calidad, … |
| `…:418` | Si el Excel y la revisión manual Qubico no coinciden, … | Si la planilla y la revisión manual Qubico no coinciden, … **[nuevo, consistencia]** |
| `…:529` | Preguntas al cliente | Preguntas a la empresa |
| `…:530` | Sin preguntas al cliente. | Sin preguntas a la empresa. |
| `app/(app)/admin/discrepancies/patterns/[id]/pattern-detail.tsx:17` | `excel: "da razón al Excel"` | `excel: "da razón a la planilla"` **[nuevo, consistencia]** |
| `…pattern-detail.tsx:77` | Cliente (columna) | Planilla |
| `…:79` | Cita de la IA · comentario del cliente | Cita de la IA · comentario en la planilla |
| `…:107` | Cliente: {comentario ?? "sin comentario"} | Planilla: {comentario ?? "sin comentario"} |
| `components/admin/discrepancy-parts.tsx:150` | Queda en Seguimiento, en Preguntas al cliente. | Queda en Seguimiento, en Preguntas a la empresa. |
| `lib/discrepancy-labels.ts:18` | Evaluador del cliente | Evaluador de la planilla |
| `lib/discrepancy-labels.ts:32` | Pregunta al cliente | Pregunta a la empresa |
| `lib/discrepancy-labels.ts:33` | Pedido de datos al cliente | Pedido de datos a la empresa |

### 6.7 La empresa (B) y catálogo

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `components/admin/admin-header.tsx:11` | Cliente: {clientName} | Empresa: {clientName} |
| `app/(app)/admin/accounts/page.tsx:78` | …en ${clientName ?? "el cliente"}. | …en ${clientName ?? "la empresa"}. |
| Invitación (backend/correo, C12 §invitación) | …auditoría de llamadas de {cliente}… | …auditoría de llamadas de {clientName}… |
| `app/(app)/catalog/page.tsx:150` | Sube el Excel del cliente para empezar. | Sube el Excel de seguros para empezar. |
| `app/(app)/catalog/[id]/product-detail.tsx:199` | Ej.: Cliente actualizó la devolución de primas en octubre | Ej.: Se actualizó la devolución de primas en octubre |
| `app/privacy/page.tsx:31` | TBD (lo define la empresa cliente). | TBD (lo define la empresa). |

### 6.8 Mocks de la demo (se ven en pantalla)

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `lib/api/mock/admin-mock.ts:114` | activationReason "Sube la coincidencia con el cliente." | Sube la coincidencia con la planilla. |
| `lib/api/mock/admin-mock.ts:117` | details "Sube la coincidencia con el cliente." | Sube la coincidencia con la planilla. |
| `lib/api/mock/discrepancy-mock.ts:150` | …; el cliente exige la principal. | …; la planilla exige la principal. |
| `…discrepancy-mock.ts:153` | El cliente marca con distinto criterio llamadas parecidas. | La planilla marca con distinto criterio llamadas parecidas. |
| `…:174` | El cliente exige el motivo principal. … | La planilla exige el motivo principal. … |
| `…:189` | …; el cliente no las marca si el ejecutivo avisó. | …; la planilla no las marca si el ejecutivo avisó. |
| `…:200` | Llamadas parecidas con marca distinta del cliente | Llamadas parecidas con marca distinta en la planilla |
| `…:201` | …el cliente marca en 3 y no en las otras 3. | …la planilla las marca en 3 y no en las otras 3. |

**Ojo:** en `discrepancy-mock.ts:173` y `:183` "el cliente da dos razones" / "Si el cliente da más de un motivo" es la persona que llama: **no cambian**.

## 7. Revisión rápida

- **Trazabilidad:** sin cambio de R-xx, CUJ ni AI; solo etiquetas. Valores de código (`client`, `client_question`, `asked_client`, `external*`) iguales.
- **Accesibilidad:** `title` y `aria-label` del "—" cambian junto al texto visible; el badge mantiene ícono + texto. "Planilla" como encabezado es más corto que antes: sin riesgo de truncado.
- **Dark patterns:** ninguno.
- **Post-implementación:** `grep -rn "cliente" frontend/src` solo debe dejar los usos de §5 y comentarios/JSDoc.
