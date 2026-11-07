"""Regression coverage for report persistence failures."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ielts_config import EnvironmentConfig
from ielts_db.models import ProcessingJob
from ielts_db.models import TestSession as SessionModel
from ielts_inference.evaluation import _skill_observation_key, evaluate_test
from sqlalchemy.exc import IntegrityError


def test_shared_subdimension_names_keep_both_criteria():
    lexical = _skill_observation_key("lexical_resource", "range")
    grammar = _skill_observation_key("grammatical_range_and_accuracy", "range")
    assert lexical != grammar
    assert lexical == "lexical_resource:range"
    assert grammar == "grammatical_range_and_accuracy:range"


def test_long_subdimension_names_fit_column_without_truncation_collisions():
    first = _skill_observation_key("grammatical_range_and_accuracy", "a" * 100 + "x")
    second = _skill_observation_key("grammatical_range_and_accuracy", "a" * 100 + "y")
    assert len(first) <= 50
    assert len(second) <= 50
    assert first != second
    assert first == _skill_observation_key("grammatical_range_and_accuracy", "a" * 100 + "x")


@pytest.mark.asyncio
async def test_database_error_rolls_back_before_persisting_failed_status():
    test = SessionModel(id="test", status="SUBMITTED", revision=1)
    job = ProcessingJob(id="job", test_session_id="test", status="RUNNING")
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one.return_value = test
    session.execute.return_value = result
    failure = IntegrityError("INSERT", {}, Exception("duplicate skill"))
    session.commit.side_effect = [failure, None]
    recovered = False

    async def rollback():
        nonlocal recovered
        recovered = True

    async def refresh(row):
        assert recovered, "A failed transaction must roll back before reloading rows"
        if row is test:
            row.status = "SUBMITTED"
            row.revision = 1

    session.rollback.side_effect = rollback
    session.refresh.side_effect = refresh
    config = MagicMock(spec=EnvironmentConfig, inference_mode="real")
    with patch("ielts_inference.evaluation._job", AsyncMock(return_value=job)):  # noqa: SIM117
        with pytest.raises(IntegrityError) as raised:
            await evaluate_test(session, test.id, config)

    assert raised.value is failure
    session.rollback.assert_awaited_once()
    assert session.commit.await_count == 2
    assert test.status == "FAILED"
    assert job.status == "FAILED"
    assert job.payload == {"stage": "failed", "progress": 100}
    assert job.error_code == "EVALUATION_FAILED"
    assert job.completed_at is not None
