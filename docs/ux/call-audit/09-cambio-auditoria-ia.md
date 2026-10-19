# Cambio 09 · Calibración contra el cliente, notas y prompt visible

> Revisión rápida sobre el diseño aprobado (fases 0–8 cerradas). Fecha: 2026-10-19.
> **Origen:**
> - weekly del 2026-10-19 (Johannes, Jean Paul, Agustín; notas de Gemini tratadas como datos);
> - aclaración de Johannes: el veredicto del auditor del cliente (`ESTADO_CALIDAD`) viene en la metadata **a veces**: sí en la calibración inicial, no en la operación;
> - propuesta del coordinador (puntos 1–7).
>
> **Alcance de la revisión:** trazabilidad, patrones y navegación, WCAG 2.2 AA, microcopy y glosario, dark patterns y Registro Legal.
> **Toca la AI** (rol y sección nuevos) y **puntos legales**, así que se actualizan `03`, `registro-legal.md`, `hipotesis.md` y `estado.md`. No se reabren las demás fases.
> Front de referencia revisado: `frontend/src/lib/api/types.ts` (Next.js, datos mock).

---

## 0. Cierre del cambio (2026-10-19) · prevalece sobre el resto del documento

**Estado: aprobado.** Las respuestas de Johannes a las 2 preguntas definen lo siguiente:

| # | Decisión | Efecto |
|---|---|---|
| D-22 | **Vero y el equipo externo del cliente entran con rol Auditor**, con el permiso `view_model_io` (ven el panel "Prompt y respuesta del modelo"). Revisan casos de la cola y **no ven Discrepancias** | §2.1 y §2.2 quedan como sigue |
| D-23 | **No se crea el rol "Calidad de la IA" en el MVP** **[SUPUESTO del diseñador, H-57]**. Discrepancias, la clasificación "La IA acertó / se equivocó" y el seguimiento "Por presentar" quedan en el rol **Supervisor**. El equipo de Qubico que calibra usa cuentas de supervisor | `Role` sigue siendo `auditor \| supervisor`. Si más adelante se necesita alguien que clasifique sin ver dashboards de ejecutivos, se agrega `ai_quality` tal como estaba en §2.1 |
| D-24 | **El auditor nunca ve el veredicto ni el comentario del cliente**, ni antes ni después de guardar. Reemplaza la "revisión a ciegas" de §3.4 | Los externos son auditores del cliente, quizás los mismos que hicieron la auditoría original. Verlo después de guardar los invitaría a editar su revisión para calzar (se puede editar hasta la aprobación, H-39) y mostraría discrepancias con su propio trabajo (L-31). Solo lo ve el supervisor |
| D-25 | **El veredicto del cliente es opcional en tres niveles, y el backend lo pasa si viene:** (a) no viene; (b) solo por llamada (`ESTADO_CALIDAD` APROBADA / RECHAZADA, como hoy); (c) por llamada y por motivo (a futuro). Además, un **comentario libre del cliente** opcional (columna COMENTARIO; hoy en ~39 de 100 llamadas) | El front soporta los tres niveles sin cambios de diseño (ver abajo) |

### Qué muestra el front según el nivel (D-25)

| Nivel de datos | Discrepancias (supervisor) | Detalle (supervisor) | Detalle (auditor) |
|---|---|---|---|
| (a) Sin veredicto del cliente | La llamada no entra; si no hay ninguna, estado vacío | Nada del cliente | Nada |
| (b) Solo por llamada | Entra a su rama según el veredicto de la llamada | Encabezado "Cliente: {Cumple / No cumple} · Auditoría del cliente" + comentario del cliente, si viene, en un bloque plegable "Comentario del cliente" | Nada |
| (c) Llamada + motivo | Igual que (b); además, una columna "Motivos donde difieren" | Lo de (b) + por ítem, en la vista de diferencias: IA → Auditor → **Cliente**. En los motivos sin dato del cliente: "—" | Nada |

