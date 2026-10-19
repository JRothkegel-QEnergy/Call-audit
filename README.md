# Call Audit · Qubico

Audita automáticamente grabaciones de contact center: transcribe el 100 % de las llamadas, las evalúa contra una pauta de calidad versionada y deriva a revisión humana solo lo dudoso o lo que no cumple.

- Contexto y dominio: [docs/context.md](docs/context.md)
- Preguntas abiertas al cliente: [docs/client-open-questions.md](docs/client-open-questions.md)
- Prompt de ejemplo de la capa 2: [docs/layer2-prompt-example.md](docs/layer2-prompt-example.md)
- Decisiones de arquitectura: [docs/adr/](docs/adr/)
- Revisión manual de llamadas reales en equipo: [docs/revision-manual.md](docs/revision-manual.md)
- Reglas para trabajar con Claude Code: [CLAUDE.md](CLAUDE.md) y [.claude/rules/](.claude/rules/)

## Ramas

- `main`: producción.
- `develop`: integración. Los PR van acá desde `feature/*`, `fix/*`, `chore/*`.

## Estructura

```
src/call_audit/  backend Python (FastAPI + workers)
rubrics/         rúbricas YAML versionadas
prompts/         prompts versionados
golden_set/      scripts de evaluación (sin datos reales)
tests/           pytest
frontend/        Next.js
docs/            contexto, ADRs, preguntas abiertas
```

## Backend (API v0 sobre las corridas del bench)

Por ahora la API no corre el pipeline: sirve al front las llamadas que ya evaluó el bench
(`scripts/prompt_bench/real_calls.py`) y guarda las revisiones, las notas y la clasificación de discrepancias.

```bash
uv sync --extra bench                     # entorno Python 3.12
uv run alembic upgrade head               # crea o migra la base (DATABASE_URL; vacío = SQLite local)
uv run python -m call_audit.admin create-user --email E --name N --role supervisor --model-io
uv run python -m call_audit.ingestion.import_bench --out ../transcripts/layer2_real_100_v2.7 \
    --metadata "../audios/Retenciones BECS Para Revision.xlsx" --catalog ../call-audit/data/catalog/products.json \
    --label v2.7 --current-model gemini-3-8-flash \
    --reviews ../transcripts/layer2_real_100_v2.7/revision_capa2.csv --reviewer E
uv run uvicorn call_audit.api.app:app --reload --port 8000   # docs en http://localhost:8000/docs
uv run pytest && uv run ruff check src tests
```

- **Quién ve qué:** el auditor nunca recibe el veredicto ni el comentario del cliente (D-24), y el prompt y la respuesta del modelo solo van a cuentas con `view_model_io` (D-22). Las discrepancias son solo para supervisor.
- **`--reviews`:** carga la auditoría manual del dashboard como clasificación del árbol de discrepancias ("la IA acertó / se equivocó"). Los casos siguen pendientes para los auditores.
- **Pendiente, responde 501:** estadísticas por ejecutivo y por auditor, feedback, invitaciones, exportación y override.
