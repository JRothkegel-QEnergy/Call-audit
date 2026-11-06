# Revisión · Análisis de discrepancias "más visual"

- Fecha: 2026-11-06
- Pedido (Johannes): "Actualmente tenemos la pestaña de análisis de discrepancias pero aún siento que le falta algo más visual, más gráfico que ayude a entender más rápido lo que se necesita."
- Modo: revisar feature propuesta + mejoras a feature existente.
- Estado: aprobada (Johannes, 2026-11-06; ver §7).

## 1. Veredicto

**Construir con ajustes.** El problema real no es que falten gráficos, sino que la vista esconde los datos que sirven para decidir: quién tiene la razón, qué casos corrige cada propuesta y qué puede romper. Primero hay que exponerlos (S, casi todo backend). Después, un solo gráfico que resuma "dónde está la ganancia". Requiere pasar por `disenador-ux` antes de construir.

## 2. Problema y valor

- **Actor:** admin Qubico (Johannes, y Agustín en la revisión del paso 8 del plan).
- **Decisión que toma en la pestaña:** qué propuestas acepta (van a la próxima versión del prompt de la capa 2), cuáles manda a calibrar con el auditor y cuáles descarta, y en qué orden.
- **Lo que le cuesta hoy:** leer tarjeta por tarjeta (título, explicación, etiquetas) y una tabla de 10 columnas para 29 motivos y 1.385 casos, sin poder responder rápido: ¿dónde gano más?, ¿esto es un error de la IA o del auditor?, ¿qué gano si acepto todo lo pendiente?
- **Valor:** llegar más rápido del análisis al prompt v2.11 (meta ≤ 5 % FP, ≤ 20 % FN) y tener un argumento claro para la corredora: qué parte del desacuerdo es de la IA y qué parte es de su auditor.

## 3. Hallazgos

### Lo que muestra hoy (verificado en código)

- `frontend/src/app/(app)/admin/discrepancies/page.tsx`: encabezado de la corrida, línea de totales y tabla "¿Dónde están los desacuerdos?". La tabla va por motivo con estas columnas: planilla NO CUMPLE, IA NO CUMPLE, coinciden, solo la IA, omitidos, dudosa, con revisión manual y patrones. Debajo vienen la tabla por evaluador (colapsada), la lista de tarjetas de patrón ordenadas por impacto con filtros (causa, tipo, estado) y las observaciones (colapsadas). Todo es texto y números; no hay ningún gráfico.
- `frontend/src/components/admin/discrepancy-parts.tsx` (`PatternTags`, `PatternBody`): dirección, causa, confianza, n.º de casos, estado, explicación, una cita y la propuesta.

### Datos que ya existen y no se aprovechan

1. **El prompt v1.2.0 devuelve por patrón** `who_is_right`, `expected_fix`, `side_effects`, `concentration` y `tentative` (`prompts/discrepancy_analysis/v1.2.0/system.txt`, líneas 81–89). Se guardan en `discrepancy_patterns.data`, pero `pattern_out()` (`src/call_audit/discrepancy_runs.py`) no los devuelve y el tipo `DiscrepancyPattern` (`frontend/src/lib/api/admin-types.ts`) no los tiene. Solo salen en el informe Markdown (`src/call_audit/discrepancy_analysis.py`, líneas 278–290). **Es el hallazgo principal:** la información para decidir ya se pagó (~US$20,5) y no llega a la pantalla.
2. **El orden por impacto engaña:** `impact = len(cases) × weight` (`patterns_from()`) no distingue si la IA tiene la razón ni cuántos casos corrige la propuesta. Un patrón grande de "el auditor se equivoca" sube igual que uno de "la regla está mal".
3. **fp vs fn por patrón:** cada caso guardado trae `kind` (fp/fn/ai_uncertain/match_fail), así que se puede contar sin IA. Hoy solo se muestra `direction`.
4. **Cobertura del análisis:** se puede comparar los casos en desacuerdo por motivo (tabla del paso 1) con los casos cubiertos por patrones y observaciones. Hoy no se ve qué parte quedó sin explicar. `unexplained_cases` no se guarda, pero se puede sacar por diferencia.
5. **Concentración por ejecutivo:** `agent_id` está en las filas del paso 1 (`discrepancy_analysis.py`, línea 197), pero no en la foto del caso (`snapshot()`). Se puede cruzar por `callId` con `table(session)` sin volver a correr nada. Por auditor, `evaluator` ya está en la foto del caso.
6. **Desacuerdo entre revisores:** `reviewer_disagreements` existe por patrón, pero hay revisión manual en ~1 caso por motivo (resumen del 2026-11-04), así que pesa poco. No vale la pena mostrarlo aparte.

