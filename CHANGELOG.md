# Historial de cambios · Call Audit

Una entrada por fecha, con lo que cambió en la app, en los datos y en los prompts, y por qué.

Cada componente tiene además su propio historial detallado:
- Prompt de la capa 2: `prompts/layer2/CHANGELOG.md` (una entrada por versión, con métricas).
- Prompt de verificación de afirmaciones: historial al final de `docs/layer2-claims-prompt.md`.
- Diseño del front: `docs/ux/call-audit/estado.md` (fases y cambios aprobados).

## 2026-10-19

- **Integración:** nueva rama `feature/deploy-v0` desde `develop`, con `feature/real-calls-validation` (bench, prompt capa 2 v2.7 y validación con 100 llamadas reales) y `feature/frontend-mock` (front Next.js con API mock, diseño UX fases 0–8 y bench de ASR).
- **Prompt capa 2:** pasa a ser una fuente versionada en `prompts/layer2/prompt.yaml`, con el origen de cada regla. La versión sigue siendo la 2.7.
- **Bench:** `share_dashboard.py --no-audio` permite compartir el dashboard solo con las transcripciones.
- **Diseño:** el cambio 09 queda aprobado (`docs/ux/call-audit/09-cambio-auditoria-ia.md`). Incluye:
  - las notas por motivo;
  - el panel "Prompt y respuesta del modelo";
  - la vista Discrepancias para el supervisor;
  - el veredicto del cliente como dato opcional.
- **Evaluación (weekly):**
  - Gemini 3.8 Flash y Sonnet 5.5 quedan como finalistas, con un 70 % y un 68 % de acierto contra 50 llamadas auditadas a mano.
  - Haiku 5.5 y GPT-6 Luna se descartan porque rechazan de más.
  - La elección final se hará con el servicio ya desplegado.
