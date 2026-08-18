"""Celery worker application."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from celery import Celery


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


@celery_app.task(name="ielts_worker.tasks.evaluate_test")
def evaluate_test_task(test_id: str) -> str:
    from ielts_db.database import DatabaseConfig
    from ielts_inference.evaluation import evaluate_test

    async def _run() -> str:
        db = DatabaseConfig()
        async with db.session_factory() as session:
            report = await evaluate_test(session, test_id)
            return report.id

    return asyncio.run(_run())


@celery_app.task(name="ielts_worker.tasks.reconcile_retention")
def reconcile_retention() -> str:
    from ielts_config import EnvironmentConfig
    from ielts_db.database import DatabaseConfig
    from ielts_inference.retention import reconcile_retention as run_retention

    async def _run() -> str:
        db = DatabaseConfig()
        async with db.session_factory() as session:
            deleted = await run_retention(session, EnvironmentConfig.from_env())
            return str(deleted)

    return asyncio.run(_run())
