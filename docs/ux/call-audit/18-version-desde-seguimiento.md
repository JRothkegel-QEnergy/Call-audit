# Cambio 18 · Versión del prompt desde Seguimiento

> Revisión rápida sobre lo aprobado (fases 0–8, Cambio 12 «Prompt» y Cambio 16 «Análisis de discrepancias»). Fecha: 2026-11-06. **Estado: alcance aprobado (2026-11-06, Johannes: «Sí, todas A») = P1–P5 A, H-124 a H-131 sin objeción (D-75 a D-79). §8 aprobada (2026-11-06, Johannes: «Sí, todas A») = Q1–Q3 A, H-139 a H-143 sin objeción. Implementado el 2026-11-06.**
> **Pedido de Johannes (textual):** «me gustaría que eso fuera más automático. Tengo el seguimiento y luego puedo publicar una nueva versión considerando el seguimiento.»
> **Numeración:** P-18.x, R-18.x; decisiones desde D-75; supuestos H-124 a H-131 (pasan a `hipotesis.md` al aprobarse; revisar que otra sesión no haya usado esos números). Sin ítems L nuevos (preferencia de Johannes).
> **Revisado:** `12-cambio-admin-qubico.md` §2.2–2.3, `16-ia-discrepancias.md` §0, §7.3 (Seguimiento) y §7.9, `prompts/layer2/prompt.yaml` (motivos con `number`, `official`, `criterion`, `history`; `origins` definidos en el mismo archivo), `prompts/discrepancy_analysis/v1.2.0/system.txt` (propuesta `prompt_rule` = texto libre «indica si se agrega o qué frase reemplaza»), `src/call_audit/prompt_registry.py` (`create_draft`, `validate_yaml` exige entrada de `history` con la versión nueva en cada ítem que cambia), `frontend/src/components/admin/prompt-form.tsx` (casillas «Propuestas incluidas» que solo agregan texto a «Por qué»).
> **No contradice:** regla no negociable 5 / D-64 (aceptar no toca el prompt vigente), D-35 (prueba con *n* y costo, solo si el admin confirma), D-36 (activar con motivo obligatorio), D-67 (texto editado al aceptar), D-68 («Incluida en vX» al guardar el borrador; vuelve a «Aceptada» si se retira sin activarse).

---

## 0. Decisiones

| # | Decisión | Origen |
|---|---|---|
| D-75 | Las reglas se aplican **sin IA**, siempre igual. El prompt del análisis pasa a v1.3.0 con `prompt_rule = {acción: agregar \| reemplazar, frase a reemplazar (exacta), texto nuevo}`. Las propuestas antiguas en texto libre se agregan al final del criterio con la marca «Texto libre». No se re-corre ningún análisis | Johannes (P1 A) |
| D-76 | «Publicar» = **borrador + prueba encadenados**: «Crear borrador y probar» crea el borrador y abre el diálogo de costo (D-35). Activar sigue aparte, con motivo (D-36). También existe «Solo crear borrador» | Johannes (P2 A) |
| D-77 | Antes de crear, **comparación por motivo** (antes / después) con el texto final editable, el estado de cada regla, la entrada de historial y «Quitar esta regla» | Johannes (P3 A) |
| D-78 | Se mantiene la subida manual del prompt.yaml; **se quitan las casillas «Propuestas incluidas»** del formulario. Aviso con enlace a Seguimiento si hay reglas aceptadas | Johannes (P4 A) |
| D-79 | Origen nuevo del historial **«Análisis de discrepancias»** (`discrepancy_analysis`), con nota: patrón, quién aceptó y su nota | Johannes (P5 A) |

## 1. Hechos de partida (hoy)

