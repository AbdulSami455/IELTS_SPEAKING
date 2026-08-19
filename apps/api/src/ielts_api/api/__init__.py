"""FastAPI application."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from ielts_api.api.routes import api_router
from ielts_api.errors import AppError
from ielts_db.database import DatabaseConfig
from ielts_db.models import Base


def _load_env() -> None:
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        env_path = parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())
            return


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if os.environ.get("APP_ENV", "development") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def create_app() -> FastAPI:
    _load_env()
    from ielts_observability import configure_logging

    configure_logging(os.environ.get("LOG_LEVEL", "INFO"))
    app = FastAPI(
        title="IELTS Speaking API",
        version="0.1.0",
        docs_url="/v1/docs",
        openapi_url="/v1/openapi.json",
    )
    origin = os.environ.get("WEB_ORIGIN", "http://localhost:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin, "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )
    app.add_middleware(RequestIDMiddleware)

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready() -> dict[str, object]:
        return {
            "status": "ok",
            "checks": {
                "database": "configured" if os.environ.get("DATABASE_URL") else "missing",
                "redis": "configured" if os.environ.get("REDIS_URL") else "missing",
                "storage": "configured" if os.environ.get("MINIO_ENDPOINT") else "missing",
            },
        }

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "retryable": exc.retryable,
                    "details": {},
                },
                "requestId": request_id,
            },
            headers={"X-Request-Id": request_id},
        )

    @app.on_event("startup")
    async def startup() -> None:
        db = DatabaseConfig()
        async with db.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
            await conn.execute(text("ALTER TABLE session_questions ALTER COLUMN question_id DROP NOT NULL"))
            await conn.execute(text("ALTER TABLE test_sessions ALTER COLUMN question_set_id DROP NOT NULL"))
            await conn.execute(text("ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS topic_plan JSON"))
        await db.dispose()

    app.include_router(api_router, prefix="/v1")
    return app


app = create_app()
