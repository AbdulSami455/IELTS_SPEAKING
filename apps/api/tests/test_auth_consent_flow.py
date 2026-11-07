"""End-to-end auth, consent, and account-deletion behaviour against a real database."""

from __future__ import annotations

import uuid

import pytest
from conftest import PASSWORD, db_scalar, register

pytestmark = pytest.mark.postgres


@pytest.fixture(autouse=True)
def _fresh_rate_limits(api):
    """Every test registers and logs in; keep the per-IP auth budget from leaking across tests."""
    api.portal.call(api.fake_redis.flushall)


def _email() -> str:
    return f"learner-{uuid.uuid4().hex[:10]}@example.com"


def test_register_sets_cookies_and_records_consent(api):
    email = _email()
    response = register(api, email)
    assert response.status_code in (200, 201), response.text
    assert "auth-token" in api.cookies
    me = api.get("/v1/me")
    assert me.status_code == 200, me.text
    user = me.json()["data"]
    assert user["email"] == email
    assert user["consentRequired"] is False
    assert db_scalar("SELECT count(*) FROM consent_records WHERE user_id = (SELECT id FROM users WHERE email = %s)", (email,)) == 1


def test_register_requires_consent(api):
    response = register(api, _email(), accept_terms=False)
    assert response.status_code in (400, 422), response.text
    assert "auth-token" not in api.cookies


def test_register_rejects_weak_or_overlong_password(api):
    api.cookies.clear()
    short = api.post("/v1/auth/register", json={"email": _email(), "password": "short", "display_name": "x", "accept_terms": True})
    assert short.status_code in (400, 422)
    overlong = api.post(
        "/v1/auth/register",
        json={"email": _email(), "password": "p" * 129, "display_name": "x", "accept_terms": True},
    )
    assert overlong.status_code in (400, 422)


