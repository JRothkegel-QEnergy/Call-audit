---
paths:
  - "src/**/*.py"
  - "tests/**/*.py"
---

# Python / backend

- Python 3.12, gestionado con `uv`. FastAPI para la API, workers aparte (RQ o SQS).
- Tipado completo; modelos de datos con Pydantic v2. `ruff` para lint y formato, `mypy` en modo estricto en `contrato/` y `decision/`.
- Estructura: `ingesta/`, `asr/`, `preproceso/`, `capas/`, `decision/`, `contrato/`, `api/`, `persistencia/`.
- Tests con `pytest`. Fixtures con transcripciones **sintéticas**; nada de datos reales.
- Los tests no llaman APIs externas: se usan dobles de `Transcriptor` y `Capa`. Los tests contra proveedores reales van marcados `@pytest.mark.externo` y no corren en CI por defecto.
- Configuración con `pydantic-settings` desde variables de entorno.
- Funciones pequeñas y explicables; preferir código simple y medible a abstracciones prematuras.
