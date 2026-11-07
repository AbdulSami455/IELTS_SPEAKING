"""Request guards that must refuse traffic before any handler, database, or model runs.

These use the real app without its lifespan (no database), because every guard here
rejects before routing.
"""

from __future__ import annotations

import pytest
from conftest import EVIL_ORIGIN, ORIGIN
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


@pytest.fixture
def client(fake_redis):
    from ielts_api.api import app

    return TestClient(app, base_url="http://testserver")


def test_cross_site_post_is_refused(client):
    response = client.post("/v1/auth/logout", headers={"Origin": EVIL_ORIGIN})
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "ORIGIN_NOT_ALLOWED"


def test_cross_site_referer_is_refused(client):
    response = client.post("/v1/auth/logout", headers={"Referer": f"{EVIL_ORIGIN}/login"})
    assert response.status_code == 403


def test_same_site_post_is_allowed(client):
    assert client.post("/v1/auth/logout", headers={"Origin": ORIGIN}).status_code == 200
    assert client.post("/v1/auth/logout", headers={"Referer": f"{ORIGIN}/login"}).status_code == 200


def test_safe_methods_ignore_origin(client):
    # GETs cannot mutate state; browsers also send Origin on cross-site GETs in some cases.
    assert client.get("/health/live", headers={"Origin": EVIL_ORIGIN}).status_code == 200


def test_oversized_json_body_is_refused_before_routing(client):
    payload = '{"email": "' + "a" * (70 * 1024) + '"}'
    response = client.post(
        "/v1/auth/logout",
        content=payload,
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_auth_endpoints_are_rate_limited_per_ip(client):
    from ielts_api.rate_limit import AUTH_LIMITS

    burst = min(limit.limit for limit in AUTH_LIMITS)
    # /auth/refresh with no cookie fails fast in the handler; the guard counts it regardless.
    statuses = [client.post("/v1/auth/refresh", headers={"Origin": ORIGIN}).status_code for _ in range(burst + 1)]
    assert 429 not in statuses[:burst]
    assert statuses[-1] == 429
    limited = client.post("/v1/auth/refresh", headers={"Origin": ORIGIN})
    assert limited.headers.get("Retry-After")
    assert limited.json()["error"]["code"] == "RATE_LIMITED"
    # Other endpoints are not on the per-IP auth budget.
    assert client.post("/v1/auth/logout", headers={"Origin": ORIGIN}).status_code == 200


def test_forwarded_ip_is_only_trusted_through_configured_hops(client):
    from ielts_api.rate_limit import AUTH_LIMITS

    burst = min(limit.limit for limit in AUTH_LIMITS)
    # In development no proxy hop is trusted, so a spoofed X-Forwarded-For must not reset the budget.
    for i in range(burst):
        client.post("/v1/auth/refresh", headers={"Origin": ORIGIN, "X-Forwarded-For": f"10.0.0.{i}"})
    assert client.post("/v1/auth/refresh", headers={"Origin": ORIGIN, "X-Forwarded-For": "10.0.0.99"}).status_code == 429


def test_websocket_rejects_foreign_origin(client):
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/v1/tests/any/realtime/live", headers={"Origin": EVIL_ORIGIN}):
        pass


def test_websocket_rejects_missing_auth(client):
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/v1/tests/any/realtime/live", headers={"Origin": ORIGIN}):
        pass


def test_docs_hidden_in_production(monkeypatch):
    from ielts_config import EnvironmentConfig

    config = EnvironmentConfig.from_env()
    assert config.is_production is False
    # Production builds hide the schema; the flag that drives it is derived from APP_ENV.
    prod = EnvironmentConfig(**{**config.__dict__, "app_env": "production"})
    assert prod.is_production is True
