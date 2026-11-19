# Estado del proceso UX · Calidad del servicio (vistas de supervisor)

- **Fase actual:** **Iteración 2 «criterios y motivos de renuncia»: fases 3 a 6 aprobadas (2026-11-19, D-42 a D-47); implementa el coordinador desde `10-criterios-y-motivos-de-renuncia.md`.** Sin preguntas abiertas de diseño. Iteración 1 («graficada») implementada (D-32 a D-40); D-41 Criterios (antes Motivos) solo para Qubico.
- **Tipo:** funcionalidad nueva (usuaria nueva: la supervisora de la empresa). Proceso completo comprimido según `00-brief.md` §10 (D-05).
- **Aprueba los gates:** Johannes.
- **Legal y anonimización:** omitidos por instrucción de Johannes (D-00). No hay `registro-legal.md`.
- **No escribir código de UI** hasta aprobar las fases previas.
- **Reunión presencial con Verónica:** sin fecha. No bloquea; el guion está en `01-investigacion.md` §7.
- **Relación con otros procesos:** reemplaza en modo real los cascarones vacíos de `/agents`, `/dashboard/criteria` y `/auditors` (HU-SUP-02, 03, 08 de `docs/ux/call-audit/`) con un enlace a la sección nueva; reutiliza la tabla por evaluador (Cambio 20 §7) y Calidad de la IA (Cambio 15); es vecina de `docs/ux/admin-presentation/`.

## Aprobaciones

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 0 · Brief | **Aprobada** | 2026-11-17 | Johannes: "Sí, apruebo todas" (las 5 recomendaciones de la ronda 1) |
| 1 · Investigación | Entregada, pendiente | 2026-11-17 | `01-investigacion.md`; preguntas de la ronda 2 abiertas |

## Decisiones tomadas

