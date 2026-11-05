# Plan · Cuarta IA: análisis de discrepancias

> Acordado con Agustín el 2026-11-04. Revisión de seguimiento: 2026-11-05, 09:00.
> Prioridad única: todo lo que no sea input para esta IA queda en pausa (logo, nombre, mejoras de UI, etc.).

## Objetivo

Una IA que lea las llamadas ya procesadas, compare lo que dijo la IA evaluadora (capa 2) con lo que dijeron los revisores y entregue:

1. **Patrones** de discrepancia: qué motivos, en qué situaciones y en qué dirección (la IA marca de más o se le pasa).
2. **Causa probable** de cada patrón:
   - **Criterio:** la regla del prompt está mal o es ambigua.
   - **Evaluador:** el revisor humano aplica la pauta distinto (o de forma inconsistente).
   - **Transcripción:** el ASR cortó o cambió algo y la IA evaluó sobre un texto malo.
   - **Dato faltante:** a la IA le falta información (ficha, metadata, tipificación).
3. **Propuesta de solución** por patrón: cambio de regla del prompt, pregunta al cliente o caso a calibrar con el auditor.

**No modifica criterios automáticamente.** Sus propuestas las revisa una persona y, si se aceptan, entran como nueva versión del prompt por el flujo que ya existe (registro de prompts → prueba → vigente).

## Qué datos ya tenemos

| Fuente | Dónde | Nivel |
|---|---|---|
| Hallazgos de la IA (veredicto, confianza, cita validada, comentario) por motivo | `model_runs.findings` (corrida vigente) | llamada × motivo |
| **Excel del cliente:** veredicto (ESTADO_CALIDAD) y COMENTARIO | `cases.external_verdict`, `external_comment` | llamada |
| **Excel del cliente:** CUMPLE / NO CUMPLE por motivo (C01..C33) | `cases.external_item_fails` | llamada × motivo |
| **Revisión manual Qubico:** auditoría de Johannes en el dashboard (50 llamadas) | `transcripts/layer2_real_100_v2.7/revision_capa2.csv` | llamada × motivo |
| **Revisión manual Qubico:** revisiones de auditores en la app (confirmar / corregir cada motivo) | `reviews.items` | llamada × motivo |
| **Revisión manual Qubico:** clasificación "la IA acertó / se equivocó" con motivos y nota | `discrepancy_classifications` | llamada |
| **Revisión manual Qubico:** notas por motivo o por llamada | `notes` | llamada / motivo |

Hay dos tipos de revisor y se tratan por separado:

- **Cliente (Excel):** la referencia "oficial", pero viene sin explicación por motivo y sin identificar al auditor.
- **Revisión manual Qubico** (dashboard y app): más chica, pero trae el porqué (notas, corrección por motivo). Sirve para dos cosas:
  1. Desempatar: si la revisión manual le da la razón a la IA contra el Excel, apunta a una diferencia del evaluador del cliente; si se la da al Excel, apunta a un problema de criterio del prompt.
  2. Darle a la cuarta IA la explicación que el Excel no trae.

Cada caso de la tabla lleva las tres miradas (IA, Excel, manual) cuando existen, y el informe dice cuántos casos tenían revisión manual.
| Reglas del prompt con su origen | `prompts/layer2/prompt.yaml`, `PROVENANCE.md` | motivo |
| Análisis manual previo (v2.6) | `transcripts/layer2_real_100/analisis_discrepancias_v2.6.md` | referencia de formato y causas ya conocidas |

Volumen: 566 llamadas procesadas en producción (las 100 locales están en v2.10).

**Quién auditó:** el Excel nuevo de S4P trae `EVALUADOR_CALIDAD` (el de las 100 llamadas de octubre no). Desde el 2026-11-04 se guarda en `cases.call_metadata.external_evaluator` (no sale por la API) y la tabla lo muestra con un resumen por evaluador: si uno marca mucho más que el resto con la IA pareja, es diferencia del evaluador, no del prompt. Las llamadas ya cargadas lo toman con `python -m call_audit.ingestion.customer --metadata <Excel>`.

## Diseño