- **Mapeo de la planilla:** APROBADA → `compliant` (Cumple) · RECHAZADA → `non_compliant` (No cumple). Cualquier otro valor se trata como "sin veredicto" y se registra como advertencia de ingesta; no se muestra un valor inventado.
- **Comentario del cliente:**
  - es texto de terceros con posible PII, así que **se enmascara igual que la transcripción** antes de llegar al front (L-32);
  - solo lo ve el supervisor;
  - no se exporta salvo en la exportación de Discrepancias, enmascarado.

### Tipo (para `types.ts`; reemplaza la fila `types.ts` de §7)

- `CaseSummary.externalQualityVerdict: CallVerdict | null`: nivel llamada. Solo `compliant` o `non_compliant` (el cliente no tiene "Dudosa").
- `CaseDetail.externalItemVerdicts: { criterionId: string; verdict: "compliant" | "non_compliant" }[] | null`: nivel motivo, a futuro. `null` = no vino.
- `CaseDetail.externalComment: string | null`: comentario del cliente, ya enmascarado.
- Solo el rol `supervisor` recibe estos tres campos. **[SUPUESTO técnico: el backend los omite en las respuestas al rol auditor, no solo el front]** (H-58).
- `User.permissions: ("view_model_io")[]`: Qubico lo activa por cuenta; para Vero y el equipo externo, activado.
- Lo demás de §7 se mantiene (`Note`, `ModelRun`, `DiscrepancyBranch`, `DiscrepancyClassification`). **Sin** `"ai_quality"` en `Role`.

### Navegación final

| Rol | Navegación |
|---|---|
| Auditor (incluye Vero y el equipo externo) | Cola · Mis revisiones *(sin cambios)*. En el detalle: botón "Modelo X · Prompt vY" si tiene `view_model_io`; notas por caso y por motivo |
| Supervisor | Inicio · Alertas · Revisiones · Ejecutivos · Motivos · Auditores · Cola · **Discrepancias** |

### Microcopy que cambia

- Se elimina "Mis revisiones (después de guardar): El cliente auditó esta llamada…" (D-24).
- Se agrega:
  - "Comentario del cliente" (título del bloque plegable);
  - "Sin dato del cliente en este motivo" (tooltip del "—").

---

## 1. Veredicto de la revisión

| # | Propuesta | Veredicto | Ajuste del diseñador |
|---|---|---|---|
| 1 | Veredicto externo opcional + vista de discrepancias con el árbol de Jean Paul | **Aprobada con cambios** | Sección propia **Discrepancias** con rol y permisos definidos (§2). El auditor **no ve** el veredicto del cliente antes de guardar (revisión a ciegas, §3.4). Ramas con nombres del glosario, no "aprobado/rechazado" (§4) |
| 2 | Notas libres por motivo y por caso | **Aprobada** | Aviso de no escribir PII, autor y fecha, visibles para quienes ven el caso, y se exportan (§3.3, L-30) |
| 3 | Panel "Prompt y respuesta del modelo" | **Aprobada, fusionada con la 5** | Reemplaza el diálogo "Capas y motor". Se muestra **siempre la versión anonimizada** que salió al modelo. Acceso por permiso (§3.2, L-29) |
| 4 | Conectar datos reales + enmascarado de PII + accesos para externos | **Aprobada con condición** | **No se muestran transcripciones reales a nadie sin enmascarar** (O-16 sigue). Cuentas de externos solo por alta de Qubico (L-28) |
| 5 | "Veredicto del modelo X · prompt vY" en vez de capas | **Aprobada** (va en la 3) | El encabezado del detalle muestra "Modelo {x} · Prompt v{y}". La comparación Gemini vs Sonnet es una pestaña que se ve solo si hay 2 corridas (después) |
| 6 | Motivos 18–25: tipificación del ejecutivo vs motivo de renuncia según la IA | **Aprobada, después** | Dentro del bloque Tipificación del checklist: "Tipificado por el ejecutivo: X · Según la IA: Y", con un ítem por diferencia (§3.5) |
| 7 | Historial de versiones del prompt con métricas; exportar discrepancias con notas | **Aprobada, después** | Pestaña "Versiones del prompt" dentro de Discrepancias. Toda métrica dice contra qué referencia se midió |

