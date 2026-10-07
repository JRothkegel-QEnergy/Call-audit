---
paths:
  - "src/**/*.py"
  - "tests/**/*.py"
---

# Python / backend

- Python 3.12, gestionado con `uv`. FastAPI para la API, workers aparte (RQ o SQS).
- **Identificadores en inglés** (módulos, clases, funciones, variables, columnas). Docstrings y comentarios pueden ir en español.
- Tipado completo; modelos de datos con Pydantic v2. `ruff` para lint y formato, `mypy` en modo estricto en `contract/` y `decision/`.
- Estructura de `src/call_audit/`: `ingestion/`, `asr/`, `preprocessing/`, `layers/`, `llm/`, `decision/`, `contract/`, `api/`, `persistence/`.
- Tests con `pytest`. Fixtures con transcripciones **sintéticas**; nada de datos reales.
- Los tests no llaman APIs externas: se usan dobles de `Transcriber` y `Layer`. Los tests contra proveedores reales van marcados `@pytest.mark.external` y no corren en CI por defecto.
- Configuración con `pydantic-settings` desde variables de entorno.
- Funciones pequeñas y explicables; preferir código simple y medible a abstracciones prematuras.
