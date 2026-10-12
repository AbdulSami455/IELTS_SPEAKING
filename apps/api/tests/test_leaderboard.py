"""Exercise ranking SQL against real relational data without external services."""
from datetime import UTC, datetime

import pytest
from ielts_api.services.leaderboard import LeaderboardPeriod, period_start, ranked_scores
from ielts_inference.assembler import EVALUATOR_VERSION
from sqlalchemy import create_engine, select, text

NOW = datetime(2026, 9, 10, 12, tzinfo=UTC)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT)"))
        connection.execute(text("CREATE TABLE test_sessions (id TEXT PRIMARY KEY, user_id INTEGER, status TEXT)"))
        connection.execute(text("CREATE TABLE reports (id TEXT PRIMARY KEY, test_session_id TEXT, overall_band FLOAT, is_inconclusive BOOLEAN, evaluator_version TEXT, created_at DATETIME)"))
        for user_id in range(1, 7):
            connection.execute(text("INSERT INTO users VALUES (:id, :name)"), {"id": user_id, "name": f"Learner {user_id}"})
        cases = [
            (1, 7, "2026-09-10 00:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (1, 8, "2026-09-10 10:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (2, 8, "2026-09-10 11:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (3, 9, "2026-09-07 00:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (4, 9, "2026-09-06 23:59:59.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (5, 9, "2026-09-10 01:00:00.000000", "FAILED", False, EVALUATOR_VERSION),
            (5, 9, "2026-09-10 01:00:00.000000", "COMPLETED", True, EVALUATOR_VERSION),
            (5, None, "2026-09-10 01:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (5, 9, "2026-09-10 01:00:00.000000", "COMPLETED", False, "old-version"),
            (5, 9, "2026-09-11 01:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
            (6, 6, "2026-09-10 01:00:00.000000", "COMPLETED", False, EVALUATOR_VERSION),
        ]
        for index, (user_id, band, created, state, inconclusive, version) in enumerate(cases):
            connection.execute(text("INSERT INTO test_sessions VALUES (:id, :user, :state)"), {"id": str(index), "user": user_id, "state": state})
            connection.execute(text("INSERT INTO reports VALUES (:id, :id, :band, :inconclusive, :version, :created)"), {"id": str(index), "band": band, "inconclusive": inconclusive, "version": version, "created": created})
        yield connection
    engine.dispose()


def test_today_best_per_user_ties_and_eligibility(db):
    ranked = ranked_scores(LeaderboardPeriod.TODAY, NOW)
    rows = db.execute(select(ranked).order_by(ranked.c.position)).all()
    assert [(row.user_id, row.best_band, row.rank) for row in rows] == [(1, 8, 1), (2, 8, 1), (6, 6, 3)]
    assert rows[0].tests_completed == 2
    assert all(row.total_participants == 3 for row in rows)


@pytest.mark.parametrize("period,expected", [(LeaderboardPeriod.WEEK, {1, 2, 3, 6}), (LeaderboardPeriod.OVERALL, {1, 2, 3, 4, 6})])
def test_period_boundaries(db, period, expected):
    ranked = ranked_scores(period, NOW)
    assert {row.user_id for row in db.execute(select(ranked))} == expected


def test_week_starts_monday_utc():
    assert period_start(LeaderboardPeriod.WEEK, NOW) == datetime(2026, 9, 7, tzinfo=UTC)
    assert period_start(LeaderboardPeriod.OVERALL, NOW) is None


def test_own_rank_outside_top_50_is_preserved(db):
    for user_id in range(20, 80):
        db.execute(text("INSERT INTO users VALUES (:id, 'Learner')"), {"id": user_id})
        db.execute(text("INSERT INTO test_sessions VALUES (:id, :id, 'COMPLETED')"), {"id": user_id})
        db.execute(text("INSERT INTO reports VALUES (:id, :id, 7, 0, :version, '2026-09-10 01:00:00.000000')"), {"id": user_id, "version": EVALUATOR_VERSION})
    ranked = ranked_scores(LeaderboardPeriod.TODAY, NOW)
    rows = db.execute(select(ranked).where((ranked.c.position <= 50) | (ranked.c.user_id == 6))).all()
    assert len(rows) == 51
    own = next(row for row in rows if row.user_id == 6)
    assert own.rank == 63
    assert own.total_participants == 63


def test_endpoint_validates_period_and_serializes_camel_case():
    from unittest.mock import AsyncMock, patch

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from ielts_api.api.v1.leaderboard import router
    from ielts_api.auth.identity import AuthenticatedUser
    from ielts_api.deps import get_session, require_user
    from ielts_api.services.leaderboard import LeaderboardEntry, LeaderboardResponse

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_user] = lambda: AuthenticatedUser(1, "subject", None, "Learner")
    app.dependency_overrides[get_session] = lambda: None
    entry = LeaderboardEntry(rank=1, display_name="Learner", best_band=8, tests_completed=2, is_you=True)
    result = LeaderboardResponse(period=LeaderboardPeriod.WEEK, starts_at=period_start(LeaderboardPeriod.WEEK, NOW), updated_at=NOW, total_participants=1, entries=[entry], your_entry=entry)
    with patch("ielts_api.api.v1.leaderboard.get_leaderboard", AsyncMock(return_value=result)) as service:
        client = TestClient(app)
        assert client.get("/leaderboard?period=invalid").status_code == 422
        service.assert_not_awaited()
        response = client.get("/leaderboard?period=week")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["yourEntry"]["isYou"] is True
        assert data["entries"][0]["bestBand"] == 8
        assert "userId" not in data["entries"][0]
        service.assert_awaited_once_with(None, 1, LeaderboardPeriod.WEEK)
