# Prompt capa 2 · versionado y origen de las reglas

Fuente única del prompt de la capa 2 (auditoría de llamadas de retención). Las explicaciones de diseño, el mensaje de usuario y el ejemplo de salida siguen en `docs/layer2-prompt-example.md`.

| Archivo | Qué es | ¿Se edita? |
|---|---|---|
| `prompt.yaml` | Versión, tipos de origen y el system prompt partido en secciones e ítems, cada uno con su historial | Sí |
| `schema.json` | Herramienta `registrar_auditoria` (esquema de salida) | Sí |
| `CHANGELOG.md` | Una entrada por versión con el porqué | Sí |
| `system.txt` | System prompt armado, para leerlo entero y ver diffs entre versiones | No, se genera |
| `PROVENANCE.md` | Reporte: reglas por origen, las que vienen de feedback, personalizaciones de la pauta, pendientes | No, se genera |
| `prompt.lock.json` | Versión y huella de cada ítem de la última build | No, se genera |

## Origen de cada regla

Cada ítem tiene un `history` con una entrada por versión en que cambió: `{version, origin, note}`.

| `origin` | Cuándo usarlo |
|---|---|
| `official_text` | Texto oficial del cliente sin cambios (pauta, motivos de renuncia) |
| `client_feedback` | Aclaración del cliente: notas de la pauta, reuniones. En la nota, quién y cuándo |
| `client_script` | Script Retención BECS |
| `client_catalog` | Excel de apoyo (catálogo, fichas, hoja Otros) |
| `validation_feedback` | Ajuste nuestro tras revisar errores de las IA en una corrida. En la nota, qué fallaba y en cuántas llamadas |
| `design` | Decisión nuestra de formato o método, sin un error concreto detrás |

En los motivos de la pauta, `official` es el texto oficial y `criterion` la aclaración (se imprime como `Criterio:`). Todo lo que está en `criterion` es personalización. Lo que el cliente aún debe confirmar va en `pending` (y en `docs/client-open-questions.md`).

`version: "base"` en un historial = la regla ya estaba antes del historial detallado (v2.0 o anterior). Las notas que dicen "Origen inferido al migrar" se reconstruyeron del historial en la migración: corrígelas si sabes de dónde vino.

## Cómo sacar una versión nueva

1. Edita el texto del ítem en `prompt.yaml` (o agrega uno nuevo con su `id`).
2. Sube `version` (y `date`). Minor para cambios de reglas; major si cambia el esquema de forma incompatible.
3. En cada ítem que cambiaste, agrega a `history` una entrada con la versión nueva, el origen y el porqué.
4. Agrega `**X.Y (fecha)**` en `CHANGELOG.md`.
5. Corre:

   ```bash
   python scripts/prompt_bench/layer2_prompt.py build
   ```

   Falla si cambiaste texto sin subir la versión, si un ítem cambió sin entrada en su `history`, o si falta la entrada del changelog. `check` hace lo mismo sin escribir (sirve antes de commitear).
6. Commitea `prompt.yaml` junto con los generados: el diff de `system.txt` muestra el cambio real del prompt.

`render.py`, `run.py` y `real_calls.py` leen el prompt de acá, y `run.py` guarda `prompt_version` en cada `.meta.json`.
