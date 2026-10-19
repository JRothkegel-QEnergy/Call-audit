# API de Call Audit (FastAPI). Al arrancar aplica las migraciones y levanta uvicorn en el puerto 8000.
# Configuración por variables de entorno (ver .env.example): DATABASE_URL, SESSION_SECRET, COOKIE_SECURE,
# S3_BUCKET, S3_PREFIX, AWS_REGION. El importador del bench no va en la imagen: se corre desde un PC con los datos.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/app/.venv PATH="/app/.venv/bin:$PATH"
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY migrations ./migrations
COPY rubrics ./rubrics
COPY src ./src
RUN uv sync --frozen --no-dev

RUN useradd --system --uid 10001 app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["sh", "-c", "alembic upgrade head && uvicorn call_audit.api.app:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
