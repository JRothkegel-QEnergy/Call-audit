"""API de Call Audit. Correr en desarrollo con:
uv run uvicorn call_audit.api.app:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from call_audit.api import routes_admin, routes_auditor, routes_catalog, routes_supervisor
from call_audit.config import DEV_SECRET, get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.cookie_secure and settings.session_secret == DEV_SECRET:
        # Con el secreto de desarrollo cualquiera podría firmar una cookie de sesión.
        raise RuntimeError("Define SESSION_SECRET antes de exponer la API")
    app = FastAPI(title="Call Audit", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(routes_auditor.router)
    app.include_router(routes_supervisor.router)
    app.include_router(routes_catalog.router)
    app.include_router(routes_admin.router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