| ID | Fecha | Decisión | Origen |
|---|---|---|---|
| — | 2026-11-16 | Incorporar vistas de supervisor por ejecutivo, por tipo de llamada y por motivo, con análisis precomputados | Reunión semanal (Jean Paul, Johannes, Agustín, Rodrigo) |
| — | 2026-11-17 | RAG/vectorización fuera de alcance | Reunión 16-nov; diseñador |
| D-00 | 2026-11-17 | Sin revisión legal ni anonimización en este proceso; artefactos en `docs/ux/vistas-supervisor/` | Johannes |
| D-01 | 2026-11-17 | La vista **por evaluador** de la planilla es **solo interna** (`qubico_admin`) en la primera ola; Qubico la presenta acompañada y después de la reunión se decide si se abre. **Verónica pasa a rol `supervisor`** (revierte D-22 de call-audit para ella) y ve las demás vistas | Johannes (opción 1A) |
| D-02 | 2026-11-17 | Las tasas se muestran con **IA vigente y planilla lado a lado**, la IA como eje, la brecha destacada; nunca mezcladas en una cifra y siempre rotuladas por fuente | Johannes (opción 2C) |
| D-03 | 2026-11-17 | "Tipo de llamada": mientras se confirma con Verónica, se diseña con **tipo de seguro y flujo** como filtros de una misma vista | Johannes (opción 3) |
| D-04 | 2026-11-17 | Sección nueva **"Análisis de calidad"** con pestañas Ejecutivos, Evaluadores (interna), Tipos de llamada, Motivos e Informes, alimentada por una foto precomputada; en modo real los cascarones vacíos actuales enlazan a ella | Johannes (opción 4A) |
| D-05 | 2026-11-17 | **Ola 1:** Motivos, Ejecutivos, Evaluadores (interna), Informes de Claude publicados. **Ola 2:** Tipo de llamada, Alertas de ambigüedad (primero con regla sin IA), Referente de calidad. Proceso comprimido (brief §10); la reunión con Verónica sirve como entrevista y test | Johannes (opción 5) |
| D-06 | 2026-11-17 | Consistencia medida **contra la IA**: se separan **severidad** (más estricto o permisivo) y **desacuerdo** (marca distinto), contra el resto del equipo en el mismo motivo; kappa solo en el detalle técnico interno. Un motivo está "posiblemente mal definido" si el desacuerdo es alto en la mayoría de los evaluadores | Johannes (ronda 2, 1A) |
| D-07 | 2026-11-17 | Por ejecutivo: % No cumple por motivo según la IA y según la planilla, desvío contra la media, bases visibles (100 % con corrida vigente / solo evaluadas), "pocas llamadas" bajo 10, **sin ranking** (orden por desvío, sin posiciones) | Johannes (ronda 2, 2A) |
| D-08 | 2026-11-17 | La foto la genera un **script del backend** al cerrar una corrida o al importar la planilla; sin botón en la UI; se muestra "Datos al {fecha} · corrida {versión}" | Johannes (ronda 2, 3A) |
| D-09 | 2026-11-17 | Informes de Claude en **Markdown con encabezado** (título, fecha, corrida, audiencia interna/empresa), cargados por el admin; el primero es el de patrones de los ejecutivos con menos rechazo | Johannes (ronda 2, 4A) |
| D-10 | 2026-11-17 | Motivo 25 con aviso "Desacuerdo explicado en parte por los datos de la gestión" y **fuera del orden por defecto** de Ejecutivos; el mismo mecanismo sirve para el 18 si se confirma | Johannes (ronda 2, 5A) |
| D-11 | 2026-11-17 | `/discrepancies` (clasificación y "Por presentar") **sale del rol `supervisor`** y queda solo para `qubico_admin` | Johannes (ronda 3, 1A) |
| D-12 | 2026-11-17 | Sin modo reunión: Qubico presenta con una cuenta `supervisor` de prueba | Johannes (ronda 3, 2A) |
| D-13 | 2026-11-17 | `qubico_viewer` ve toda la sección en solo lectura, incluidos Evaluadores e informes internos | Johannes (ronda 3, 3A) |
| D-14 | 2026-11-17 | La sección se llama **"Calidad del servicio"**; ruta `/analysis` (reemplaza el nombre de trabajo "Análisis de calidad") | Johannes (ronda 3, 4B) |
| D-15 | 2026-11-17 | La ola 1 es **solo lectura**; marcar un motivo "a revisar con la pauta" se reevalúa después de la reunión | Johannes (ronda 3, 5A) |
| D-16 | 2026-11-17 | Los informes se cargan **con el script de la foto** (Markdown en carpeta o por línea de comandos); sin subida en la UI | Johannes (ronda 4, 1A) |
| D-17 | 2026-11-17 | La lista de llamadas de una cifra es una **página propia** `/analysis/calls?…`, paginada en el servidor (50 por página), con URL compartible | Johannes (ronda 4, 2A) |
| D-18 | 2026-11-17 | La foto usa **una sola corrida, la vigente**, recalculada por motivo sin IA (A). Si faltan resultados por motivo, cada bloque usa su mejor corrida **con rótulo** y sin re-correr nada (B). El diseño soporta ambos casos (banda S-07). Ver H-17 | Johannes (ronda 4, 3A) |
| D-19 | 2026-11-17 | Los datos se actualizan **al recargar**, sin aviso ni sondeo | Johannes (ronda 4, 4B) |
| D-20 | 2026-11-17 | En modo real, el `supervisor` **aterriza en Calidad del servicio → Motivos** (`homeFor`); Inicio sigue en la sidebar | Johannes (ronda 4, 5A) |
| D-21 | 2026-11-17 | Umbrales: U = 15 pts de desacuerdo con la IA en la mayoría de los evaluadores con ≥ 10 llamadas ("Se marca distinto") y ±2 pts ("Igual que el equipo"); configurables en el script | Johannes (ronda 5, 1A) |
| D-22 | 2026-11-17 | "Frente al equipo" en Ejecutivos se calcula **solo según la IA**; la planilla va al lado como dato | Johannes (ronda 5, 2A) |
| D-23 | 2026-11-17 | La ficha del ejecutivo muestra los **10 motivos con más desvío** y "Ver los 33" | Johannes (ronda 5, 3A) |
| D-24 | 2026-11-17 | Prototipo con **cifras agregadas reales de la base local** y nombres sintéticos, rotulando la corrida (la base local tiene 2.7, 2.8 y 2.10; no v3.0) | Johannes (ronda 5, 4A) |
| D-25 | 2026-11-17 | El glosario de `06-ux-writing.md` §9 se suma **ahora** a `docs/ux/call-audit/06-ux-writing.md` §5 (hecho el 2026-11-17) | Johannes (ronda 5, 5A) |
| D-26 | 2026-11-17 | Motivos: columna **"No coinciden"** (% de llamadas donde la IA y la planilla marcan distinto), orden por defecto por ella; "Diferencia" al lado (C-01) | Johannes (ronda 6, 1A) |
| D-27 | 2026-11-17 | La foto acumula **90 días** (configurable). Ejecutivos se muestra solo si **≥ 5 ejecutivos tienen ≥ 10 llamadas**; si no, aviso con enlace a Motivos (C-02). Volumen en producción sin confirmar | Johannes (ronda 6, 2A) |
| D-28 | 2026-11-17 | **"Evaluador"** en toda la app, incluidas las métricas del prompt (reemplaza "Revisor"); solo copy, como tarea del handoff (F-7), sin editar ahora | Johannes (ronda 6, 3A) |
| D-29 | 2026-11-17 | En la reunión con Verónica se usa el prototipo con rol Supervisor si es antes de la ola 1; fecha pendiente | Johannes (ronda 6, 4A) |
| D-30 | 2026-11-17 | Fase 8 en HTML, reutilizando tokens y componentes, con handoff de tipos y contrato de API de `analysis_snapshot` | Johannes (ronda 6, 5A) |
| D-31 | 2026-11-18 | La referencia humana pasa a ser **"el auditor"**: por llamada, la revisión del auditor en la app (`reviews`) si existe; si no, la marca por motivo de la planilla. Textos en `06-ux-writing.md` §10; la pestaña Evaluadores pasa a **"Auditores"** (recomendación, §10.2). Palabras de Johannes: "aquí en vez de segun planilla, deberia ser, según auditor. En el caso de que no haya habido resultado de un auditor, entonces usa lo de la metadata, pero si hay feedback de auditor, se usa eso." | Johannes (implementado por el coordinador; copy: diseñador) |
| D-32 | 2026-11-18 | Iteración 1: **"top" de auditores permitido** (orden por marca distinto por llamada, uso interno); **ejecutivos sin "top"**: se mantiene D-07 (orden por desvío, sin posiciones, sin recortar) | Johannes (IT-Q6 A: "Sí, apruebo todas") |
| D-33 | 2026-11-18 | Se mantienen D-01/D-13: pestaña Auditores y ficha del auditor **solo para Qubico** (`qubico_admin`, `qubico_viewer`) | Johannes (IT-Q7 A) |
| D-34 | 2026-11-18 | Celda del cruce persona × motivo de auditores = **% de sus llamadas en que no coincide con la IA en ese motivo**, en un solo tono; cantidad y dirección en el tooltip | Johannes (IT-Q8 A) |
| D-35 | 2026-11-18 | Alcance de la iteración: **solo pestaña Auditores, ficha del auditor, pestaña Ejecutivos y ficha del ejecutivo**. Motivos sin cambios; vista "Resumen" postergada (IT-Q1 a IT-Q4 cerradas o en pausa) | Johannes (IT-Q9 A) |
| D-36 | 2026-11-18 | **Evolución por tramos dentro de los 90 días de la foto** (3 puntos), sin cambiar la retención de fotos | Johannes (IT-Q10 A) |
| D-37 | 2026-11-18 | Colores de los gráficos: escala violeta para "cuánto marca distinto" y ocre ↔ violeta con gris para "frente al equipo" (`--seq-*`, `--div-*`) | Johannes (IT-Q11 A) |
| D-38 | 2026-11-18 | Evolución en 3 tramos de 30 días hacia atrás desde el fin de la foto | Johannes (IT-Q12 A) |
| D-39 | 2026-11-18 | "Top" de auditores: todos si son 8 o menos; si no, 8 y "Ver todos" | Johannes (IT-Q13 A) |
| D-40 | 2026-11-18 | Mapas de calor: celdas pulsables con mouse; con teclado, por nombre → ficha y por la tabla de abajo | Johannes (IT-Q14 A) |
| D-41 | 2026-11-19 | **Motivos, por ahora, solo para Qubico** (`qubico_admin`, `qubico_viewer`). El supervisor no ve la pestaña ni la ficha del motivo (API 404, como Auditores) y entra a Calidad del servicio por Ejecutivos. Revisa D-20 | Johannes ("Toda la pestaña Motivos") |
| D-42 | 2026-11-19 | Los 33 puntos de la pauta se llaman **"criterio(s)"** en **toda la app visible, incluidas las exportaciones**; "motivo" queda solo para el **motivo de renuncia**. Identificadores de código, URLs, prompt y rúbrica sin cambio. Glosario actualizado en `docs/ux/call-audit/06-ux-writing.md` §2.8 y §5 y `03-arquitectura-informacion.md` §4.2 | Johannes (IT-Q15 A: "Sí, apruebo todas") |
| D-43 | 2026-11-19 | La razón de una acción del usuario se llama **"razón"** ("Razón de la corrección", "Razón del escalamiento", "Razón del cambio", "Elige una razón…") | Johannes (IT-Q16 A) |
| D-44 | 2026-11-19 | El modal del criterio 18 muestra lo tipificado por el ejecutivo y lo sugerido por la IA; **no** el motivo según el auditor (no existe el dato). Registrarlo en la revisión del auditor queda como mejora aparte (proceso `call-audit`) | Johannes (IT-Q17 A) |
| D-45 | 2026-11-19 | "Criterio del prompt" pasa a **"Regla de aplicación"**; "Prompt o criterio" a **"Prompt o regla de aplicación"** | Johannes (IT-Q18 A) |
| D-46 | 2026-11-19 | En vistas agregadas el modal muestra solo la lista oficial y "Cómo se evalúa"; sin datos nuevos en la foto ni modal por fila en `/analysis/calls` | Johannes (IT-Q19 A) |
| D-47 | 2026-11-19 | La lista de motivos de renuncia **se lee de `renunciation_reasons` en `prompts/layer2/prompt.yaml` vigente** (fuente única: el prompt) vía `GET /api/reference/renunciation-reasons`. No se mueve a la rúbrica por ahora porque obligaría a subir versión de rúbrica y prompt (resuelve P-12) | Coordinador (decisión técnica) |
| D-48 | 2026-11-19 | **Discrepancias, por ahora, solo para el admin de Qubico.** El supervisor no la ve en el menú, la ruta lo saca y la API responde 403 (resuelve P-6) | Johannes ("saca de la vista de supervisor la vista discrepancias") |
| D-49 | 2026-11-19 | Las vistas antiguas del supervisor sin datos (Ejecutivos `/agents`, Criterios `/dashboard/criteria`, Auditores `/auditors`) **no se muestran en ningún modo, tampoco en la demo**, y sus rutas llevan a Calidad del servicio. Amplía F-3/F-4 | Johannes ("no las muestres si es que aún no están disponibles") |