**Prioridad para esta semana:** 1, 2, 3 (con 5) y 4. **Después:** 6 y 7.

---

## 2. Rol y AI (cómo encaja sin romper lo aprobado)

### 2.1 Rol nuevo: **Calidad de la IA** (`ai_quality`) · *reemplazado por D-22/D-23 (§0): no se crea en el MVP*

Era el "admin de calidad", fuera del MVP. Entra **acotado** a la calibración y no reemplaza al supervisor.

| Puede | No puede |
|---|---|
| Ver Discrepancias y clasificar la rama "Solo la IA detectó" (la IA acertó / la IA se equivocó) | Ver dashboards de ejecutivos, registrar feedback ni gestionar cuentas (sigue siendo del supervisor) |
| Ver el panel Prompt y respuesta del modelo | Aprobar, reabrir ni cambiar revisiones de auditores (sigue siendo del supervisor) |
| Agregar notas por caso y por motivo | Exportar con PII |
| Exportar discrepancias clasificadas (sin PII) | Editar o publicar el prompt desde la app (se versiona en el repo, regla 2) |
| Ver el historial de versiones del prompt (después) | — |

- **Quién lo tiene:** Qubico (Johannes, Agustín) y las personas del cliente que Qubico autorice (ver la pregunta 1).
- **Cómo se asigna:** solo Qubico crea cuentas con este rol, igual que los supervisores (D-12).
- **Supervisor:** recibe también Discrepancias y el panel de prompt (es un superconjunto).
- **Auditor:** no ve Discrepancias. El panel de prompt queda **desactivado por defecto**, y Qubico puede activarlo por cuenta (permiso `view_model_io`).

### 2.2 Navegación y rutas (adición a `03` §3–4)

| Rol | Navegación (en orden) |
|---|---|
| Auditor | Cola · Mis revisiones *(sin cambios)* |
| Supervisor | Inicio · Alertas · Revisiones · Ejecutivos · Motivos · Auditores · Cola · **Discrepancias** |
| Calidad de la IA | **Discrepancias** · Cola (solo lectura) |

| Ruta | Vista | Roles |
|---|---|---|
| `/discrepancies` | Discrepancias con el cliente (pestañas: Resumen · Solo la IA detectó · Omitidos por la IA · Coinciden · IA dudosa) | S, Q |
| `/discrepancies/prompts` | Versiones del prompt (después) | S, Q |
| `/calls/[id]` | Detalle: suma el panel "Prompt y respuesta del modelo", las notas y, si existe, la columna Cliente | según permiso |

- **Discrepancias siempre aparece** en la navegación de quien tiene el rol. Sin datos del cliente muestra un estado vacío (§5), en vez de esconder la sección.
- Esconder y mostrar entradas de la navegación según los datos confunde (`05` §1).

---

## 3. Diseño de cada cambio (lo mínimo para implementar)

### 3.1 Discrepancias (`/discrepancies`)

- **Alcance:** solo llamadas con `externalQualityVerdict` presente. El filtro de lote o periodo es el mismo que en Inicio.
- **Encabezado de métricas.** Siempre visible, con su referencia: "Referencia: auditoría del cliente · {n} llamadas con veredicto del cliente". Contadores:
  - **Coinciden** {n} ({%}) = la métrica "coincidencia con el cliente" (la del 70 % / 68 % de la reunión);
  - **Solo la IA detectó** {n} · {k} sin clasificar ← **prioritaria**, va primera;
  - **Omitidos por la IA** {n};
  - **IA dudosa** {n}. La IA dijo Dudosa; es la cuarta rama, que el árbol original no tenía.