Dos pasos: uno sin IA que arma los casos y otro con IA que los agrupa y explica. Así el costo va solo a lo que es discrepancia y los números son reproducibles.

### Paso 1 · Tabla de discrepancias (determinístico, sin IA)

`python -m call_audit.discrepancies --out <carpeta fuera del repo> [--manual-csv revision_capa2.csv]` (hecho el 2026-11-04), que, para cada llamada × motivo, cruza IA vs. Excel del cliente y vs. revisión manual Qubico (dashboard y app, donde exista) y etiqueta:

- `fp` (IA no cumple, cliente cumple), `fn` (IA cumple, cliente no cumple), `ai_uncertain`, `match`.
- Contexto pegado a cada caso: cita y comentario de la IA, comentario del cliente, regla vigente del motivo, tramo de la transcripción (± 30 s de la cita), metadata relevante (tipificación, seguros, esperas).

Salida: `discrepancies.jsonl` + resumen por motivo (tasa de FP/FN, n). Esto solo ya responde "dónde duele" y alimenta el paso 2.

### Paso 2 · La cuarta IA (por motivo)

Por cada motivo con discrepancias, una llamada al LLM con todos sus casos (`fp`, `fn` y una muestra de `match` como contraste). Devuelve JSON:

```json
{
  "criterionId": 13,
  "patterns": [
    {
      "summary": "La IA rechaza cuando el N° de seguro se dice con el cero inicial omitido",
      "direction": "fp",
      "cases": ["230244", "231063"],
      "cause": "criterion | evaluator | transcript | missing_data",
      "evidence": "…",
      "proposal": {"type": "prompt_rule | client_question | calibrate_auditor", "text": "…"},
      "confidence": 0.7
    }
  ]
}
```

Reglas del prompt de análisis:
- Cada patrón cita sus casos; un patrón con menos de 3 casos queda como "observación", no como propuesta.
- Las citas se validan contra la transcripción (misma regla del proyecto).
- `evaluator` solo si hay evidencia (dos humanos discrepan, o el cliente marca distinto en casos equivalentes).

Luego una pasada de síntesis que junta los motivos en un informe priorizado por impacto (casos afectados × peso en el veredicto de llamada).

### Salida: vista en el perfil admin

El análisis se ve en la app, en el menú del Administrador Qubico (aclarado por Johannes el 2026-11-04). La vista muestra la tabla por motivo (paso 1), los patrones con causa y propuesta (paso 2) y los casos de cada patrón, que abren la llamada. Desde ahí el admin acepta o descarta cada propuesta; nada cambia el prompt solo.

- Backend: el análisis se guarda en la base (corrida de análisis: modelo, versión del prompt de análisis, corridas de capa 2 analizadas, costo).
- **Cuándo corre (Johannes, 2026-11-04):** a mano. El admin la lanza desde la vista después de ver el costo estimado y confirmarlo, igual que la prueba de un prompt (Cambio 12). El worker que ya existe la toma en su siguiente pasada; si ya hay una corriendo, no se pide otra. Se evaluó y se descartó una corrida diaria automática: la corrida completa cuesta ~US$3,25, unos US$100 al mes si fuera diaria.
- Diseño: pasa por el agente `disenador-ux` con sus gates antes de escribir UI. Tiene que convivir con «Discrepancias» (árbol del supervisor) y «Calidad de la IA por corrida» (Cambio 15).
- Mientras la vista no esté, el informe Markdown sirve para revisar los resultados del piloto.

## Plan de trabajo

