"""Shared API test fixtures.

Unit-level tests (request guards, limiter, export escaping) need no services. Integration
tests use the ``api`` fixture, which needs ``TEST_DATABASE_URL`` pointing at a disposable
Postgres database; they skip when it is unset. Redis is replaced by fakeredis everywhere.

The environment is pinned here, before any test module imports ``ielts_api.api`` (which
builds the app and caches the config at import time).
"""

from __future__ import annotations

import os

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
if TEST_DATABASE_URL:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("AUTO_MIGRATE", "false")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("WEB_ORIGIN", "http://localhost:3000")
os.environ.setdefault("AUTH_MODE", "jwt")
os.environ.setdefault("AUTH_TOKEN_SECRET", "test-secret-that-is-long-enough-for-hmac-signing-0123456789")
os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/14")
os.environ.setdefault("MINIO_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("MINIO_ACCESS_KEY", "minio")
os.environ.setdefault("MINIO_SECRET_KEY", "minio-development-only")
os.environ.setdefault("CONSENT_VERSION", "2026-10-12")

ORIGIN = os.environ["WEB_ORIGIN"]
EVIL_ORIGIN = "http://evil.example"
PASSWORD = "Correct-horse-battery-9"


def _sync_url(url: str) -> str:
    for prefix in ("postgresql+psycopg://", "postgresql+asyncpg://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


@pytest.fixture(scope="session")
def migrated_db() -> str:
    """Reset the disposable database and bring it to Alembic head, exercising the migrations."""
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set")
    import psycopg

    with psycopg.connect(_sync_url(TEST_DATABASE_URL), autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    from ielts_api.api import run_migrations

    run_migrations()
    return TEST_DATABASE_URL


@pytest.fixture
def fake_redis():
    """A fresh in-memory Redis for every test so rate-limit windows never leak between tests."""
    import fakeredis.aioredis
    from ielts_api import rate_limit

    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    rate_limit.set_client(client)
    yield client
    rate_limit.set_client(None)


@pytest.fixture(scope="module")
def api(migrated_db):
    """One live app (lifespan + event loop) per module; tests register their own users."""
    import fakeredis.aioredis
    from fastapi.testclient import TestClient
    from ielts_api import deps, rate_limit
    from ielts_api.api import app

    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    rate_limit.set_client(fake)
    with TestClient(app, base_url="http://testserver") as client:
        client.headers.update({"Origin": ORIGIN})
        client.fake_redis = fake  # type: ignore[attr-defined]
        yield client
        # Connections belong to this client's event loop; release them before it closes.
        client.portal.call(deps.database().dispose)
    rate_limit.set_client(None)


@pytest.fixture
def fresh_limits(api):
    api.portal.call(api.fake_redis.flushall)
    return api


def register(client, email: str, *, display_name: str = "Test Learner", accept_terms: bool = True):
    """Create an account and return the response; cookies land in the client jar."""
    client.cookies.clear()
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": display_name, "accept_terms": accept_terms},
    )


def db_scalar(sql: str, params: tuple = ()):
    import psycopg

    with psycopg.connect(_sync_url(TEST_DATABASE_URL)) as conn:
        return conn.execute(sql, params).fetchone()[0]