- **Pestañas por rama**, en este orden: Solo la IA detectó · Omitidos por la IA · IA dudosa · Coinciden.
- **Tabla:** Llamada · Fecha · Ejecutivo · IA · Cliente · Auditor de la app (si existe) · Motivos de la IA que incumplen · Clasificación · Notas (ícono + n).
- **Clasificación** (solo en "Solo la IA detectó"): control segmentado en la fila y en el detalle.
  - Opciones: **La IA acertó** / **La IA se equivocó** / Sin clasificar.
  - Al elegir, se piden los **motivos involucrados** (multiselección entre los que la IA marcó Incumple) y una **nota opcional**. Si se eligió "La IA se equivocó", la nota es obligatoria: es el insumo para ajustar el prompt.
- **"La IA acertó" → "Por presentar al cliente".** Estados: Por presentar → Presentado. Hay un filtro para preparar la revisión uno a uno con la contraparte. El resultado de esa conversación va en una nota (después: estado Aceptado / No aceptado por el cliente) **[SUPUESTO]**.
- **Exportar:** CSV/Excel de la rama filtrada con clasificación, motivos y notas. Sin PII; la casilla de PII no aparece para este rol.

### 3.2 Panel "Prompt y respuesta del modelo" (reemplaza "Capas y motor")

- **Botón** en el encabezado del detalle: `Modelo {modelo} · Prompt v{versión}`.
- **Abre un panel lateral grande** (Sheet, ~60 % del ancho), no un diálogo, para poder leer junto a la transcripción.
- **Pestañas:**
  1. **Resumen:** modelo, versión de prompt, versión de rúbrica, fecha de la corrida, latencia, costo, veredicto del modelo y regla del motor.
  2. **Datos enviados:** metadatos del caso y fichas de los seguros, tal como entraron al prompt, en tabla de columnas (consistente con el "ordenar en columnas" de la reunión).
  3. **Prompt enviado:** texto monoespaciado, con buscar y copiar; las secciones (system, reglas de revisión, mensaje de usuario) son plegables.
  4. **Respuesta (JSON):** JSON con formato y plegable, con copiar. Cada criterio del JSON enlaza al motivo en el checklist.
  5. **Comparar modelos** (después; solo si hay 2 o más corridas): veredicto por motivo de cada modelo, lado a lado.
- **Siempre se muestra lo que efectivamente salió al modelo, ya anonimizado** (`privacy.md`). Si el N° de seguro o la póliza van en el prompt, se muestran enmascarados. Nunca se muestra una versión "re-identificada".
- **Aviso fijo** en el panel: "Contenido técnico confidencial de Qubico y datos del cliente. No lo compartas fuera de la app." (L-29).

### 3.3 Notas por caso y por motivo

- **Por motivo:** en `FindingItem`, acción "Agregar nota" (atajo `N`), **independiente de corregir**. Se puede anotar sin cambiar el veredicto.
- **Por caso:** sección "Notas del caso" en el detalle, debajo del checklist o en una pestaña junto a "Historial del caso".
- **Cada nota:**
  - lleva texto, autor, rol y fecha;
  - es editable por su autor mientras el caso no esté cerrado, y queda en el historial;
  - la ven todos los que pueden ver el caso;
  - se exporta en Discrepancias.
- **Ayuda del campo:** "No escribas RUT, nombres ni datos de salud del cliente." **[SUPUESTO técnico]** Si el texto parece contener un RUT (patrón), se muestra un aviso antes de guardar (no bloquea) (L-30).
- No se notifica a nadie en el MVP.

### 3.4 Veredicto del cliente en el detalle · *el auditor no lo ve nunca (D-24, §0)*

- **Fila del encabezado:** "Cliente: No cumple · Auditoría del cliente", con `SourceBadge` nuevo `client`: contorno sólido neutro con ícono de edificio.
- **Columna de diferencias por ítem**, solo si el cliente trae el veredicto **por motivo** (pregunta 2): IA → Auditor → Cliente. Si solo viene por llamada, se muestra solo en el encabezado.
- **Auditor: revisión a ciegas.** El auditor **no ve** el veredicto del cliente mientras revisa; lo ve en "Mis revisiones" después de guardar. **Razón:** evitar que copie al cliente (sesgo de anclaje, H-16), lo que además invalidaría la medición de IA vs auditor de la app.
- **Supervisor y Calidad de la IA** lo ven siempre.