| # | Tarea | Resultado | Esfuerzo |
|---|---|---|---|
| 1–2 | Paso 1: tabla de discrepancias leyendo la base de producción (por túnel, solo lectura) y guardando el resultado en archivos locales, fuera del repo. Hecho el 2026-11-04 | `transcripts/discrepancies/prod-2026-11-04/` | hecho |
| 3 | Prompt de la cuarta IA (v1.0.0, versionado en `prompts/discrepancy_analysis/`) y esquema JSON | prompt + schema | 0,5 d |
| 4 | Piloto con 3 motivos con más discrepancia; contrastar con lo que ya sabemos del análisis v2.6 | ¿encuentra las causas conocidas? | 0,5 d |
| 5 | Corrida completa + síntesis + informe | informe priorizado | 0,5 d |
| 6 | Diseño de la vista admin con `disenador-ux` (en paralelo a 3–5) | fases aprobadas | según gates |
| 7 | Backend (corridas de análisis en la base, endpoint admin) y vista. Hecho el 2026-11-04 (`discrepancy_runs.py`, `routes_discrepancies.py`, `/admin/discrepancies`) | vista en el perfil admin | hecho |
| 8 | Revisión con Agustín: aceptar / descartar propuestas desde la vista | lista de cambios para prompt v2.11 y preguntas al cliente | reunión |

**Pasos 3 y 4 hechos (2026-11-04):** prompt `prompts/discrepancy_analysis/v1.0.0` y `python -m call_audit.discrepancy_analysis`. Piloto con 25, 1 y 18 en Sonnet 5.5: US$0,49, 0 citas no encontradas, y redescubrió las causas conocidas (25 dato faltante; 1 esperas anunciadas bajo 60 s). Informe en `transcripts/discrepancies/prod-2026-11-04/analysis/v1.0.0/claude-sonnet-5-5/report.md`. **Paso 5 hecho:** corrida de los 28 motivos con desacuerdos (~US$3,25 en total), mismo informe. Para la v1.1: forzar el esquema con tool use (comillas sin escapar en el 32, una causa fuera de la lista, un patrón sin propuesta) y pedir que cada caso vaya en un solo patrón (en el 25, el patrón 2 repite casos del 1).

**Prompt v1.1.0 (2026-11-05, comentarios de Johannes):** el analista no sabe del Excel; recibe todos los casos, cada uno con la llamada completa, los datos de la llamada y el código del ejecutivo; por patrón decide si corresponde cambiar la regla (la IA se equivoca) o calibrar al auditor (la IA tiene más razón). Sobre un borrador de Johannes, decide con una jerarquía de evidencia (revisión Qubico > pauta aplicada a la transcripción > auditor > IA), separa las causas en `rule_text`, `ai_application`, `auditor`, `motive_overlap`, `transcript` y `missing_data`, y por patrón dice quién tiene más razón, la concentración por ejecutivo o auditor, qué casos corregiría la propuesta y qué aciertos podría romper. Los motivos grandes van en tandas de hasta 150 mil tokens más una pasada que las junta (`merge.txt`). Con producción: 91 pedidos, ~US$20,5 por corrida completa con Sonnet 5.5. Sigue pendiente forzar el esquema con tool use.

**Prompt v1.2.0 (2026-11-05):** las propuestas son solo `prompt_rule` o `calibrate_auditor` (Johannes: «Solo debe haber propuesta si se considera que hay algo que mejorar en el prompt o quizás para el auditor»). Lo demás va sin propuesta. Si la pauta es ambigua, la práctica consistente del auditor manda; si es inconsistente, se calibra.

El paso 4 es el control de calidad: si la IA no redescubre las causas que ya encontramos a mano en v2.6 (NO_ACEPTADA, motivo 7 sin reclamo, motivo 13 cero inicial, esperas), el prompt de análisis no está listo.

## Para mañana 09:00

- Pasos 1 y 2 listos (no gastan créditos): tabla de discrepancias por motivo de las 566.
- Si da el tiempo, el prompt (paso 3) en borrador.

## Decisiones pendientes

1. **Modelo para la cuarta IA.** Decidido (Johannes, 2026-11-05): Sonnet 5.5 por la API de Anthropic, el mismo del piloto y la corrida completa. Requiere `ANTHROPIC_API_KEY` en `.env` (local) y en `.deploy/server.env` (producción). Gemini 3.8 Flash queda como alternativa en el diálogo, con respaldo por OpenRouter.
2. **Si el Excel y la revisión manual Qubico se contradicen, ¿cuál manda?** Propuesta: ninguna. El caso se marca como "desacuerdo entre revisores" y va a la sección de calibración con el cliente, no a cambios del prompt.