| Paso | Dónde | Qué hace el admin | Problema |
|---|---|---|---|
| 1 | Análisis de discrepancias | Acepta una propuesta `prompt_rule` (texto editable + nota) | — |
| 2 | Seguimiento | La ve en «Para la próxima versión del prompt» | No hay acción para llevarla al prompt |
| 3 | Fuera de la app | Descarga/abre el `prompt.yaml` vigente, busca el motivo, edita el `criterion` a mano, agrega la entrada de `history` con versión y origen, sube el `version` | Manual, propenso a error (versión, history, indentación YAML) |
| 4 | Prompt → Publicar versión | Sube el archivo, marca las propuestas (solo se copian a «Por qué»), escribe «Qué cambió», guarda borrador | Doble trabajo: el texto ya estaba en Seguimiento |
| 5 | Versión | Prueba contra la referencia (costo confirmado) y activa con motivo | — |

**Dolencias**
- **P-18.1** La regla aceptada ya trae el texto listo, pero llegar al prompt exige editar el YAML a mano fuera de la app.
- **P-18.2** El formulario de versión no aplica las propuestas: solo las copia a «Por qué», así que es fácil marcarlas como «Incluida en vX» sin haberlas aplicado de verdad.
- **P-18.3** La propuesta es texto libre («agrega…» / «reemplaza la frase…»): no se puede aplicar sola de forma exacta.

**Requisitos**
- **R-18.1** Desde Seguimiento, generar un borrador del prompt con las reglas aceptadas aplicadas al «Criterio:» de cada motivo, con su entrada de `history` (versión, origen, nota).
- **R-18.2** Antes de crear el borrador, el admin ve y puede corregir, por motivo, el criterio antes → después.
- **R-18.3** Nada cambia el prompt vigente sin confirmación del admin; lo que cuesta IA muestra *n* y costo y solo corre si el admin confirma (D-35).
- **R-18.4** «Incluida en vX» solo si la regla quedó aplicada en el contenido (corrige P-18.2).
- **R-18.5** Se conserva el camino manual (subir `prompt.yaml`) para cambios que no salen del análisis.

## 2. Flujo propuesto (con las recomendadas de §4)

```mermaid
flowchart TD
  A[Seguimiento · Para la próxima versión del prompt] -->|Marca reglas, todas por defecto| B[Crear versión con n reglas]
  B --> C[Revisar cambios · /admin/prompts/new?from=followup]
  C --> D{¿Cada regla se aplicó?}
  D -- Aplicada --> E[Diff por motivo: antes / después, editable]
  D -- No se encontró la frase --> F[Marcada «Revisar»: editar el después o quitar la regla]
  F --> E
  E --> G[Versión 2.11 sugerida · Qué cambió precargado · Por qué con notas]
  G -->|Crear borrador y probar| H[Borrador v2.11 · reglas «Incluida en v2.11 (borrador)»]
  H --> I[Diálogo de costo de la prueba · C12 §3.3]
  I -- Confirma --> J[En prueba k de n]
  I -- Cancela --> H
  J --> K[Probada · métricas lado a lado con la vigente]
  K -->|Activar · motivo obligatorio D-36| L[v2.11 vigente · reglas «Incluida en v2.11»]
  K -->|Retirar| M[Reglas vuelven a «Aceptada» · D-68]
```

**Conteo de pasos (de regla aceptada a versión probada):**

| | Hoy | Propuesto |
|---|---|---|
| Pasos en la app | 6 (ir a Prompt, nueva versión, formato, subir archivo, marcar propuestas, escribir «Qué cambió», guardar) + probar | 3 (Crear versión con n reglas → revisar diff → Crear borrador y probar) + confirmar costo |
| Pasos fuera de la app | Editar YAML: buscar motivo, editar criterio, history, versión | 0 |
| Riesgo de «Incluida» sin aplicar | Sí (P-18.2) | No (R-18.4) |

**Auditoría del flujo propuesto**