## Aprobaciones (continuación)

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 1 · Investigación | **Aprobada** | 2026-11-17 | Johannes: "Sí, apruebo todas" (ronda 2) |
| 2 · Ideación + 3 · AI | **Aprobadas** | 2026-11-17 | Johannes: "Sí, apruebo todas" (ronda 3) |
| 4 · User flows | **Aprobada** | 2026-11-17 | Johannes: "Sí, apruebo todas" (ronda 4) |
| 5 · Patrones + 6 · UX writing | **Aprobadas** | 2026-11-17 | Johannes: "Sí, apruebo todas" (ronda 5) |
| 7 · Prototipado | **Aprobada** | 2026-11-17 | Johannes: "Sí, apruebo todas" (ronda 6) |
| 8 · Alta fidelidad | **Aprobada** (Johannes: "Sí, apruebo"). **Proceso UX cerrado** | 2026-11-17 | `08-alta-fidelidad.md`, `08-prototipo-alta-fidelidad.html`; C-01 a C-09 aplicados |

## Pendiente antes de implementar (P-2 a P-8 abiertos para la implementación)

| ID | Pendiente | Quién | Bloquea |
|---|---|---|---|
| P-1 | ~~Aprobación de la Fase 8~~ **Resuelto 2026-11-17** (Johannes: "Sí, apruebo") | Johannes | — |
| P-2 | ¿Existen resultados por motivo de v3.0 en producción o archivos? (H-17) | Johannes / analista | No: el diseño soporta ambos casos (D-18) |
| P-3 | `TIPO_SEGURO` no trae el tipo: en la base local viene con el sistema de origen (MUS 62, SALEFORCE 36, ANETO 2; revisado al implementar, 2026-11-17). La foto agrupa por nombre de producto (Accidentes personales, Sale Seguro, Vida y salud, Incendio Hogar); falta validar esa lista con la corredora | Johannes | La pestaña de tipo de seguro (filtro) |
| P-4 | Volumen por ejecutivo en producción en 90 días (D-27): define si Ejecutivos se abre en la ola 1 | Johannes / analista | No (hay estado vacío) |
| P-5 | El evaluador de la planilla debe venir en la importación (la base local no lo trae; Cambio 20, D-97) | Johannes | La pestaña Evaluadores |
| ~~P-6~~ | ~~Confirmar H-16 en producción antes de quitar Discrepancias al supervisor~~ | Johannes | **Resuelta 19-nov: se quita (D-48)** |
| P-7 | Motivo 1 como "Explicado por los datos" (HE-03): validar con Verónica | Rodrigo | No |
| P-8 | Fecha de la reunión con Verónica | Rodrigo | No |
| P-9 | La foto solo se regenera al cerrar una corrida o importar una planilla (D-08); las revisiones del auditor hechas después no aparecen hasta la próxima foto. Decidir si también se regenera al aprobar revisiones o una vez al día | Johannes | No |
| ~~P-10~~ | ~~Confirmar el nombre "Auditores" para la pestaña (D-31, §10.2)~~ | Johannes | **Resuelta 18-nov-2026: Johannes confirma "Auditores".** |

