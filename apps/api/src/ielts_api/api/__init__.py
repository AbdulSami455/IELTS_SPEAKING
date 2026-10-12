"""FastAPI application."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from ielts_db.database import DatabaseConfig
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from starlette.middleware.base import BaseHTTPMiddleware

from ielts_api.api.routes import api_router
from ielts_api.errors import AppError
from ielts_api.middleware import RequestGuardMiddleware

_logger = logging.getLogger(__name__)

DATABASE_STARTUP_ATTEMPTS = 10
DATABASE_STARTUP_RETRY_DELAY_SECONDS = 1.0
JSON_BODY_MAX_BYTES = 64 * 1024


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
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'none'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src https://fonts.googleapis.com https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "media-src 'self' blob:; "
            "connect-src 'self' ws: wss:; "
            "object-src 'none'"
        )
        if os.environ.get("APP_ENV", "development") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


async def _initialize_database(database: DatabaseConfig) -> None:
    """Wait for the database. Schema changes are applied by Alembic, not at boot."""
    async with database.engine.begin() as conn:
        await conn.execute(text("SELECT 1"))


async def _initialize_database_with_retry(database: DatabaseConfig) -> None:
    for attempt in range(1, DATABASE_STARTUP_ATTEMPTS + 1):
        try:
            await _initialize_database(database)
            return
        except OperationalError:
            if attempt == DATABASE_STARTUP_ATTEMPTS:
                raise
            _logger.warning(
                "Database unavailable during startup; retrying in %.1f seconds (%d/%d)",
                DATABASE_STARTUP_RETRY_DELAY_SECONDS,
                attempt,
                DATABASE_STARTUP_ATTEMPTS,
            )
            await asyncio.sleep(DATABASE_STARTUP_RETRY_DELAY_SECONDS)


def run_migrations() -> None:
    """Upgrade the database to the latest Alembic revision (repo-root alembic.ini)."""
    from alembic import command
    from alembic.config import Config

    root = _repo_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(config, "head")


def _repo_root() -> Path:
    """Locate alembic.ini by walking up from this file, falling back to the working directory.

    The source tree is apps/api/src/ielts_api/api/; the Docker image keeps the same layout
    under /app, and `alembic upgrade head` as a release step runs from that directory too.
    """
    for candidate in Path(__file__).resolve().parents:
        if (candidate / "alembic.ini").is_file() and (candidate / "migrations").is_dir():
            return candidate
    return Path.cwd()


def _validate_config_at_boot():
    from ielts_config import get_config

    config = get_config()
    errors = config.validate()
    if errors:
        if config.is_production:
            raise RuntimeError("Refusing to start with invalid configuration: " + "; ".join(errors))
        for error in errors:
            _logger.warning("configuration warning: %s", error)
    return config


def create_app() -> FastAPI:
    _load_env()
    from ielts_observability import configure_logging, metrics_response

    configure_logging(os.environ.get("LOG_LEVEL", "INFO"))
    config = _validate_config_at_boot()
    app = FastAPI(
        title="IELTS Speaking API",
        version="0.1.0",
        docs_url=None if config.is_production else "/v1/docs",
        redoc_url=None,
        openapi_url=None if config.is_production else "/v1/openapi.json",
    )
    # Innermost first: the guard refuses bad requests before routing, and CORS
    # still decorates its responses because it wraps the guard.
    app.add_middleware(
        RequestGuardMiddleware,
        allowed_origins=config.allowed_origins,
        json_max_bytes=JSON_BODY_MAX_BYTES,
        audio_max_bytes=config.upload_max_bytes_per_answer,
        trusted_proxy_hops=config.trusted_proxy_hops,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-Id"],
        expose_headers=["X-Request-Id", "Retry-After"],
    )
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=500)

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request) -> Response:
        token = config.metrics_token
        if not token:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        if request.headers.get("authorization") != f"Bearer {token}":
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return metrics_response()

    from ielts_api.deps import database as shared_database

    database = shared_database()

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready() -> JSONResponse:
        checks = await readiness_checks(database)
        healthy = all(value == "ok" for value in checks.values())
        return JSONResponse(
            {"status": "ok" if healthy else "degraded", "checks": checks},
            status_code=200 if healthy else 503,
        )

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        headers = {"X-Request-Id": request_id}
        if exc.status_code == 429:
            headers["Retry-After"] = "60"
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
            headers=headers,
        )

    @app.on_event("startup")
    async def startup() -> None:
        await _initialize_database_with_retry(database)
        # Local convenience only; deployments run `alembic upgrade head` as a release step.
        if os.environ.get("AUTO_MIGRATE", "").lower() in {"1", "true", "yes"}:
            await asyncio.to_thread(run_migrations)

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await database.dispose()

    app.include_router(api_router, prefix="/v1")
    return app


async def readiness_checks(database: DatabaseConfig) -> dict[str, str]:
    """Each dependency is probed with a short timeout; any failure makes the API unready."""
    from ielts_config import get_config
    from ielts_db.storage import ObjectStore

    config = get_config()
    checks: dict[str, str] = {}
    try:
        async with database.engine.connect() as conn:
            await asyncio.wait_for(conn.execute(text("SELECT 1")), timeout=3)
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"error: {type(exc).__name__}"
    try:
        import redis.asyncio as redis

        client = redis.from_url(config.redis_url, socket_timeout=2, socket_connect_timeout=2)
        try:
            await client.ping()
        finally:
            await client.aclose()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = f"error: {type(exc).__name__}"
    try:
        store = ObjectStore(config)
        exists = await asyncio.to_thread(store.bucket_exists, config.minio_candidate_bucket)
        checks["storage"] = "ok" if exists else "error: bucket missing"
    except Exception as exc:  # noqa: BLE001
        checks["storage"] = f"error: {type(exc).__name__}"
    return checks


app = create_app()