| Tipo | Hallazgo | Tratamiento |
|---|---|---|
| Paso de más | Elegir formato y subir archivo | Desaparecen en este camino (la base es el YAML de la vigente en la BD) |
| Redundancia | Copiar el texto de la regla a «Por qué» y además editar el YAML | Se aplica una vez; «Por qué» lleva las notas del admin y el enlace al patrón |
| Cuello de botella | Frase a reemplazar que ya no existe en el criterio (otra versión la cambió) | Regla marcada «Revisar», el resto sigue; no bloquea en silencio |
| Callejón sin salida | Vigente subida como «Solo system prompt» (sin YAML): no hay criterio por motivo que editar | Botón deshabilitado con explicación: «La versión vigente no tiene prompt.yaml; súbelo en Prompt para usar esto.» |
| Cuello de botella | Prueba larga y con costo | Igual que hoy (C12 §2.3); se puede salir y volver, el estado vive en la versión |

## 3. Boceto (texto, datos sintéticos; detalle fino después de aprobar)

**Seguimiento, grupo de reglas:**
```
Para la próxima versión del prompt (3)                [ Crear versión con 3 reglas ]
 [x] Motivo 18 · Agregar · "Si el cliente da dos razones y el ejecutivo tipifica…"   Aceptada 04-11
 [x] Motivo 13 · Reemplazar «sin el cero inicial» por "…"                           Aceptada 05-11
 [x] Motivo 7  · Texto libre (propuesta anterior a v1.3) · se agregará al final       Aceptada 03-11
```

**Revisar cambios (`/admin/prompts/new?from=followup&p=…`):**
```
Nueva versión desde Seguimiento · basada en v2.10 (vigente)
Versión 2.11 · Modelo [vigente ▾]

Motivo 18 · Tipifica motivo de renuncia incorrecto            Aplicada · Agregar
  Antes                          | Después (editable)
  …- Si el cliente da más de     | …- Si el cliente da más de un motivo, basta…
  un motivo, basta…              | + Si el cliente da dos razones y el ejecutivo…
  Historial: 2.11 · Análisis de discrepancias · "Patrón #42 · nota de Johannes"
  [ Quitar esta regla ]

Motivo 13 · …                                                 Revisar · no se encontró «sin el cero inicial»
  [ editar Después ]  [ Quitar esta regla ]

Qué cambió: "Reglas del análisis de discrepancias: motivos 7, 13, 18."  (editable)
Por qué: notas de cada regla + enlace a su patrón                       (editable)

[ Crear borrador y probar ]   [ Solo crear borrador ]   Cancelar
```

## 4. Decisiones para Johannes

**P1 · ¿Cómo se aplica cada regla al «Criterio:»?**
- **A (recomendada) · Determinístico, sin IA.** Se cambia el esquema de la propuesta en el prompt del análisis (nueva v1.3.0): `{acción: agregar | reemplazar, frase_a_reemplazar (exacta), texto_nuevo}`. Aplicar cuesta US$ 0 y es exacto; si la frase no aparece tal cual, la regla queda «Revisar». Las propuestas ya aceptadas en texto libre se **agregan al final** del criterio, marcadas «Texto libre», y el admin las corrige en el «Después». No obliga a re-correr ningún análisis: el esquema nuevo rige para los análisis futuros.
- B · Una IA aplica las reglas al criterio. Entiende el texto libre, pero cuesta (centavos por versión, con diálogo de costo) y puede reescribir de más; el diff lo deja ver, pero hay que leerlo con más cuidado.
- C · Mixto: A para las nuevas y IA solo para las de texto libre o las «Revisar», bajo confirmación de costo. Más piezas para un volumen chico.

**P2 · ¿Qué significa «publicar» en este camino?**
- **A (recomendada) · Borrador + prueba, como hoy, encadenado.** «Crear borrador y probar» crea el borrador y abre directo el diálogo de costo de la prueba (D-35). Activar sigue siendo un paso aparte con motivo (D-36), después de ver las métricas. También existe «Solo crear borrador».
- B · Activar directo al confirmar el diff (con motivo), sin probar contra la referencia. Más rápido, pero una regla mal aplicada llega a producción sin medir.
- C · Como A, pero además «Activar sin probar» con advertencia. Abre la puerta a saltarse la prueba.