## Iteración 1 · Calidad del servicio graficada (2026-11-18)

Detalle en `09-iteracion-graficos.md`.

- **Ronda IT-1:** "quiero que la data se vea más graficada. Como si fuera una presentación a un board o a un gerente". Preguntas IT-Q1 a IT-Q5.
- **Ronda IT-2:** Johannes no eligió entre IT-Q1 e IT-Q5 y redefinió el foco: "necesito ver en gráficos por cada, o quizás como el top de los auditores, o quizás cada auditor, como la cantidad de discrepancias que tienen, así como discrepancias entre la IA y sus resultados para cada ítem. Eso es como lo más importante. Y también necesito como un análisis de cada auditor, como de su performance, cosas así, pero eso necesito que esté graficado. Y eso para ejecutivos y auditores."
- **Alcance propuesto:** gráficos dentro de pestaña Auditores, ficha del auditor, pestaña Ejecutivos y ficha del ejecutivo. Vista "Resumen" postergada.
- **Se reabren:** 0 (delta), 1 comprimida (CUJ-5), 4 corta, 5 (catálogo de gráficos, lo principal), 6 parcial, 7 y 8 de esas 4 pantallas. 2–3 solo si IT-Q7 cambia quién ve Auditores.
- **Se mantienen:** D-02, D-06, D-10, D-18, D-21, D-22, D-23, D-26, D-27, D-31, tokens y glosario. Las tablas quedan como detalle.
- **En tensión (decide Johannes):** D-07 (sin ranking) frente a "el top" → IT-Q6; D-01/D-13 (Auditores solo Qubico) → IT-Q7.
- **Propuesta del diseñador (se aprueba con la Fase 5 de la iteración):** gráficos a mano en SVG/`div`, sin librería (R-13); desempeño = consistencia frente a la IA y al equipo, nunca acierto (R-14); sin números de posición ni medallas (R-11).

