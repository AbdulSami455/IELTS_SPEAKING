"""API contract tests for authentication gating and response schemas."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _make_client():
    from ielts_api.api import app

    return TestClient(app)


def test_health_live():
    client = _make_client()
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_me_requires_auth():
    client = _make_client()
    response = client.get("/v1/me")
    assert response.status_code == 401


def test_create_test_requires_auth():
    client = _make_client()
    response = client.post("/v1/tests")
    assert response.status_code == 401


def test_get_test_requires_auth():
    client = _make_client()
    response = client.get("/v1/tests/123")
    assert response.status_code == 401


def test_get_report_requires_auth():
    client = _make_client()
    response = client.get("/v1/reports/123")
    assert response.status_code == 401


def test_progress_requires_auth():
    client = _make_client()
    response = client.get("/v1/progress/overview")
    assert response.status_code == 401


def test_error_response_schema():
    client = _make_client()
    response = client.get("/v1/me")
    assert response.status_code == 401
    body = response.json()
    assert "error" in body
    assert "requestId" in body
    assert body["error"]["code"] == "AUTH_REQUIRED"
    assert isinstance(body["error"]["message"], str)


def test_security_headers_present():
    client = _make_client()
    response = client.get("/health/live")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert "frame-ancestors" in response.headers.get("Content-Security-Policy", "")


def test_gzip_compression():
    client = _make_client()
    response = client.get("/v1/me", headers={"Accept-Encoding": "gzip"})
    assert response.status_code == 401