### 3.5 Tipificación (después)

- En el bloque Tipificación (motivos 18–25), una tarjeta antes de los ítems: "Tipificado por el ejecutivo: **{motivo}** · Según la IA: **{motivo}**". Si son distintos, hay marca de diferencia.
- Los motivos de renuncia son la lista cerrada de 27 del cliente (`context.md`).

---

## 4. Vocabulario (adición al glosario de `03` §4.2)

**Decisión:** en la UI **no se usa "aprobado / rechazado"** para veredictos. Se mantiene "Cumple / No cumple" por llamada (D-20).

**Por qué:**
- "Aprobar" ya es una acción del supervisor ("Aprobar revisiones", D-19). Usar "Aprobado" para un veredicto confundiría dos cosas distintas en la misma pantalla.
- Mezclar vocabularios rompe el glosario aprobado.

**Para el equipo del cliente**, que habla de aprobado / rechazado: el tooltip del veredicto del cliente dice "En la planilla del cliente: Aprobado = Cumple · Rechazado = No cumple".

| Término UI | Definición | Código | Evitar |
|---|---|---|---|
| **Veredicto del cliente** | `ESTADO_CALIDAD` del auditor del cliente, cuando viene en la metadata | `externalQualityVerdict: CallVerdict \| null` | "estado de calidad", "aprobado / rechazado" |
| **Auditoría del cliente** | Fuente de ese veredicto (`SourceBadge`) | `source = client` | "auditor externo" en la UI |
| **Coinciden** | IA y cliente dan el mismo veredicto de llamada | `branch = match` | — |
| **Solo la IA detectó** | IA: No cumple · Cliente: Cumple (prioritaria) | `branch = ai_only_fail` | "falso positivo" (no se sabe hasta clasificar) |
| **Omitidos por la IA** | IA: Cumple · Cliente: No cumple | `branch = ai_missed_fail` | "falso negativo" (ídem) |
| **IA dudosa** | La IA dio Dudosa, con cualquier veredicto del cliente | `branch = ai_uncertain` | — |
| **La IA acertó** / **La IA se equivocó** | Clasificación humana de "Solo la IA detectó" | `classification = ai_correct / ai_wrong` | "acierto / error" a secas |
| **Por presentar al cliente** / **Presentado** | Seguimiento de "La IA acertó" | `presentation = pending / presented` | — |
| **Coincidencia con el cliente** | % de "Coinciden" sobre las llamadas con veredicto del cliente | — | "precisión" (es otra métrica) |
| **Nota** | Texto libre por caso o por motivo | `note` | "comentario" (se reserva para la IA y las correcciones) |
| **Prompt y respuesta del modelo** | Panel con la entrada y la salida cruda del modelo | `model_io` | "capas" |
| **Calidad de la IA** | Rol nuevo (§2.1) | `ai_quality` | "admin" |

**Referencia de las métricas:** toda métrica de acuerdo lleva "Referencia: auditoría del cliente" o "Referencia: auditores de la app", con su *n*.

---

## 5. Microcopy nuevo (complementa `06`)

