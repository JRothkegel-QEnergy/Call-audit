# Ajustes tras ver producción · Propuesta (Fase 1 acotada)

- **Fecha:** 2026-11-13 · **Pide:** Johannes, tras ver en producción la segunda entrega (N1-N8, commit `73677ba`).
- **Base aprobada:** `05-numeros-propuesta.md` (N1-N8), `02-mosaico-propuesta.md` (colores E3, D5), `04-verificacion-propuesta.md`
  (lista y caso por segmento), glosario `../call-audit/06-ux-writing.md` §8.
- **Tipo:** cambio sobre diseño aprobado. No se repiten fases: diagnóstico, propuesta y decisiones F1-F5.
- **Fuera:** temas legales y anonimización (instrucción de Johannes); correr IA pagada. Todo sale de resultados guardados.

## 1. Feedback y diagnóstico

| # | Feedback (resumido) | Qué pasa hoy (leído en código y BD de prod) | Trazabilidad |
|---|---|---|---|
| 1 | Volver a ver el caso a caso en cuadritos (matriz), en otra pestaña o en un acordeón | El "Mapa llamada por llamada" (`CallMap`, `ec53434`) se quitó con N6 A. Nada lo reemplaza a la vista: hay que ir cifra por cifra a la lista | P-08 (no se puede revisar caso a caso), O-06 |
| 2 | "Error de planilla" → "error del revisor" / "posible error del revisor" | El término está en ~20 archivos del front (cabecera, mosaico, barra de Discrepancias, Calidad de la IA, lista, caso, `verification-labels.ts`) y en el glosario §8.3 | N-R6 (una cifra, un nombre) |
| 3 | En Análisis de discrepancias la data no cambia al abrir otro análisis | Cabecera, mosaico, puente y «¿En qué motivos?» del Resumen salen **siempre** de la última prueba en validación (`verification.latest_quality`, hoy v2.15), no del análisis elegido. La línea "Patrones: … sobre la corrida vigente en las llamadas de entrenamiento" está fija en `discrepancy-summary.tsx` y es falsa para los `attribution`. `latest_finished` excluye los `attribution`, y `decide()` los rechaza (`attribution_only`) | P-09, N-R1 |
| 4 | En Calidad de la IA no pasa nada al agregar otra versión | Cabecera y mosaico usan `selected[0]` (`ai-quality.tsx`). Agregar una versión solo agrega una fila a la comparación, abajo, fuera de la vista | P-14, O-07 |

Análisis reales en producción y su universo:

| Tipo | Cuántos | Sobre qué corre | Patrones decidibles hoy |
|---|---|---|---|
| Antiguos (5-10 nov) | 8 | Corrida vigente Gemini v2.10, todas las llamadas (sin split) | Sí |
| `rules` (loop) | 3 | Pruebas de v2.12, v2.13, v2.14 en **entrenamiento** | Sí |
| `attribution` (análisis de causa) | 3 | Pruebas de v2.13, v2.14, v2.15 en **validación** (220) | No (`attribution_only`) |

## 2. Análisis por caso (feedback 1)

Vuelve el mapa, rehecho con las reglas de N1-N8 (no el de antes tal cual):

- **Dónde (F1):** acordeón **"Análisis por caso"** en Calidad de la IA, debajo del mosaico, **cerrado por defecto**. Sigue a la
  versión activa (§5). Texto del resumen plegado: "Análisis por caso · 218 llamadas × 24 motivos de v2.15".
- **Universo:** las llamadas de validación de esa versión (N-R1), no las ≈ 1.000 de antes.
- **Ejes:** columnas = llamadas; filas = **Veredicto** + un motivo por fila (M01…). Igual que antes.
- **Colores E3 del mosaico** (cambia respecto del mapa viejo): verde coincide · amarillo solo la IA lo marca · rojo solo el revisor
  lo marca · azul posible error del revisor (si hay análisis de causa) · gris claro sin decisión de la IA (N-R3, ya no cuenta
  como No cumple) · blanco ninguno lo marca · rayado con error de la IA.
- **Páginas:** dos, con un control segmentado: "Aprobadas por el revisor (109)" / "Rechazadas por el revisor (109)". Dentro de
  cada una, primero las llamadas en desacuerdo de veredicto, luego las que solo difieren en algún motivo, luego las que coinciden
  (los colores se agrupan y se lee de izquierda a derecha).
- **Interacción:** clic o Enter en una columna → la página del caso ya desplegada (`/admin/prompts/[v]/calls/[caseId]`).
  Clic en el rótulo de un motivo → la lista filtrada por ese motivo (`?motivo=`). Botón "Ver como lista" → `?segment=disagree`.
