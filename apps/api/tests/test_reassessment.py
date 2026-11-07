from unittest.mock import AsyncMock, MagicMock

import pytest
from ielts_api.errors import AppError
from ielts_api.services.tests import TestService as SpeakingService


def service():
    session = AsyncMock()
    svc = SpeakingService(session, MagicMock(), MagicMock())
    svc.reports = MagicMock()
    svc.reports.get_by_id = AsyncMock(return_value=MagicMock(test_session_id="test"))
    svc.tests = MagicMock()
    svc.tests.get_owned = AsyncMock(return_value=MagicMock(id="test", status="COMPLETED", revision=4, answers=[MagicMock(media_object=object())]))
    return svc, session


@pytest.mark.asyncio
async def test_reassess_keeps_report_and_queues_existing_test():
    svc, session = service()
    assert await svc.reassess_report(1, "report") == "test"
    test = svc.tests.get_owned.return_value
    assert test.status == "SUBMITTED"
    assert test.revision == 5
    session.commit.assert_awaited_once()
    svc.tests.get_owned.assert_awaited_once_with("test", 1)


@pytest.mark.asyncio
async def test_reassess_rejects_other_users_report():
    svc, session = service()
    svc.tests.get_owned.return_value = None
    with pytest.raises(AppError) as error:
        await svc.reassess_report(2, "report")
    assert error.value.status_code == 404
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reassess_rejects_duplicate_processing_request():
    svc, session = service()
    svc.tests.get_owned.return_value.status = "PROCESSING"
    with pytest.raises(AppError) as error:
        await svc.reassess_report(1, "report")
    assert error.value.status_code == 409
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reassess_rejects_missing_recordings():
    svc, session = service()
    svc.tests.get_owned.return_value.answers = []
    with pytest.raises(AppError) as error:
        await svc.reassess_report(1, "report")
    assert error.value.status_code == 400
    session.commit.assert_not_awaited()