| Fase de la iteración | Estado | Fecha |
|---|---|---|
| 0 · Delta del brief, ronda IT-1 | Entregada; Johannes redefinió el foco | 2026-11-18 |
| 0 · Delta del brief, ronda IT-2 | **Aprobada** (Johannes: "Sí, apruebo todas"; D-32 a D-36) | 2026-11-18 |
| 1 comprimida + 5 · Patrones + 6 · Textos | Entregadas en `09b-graficos-especificacion.md`, esperando IT-Q11 a IT-Q14 y aprobación | 2026-11-18 |

### Preguntas de la ronda IT-1

| ID | Pregunta | Estado |
|---|---|---|
| IT-Q1 | ¿Dónde van los gráficos? (Resumen / pestañas / ambos) | **Reemplazada** por el foco de IT-2 (gráficos dentro de las 4 pantallas), sujeto a IT-Q9 |
| IT-Q2 | Audiencia (gerencia / Verónica / socios de Qubico) | **Reemplazada** por IT-Q7 |
| IT-Q3 | Mensaje en 5 segundos | **Reemplazada**: el foco es el cruce persona × motivo |
| IT-Q4 | Exportar o presentar (pantalla + PDF del navegador / PPTX / solo pantalla) | **En pausa**; vuelve si se retoma la vista Resumen |
| IT-Q5 | Tendencia en el tiempo | **Pasa a IT-Q10** |

