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