- **Datos (sin IA):** un parámetro nuevo en `/agreement/calls` (p. ej. `?grid=1`) que devuelva por llamada su estado por motivo
  (`fp`/`fn`/azul/sin decisión/coincide). Hoy `GET /api/admin/quality` ya no trae datos por llamada y no debe volver a traerlos.
- **Vigente sin prueba:** el mapa se dibuja desde sus corridas en las 220, pero sus columnas no enlazan al caso (la página de caso
  exige una prueba terminada; desvío del 12-nov).
- **Accesibilidad:** la grilla es `role="img"` con resumen en texto ("v2.15: 36 falsas alarmas y 33 rechazos no detectados en 218
  llamadas"); celdas pequeñas aceptadas por la excepción de 2.5.8 porque la lista equivalente está a un clic. Foco visible por
  columna; nunca solo color: la leyenda repite cada estado con su nombre.

## 3. "Posible error del revisor" (feedback 2)

Regla: **lo que dice una IA es "posible"; lo que confirmó una persona no.** "Planilla" se queda solo como nombre del documento
("Planilla: No cumple", "Comentario de la planilla").

| Hoy | Pasa a | Dónde |
|---|---|---|
| Posible error de planilla | **Posible error del revisor** | KPI de la cabecera, segmento azul del mosaico, barra de Discrepancias, Calidad de la IA, filtro de la lista, caso |
| = N a corregir + M posible error de planilla | = N a corregir + M posible error del revisor | Desglose de Falsas alarmas y Rechazos no detectados |
| según la IA de análisis, el error está en la planilla del revisor | según la IA de análisis, se equivocó el revisor | Ayuda de la lista |
| Error de la planilla / La planilla se equivocó (resultado de verificación) | **Error del revisor** / El revisor se equivocó | Registro de verificación |
| Confirmada: error de planilla · "Error de planilla confirmado en X de Y" | Confirmada: error del revisor · "Error del revisor confirmado en X de Y revisadas" | Línea de verificación |
| La planilla tiene razón | El revisor tiene razón | Registro de verificación |
| Azul: la IA de análisis cree que el error está en la planilla | Azul: la IA de análisis cree que se equivocó el revisor | Leyendas |
| D5: "Inconsistencia del revisor (según el análisis)" | Posible error del revisor | Glosario §8.3 |

## 4. Análisis de discrepancias sigue al análisis elegido (feedback 3)

### 4.1 Qué prueba muestra el Resumen

| Análisis elegido en Historial | Cabecera, mosaico, puente y «¿En qué motivos?» | Azul |
|---|---|---|
| `attribution` de v{X} | La prueba de v{X} en validación (la misma que analizó) | Sí |
| `rules` sobre la prueba de v{X} en entrenamiento | La prueba de v{X} en validación, si existe; si no, aviso "v{X} no tiene prueba en validación" y sin cabecera | Solo si v{X} tiene `attribution` |
| Antiguo (vigente, sin split) | La vigente medida en validación (las mismas cifras de Calidad de la IA) | No ("Causa sin analizar") |

- La **línea de estado** dice el universo real de cada análisis, en lugar del texto fijo:
  - `attribution`: "Análisis de causa de v2.15 · 13-nov · US$3,95 · 28 motivos · sobre las 220 llamadas de validación de su prueba".
  - `rules`: "Análisis del loop, vuelta N · v2.14 · sobre las N llamadas de entrenamiento de su prueba. Las cifras de arriba son de
    validación".
  - Antiguo: "Análisis de la corrida vigente (Gemini v2.10) · 8-nov · sobre todas las llamadas con planilla, antes de separar
    entrenamiento y validación. Las cifras de arriba son de la vigente en validación".
- Cuando el universo de los patrones y el de las cifras difieren, se dice (una frase, no un banner).
- **Por defecto** (sin análisis elegido) se abre el último análisis terminado **de cualquier tipo**, incluido `attribution`
  (hoy `latest_finished` los excluye). El análisis elegido va en la URL (`?analisis=<id>`) y lo comparten Resumen, Patrones y
  Evaluadores.
- El encabezado de Patrones también deja de decir "corrida vigente … entrenamiento" fijo (`discrepancy-patterns.tsx` 299-310) y
  usa la misma línea de universo.
- Backend (sin IA): `overview(analysis_id)` resuelve la prueba según la tabla y devuelve su bloque `quality`; ya no llama a
  `latest_quality`.

### 4.2 Decidir propuestas de un análisis de causa (R-11)

Johannes quiere trabajar con el `attribution` de v2.15 (21 patrones, 28 motivos). Hoy no se puede: `decide()` lanza
`attribution_only`, y la UI de Patrones lo muestra solo como atribución.

Si se habilita (recomendado, coherente con G8 A y N8 A ya aprobados):

- Se quita el bloqueo en `decide()` y en la UI; las propuestas entran a la bandeja como las del loop.
- **Aviso N8 A, ahora sí aplica** (el 12-nov no se puso porque los patrones salían de entrenamiento): en el encabezado de
  Patrones del análisis de causa, "Estas propuestas salen de las 220 llamadas de validación. Una versión hecha con ellas se medirá
  en las mismas llamadas y su mejora se verá más grande de lo que es". Y en la cabecera de toda versión que incluya alguna de esas
  reglas: "Medido en las mismas llamadas de donde salieron N reglas" (dato: `included_in_version` + `purpose` del análisis de
  origen).
- El loop no cambia: sigue usando `rules` en entrenamiento.

## 5. Calidad de la IA: elegir qué versión se ve (feedback 4)

- **Versión activa:** encima de la cabecera, un control segmentado "Ver: v2.15 · v2.14 · Vigente" con las versiones elegidas
  (máx. 6). Cambia **cabecera, mosaico y Análisis por caso** juntos. El título dice "Calidad de v2.14".
- **Al agregar una versión, pasa a ser la activa** y se anuncia (`aria-live`: "Ahora ves v2.14"). Así agregar siempre cambia algo
  visible arriba.
- **Comparación entre versiones:** la fila activa se resalta (fondo + "Viendo" en texto, no solo color); clic en otra fila = misma
  acción que el control segmentado.
- **Por motivo:** sin cambios (ya es multi-versión); la columna activa lleva el mismo resaltado.
- La URL guarda las elegidas y la activa (`?v=2.15,2.14&ver=2.14`) para compartir la vista.
- Sin cambios de backend: `GET /api/admin/quality` ya trae el bloque `agreement` de cada versión.

## 6. Accesibilidad (WCAG 2.2 AA, revisión rápida)

- Control segmentado = `role="radiogroup"` con flechas; filas de la comparación con botón "Ver" dentro de la celda de versión
  (no la fila entera como único objetivo), ≥ 24 × 24 px.
- Estado "Viendo" e ícono, no solo color (1.4.1). Mapa: ver §2.
- Los textos nuevos del Historial y el aviso N8 son texto, no solo un ícono.

## 7. Supuestos y riesgos

- **[SUPUESTO] H-22:** las cifras del texto (218, 109/109, 24 motivos) son ilustrativas de v2.15; las reales salen de su prueba.
- **[SUPUESTO] H-23:** cada `rules` del loop tiene una prueba de la misma versión en validación (el loop mide en validación, 11-nov).
  Si falta, el Resumen muestra el aviso de §4.1 en vez de cifras de otra versión.
- **Riesgo R-A (vigente desde N8):** al habilitar decidir en `attribution`, la mejora de v2.16 sobre las 220 estará inflada. El aviso
  lo hace visible pero no lo corrige; medirla sin sesgo exigiría otro grupo de llamadas (fuera de esta entrega).
- **Riesgo R-C:** con el mapa de vuelta, hay dos caminos al caso (mapa y lista). Ambos llevan a la misma página de caso, así que no
  hay dos definiciones de desacuerdo (lo que motivó quitarlo en N6).

## 8. Decisiones para Johannes

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| F1 | Dónde vuelve el caso a caso | A acordeón "Análisis por caso" cerrado en Calidad de la IA, bajo el mosaico, rehecho con colores E3, solo las 220 y clic al caso · B pestaña propia "Análisis por caso" en Estadísticas · C también en la pestaña Prueba de cada versión | A |
| F2 | Nombre | A "Posible error del revisor" para lo que dice la IA de análisis y "Error del revisor" para lo confirmado en la verificación; "planilla" queda solo como documento · B "Error del revisor" en todo | A |
| F3 | Qué muestra el Resumen de Discrepancias | A sigue al análisis elegido (tabla §4.1), línea de universo real por análisis, por defecto el último de cualquier tipo · B cabecera siempre de la última prueba, pero con la línea de universo corregida | A |
| F4 | Decidir propuestas del análisis de causa de v2.15 | A habilitar, con el aviso N8 A en Patrones y en la cabecera de las versiones que usen esas reglas · B mantener el bloqueo (solo atribuyen la causa, como D1) | A |
| F5 | Ver otra versión en Calidad de la IA | A control "Ver:" que cambia cabecera + mosaico + caso a caso; la versión agregada pasa a activa; clic en la fila de la comparación hace lo mismo · B mosaicos pequeños de todas las versiones lado a lado, cabecera solo de la activa | A |

Esperando aprobación para continuar con la Fase 1 (implementación de los ajustes F1-F5).
