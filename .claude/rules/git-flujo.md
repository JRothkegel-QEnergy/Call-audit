# Flujo de Git

## Ramas

- `main`: solo código liberado. Nunca se commitea directo; entra por merge desde `develop` o `hotfix/*`, con tag `vX.Y.Z`.
- `develop`: rama de integración. Todo PR de trabajo apunta acá.
- `feature/<descripcion-corta>`, `fix/<...>`, `chore/<...>`, `docs/<...>`: salen de `develop` y vuelven a `develop` por PR.
- `hotfix/<...>`: sale de `main`, vuelve a `main` y a `develop`.

## Commits

Conventional Commits en español, en imperativo:

```
feat(capa1): agrega detección de frase de cierre con rapidfuzz
fix(decision): marca como dudosa la cita no encontrada
chore(deps): actualiza anthropic
docs(rubrica): documenta motivos del bloque Trato
```

Scopes sugeridos: `ingesta`, `asr`, `preproceso`, `capa1`, `capa2`, `capa3`, `decision`, `api`, `frontend`, `rubrica`, `golden`, `infra`, `deps`.

## Antes de commitear

- `ruff check`, `ruff format --check` y `pytest` en verde.
- Nada de audios (`*.wav`, `*.mp3`, ...), transcripciones reales, `.env` ni credenciales.
- Si cambia una rúbrica o un prompt, sube su versión.

## Prohibido sin pedirlo explícitamente

`push --force` a `main` o `develop`, reescribir historia compartida, borrar ramas remotas, saltarse hooks (`--no-verify`).
