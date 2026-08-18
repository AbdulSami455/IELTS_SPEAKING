"""Enqueue evaluation. Prefer Celery; fall back to an in-process run if Redis is down."""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


def enqueue_evaluate(test_id: str) -> None:
    try:
        from ielts_worker.tasks import evaluate_test_task

        evaluate_test_task.delay(test_id)
        return
    except Exception as exc:
        logger.warning("celery_unavailable", extra={"test_id": test_id, "error": type(exc).__name__})
    asyncio.run(_run_inline(test_id))


async def _run_inline(test_id: str) -> None:
    from ielts_db.database import DatabaseConfig
    from ielts_inference.evaluation import evaluate_test

    db = DatabaseConfig()
    async with db.session_factory() as session:
        await evaluate_test(session, test_id)
    await db.dispose()