| Elemento | Texto |
|---|---|
| Discrepancias · título | Discrepancias con el cliente |
| Subtítulo | Compara la IA con la auditoría del cliente en las llamadas que traen su veredicto. |
| Referencia | Referencia: auditoría del cliente · {n} llamadas |
| Vacío (sin datos del cliente) | Este periodo no trae veredictos del cliente. Las discrepancias aparecen cuando un lote incluye la auditoría del cliente. |
| Vacío de rama | No hay llamadas en esta rama. |
| Clasificar · pregunta | ¿La IA tenía razón? |
| Opciones | La IA acertó · La IA se equivocó |
| Motivos involucrados | ¿En qué motivos? |
| Nota obligatoria (se equivocó) | Explica qué entendió mal la IA. Sirve para ajustar el prompt. |
| Seguimiento | Por presentar al cliente · Presentado |
| Tooltip del veredicto del cliente | Veredicto de la auditoría del cliente. En su planilla: Aprobado = Cumple · Rechazado = No cumple. |
| ~~Mis revisiones (después de guardar)~~ | *Eliminado (D-24)* |
| Botón del panel | Modelo {modelo} · Prompt v{versión} |
| Aviso del panel | Contenido técnico confidencial de Qubico y datos del cliente. No lo compartas fuera de la app. |
| Pestañas del panel | Resumen · Datos enviados · Prompt enviado · Respuesta (JSON) · Comparar modelos |
| Nota · acción | Agregar nota |
| Nota · ayuda | No escribas RUT, nombres ni datos de salud del cliente. |
| Nota · aviso de RUT | Parece que la nota incluye un RUT. Revísala antes de guardar. · Botones: Editar nota · Guardar igual |
| Notas del caso · vacío | Aún no hay notas en este caso. |

---

## 6. Accesibilidad y patrones (comprobación rápida)

- **Ramas:** pestañas con contador (patrón aprobado) y etiquetas con texto, no solo color.
- **Clasificación:** control segmentado accesible (`role=radiogroup`).
- **JSON y prompt:** monoespaciado en 13/20; plegables con `<details>`/Collapsible (teclado); "Copiar" anuncia "Copiado" por `aria-live`. Contraste del texto mono con `--foreground` sobre `--muted`: 15:1 o más.
- **Panel lateral:** foco atrapado solo si es modal; si no es modal, el foco vuelve al botón al cerrar. Esc cierra.
- **Atajo `N`** (nota): se suma a la ayuda "?" y es desactivable como los demás (WCAG 2.1.4).
- **Dark patterns:** ninguno nuevo. La exportación sigue sin PII por defecto.

---

## 7. Impacto técnico (para implementar; no es código)

| Tema | Impacto |
|---|---|
| `types.ts` | `CaseSummary.externalQualityVerdict: CallVerdict \| null` · `Finding.externalVerdict?: Verdict` (si viene por motivo) · `Note { id, scope: "case" \| "finding", criterionId?, text, authorId, authorRole, createdAt, editedAt? }` · `DiscrepancyBranch` y `DiscrepancyClassification` según §4 · `ModelRun { model, promptVersion, rubricVersion, runAt, latencyMs, costUsd, inputData, promptText, rawResponse }` (reemplaza `LayerResultSummary[]`) · `Role` suma `"ai_quality"` · permiso `view_model_io` por usuario |
| Arquitectura | La reunión pasó de "capas reglas + LLM" a un **prompt único**. Contradice las 6 etapas de `CLAUDE.md` y el contrato de capas: **requiere un ADR** (`pipeline-architect`). El diseño ya no depende de "capas" (H-52) |
| Datos reales | Las transcripciones del benchmark tienen PII sin enmascarar: el front **no puede** mostrarlas tal cual. Hace falta que el enmascarado del pre-proceso se aplique **antes** de servirlas al front (L-28) |
| `not_applicable` | Sigue H-48 |

---

## 8. Supuestos de este cambio

- **H-52:** el panel del modelo reemplaza "Capas y motor" aunque el backend vuelva a tener varias capas; en ese caso, cada capa sería una corrida más en la pestaña Resumen.
- **H-53:** la clasificación "La IA acertó / se equivocó" se hace por llamada, con los motivos involucrados como multiselección.
- **H-54:** "Por presentar / Presentado" basta para la revisión uno a uno con la contraparte; el resultado va en notas.
- **H-55:** el auditor revisa a ciegas respecto del veredicto del cliente.
- **H-56:** el aviso de RUT en las notas es una heurística que no bloquea.
