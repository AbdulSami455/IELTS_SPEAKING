"""API startup behavior."""

from unittest.mock import AsyncMock

import pytest
from ielts_api.api import DATABASE_STARTUP_ATTEMPTS, _initialize_database_with_retry
from sqlalchemy.exc import OperationalError


def _connection_error() -> OperationalError:
    return OperationalError("connect", {}, OSError("temporary DNS failure"))


@pytest.mark.asyncio
async def test_database_startup_retries_transient_connection_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    initialize = AsyncMock(side_effect=[_connection_error(), None])
    sleep = AsyncMock()
    monkeypatch.setattr("ielts_api.api._initialize_database", initialize)
    monkeypatch.setattr("ielts_api.api.asyncio.sleep", sleep)

    await _initialize_database_with_retry(AsyncMock())

    assert initialize.await_count == 2
    sleep.assert_awaited_once()


@pytest.mark.asyncio
async def test_database_startup_fails_after_retry_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    initialize = AsyncMock(side_effect=_connection_error())
    sleep = AsyncMock()
    monkeypatch.setattr("ielts_api.api._initialize_database", initialize)
    monkeypatch.setattr("ielts_api.api.asyncio.sleep", sleep)

    with pytest.raises(OperationalError):
        await _initialize_database_with_retry(AsyncMock())

    assert initialize.await_count == DATABASE_STARTUP_ATTEMPTS
    assert sleep.await_count == DATABASE_STARTUP_ATTEMPTS - 1