**P3 · ¿Qué ve y puede hacer el admin antes de confirmar?**
- **A (recomendada) · Diff por motivo (antes / después) con el «Después» editable**, el estado de cada regla (Aplicada · Revisar · Texto libre), la entrada de historial que se agregará y «Quitar esta regla». El YAML completo y el `system.txt` quedan en la pestaña Diferencias del borrador (C12) y en «Descargar para el repo».
- B · Diff solo lectura: para corregir hay que volver a Seguimiento y editar la propuesta. Más simple, pero obliga a ir y volver.
- C · A + vista previa del `system.txt` completo en la misma pantalla. Más largo de leer; ya existe en el borrador.

**P4 · ¿Qué pasa con el camino manual y las casillas «Propuestas incluidas» del formulario actual?**
- **A (recomendada) · Se mantiene el camino manual** (subir `prompt.yaml` para cambios que no vienen del análisis) **y se quitan las casillas** de ese formulario: las reglas del análisis entran solo por «Crear versión con n reglas», que sí las aplica (corrige P-18.2). Si el admin sube un YAML a mano mientras hay reglas aceptadas, un aviso enlaza a Seguimiento.
- B · Se mantienen ambas: casillas en el formulario manual que ahora también aplican la regla sobre el YAML subido. Dos lugares para lo mismo.

