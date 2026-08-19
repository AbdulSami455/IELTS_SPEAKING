"""Enqueue evaluation and background transcription."""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


def enqueue_transcribe(user_id: int, test_id: str, answer_id: str) -> None:
    try:
        from ielts_worker.tasks import transcribe_answer_task

        transcribe_answer_task.delay(user_id, test_id, answer_id)
        return
    except Exception as extra:
        logger.warning("celery_unavailable", extra={"test_id": test_id, "error": type(extra).__name__})
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_transcribe_inline(user_id, test_id, answer_id))
    except RuntimeError:
        asyncio.run(_transcribe_inline(user_id, test_id, answer_id))


async def _transcribe_inline(user_id: int, test_id: str, answer_id: str) -> None:
    from ielts_api.services.tests import TestService
    from ielts_config import EnvironmentConfig
    from ielts_db.database import DatabaseConfig
    from ielts_db.storage import ObjectStore

    db = DatabaseConfig()
    config = EnvironmentConfig.from_env()
    store = ObjectStore(config)
    async with db.session_factory() as session:
        await TestService(session, config, store).transcribe_saved_answer(user_id, test_id, answer_id)
    await db.dispose()


def enqueue_evaluate(test_id: str) -> None:
    try:
        from ielts_worker.tasks import evaluate_test_task

        evaluate_test_task.delay(test_id)
        return
    except Exception as extra:
        logger.warning("celery_unavailable", extra={"test_id": test_id, "error": type(extra).__name__})
    asyncio.run(_run_inline(test_id))


async def _run_inline(test_id: str) -> None:
    from ielts_db.database import DatabaseConfig
    from ielts_inference.evaluation import evaluate_test

    db = DatabaseConfig()
    async with db.session_factory() as session:
        await evaluate_test(session, test_id)
    await db.dispose()
