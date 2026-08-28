"""Celery worker application."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from celery import Celery
from celery.signals import worker_process_init


def _load_env() -> None:
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        env_path = parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())
            return


_load_env()

celery_app = Celery(
    "ielts_worker",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1"),
    backend=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
)
app = celery_app
celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_store_errors=False,
    task_soft_time_limit=int(os.environ.get("CELERY_DEFAULT_SOFT_TIME_LIMIT_SECONDS", "600")),
    task_time_limit=int(os.environ.get("CELERY_DEFAULT_HARD_TIME_LIMIT_SECONDS", "660")),
    timezone="UTC",
    beat_schedule={
        "reconcile-retention": {
            "task": "ielts_worker.tasks.reconcile_retention",
            "schedule": 3600.0,
        }
    },
)

_worker_engines: dict[int, object] = {}


@worker_process_init.connect
def _reset_engine_per_worker(**kwargs):
    for engine in _worker_engines.values():
        asyncio.run(engine.dispose())
    _worker_engines.clear()


@celery_app.task(name="ielts_worker.tasks.transcribe_answer")
def transcribe_answer_task(user_id: int, test_id: str, answer_id: str) -> str:
    from ielts_api.services.tests import TestService
    from ielts_config import EnvironmentConfig
    from ielts_db.database import DatabaseConfig
    from ielts_db.storage import ObjectStore

    async def _run() -> str:
        config = EnvironmentConfig.from_env()
        db = DatabaseConfig()
        try:
            store = ObjectStore(config)
            async with db.session_factory() as session:
                await TestService(session, config, store).transcribe_saved_answer(user_id, test_id, answer_id)
            return answer_id
        finally:
            await db.dispose()

    return asyncio.run(_run())


@celery_app.task(name="ielts_worker.tasks.evaluate_test")
def evaluate_test_task(test_id: str) -> str:
    from ielts_db.database import DatabaseConfig
    from ielts_inference.evaluation import evaluate_test

    async def _run() -> str:
        db = DatabaseConfig()
        try:
            async with db.session_factory() as session:
                report = await evaluate_test(session, test_id)
                return report.id
        finally:
            await db.dispose()

    return asyncio.run(_run())


@celery_app.task(name="ielts_worker.tasks.reconcile_retention")
def reconcile_retention() -> str:
    from ielts_config import EnvironmentConfig
    from ielts_db.database import DatabaseConfig
    from ielts_inference.retention import reconcile_retention as run_retention

    async def _run() -> str:
        config = EnvironmentConfig.from_env()
        db = DatabaseConfig()
        try:
            async with db.session_factory() as session:
                deleted = await run_retention(session, config)
                return str(deleted)
        finally:
            await db.dispose()

    return asyncio.run(_run())