### Preguntas abiertas de la ronda IT-2

| ID | Pregunta | Opciones (recomendada primero) | Estado |
|---|---|---|---|
| IT-Q6 | ¿Se permite un "top" (ordenar y recortar a los que más se apartan)? | **A** auditores: sí, ordenados por discrepancias por llamada (es calibración de la pauta, uso interno); ejecutivos: se mantiene D-07, orden por desvío sin posiciones y sin recortar a un "top" · B "top" para ambos (revisa D-07) · C ningún "top": orden alfabético en ambos | **Resuelta: A (D-32)** |
| IT-Q7 | ¿Quién ve la pestaña Auditores y la ficha del auditor? | **A** se mantiene D-01/D-13: solo Qubico (`qubico_admin`, `qubico_viewer`), que la presenta acompañada · B también el `supervisor` de la corredora (revisa D-01) · C el `supervisor` ve solo los agregados del equipo de auditores, sin nombres | **Resuelta: A (D-33)** |
| IT-Q8 | ¿Qué muestra cada celda del cruce persona × motivo? | **A** % de las llamadas de esa persona en que no coincide con la IA en ese motivo (un tono), con cantidad y dirección en el tooltip · B dirección: más estricto / más permisivo (par divergente) · C cantidad absoluta de discrepancias | **Resuelta: A (D-34)** |
| IT-Q9 | ¿El alcance es solo estas 4 pantallas? | **A** sí: Auditores, ficha del auditor, Ejecutivos y ficha del ejecutivo; Motivos sigue como está y la vista "Resumen" se posterga · B además gráficos en Motivos · C además la vista "Resumen" para gerencia | **Resuelta: A (D-35)** |
| IT-Q10 | ¿Se muestra la evolución de cada persona en el tiempo? | **A** por mes dentro de los 90 días de la foto (3 puntos), sin cambiar la retención · B sin evolución por ahora · C guardar el historial de todas las fotos (más backend) | **Resuelta: A (D-36)** |

### Preguntas abiertas de la ronda IT-3 (fases 1, 5 y 6 de la iteración)

| ID | Pregunta | Opciones (recomendada primero) | Estado |
|---|---|---|---|
| IT-Q11 | Colores nuevos de los gráficos | **A** violeta (una sola escala) para "cuánto marca distinto" y ocre ↔ violeta con gris al centro para "más o menos que el equipo"; nunca los dos en la misma pantalla (validado con el script de la skill dataviz) · B reutilizar el teal de la app con opacidad, como el mapa actual de `/dashboard/criteria` · C azul ↔ rojo (choca con IA = azul e Incumple = rojo) | **Resuelta 18-nov: A** (Johannes: "Sí, implementa directo") |
| IT-Q12 | Cómo se cortan los "meses" de la evolución | **A** 3 tramos iguales de 30 días hacia atrás desde el fin de la foto, rotulados con fechas ("19 ago – 17 sep") · B meses calendario (el primero y el último quedan incompletos) | **Resuelta 18-nov: A** (Johannes: "Sí, implementa directo") |
| IT-Q13 | Cuántos auditores muestra el gráfico de barras ("top") | **A** todos si son 8 o menos; si son más, los 8 que más marcan distinto y "Ver todos" · B siempre todos · C siempre los 5 primeros | **Resuelta 18-nov: A** (Johannes: "Sí, implementa directo") |
| IT-Q14 | Teclado en los mapas de calor | **A** las celdas se pueden pulsar con el mouse; con teclado se llega al mismo destino por el nombre de la fila → ficha → motivo (la tabla de abajo tiene los mismos enlaces) · B cada celda enfocable con flechas (grilla con `role="grid"`; más trabajo de implementación) | **Resuelta 18-nov: A** (Johannes: "Sí, implementa directo") |

## Iteración 2 · "Criterio" en vez de "motivo" y modal de motivos de renuncia (2026-11-19)

Pedido de Johannes, textual: "Quiero que todo lo que dice motivo en realidad diga criterios o criterios. Los motivos son los motivos de renuncia. Siempre que salga el criterio 18, deberiamos poder revisar en un modal los motivos de renuncia." Detalle en `10-criterios-y-motivos-de-renuncia.md`.

