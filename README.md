# Auditoría de llamadas con IA · Qubico

Audita automáticamente grabaciones de contact center: transcribe el 100 % de las llamadas, las evalúa contra una pauta de calidad versionada y deriva a revisión humana solo lo dudoso o lo que no cumple.

- Contexto y dominio: [docs/contexto.md](docs/contexto.md)
- Pendientes con el cliente: [docs/pendientes-cliente.md](docs/pendientes-cliente.md)
- Decisiones de arquitectura: [docs/adr/](docs/adr/)
- Reglas para trabajar con Claude Code: [CLAUDE.md](CLAUDE.md) y [.claude/rules/](.claude/rules/)

## Ramas

- `main`: producción.
- `develop`: integración. Los PR van acá desde `feature/*`, `fix/*`, `chore/*`.

## Estructura

```
src/auditoria/   backend Python (FastAPI + workers)
rubricas/        rúbricas YAML versionadas
golden_set/      scripts de evaluación (sin datos reales)
tests/           pytest
frontend/        Next.js
docs/            contexto, ADRs, pendientes
```
