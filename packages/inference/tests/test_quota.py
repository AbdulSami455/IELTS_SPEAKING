"""Reservations use database counters and independent attempt identities."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ielts_config import EnvironmentConfig
from ielts_db.models import ModelCallAttempt, UsageLedger
from ielts_inference.openrouter import InferenceError
from ielts_inference.quota import reserve_model_call


@pytest.fixture
def reservations():
    engine = create_engine("sqlite://")
    UsageLedger.__table__.create(engine)
    ModelCallAttempt.__table__.create(engine)
    with Session(engine, autoflush=False, expire_on_commit=False) as session:
        async_session = AsyncMock()
        async_session.execute.side_effect = session.execute
        async_session.flush.side_effect = session.flush
        async_session.add = session.add
        config = MagicMock(spec=EnvironmentConfig, paid_daily_budget_usd=1, free_request_daily_hard_limit=3, openrouter_scoring_model="model")
        yield session, async_session, config
    engine.dispose()


@pytest.mark.asyncio
async def test_reservations_increment_once_and_enforce_limit(reservations):
    session, async_session, config = reservations
    for stage in ["examiner", "transcription", "examiner"]:
        await reserve_model_call(async_session, 1, "test", stage, config)
    with pytest.raises(InferenceError, match="Daily free request limit reached"):
        await reserve_model_call(async_session, 1, "test", "examiner", config)
    ledger = session.scalars(select(UsageLedger)).one()
    attempts = session.scalars(select(ModelCallAttempt)).all()
    assert ledger.free_requests_used == ledger.version == 3
    assert len(attempts) == len({attempt.idempotency_key for attempt in attempts}) == 3


@pytest.mark.asyncio
async def test_old_counter_key_cannot_collide_with_new_attempt(reservations):
    session, async_session, config = reservations
    session.add(ModelCallAttempt(id="previous", idempotency_key="test:examiner:1", test_session_id="test", stage="examiner", route="examiner", provider="openrouter", model="policy", policy_version="model", request_started_at=datetime.now(timezone.utc), reserved_microdollars=0, free_request_impact=True, outcome="RESERVED"))
    session.flush()
    await reserve_model_call(async_session, 1, "test", "examiner", config)
    assert len(session.scalars(select(ModelCallAttempt)).all()) == 2