- **Alcance transversal:** el glosario es común a la app (`docs/ux/call-audit/06-ux-writing.md` §2.8 y §5, D-25). Al aprobar, se actualiza ese glosario también.
- **Se reabren:** 3 (taxonomía y glosario), 4 (micro-flujo del modal), 5 (componente modal de referencia, variantes llamada y agregada), 6 (reemplazo de textos y textos del modal). **No** 7 y 8 (implementación directa, como la Iteración 1). Sin cambios en cálculos, permisos ni D-00 a D-41.
- **Código:** identificadores sin cambio (`criterion`, `criterionId`); solo textos visibles. El prompt de la capa 2, la rúbrica y los nombres oficiales de los criterios no cambian.
- **Datos revisados:** la lista oficial de motivos de renuncia solo está en `prompts/layer2/prompt.yaml` (`renunciation_reasons`, 28 entradas con "No informado"; `docs/context.md` dice 27 → pregunta #30 a la corredora). Existen `Typification.reason` (tipificado) y `Finding.suggestedReasons` (IA, criterio 18). **No existe** el motivo de renuncia según el auditor.

| Fase de la iteración 2 | Estado | Fecha |
|---|---|---|
| 3 + 4 + 5 + 6 | **Aprobadas** (Johannes: "Sí, apruebo todas"; D-42 a D-46; D-47 del coordinador). Fases 7 y 8 omitidas: implementación directa | 2026-11-19 |

### Preguntas abiertas de la ronda IT-4

| ID | Pregunta | Opciones (recomendada primero) | Estado |
|---|---|---|---|
| IT-Q15 | ¿Dónde se cambia "motivo" por "criterio"? | **A** toda la app visible (auditor, detalle de llamada, Calidad del servicio, admin, discrepancias, dashboards) **y** las exportaciones · B toda la app salvo las exportaciones (los CSV/Excel siguen con "Motivo" para calzar con la planilla de la corredora) · C solo Calidad del servicio | **Resuelta: A (D-42)** |
| IT-Q16 | ¿Qué pasa con "motivo" como razón de una acción ("Motivo de la corrección", motivo del escalamiento, "Motivo del cambio")? | **A** pasa a "razón" ("Razón de la corrección", "Elige una razón…"), así "motivo" queda solo para la renuncia · B se mantiene "Motivo de la corrección" (es compuesto y se entiende) | **Resuelta: A (D-43)** |
| IT-Q17 | ¿El modal muestra el motivo de renuncia según el auditor? | **A** no por ahora: muestra lo tipificado por el ejecutivo y lo sugerido por la IA (lo que existe); registrar el motivo correcto en la revisión del auditor queda como mejora aparte (proceso `call-audit`) · B agregar ahora al flujo del auditor elegir el motivo de renuncia correcto al corregir el criterio 18 | **Resuelta: A (D-44)** |
| IT-Q18 | ¿Cómo se llama lo que hoy dice "Criterio del prompt" (la regla con que la IA aplica cada criterio) y "Prompt o criterio"? | **A** "Regla de aplicación" ("Prompt o regla de aplicación") · B "Cómo se aplica" · C se deja igual (convive con el nuevo "criterio") | **Resuelta: A (D-45)** |
| IT-Q19 | En vistas agregadas (Criterios, mapas de calor, fichas, lista de llamadas), ¿el modal trae datos de la foto? | **A** no: lista oficial + "Cómo se evalúa", sin cambiar la foto · B además "En esta foto": motivos tipificados más frecuentes entre las llamadas que incumplen el 18, y el modal por llamada en cada fila de `/analysis/calls?criterion=18` (campos nuevos en la foto) | **Resuelta: A (D-46)** |

### Pendientes nuevos

| ID | Pendiente | Quién | Bloquea |
|---|---|---|---|
| P-11 | ¿Son 27 o 28 los motivos de renuncia ("No informado" incluido)? Pregunta #30 en `docs/client-open-questions.md` | Rodrigo / la corredora | No: el modal muestra la cantidad que traiga la lista |
| ~~P-12~~ | ~~Fuente única de la lista~~ **Resuelto 2026-11-19 (D-47):** se lee del prompt vigente | Coordinador | — |
| P-13 | Llamadas con varias gestiones y motivos de renuncia distintos: `Typification` trae uno solo | Johannes | No |
