# Imágenes de Call Audit. Configuración por variables de entorno (ver .env.example).
#   api (por defecto)  FastAPI: aplica las migraciones y levanta uvicorn en el puerto 8000.
#                      DATABASE_URL, SESSION_SECRET, COOKIE_SECURE, S3_BUCKET, S3_PREFIX, AWS_REGION.
#   worker             pipeline automático (python -m call_audit.ingestion.pipeline): SFTP → ASR → capa 2 → base.
#                      Además GEMINI_API_KEY, SFTP_* (cuenta de S4P) y PIPELINE_WORK_DIR (volumen del compose).
FROM python:3.12-slim AS base

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


# El worker reutiliza el ASR y el bench de prompts (scripts/), el prompt versionado y el catálogo de productos.
# ffprobe mide la duración del audio. Corre con uid 10001, dueño de /opt/call-audit/work en el EC2.
FROM base AS worker
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN uv sync --frozen --no-dev --extra bench
COPY scripts/asr_bench/run.py scripts/asr_bench/pricing.toml ./scripts/asr_bench/
COPY scripts/prompt_bench/*.py scripts/prompt_bench/models.toml ./scripts/prompt_bench/
COPY prompts ./prompts
COPY docs/layer2-product-sheet.md ./docs/
COPY data/catalog/products.json ./data/catalog/
ENV PIPELINE_WORK_DIR=/data/work
USER app
CMD ["python", "-m", "call_audit.ingestion.pipeline", "--loop", "900"]


FROM base AS api
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["sh", "-c", "alembic upgrade head && uvicorn call_audit.api.app:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