**P5 · ¿Con qué origen queda la regla en el historial del motivo?**
- **A (recomendada) · Origen nuevo «Análisis de discrepancias»** (`discrepancy_analysis`) agregado a `origins` del `prompt.yaml`; la nota lleva el patrón (#id), quién aceptó y su nota. En Diferencias (C12) se ve con esa etiqueta y se puede contar cuántas reglas salieron del análisis.
- B · Reusar «Feedback de validación» (`validation_feedback`) con la nota. Sin cambio de catálogo, pero se pierde distinguir lo que vino del análisis.

## 5. Supuestos (a `hipotesis.md` al aprobarse)

| ID | Supuesto | Valida |
|---|---|---|
| H-124 | La base del borrador es siempre la versión vigente con `prompt.yaml`; si la vigente es «Solo system prompt», el botón queda deshabilitado con explicación. | Johannes |
| H-125 | La versión sugerida es la siguiente menor libre (2.10 → 2.11; si ya existe un borrador 2.11, 2.12) y no se edita a mano, como en C12 §2.2. | Johannes |
| H-126 | Varias reglas del mismo motivo se aplican en orden de aceptación y se ven en un solo diff de ese motivo. | Johannes |
| H-127 | Todas las reglas aceptadas vienen marcadas por defecto; desmarcar una la deja en «Aceptada». | Johannes |
| H-128 | Una regla «Revisar» no bloquea las demás, pero no se puede crear el borrador mientras siga en «Revisar» (se edita el «Después» o se quita). | Johannes |
| H-129 | En el diálogo Aceptar (C16) se ven la acción y la frase a reemplazar en solo lectura; el texto nuevo sigue editable (D-67). La corrección fina se hace en el «Después». | Johannes |
| H-130 | Lo editado en el «Después» se guarda en el borrador, no reescribe la propuesta: la propuesta conserva original y editado de D-67. | Johannes |
| H-131 | Solo cambia el `criterion` de motivos; reglas sobre otras secciones del prompt (intro, datos) siguen por el camino manual. | Johannes |

## 6. Impacto técnico (no es código; lo detalla `pipeline-architect` / `llm-engineer` tras aprobar)

- **Prompt del análisis** v1.3.0 (si P1 = A): `proposal` pasa a `{type, action, find, text}` para `prompt_rule`. Sin re-corridas: afecta análisis futuros.
- **Backend:** servicio que toma el `spec_yaml` de la vigente + ids de propuestas, aplica, agrega `history` y `origins` (P5) y devuelve el diff por motivo con estado por regla (vista previa, sin guardar, sin costo). Luego `create_draft(source="yaml", …)` con el YAML resultante y los ids incluidos, para que `validate_yaml` siga siendo la única puerta.
- **Front:** botón y casillas en Seguimiento (`/admin/discrepancies?tab=followup`), pantalla de revisión (reusa la ruta `/admin/prompts/new` con `from=followup`), y el diálogo de costo existente al terminar.

## 7. Siguiente paso

P1–P5 respondidas (todas A, §0) y §8 entregada. Falta: aprobar §8 y Q1–Q3 (§8.10); después, implementar.

---

## 8. Especificación detallada (aprobada 2026-11-06: Q1–Q3 A)

> Supuestos nuevos H-139 a H-143 (el Cambio 19 usa H-132 a H-138). No hay decisiones nuevas hasta que se respondan Q1–Q3.

### 8.1 Flujo final

Es el mismo de §2, ya con D-75 a D-79. Entradas y salidas:

| Desde | Acción | Llega a |
|---|---|---|
| Seguimiento · «Para la próxima versión del prompt» | **Crear versión con {n} reglas** | `/admin/prompts/new?from=followup&p={id},{id}` |
| Prompt · Publicar versión (manual) | Aviso «Tienes {n} reglas aceptadas…» → **Ir a Seguimiento** | `/admin/discrepancies?tab=followup` |
| Revisar cambios | **Crear borrador y probar** | `/admin/prompts/{version}?test=1` (abre el diálogo de costo de C12 §3.3) |
| Revisar cambios | **Solo crear borrador** | `/admin/prompts/{version}` |
| Revisar cambios | **Cancelar** | Seguimiento, sin cambios |
| Diálogo de costo | Cancelar | El borrador ya existe; queda con el aviso «Pruébalo contra la referencia antes de activarlo.» |
| Borrador | Retirar sin activar | Las reglas vuelven a «Aceptada» (D-68) |

Los ids de propuesta en la URL no son datos personales. Al recargar se vuelve a la misma comparación, recalculada.

### 8.2 Seguimiento · grupo «Para la próxima versión del prompt»

- Cada regla «Aceptada» lleva una **casilla** (marcada por defecto, H-127) y una etiqueta de acción:
  - **Agregar** · "{texto}"
  - **Reemplazar** «{frase}» por "{texto}"
  - **Texto libre** · "{texto}" · «Se agregará al final del criterio; revisa dónde va.» (son las propuestas anteriores a la v1.3.0 del análisis)
- Las reglas «Incluida en v{X} (borrador)» no tienen casilla y enlazan al borrador.
- Botón primario en el encabezado del grupo: **Crear versión con {n} reglas**, donde {n} es la cantidad de reglas marcadas.
  - Se deshabilita con 0 marcadas: «Marca al menos una regla.»
  - Se deshabilita si la vigente no tiene prompt.yaml (H-124): «La versión vigente no tiene prompt.yaml. Súbelo en Prompt para crear versiones desde aquí.»
  - El motivo se lee en texto visible bajo el botón, no solo en un tooltip.
- Marcar o desmarcar no guarda nada.

### 8.3 Pantalla «Revisar cambios» (`/admin/prompts/new?from=followup`)

De arriba hacia abajo:

1. **Encabezado:** «Nueva versión desde Seguimiento» · «Basada en v{vigente} (vigente)» · migas Prompt / Nueva versión.
2. **Resumen** en una línea, en región viva: «{n} reglas en {m} motivos · {r} para revisar». Si {r} > 0, sigue una lista de enlaces («Motivo 13 · no se encontró la frase») que llevan el foco a la tarjeta de ese motivo.
3. **Una tarjeta por motivo**, ordenadas por número:
   - Título: «Motivo {n} · {texto oficial}».
   - Por cada regla del motivo, en orden de aceptación (H-126): estado + acción + «Patrón #{id} · aceptada por {nombre} el {fecha}» + **Quitar esta regla**.
   - **Cambios** (solo lectura): el criterio con lo agregado y lo quitado marcados (§8.7).
   - **Editar el texto final** abre un área de texto con el criterio resultante. La vista de Cambios se recalcula mientras escribes (tras 300 ms sin teclear). **Volver al texto generado** deshace la edición manual.
   - **Historial que se agregará:** una línea por regla, del tipo «2.11 · Análisis de discrepancias · {nota}».
4. **Datos de la versión:**
   - Versión: {2.11}, solo lectura (H-125).
   - Modelo: selector; por defecto, el de la vigente.
   - Qué cambió (obligatorio, viene escrito): «Reglas del análisis de discrepancias: motivos {7, 13, 18}.»
   - Por qué (opcional, viene escrito): una línea por regla, «Motivo {n} · Patrón #{id}: {nota del admin o, si no hay, título del patrón}».
5. **Acciones** en un pie fijo: **Crear borrador y probar** (primaria) · **Solo crear borrador** · Cancelar.
   - Se deshabilitan mientras queden reglas en «Revisar» (H-128) o no quede ninguna regla. El motivo se lee junto a los botones.

### 8.4 Cómo se aplica cada regla (en el servidor, sin IA, D-75)

| Caso | Qué hace | Estado de la regla |
|---|---|---|
| Agregar | Pone el texto en una línea nueva al final del criterio | Aplicada |
| Reemplazar, frase encontrada 1 vez | Reemplaza esa frase y deja el resto igual | Aplicada |
| Reemplazar, frase no encontrada | No cambia nada | Revisar · «No se encontró «{frase}» en el criterio actual.» |
| Reemplazar, frase encontrada varias veces | No cambia nada (ver Q2) | Revisar · ««{frase}» aparece {k} veces; edita el texto final.» |
| Texto libre (sin acción) | Agrega el texto al final | Texto libre |
| El motivo no existe en la vigente | No cambia nada | Revisar · «El motivo {n} no está en v{vigente}.» |
| Varias reglas del mismo motivo | Cada una se aplica sobre el resultado de la anterior | La que le corresponda a cada una |

- **Búsqueda de la frase:** no distingue espacios ni saltos de línea (el criterio viene cortado en líneas en el YAML), pero sí mayúsculas, tildes y puntuación (ver Q1).
- **Editar el texto final** de un motivo resuelve sus reglas en «Revisar», que pasan a **Aplicada a mano**. La edición se guarda en el borrador, no en la propuesta (H-130).
- **Historial:** una entrada por regla: `{version: "2.11", origin: discrepancy_analysis, note: "Patrón #{id} (análisis del {fecha}) · aceptada por {nombre}{: nota}"}`. Si `origins` aún no tiene `discrepancy_analysis`, se agrega con la etiqueta «Análisis de discrepancias» y la descripción «Regla propuesta por el análisis de discrepancias y aceptada por un admin en Seguimiento. La nota dice el patrón y quién la aceptó.» (D-79).
- **Archivo:** se actualizan `version` y `date`. El YAML generado **conserva los comentarios, el orden y los bloques `|-`** del original, para que «Descargar para el repo» produzca un diff limpio (H-139).
- **Al crear**, el servidor vuelve a calcular todo y pasa por `validate_yaml` / `create_draft`, igual que una subida manual. Si la vigente cambió desde la vista previa, o alguna regla cambió de estado, responde 409 (§8.5).

### 8.5 Estados

| Estado | Qué se ve |
|---|---|
| Cargando la comparación | Esqueleto de 2 tarjetas + «Aplicando las reglas a v{vigente}…» |
| Todo aplicado | Resumen «{n} reglas en {m} motivos»; acciones habilitadas |
| Con reglas en «Revisar» | Resumen con {r} y sus enlaces; esas tarjetas con aviso ámbar e ícono; acciones deshabilitadas con «Resuelve {r} reglas para revisar: edita el texto final o quita la regla.» |
| Todas las reglas quitadas | «No queda ninguna regla. Vuelve a agregar alguna o cancela.»; acciones deshabilitadas |
| Una regla quitada | La regla se ve tachada con **Volver a agregar**; la comparación del motivo se recalcula |
| URL sin reglas o con ids inválidos | «Estas reglas ya no están aceptadas o ya se incluyeron en una versión.» + **Volver a Seguimiento** |
| Vigente sin prompt.yaml | El mismo texto de §8.2 + **Ir a Prompt** |
| Error de validación del YAML al crear | La lista de errores de C12 §3.5 sobre la tarjeta del motivo afectado; no se crea nada |
| La vigente o las reglas cambiaron (409) | «La versión vigente o las reglas cambiaron mientras revisabas. Vuelve a generar la comparación; tus ediciones manuales se perderán.» + **Generar de nuevo** |
| Error de red | «No pudimos crear el borrador. Revisa tu conexión e inténtalo de nuevo.» + **Reintentar**; las ediciones no se pierden |
| Borrador creado | Navega al borrador con el aviso «Borrador v{X} creado con {n} reglas.» Las reglas pasan a «Incluida en v{X} (borrador)» |

### 8.6 Textos

**Botones:** Crear versión con {n} reglas · Editar el texto final · Volver al texto generado · Quitar esta regla · Volver a agregar · Crear borrador y probar · Solo crear borrador · Cancelar · Generar de nuevo · Ir a Seguimiento · Ir a Prompt.

**Estados de regla:** Aplicada · Aplicada a mano · Texto libre · Revisar · Quitada.

**Acciones de regla:** Agregar · Reemplazar.

**Aviso en Prompt · Publicar versión (manual, D-78):** «Tienes {n} reglas aceptadas del análisis de discrepancias. Para aplicarlas sin editar el YAML, créalas desde Seguimiento.» + **Ir a Seguimiento**. Se eliminan las casillas «Propuestas incluidas».

**Diálogo Aceptar (C16) para una regla del prompt (H-129):** «Agregar al criterio del motivo {n}:» o «Reemplazar en el criterio del motivo {n}: «{frase}» por:», seguido del texto editable.

**Registro de actividad:** «Creó el borrador v{X} desde Seguimiento con {n} reglas ({k} editadas a mano).»

**Glosario** (se suma a `06-ux-writing.md` §5 al aprobar):

| Término UI | Significa | En código |
|---|---|---|
| Texto final | El criterio del motivo tal como quedará en la versión nueva | `after` |
| Aplicada / Aplicada a mano / Texto libre / Revisar | Resultado de aplicar una regla | `applied \| manual \| free_text \| review` |
| Análisis de discrepancias (origen) | Origen en el historial de las reglas que llegan desde Seguimiento | `discrepancy_analysis` |

### 8.7 Accesibilidad (WCAG 2.2 AA)

- **Cambios que no dependen del color (1.4.1):** lo agregado va en `<ins>`, subrayado y con fondo; lo quitado en `<del>`, tachado y con fondo. Cada uno lleva el texto oculto «Agregado:» / «Quitado:» para lectores de pantalla. Contraste ≥ 4,5:1 sobre ambos fondos con los tokens existentes, sin colores nuevos.
- **Estados de regla** con texto + ícono, nunca solo con color. «Revisar» usa el ámbar de advertencia que ya existe.
- **Resumen** con `role="status"`: anuncia «{n} reglas · {r} para revisar» cada vez que cambia (al quitar, volver a agregar o editar).
- **Foco:** al quitar una regla, el foco pasa a **Volver a agregar**, y al revés. «Editar el texto final» lleva el foco al área de texto. Los enlaces del resumen llevan el foco al título de la tarjeta (`tabindex="-1"`).
- **Etiquetas:** el área de texto se llama «Texto final del criterio · Motivo {n}». Los botones deshabilitados llevan `aria-describedby` hacia el texto visible que explica por qué lo están.
- **Teclado:** todo funciona con Tab, Enter y Espacio. El pie fijo no tapa el elemento con foco (2.4.11): el contenido tiene un margen inferior igual a la altura del pie.
- **Tamaño de los objetivos:** botones y casillas de al menos 24 × 24 px (2.5.8).

### 8.8 Impacto en `admin-types.ts` y `ApiClient` (no es código)

- `DiscrepancyPattern.proposal` suma `action: "append" | "replace" | null` (null = texto libre) y `find: string | null`.
- Tipos nuevos:
  - `RuleApplyState = "applied" | "manual" | "free_text" | "review"`.
  - `FollowUpPromptPreview = { baseVersion, version, model, changelog, rationale, criteria: { criterionId, title, before, after, rules: { proposalId, patternId, action, find, text, state, reviewReason, historyNote, acceptedBy, acceptedAt }[] }[] }`.
- Métodos nuevos:
  - `previewPromptFromFollowUp({ proposalIds, overrides? })` → `POST /api/admin/prompts/from-follow-up/preview`. No guarda nada ni tiene costo. `overrides` = `{ [criterionId]: textoFinal }`, para recalcular los estados después de editar.
  - `createPromptFromFollowUp({ baseVersion, proposalIds, overrides, model, changelog, rationale })` → `POST /api/admin/prompts/from-follow-up` → `PromptVersion`. Responde 409 si cambió la base o alguna regla. Deja las propuestas en `included`.
- `createPromptVersion` pierde `includedProposalIds` (D-78).

### 8.9 Backend y prompt del análisis (los detallan `pipeline-architect` y `llm-engineer`)

- **Prompt del análisis v1.3.0:** `prompt_rule` = `{type, action: "append" | "replace", find, text}`. `find` es obligatorio con `replace` y se copia literal del «Criterio:» que recibe el análisis. Si al recibir la respuesta `find` no está en el criterio, la propuesta se guarda igual y llegará a la revisión en «Revisar». Sin re-corridas: aplica a los análisis futuros.
- **Servicio de aplicación** sin efectos secundarios (spec vigente + propuestas + overrides → spec nuevo + comparación por motivo), con tests en `tests/` sobre un prompt.yaml sintético. Debe conservar el formato del YAML (H-139).
- `create_draft` sigue siendo la única puerta de entrada. El Registro de actividad registra lo de §8.6.

### 8.10 Preguntas para aprobar §8

**Q1 · ¿Qué tan exacta debe ser la búsqueda de la frase a reemplazar?**
- **A (recomendada):** no distingue espacios ni saltos de línea, y nada más. Si cambia una tilde o una coma, la regla queda en «Revisar» y se arregla editando el texto final.
- B: tampoco distingue mayúsculas ni tildes. Encuentra más, pero puede reemplazar algo que no era.

**Q2 · ¿Qué pasa si la frase aparece más de una vez en el criterio?**
- **A (recomendada):** queda en «Revisar» sin tocar nada, y el admin decide editando el texto final.
- B: se reemplaza la primera aparición y se avisa.

**Q3 · ¿Se pueden quitar reglas en la pantalla de revisión, o solo desmarcarlas en Seguimiento?**
- **A (recomendada):** en ambos lados. Quitar una regla en la revisión no cambia su estado (sigue «Aceptada»).
- B: solo en Seguimiento; la revisión muestra lo marcado tal cual.

### 8.11 Supuestos nuevos (a `hipotesis.md` al aprobarse)

| ID | Supuesto | Valida |
|---|---|---|
| H-139 | El YAML generado conserva los comentarios, el orden y los bloques `|-` del original; si la librería no lo permite, se edita como texto solo el bloque `criterion` y el `history` del motivo | `pipeline-architect` |
| H-140 | Una línea nueva al final del criterio es un buen lugar para «Agregar»; si la regla va en otra parte, el admin la mueve en el texto final | Johannes |
| H-141 | Si la vigente cambia mientras el admin revisa, se acepta perder las ediciones manuales y regenerar (caso raro: hay un solo admin) | Johannes |
| H-142 | Si «Crear borrador y probar» termina en un borrador sin probar (porque se canceló el costo), no hace falta deshacerlo solo: el admin lo retira si quiere | Johannes |
| H-143 | La pantalla de revisión reusa la ruta `/admin/prompts/new` con `from=followup`, sin sección nueva en la sidebar | Johannes |
