"""Daily free-request reservation before any provider call."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_config import EnvironmentConfig
from ielts_db.models import ModelCallAttempt, UsageLedger
from ielts_inference.openrouter import InferenceError


async def reserve_model_call(
    session: AsyncSession,
    user_id: int,
    test_id: str,
    stage: str,
    config: EnvironmentConfig,
) -> None:
    day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await session.execute(
        select(UsageLedger).where(UsageLedger.user_id == user_id, UsageLedger.date == day)
    )
    ledger = result.scalar_one_or_none()
    if ledger is None:
        ledger = UsageLedger(
            user_id=user_id,
            date=day,
            free_requests_used=0,
            paid_cost_microdollars=0,
            free_budget_microdollars=0,
            paid_budget_microdollars=int(config.paid_daily_budget_usd * 1_000_000),
            version=0,
        )
        session.add(ledger)
        await session.flush()
    if ledger.free_requests_used >= config.free_request_daily_hard_limit:
        raise InferenceError("Daily free request limit reached", retryable=False)
    ledger.free_requests_used += 1
    ledger.version += 1
    session.add(
        ModelCallAttempt(
            id=str(uuid.uuid4()),
            idempotency_key=f"{test_id}:{stage}:{ledger.free_requests_used}",
            test_session_id=test_id,
            stage=stage,
            route=stage,
            provider="openrouter",
            model="policy",
            policy_version=config.openrouter_scoring_model[:50],
            request_started_at=datetime.now(timezone.utc),
            reserved_microdollars=0,
            free_request_impact=True,
            outcome="RESERVED",
        )
    )
    await session.flush()


async def assert_capacity(session: AsyncSession, user_id: int, config: EnvironmentConfig) -> None:
    day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await session.execute(
        select(UsageLedger).where(UsageLedger.user_id == user_id, UsageLedger.date == day)
    )
    ledger = result.scalar_one_or_none()
    used = 0 if ledger is None else ledger.free_requests_used
    if used >= config.free_request_daily_hard_limit:
        raise InferenceError("Daily free request limit reached", retryable=False)