def test_login_logout_refresh_cycle(api):
    email = _email()
    register(api, email)
    api.cookies.clear()

    wrong = api.post("/v1/auth/login", json={"email": email, "password": "not-the-password"})
    # 400, not 401: the web client treats 401 as an expired session.
    assert wrong.status_code in (400, 401)
    assert "password" in wrong.json()["error"]["message"].lower()
    assert "auth-token" not in api.cookies

    ok = api.post("/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert ok.status_code == 200, ok.text
    assert "auth-token" in api.cookies
    assert api.get("/v1/me").status_code == 200

    refreshed = api.post("/v1/auth/refresh")
    assert refreshed.status_code == 200, refreshed.text
    assert api.get("/v1/me").status_code == 200

    assert api.post("/v1/auth/logout").status_code == 200
    assert api.get("/v1/me").status_code == 401


def test_display_name_is_sanitised(api):
    email = _email()
    register(api, email, display_name="  <script>alert(1)</script>  ")
    name = api.get("/v1/me").json()["data"]["displayName"]
    assert "<" not in name and ">" not in name
    assert name.strip() == name


def test_consent_version_bump_blocks_tests_until_reaccepted(api):
    from ielts_config import get_config

    register(api, _email())
    created = api.post("/v1/tests")
    assert created.status_code in (200, 201), created.text

    config = get_config()
    original = config.consent_version
    object.__setattr__(config, "consent_version", "2099-01-01")
    try:
        assert api.get("/v1/me").json()["data"]["consentRequired"] is True
        blocked = api.post("/v1/tests")
        assert blocked.status_code == 403
        assert blocked.json()["error"]["code"] == "CONSENT_REQUIRED"
        # The client cannot pick the version it accepts; the server records the current one.
        accepted = api.post("/v1/me/consent", json={"accepted": True, "version": "1999-01-01"})
        assert accepted.status_code == 200, accepted.text
        assert api.get("/v1/me").json()["data"]["consentRequired"] is False
        assert api.post("/v1/tests").status_code in (200, 201)
    finally:
        object.__setattr__(config, "consent_version", original)


def test_daily_test_cap(api):
    from ielts_config import get_config

    register(api, _email())
    limit = get_config().tests_per_day_limit
    for _ in range(limit):
        assert api.post("/v1/tests").status_code in (200, 201)
    capped = api.post("/v1/tests")
    assert capped.status_code == 429, capped.text
    assert capped.json()["error"]["code"] == "TEST_LIMIT_REACHED"


def test_delete_account_removes_everything(api):
    email = _email()
    register(api, email)
    created = api.post("/v1/tests").json()["data"]
    test_id = created["testId"]
    user_id = db_scalar("SELECT id FROM users WHERE email = %s", (email,))
    assert db_scalar("SELECT count(*) FROM test_sessions WHERE id = %s", (test_id,)) == 1

    deleted = api.delete("/v1/me")
    assert deleted.status_code in (200, 204), deleted.text
    assert api.get("/v1/me").status_code == 401
    api.cookies.clear()
    assert api.post("/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code in (400, 401)

    assert db_scalar("SELECT count(*) FROM users WHERE id = %s", (user_id,)) == 0
    assert db_scalar("SELECT count(*) FROM test_sessions WHERE user_id = %s", (user_id,)) == 0
    assert db_scalar("SELECT count(*) FROM consent_records WHERE user_id = %s", (user_id,)) == 0
    assert db_scalar("SELECT count(*) FROM audit_events WHERE event_type = 'account_deleted'") >= 1


def test_other_users_tests_are_invisible(api):
    register(api, _email())
    mine = api.post("/v1/tests").json()["data"]["testId"]
    register(api, _email())
    assert api.get(f"/v1/tests/{mine}").status_code == 404
    assert api.delete(f"/v1/tests/{mine}").status_code == 404


def test_old_token_does_not_reach_a_reused_email(api):
    """A token from a deleted account must not authenticate a later account with the same email."""
    email = _email()
    register(api, email)
    old_cookies = dict(api.cookies)
    assert api.delete("/v1/me").status_code in (200, 204)

    register(api, email)  # same email, brand-new account
    new_id = api.get("/v1/me").json()["data"]["id"]
    api.cookies.clear()
    for name, value in old_cookies.items():
        api.cookies.set(name, value)
    stale = api.get("/v1/me")
    assert stale.status_code == 401 or stale.json()["data"]["id"] != new_id


@pytest.mark.parametrize("event", ["DELETE", "MARK_COMPLETED", "MARK_FAILED", "RETRY_PROCESSING", "SUBMIT", "COMPLETE_UPLOAD", "EXPIRE"])
def test_clients_cannot_send_server_driven_transitions(api, event):
    register(api, _email())
    test = api.post("/v1/tests").json()["data"]
    response = api.post(f"/v1/tests/{test['testId']}/transitions", json={"event": event, "expectedRevision": test["revision"]})
    assert response.status_code in (400, 422)
    assert api.get(f"/v1/tests/{test['testId']}").json()["data"]["state"] == test["state"]


def test_allowed_transition_passes_the_allowlist(api):
    """Control for the allowlist test: the payload shape is valid and allowed events reach the state machine."""
    register(api, _email())
    test = api.post("/v1/tests").json()["data"]
    response = api.post(f"/v1/tests/{test['testId']}/transitions", json={"event": "COMPLETE_DEVICE_CHECK", "expectedRevision": test["revision"]})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["state"] != test["state"]


def test_duplicate_email_is_rejected_case_insensitively(api):
    email = _email()
    assert register(api, email).status_code in (200, 201)
    again = register(api, email.upper())
    assert again.status_code == 409
    assert "auth-token" not in api.cookies


def test_database_refuses_duplicate_emails_even_when_the_check_is_raced(api):
    """The unique index is the real guard: a second insert fails even if get_by_email missed it."""
    import psycopg
    from conftest import TEST_DATABASE_URL, _sync_url

    email = _email()
    register(api, email)
    with psycopg.connect(_sync_url(TEST_DATABASE_URL)) as conn:
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute("INSERT INTO users (auth_subject, email, display_name) VALUES (%s, %s, 'dup')", (f"local:{uuid.uuid4()}", email.upper()))


def test_logout_revokes_tokens_that_were_already_issued(api):
    """A copied refresh or access token must stop working once the user logs out."""
    email = _email()
    register(api, email)
    stolen_access = api.cookies.get("auth-token")
    stolen_refresh = api.cookies.get("auth-refresh", path="/v1/auth/refresh")
    assert stolen_access and stolen_refresh

    assert api.post("/v1/auth/logout").status_code == 200
    api.cookies.clear()

    assert api.get("/v1/me", headers={"Authorization": f"Bearer {stolen_access}"}).status_code == 401
    api.cookies.set("auth-refresh", stolen_refresh, path="/v1/auth/refresh")
    assert api.post("/v1/auth/refresh").status_code in (400, 401)

    # A fresh login still works and gets a working session.
    api.cookies.clear()
    assert api.post("/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
    assert api.get("/v1/me").status_code == 200