### Encaje con lo existente

- **Calidad de la IA (Cambio 15)** ya tiene tabla por motivo, mapa llamada × motivo y matriz 2×2. No hay que duplicarlo: la pestaña Análisis responde "qué hago" y Calidad responde "cuánto calza".
- **Cambio 18** (`docs/ux/call-audit/18-version-desde-seguimiento.md`, en diseño) crea la versión del prompt desde Seguimiento. La proyección de impacto (mejora 3) es el puente natural entre aceptar una propuesta y crear la versión.

### Alternativas

- **No hacer nada y leer el informe Markdown:** descartada. El informe ya tiene los campos, pero la decisión (aceptar o descartar) se toma en la app, y saltar entre los dos es justo la fricción.
- **Solo mostrar los campos ocultos como texto en la tarjeta (mejora 1):** recomendada como primer paso. Puede que por sí sola resuelva gran parte del "no lo entiendo rápido".
- **Panel de gráficos (causas, tortas, tendencias):** descartada. La distribución de causas no cambia ninguna decisión y para tendencias no hay datos (1 o 2 análisis).

### Riesgos

- `who_is_right` y `expected_fix` son la opinión de la IA de análisis, no una medición. Cualquier gráfico o proyección tiene que decir "según el análisis". La confirmación real sigue siendo la prueba del prompt (Cambio 12), que tiene costo.
- Los análisis viejos (v1.0.0) no traen estos campos: la vista tiene que funcionar sin ellos.
- [SUPUESTO] El último análisis en producción es v1.2.0. Si fue v1.1.0, igual sirve, porque los campos aparecieron en esa versión.
- Proyectar el FP/FN de llamada obliga a recalcular el veredicto de cada llamada con la regla de motivos menores (H-108, `MINOR_WEIGHT`). Es una aproximación, no un número exacto.

## 4. Propuesta

### Alcance mínimo (fase 1, S)

- Backend: `pattern_out()` devuelve `whoIsRight`, `expectedFix` (ids y conteo por tipo, fp/fn), `sideEffects`, `concentration`, `tentative` y el conteo fp/fn/dudosa de los casos del patrón. Sin migración y sin IA.
- Front: esos datos visibles en la tarjeta, más un filtro "quién tiene la razón". El orden por defecto pasa a ser por casos que corrige la propuesta, no por casos totales.
- Pasa por `disenador-ux` como revisión rápida sobre el Cambio 16.

### Fase 2 (M), si la fase 1 no alcanza

- Un gráfico por motivo con los casos en desacuerdo divididos en cuatro grupos, con fp/fn: "regla a cambiar (la IA se equivoca)", "calibrar al auditor (la IA tiene razón)", "ambiguo o sin propuesta" y "sin explicar". Reemplaza o resume la tabla de 10 columnas.
- Proyección "si aplicas lo aceptado": fp/fn por motivo antes y después según `expectedFix` (fase 2a, S–M). Luego, a nivel de llamada contra las metas de 5 % y 20 %, con la misma fórmula de Calidad de la IA (fase 2b, M).

### Fuera

Volver a correr el análisis, gráficos de distribución de causas, tendencias entre análisis, gráfico de concentración por ejecutivo (por ahora basta el texto) y cualquier cosa para el supervisor.

