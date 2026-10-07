# Flujo de Git

## Ramas

- `main`: solo código liberado. Nunca se commitea directo; entra por merge desde `develop` o `hotfix/*`, con tag `vX.Y.Z`.
- `develop`: rama de integración. Todo PR de trabajo apunta acá.
- `feature/<short-description>`, `fix/<...>`, `chore/<...>`, `docs/<...>`: salen de `develop` y vuelven a `develop` por PR. Nombres de rama en inglés y kebab-case.
- `hotfix/<...>`: sale de `main`, vuelve a `main` y a `develop`.

## Commits

Conventional Commits. Tipo y scope en inglés; la descripción puede ir en español, en imperativo:

```
feat(layer1): agrega detección de frase de cierre con rapidfuzz
fix(decision): marca como uncertain la cita no encontrada
chore(deps): actualiza anthropic
docs(rubric): documenta motivos del bloque Trato
```

Scopes sugeridos: `ingestion`, `asr`, `preprocessing`, `layer1`, `layer2`, `layer3`, `decision`, `contract`, `api`, `frontend`, `rubric`, `prompt`, `golden`, `infra`, `deps`.

## Antes de commitear

- `ruff check`, `ruff format --check` y `pytest` en verde.
- Nada de audios (`*.wav`, `*.mp3`, ...), transcripciones reales, `.env` ni credenciales.
- Si cambia una rúbrica o un prompt, sube su versión.

## Prohibido sin pedirlo explícitamente

`push --force` a `main` o `develop`, reescribir historia compartida, borrar ramas remotas, saltarse hooks (`--no-verify`).
