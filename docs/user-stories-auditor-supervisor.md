# Historias de usuario · Vistas del auditor y del supervisor

> Estado al 2026-10-13. Complementa las HU-01 a HU-13 del documento de entregables; aquí se detallan **las vistas** de los dos roles que operan la revisión humana (etapa 6). IDs propios (`HU-AUD-xx`, `HU-SUP-xx`) para no chocar con la numeración anterior.
>
> **2026-10-13 · Ajustes desde el prototipo** ("Plan de trabajo y flujo", `Auditoria IA.dc.html`): se incorporan la pantalla de fin de jornada, el panel de capas y motor de decisión, la lista de motivos de corrección, el muestreo del 5 % como propuesta, el estado "gestionada" del supervisor y el envío a un sistema QA. Lo que el prototipo **no** cubre y estas historias sí: el control del supervisor sobre los auditores (HU-SUP-06 a HU-SUP-10), el escalamiento (HU-AUD-05) y el historial propio del auditor (HU-AUD-06). El prototipo usa protocolos genéricos con pesos y puntaje sobre 100; para BancoEstado manda la pauta de 33 motivos, sin puntaje.

## Supuestos

- **Auditor**: revisa los casos que el motor de decisión derivó a revisión humana (`non_compliant` y `uncertain`) y una muestra de `compliant`. Solo ve sus casos y su propio historial.
- **Supervisor**: tiene todo lo del auditor, más dashboards, y **puede ver y revisar todas las revisiones de todos los auditores**. Supervisa a dos grupos: a los **ejecutivos** del contact center (dar feedback) y a los **auditores** (calidad y productividad de la revisión).
- **Caso** = una llamada derivada a revisión. Un caso tiene un **hallazgo por motivo** (ítem de la rúbrica) y una decisión final por llamada.
- Toda la UI presenta los resultados como **hallazgos pendientes de revisión humana**, nunca como sanciones (regla no negociable 5).
- La gravedad de cada motivo sigue `TBD` (pregunta abierta #1). Mientras tanto, la cola ordena por "tiene algún `non_compliant`" > `uncertain` > muestra de `compliant`, y luego por antigüedad.

### Estados de un caso

| Estado | Significado |
|---|---|
| `pending` | En cola, sin asignar o asignado sin abrir |
| `in_review` | Un auditor lo tiene abierto (bloqueo para que nadie más lo tome) |
| `confirmed` | El auditor confirmó todos los hallazgos de la IA |
| `corrected` | El auditor cambió al menos un hallazgo |
| `escalated` | El auditor lo derivó al supervisor |
| `reopened` | El supervisor lo devolvió a un auditor |
| `overridden` | El supervisor cambió la decisión del auditor |
| `closed` | Decisión final tomada; ya cuenta en los dashboards |

### Mapa de vistas

| Ruta (propuesta) | Vista | Auditor | Supervisor |
|---|---|:-:|:-:|
| `/queue` | Cola de casos | ✓ (propios) | ✓ (todos) |
| `/calls/[id]` | Detalle de llamada y revisión | ✓ | ✓ |
| `/my-reviews` | Mis revisiones | ✓ | ✓ |
| `/me/stats` | Mi desempeño | ✓ | — |
| `/dashboard` | Dashboard general | — | ✓ |
| `/dashboard/criteria` | Motivos de no calidad | — | ✓ |
| `/agents`, `/agents/[id]` | Ejecutivos | — | ✓ |
| `/alerts` | Alertas críticas | — | ✓ |
| `/reviews` | Revisiones de auditores | — | ✓ |
| `/auditors`, `/auditors/[id]` | Desempeño de auditores | — | ✓ |
| `/calibration` | Calibración | ✓ (asignados) | ✓ |
| `/ai-quality` | Precisión de la IA vs humanos | — | ✓ |
| `/exports` | Exportación | — | ✓ |

**Prioridad**: `MVP` = piloto (opción A); `Post` = producción (opción B).

---

## Auditor

### HU-AUD-01 · Cola de casos · MVP

**Como** auditor, **quiero** ver mi cola de casos pendientes ordenada por gravedad, **para** revisar primero lo que más importa.

Criterios de aceptación:
- Lista con: fecha de la llamada, ID de llamada, ejecutivo, producto(s), decisión del motor (`no cumple` / `dudosa` / `muestra cumple`), cantidad de hallazgos `non_compliant` y `uncertain`, duración y antigüedad en cola.
- Orden por defecto: gravedad (ver supuestos) y luego antigüedad. Se puede reordenar por columna.
- Filtros: decisión, motivo, bloque de la pauta, producto, ejecutivo, rango de fechas.
- Botón **"Tomar siguiente"** que abre el caso de mayor prioridad y lo pasa a `in_review`. Dos auditores no pueden tener el mismo caso abierto.
- Un caso `in_review` sin actividad por `TBD` minutos vuelve a `pending`.
- Contador visible de casos pendientes y revisados hoy.
- No se muestra PII (RUT, nombre del cliente) en la lista.

### HU-AUD-02 · Detalle de llamada · MVP

**Como** auditor, **quiero** escuchar el audio sincronizado con la transcripción y ver cada hallazgo con su evidencia, **para** validar rápido si la IA tiene razón.

Criterios de aceptación:
- Reproductor de audio con velocidad 1x / 1,25x / 1,5x / 2x, y forma de onda con marcas en los timestamps de los hallazgos.
- Transcripción separada por canal (ejecutivo / cliente), con el segmento en reproducción resaltado; clic en una línea salta el audio a ese punto.
- Checklist agrupado por los 5 bloques de la pauta. Cada ítem muestra: motivo, veredicto, confianza, cita textual y comentario de la IA.
- Clic en la evidencia de un ítem salta el audio al `start_ms` y resalta la cita en la transcripción.
- Los ítems con cita no validada (que no aparece en la transcripción) se marcan con un aviso explícito.
- Metadatos de la llamada: ejecutivo, producto(s), tipificación del ejecutivo vs lo detectado en la grabación (motivos 18–25), medio de pago.
- Panel **"Capas y motor de decisión"**: veredicto, versión, latencia y costo de cada capa, más la **regla aplicada** por el motor (ej. "ítem dudoso o confianza bajo el umbral → dudosa"; "compliance duro falla → no cumple").
- Banner fijo: "Hallazgos generados por IA, pendientes de revisión humana".
- La PII se muestra enmascarada también **dentro de la transcripción** (nombre del cliente, RUT, números de tarjeta o cuenta), ej. `RUT ••••-K`. El prototipo los muestra en claro; hay que corregirlo.

### HU-AUD-03 · Confirmar o corregir hallazgos · MVP

**Como** auditor, **quiero** confirmar o corregir cada hallazgo con un motivo de una lista cerrada, **para** dejar una decisión trazable que también sirva para mejorar la IA.

Criterios de aceptación:
- Por cada ítem: **Confirmar**, **Cambiar veredicto** (`cumple` / `no cumple` / `no aplica`) o **Agregar hallazgo** que la IA no detectó (falso negativo), indicando motivo y timestamp.
- Toda corrección exige un **motivo de corrección** de lista cerrada y un comentario opcional (obligatorio si el motivo es "Otro"). Propuesta inicial, tomada del prototipo y ampliada (pendiente de validar, pregunta #21):
  - Evidencia mal interpretada
  - Error de transcripción
  - Criterio ambiguo en la rúbrica
  - Evidencia fuera del fragmento
  - No aplica al producto o a la gestión
  - IA no detectó el incumplimiento (falso negativo)
  - Otro
- El motivo de corrección se guarda junto al ítem como dato para ajustar prompts, umbrales y entrenar la capa 3.
- Un caso `dudosa` no se puede confirmar en bloque: hay que resolver cada ítem `uncertain` antes de cerrarlo.
- El veredicto resultante de la llamada se recalcula y se muestra en vivo mientras el auditor corrige.
- Al guardar se registra: auditor, fecha y hora, tiempo de revisión, versión de la rúbrica, versiones de las capas y el veredicto original de la IA (trazabilidad).
- El caso pasa a `confirmed` o `corrected`.

### HU-AUD-04 · Atajos de teclado y flujo continuo · MVP

**Como** auditor, **quiero** revisar con el teclado y pasar al siguiente caso sin volver a la cola, **para** auditar más llamadas por hora.

Criterios de aceptación:
- Atajos mínimos: espacio (play/pausa), ←/→ (±5 s), J/K (ítem anterior/siguiente), C (confirmar ítem), X (corregir ítem), E (escalar), Enter (guardar y siguiente), ? (ayuda de atajos).
- Al guardar, se abre automáticamente el siguiente caso de la cola.
- Los atajos no se disparan mientras se escribe en un campo de texto.
- Cuando la cola queda vacía se muestra la pantalla **"Fin de jornada"**: casos revisados, confirmados, corregidos y % de acuerdo con la IA, con accesos a "Ver revisados" (HU-AUD-06) y "Cerrar sesión".

### HU-AUD-05 · Escalar al supervisor · MVP

**Como** auditor, **quiero** escalar un caso al supervisor con un comentario, **para** resolver dudas de criterio o casos graves que no me corresponde cerrar.

Criterios de aceptación:
- Escalar exige un motivo (ej. "duda de criterio", "posible incumplimiento crítico", "audio inaudible", "otro") y un comentario.
- El caso pasa a `escalated`, sale de mi cola y aparece en la bandeja del supervisor.
- Veo la respuesta del supervisor en "Mis revisiones" (HU-AUD-06).

### HU-AUD-06 · Mis revisiones · MVP

**Como** auditor, **quiero** ver el historial de los casos que revisé, **para** retomar, corregir un error propio o ver lo que el supervisor cambió.

Criterios de aceptación:
- Lista de mis casos con estado, fecha, decisión final y si el supervisor lo reabrió o lo cambió (`reopened` / `overridden`).
- Puedo editar mi revisión mientras el caso no esté `closed` (ventana `TBD`); cada edición queda en el historial.
- Los casos `reopened` aparecen arriba, con el comentario del supervisor.
- Para un caso `overridden` veo lado a lado mi decisión y la del supervisor, con su justificación.

### HU-AUD-07 · Muestra de llamadas "cumple" · MVP

**Como** auditor, **quiero** que la cola incluya una muestra de llamadas que la IA marcó como `cumple`, **para** detectar falsos negativos y alimentar el monitoreo continuo.

Criterios de aceptación:
- Los casos de muestra se identifican con una etiqueta "Muestra cumple".
- El porcentaje de muestreo es configurable por el supervisor o el admin de calidad. Propuesta inicial: **5 %**, como en el prototipo (pendiente de confirmar con el cliente, pregunta #23).
- El flujo de revisión es el mismo de HU-AUD-03; si encuentro un incumplimiento se registra como falso negativo.

### HU-AUD-08 · Mi desempeño · Post

**Como** auditor, **quiero** ver mis indicadores, **para** saber cómo voy respecto de la meta del equipo.

Criterios de aceptación:
- Casos revisados por día/semana, tiempo medio por caso, % de casos reabiertos o cambiados por el supervisor, concordancia en calibraciones.
- Solo veo mis datos; no veo a otros auditores.

---

## Supervisor

### HU-SUP-01 · Dashboard general · MVP

**Como** supervisor, **quiero** un dashboard diario con el estado de la operación, **para** saber en un vistazo cómo va la calidad y la cola.

Criterios de aceptación:
- KPIs del periodo: llamadas procesadas, % `cumple` / `no cumple` / `dudosa` (según motor), % de cumplimiento final (después de revisión humana), casos pendientes en cola y su antigüedad máxima, incumplimientos críticos confirmados.
- Tendencia diaria/semanal del % de cumplimiento final.
- Filtros globales: rango de fechas, producto, equipo o ejecutivo, versión de rúbrica.
- Se distingue siempre el dato "según IA" del dato "confirmado por auditor".
- Cada KPI enlaza a la lista de llamadas que lo componen.

### HU-SUP-02 · Motivos de no calidad · MVP

**Como** supervisor, **quiero** ver qué motivos de la pauta se incumplen más, **para** orientar capacitaciones.

Criterios de aceptación:
- Ranking de los 33 motivos y de los 5 bloques por cantidad y % de incumplimientos confirmados.
- Comparación contra el periodo anterior.
- Cruce motivo × producto y motivo × ejecutivo (heatmap).
- Clic en un motivo lista las llamadas con ese incumplimiento.

### HU-SUP-03 · Vista por ejecutivo · MVP

**Como** supervisor, **quiero** ver el desempeño de cada ejecutivo y entrar a sus llamadas, **para** dar feedback concreto con evidencia.

Criterios de aceptación:
- Lista de ejecutivos con: llamadas auditadas, % de cumplimiento final, top 3 motivos incumplidos, tendencia.
- Ficha del ejecutivo: evolución en el tiempo, motivos incumplidos, listado de llamadas con hallazgos confirmados.
- Desde la ficha se abre el detalle de la llamada (mismo componente que HU-AUD-02, en modo lectura).
- Cada llamada con hallazgos tiene un **estado de seguimiento** del supervisor: `Pendiente` → `Con feedback` → `Gestionada`. Se puede marcar o desmarcar "Gestionada" desde el detalle o desde la lista.
- Solo cuentan los hallazgos confirmados por un humano; los no revisados se muestran aparte como "según IA".

### HU-SUP-04 · Registro de feedback al ejecutivo · MVP

**Como** supervisor, **quiero** registrar el feedback que le di a un ejecutivo sobre una o varias llamadas, **para** hacer seguimiento a su mejora.

Criterios de aceptación:
- El feedback se asocia a un ejecutivo y a una o más llamadas o motivos; tiene fecha, texto, compromiso y fecha de seguimiento opcional.
- La ficha del ejecutivo muestra el historial de feedback y la evolución de los motivos tratados desde esa fecha.
- El sistema no propone ni registra sanciones; el feedback es un registro del supervisor.

### HU-SUP-05 · Alertas críticas · MVP

**Como** supervisor, **quiero** recibir alertas de incumplimientos críticos ya confirmados por un auditor, **para** actuar el mismo día.

Criterios de aceptación:
- Se genera una alerta cuando un auditor confirma un hallazgo de un motivo marcado como crítico en la rúbrica (cuáles son críticos: `TBD`, pregunta abierta #1).
- Bandeja de alertas con estado (`nueva` / `vista` / `gestionada`) y comentario de gestión.
- Notificación en la app; por correo, opcional (`Post`).
- Los casos escalados por auditores (HU-AUD-05) aparecen en la misma bandeja, con su propio tipo.

### HU-SUP-06 · Revisiones de todos los auditores · MVP

**Como** supervisor, **quiero** ver todas las revisiones hechas por los auditores, **para** controlar la calidad de la revisión humana.

Criterios de aceptación:
- Listado de todos los casos revisados con: auditor, fecha, decisión de la IA, decisión del auditor, cantidad de ítems corregidos, motivos de corrección, tiempo de revisión y estado.
- Filtros: auditor, rango de fechas, estado, motivo de la pauta, "el auditor corrigió a la IA" (sí/no), "el auditor contradijo la IA en un ítem crítico", tiempo de revisión menor a `TBD` segundos (revisiones sospechosamente rápidas).
- Al abrir un caso veo el detalle (HU-AUD-02) con una columna extra por ítem: veredicto IA → veredicto auditor, motivo y comentario de la corrección.
- Historial completo del caso: quién lo tomó, cuándo, cada cambio y escalamiento.

### HU-SUP-07 · Aprobar, reabrir o cambiar una revisión · MVP

**Como** supervisor, **quiero** aprobar, devolver o cambiar la decisión de un auditor, **para** corregir errores de criterio antes de que cuenten en los indicadores.

Criterios de aceptación:
- **Aprobar**: el caso pasa a `closed`.
- **Reabrir**: lo devuelvo al mismo u otro auditor con un comentario; pasa a `reopened`.
- **Cambiar**: modifico uno o más ítems con motivo obligatorio; pasa a `overridden` y luego a `closed`. La decisión original del auditor se conserva.
- Si la decisión de cerrar automáticamente sin aprobación del supervisor aplica a todos los casos o solo a una muestra es `TBD`.
- Todo queda en la auditoría del caso (quién, cuándo, antes/después).

### HU-SUP-08 · Desempeño de auditores · MVP

**Como** supervisor, **quiero** un dashboard de los auditores, **para** equilibrar la carga y detectar quién necesita recalibrarse.

Criterios de aceptación:
- Por auditor: casos revisados por día, tiempo medio por caso, % de casos en que corrige a la IA, % de casos reabiertos o cambiados por el supervisor, % de escalamientos, concordancia en calibraciones (HU-SUP-09).
- Comparación contra la media del equipo.
- Ficha del auditor con sus revisiones (enlaza a HU-SUP-06 filtrado).

### HU-SUP-09 · Calibración entre auditores · Post

**Como** supervisor, **quiero** asignar el mismo caso a varios auditores sin que vean la revisión del otro, **para** medir la concordancia y unificar criterios.

Criterios de aceptación:
- Puedo crear una sesión de calibración con N llamadas y M auditores.
- Cada auditor revisa a ciegas; los casos de calibración no cuentan en los KPIs de ejecutivos.
- Resultado por ítem y por auditor: concordancia (% de acuerdo y kappa), ítems con más desacuerdo.
- Puedo fijar la "respuesta de referencia" de cada caso; esas llamadas se pueden proponer para el golden set.

### HU-SUP-10 · Asignación de la cola · Post

**Como** supervisor, **quiero** reasignar casos o lotes entre auditores, **para** cubrir ausencias o priorizar productos.

Criterios de aceptación:
- Ver la cola completa con el auditor asignado.
- Reasignar uno o varios casos; liberar casos `in_review` bloqueados.
- Configurar reglas simples de asignación (por producto, por motivo) y el % de muestreo de `cumple` (HU-AUD-07).

### HU-SUP-11 · Precisión de la IA vs auditores · Post

**Como** supervisor, **quiero** ver cuánto acierta la IA según las revisiones humanas, **para** saber cuánto confiar en ella y pedir ajustes a la rúbrica.

Criterios de aceptación:
- Por motivo y por versión de rúbrica/prompt: tasa de falsos positivos (IA dijo `no cumple`, humano dijo `cumple`) y falsos negativos (encontrados en la muestra de `cumple` o agregados por el auditor), contra las metas (≤ 5 % FP, ≤ 20 % FN).
- % de casos `dudosa` y cómo se resolvieron.
- Top motivos de corrección (ej. "error de transcripción" apunta al ASR; "criterio mal aplicado" apunta a la rúbrica o al prompt).
- Se puede filtrar por fecha para ver el efecto de una nueva versión de rúbrica.

### HU-SUP-12 · Exportación · MVP

**Como** supervisor, **quiero** exportar las llamadas auditadas y sus hallazgos, **para** reportar al cliente o a otras áreas.

Criterios de aceptación:
- Exporta a CSV/Excel lo que esté filtrado en la vista actual (dashboard, ejecutivo, motivos o revisiones).
- Columnas: llamada, fecha, ejecutivo, producto, motivo, veredicto IA, veredicto final, auditor, motivo de corrección, versiones de rúbrica y capas.
- Sin PII por defecto. Incluir PII requiere un permiso explícito y queda registrado.
- **Enviar a sistema QA** (`Post`): crea una tarea de seguimiento por cada llamada `no cumple` confirmada del filtro actual. El sistema de destino y su integración son `TBD` (pregunta #24).

---

## Transversales (ambos roles)

- **Permisos por rol**: el auditor nunca ve dashboards ni revisiones de otros auditores; el supervisor ve todo lo de su operación.
- **PII**: enmascarada por defecto en todas las vistas; ver datos sin enmascarar (si se permite) queda en un log de acceso.
- **Trazabilidad**: cualquier decisión mostrada indica las versiones de rúbrica, prompt y capas con las que se generó.
- **Lenguaje**: "hallazgo", "incumplimiento detectado", "pendiente de revisión"; nunca "sanción" ni "falta".

## Pendientes (registrados en `client-open-questions.md`, #1 y #21–#24)

- Gravedad y motivos críticos (#1): orden de la cola y alertas.
- Lista cerrada de motivos de corrección del auditor (hay propuesta en HU-AUD-03).
- Si todas las revisiones requieren aprobación del supervisor o solo una muestra.
- % de muestreo de llamadas `cumple` (propuesta: 5 %) y metas de productividad del auditor.
- Sistema QA de destino para las tareas de seguimiento.