### Métricas de éxito

1. **Tiempo de decisión:** desde `discrepancy_analyses.finished_at` hasta que todos los patrones con propuesta tienen decisión (`proposal_decisions.decided_at`). La línea base es el análisis actual.
2. **Tasa de decisión:** % de patrones con propuesta decididos a los 7 días. Hoy se puede consultar por SQL.
3. **Prueba rápida:** Johannes responde en menos de 1 minuto "¿qué motivos arreglo con el prompt y cuáles son del auditor?" y "¿qué gano si acepto todo lo pendiente?".

### Esfuerzo

Fase 1: S (≈0,5 d de backend y tarjeta). Fase 2a: S–M. Fase 2b: M. Más el paso por `disenador-ux`.

## 5. Mejoras priorizadas

| # | Mejora | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Mostrar `who_is_right`, `expected_fix`, `side_effects`, `concentration`, `tentative` y fp/fn por patrón; ordenar por casos corregibles | Alto: ya está pagado y es lo que define la decisión | S | Ahora (quick win) |
| 2 | Barra por motivo con el desacuerdo dividido en: la IA se equivoca, el auditor se equivoca, ambiguo, sin explicar | Alto: "dónde gano" de un vistazo y argumento para la corredora | S–M | Ahora, después de la 1 |
| 3 | Proyección fp/fn antes y después de lo aceptado (por motivo; luego por llamada contra las metas) | Alto para priorizar la v2.11; conecta con el Cambio 18 | M | Siguiente |
| 4 | Concentración por auditor o ejecutivo calculada (cruce por `callId` con `agent_id`) | Medio: el texto de la IA ya lo dice | S–M | Después |
| 5 | Gráficos de causas y tendencias entre análisis | Bajo: no cambian decisiones y no hay datos | — | No hacer |

## 6. Preguntas para Johannes

1. ¿Qué te cuesta más: decidir "qué acepto" (orden y ganancia) o explicarle a la corredora qué parte del desacuerdo es de su auditor? De eso depende si va primero la mejora 3 o la 2.
2. ¿El último análisis de producción es v1.2.0 (o v1.1.0)? Si fue v1.0.0, la mejora 1 no tiene datos hasta la próxima corrida (~US$20,5).
3. ¿Confías lo suficiente en el `who_is_right` de la IA de análisis para ponerlo en un gráfico, o lo quieres solo como etiqueta por patrón hasta revisarlo en algunos casos?
4. ¿Esto se le va a mostrar a Agustín o a la corredora (paso 8 del plan), o es solo para ti? Eso cambia cuánto pulir el gráfico.
5. ¿Te parece hacer primero solo la fase 1 y decidir la fase 2 después de usarla en un análisis?

## 7. Veredicto de Johannes (2026-11-06)

**Aprobada: Construir con ajustes.** Acepta todas las recomendaciones, tanto las de esta revisión como las de `disenador-ux`.

- **Orden y foco:** primero la fase 1. El foco es "cuánto es del prompt y cuánto del auditor, y en qué motivos".
- **P2 (versión del análisis):** el análisis vigente en producción es **v1.0.0**. "De momento basémonos solo en v1.0.0, quiero tener todo pulido antes de probar de nuevo e invertir 20 dólares porque sí." No se vuelve a correr hasta que la vista esté pulida. Qué implica:
  - Los cinco campos (`who_is_right`, `expected_fix`, `side_effects`, `concentration`, `tentative`) se exponen y se diseñan igual, pero mostrarán "sin dato" hasta la próxima corrida.
  - Lo que se saca sin IA tiene que aportar desde ya: fp/fn por patrón y casos sin explicar por motivo.
- **P3 (`who_is_right`):** "No sé si confiar porque no lo he probado. Pero intentémoslo." Se grafica, con el rótulo "según el análisis".
- **P4 (audiencia):** todos los admin.
- **P5:** primero la fase 1; la fase 2 se decide después de usarla.
