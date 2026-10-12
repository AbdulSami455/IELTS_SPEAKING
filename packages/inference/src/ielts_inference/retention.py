"""Scheduled data minimisation.

Runs hourly from Celery beat. Three passes:

1. Raw and derivative audio past ``retention_expires_at`` is deleted from object
   storage and its answer transcript blanked.
2. Transcript text older than ``TRANSCRIPT_RETENTION_DAYS`` is blanked (reports
   keep their own quotes, which is what learners revisit).
3. Tests abandoned before recording (``CREATED``/``DEVICE_CHECK``) past their
   ``expires_at`` are marked ``EXPIRED`` so they stop counting as resumable.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from ielts_config import EnvironmentConfig
from ielts_db.models import Answer, MediaObject, TestSession, Transcript
from ielts_db.storage import ObjectStore
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

_logger = logging.getLogger(__name__)


async def reconcile_retention(session: AsyncSession, config: EnvironmentConfig) -> int:
    now = datetime.now(UTC)
    store = ObjectStore(config)
    result = await session.execute(
        select(MediaObject).where(
            MediaObject.retention_expires_at.is_not(None),
            MediaObject.retention_expires_at <= now,
            MediaObject.category.in_(("candidate", "derivative")),
        )
    )
    deleted = 0
    for media in result.scalars():
        try:
            store.delete(media.bucket, media.object_key)
        except Exception as exc:  # noqa: BLE001 - keep going; the row stays for the next run
            _logger.warning("retention delete failed key=%s error=%s", media.object_key, type(exc).__name__)
            continue
        answers = await session.execute(select(Answer).where(Answer.media_object_id == media.id))
        for answer in answers.scalars():
            transcripts = await session.execute(select(Transcript).where(Transcript.answer_id == answer.id))
            for transcript in transcripts.scalars():
                transcript.text = ""
                transcript.words = []
            answer.status = "DELETED"
            answer.media_object_id = None
        await session.delete(media)
        deleted += 1

    transcript_cutoff = now - timedelta(days=config.transcript_retention_days)
    blanked = await session.execute(
        update(Transcript)
        .where(Transcript.created_at <= transcript_cutoff, Transcript.text != "")
        .values(text="", words=[])
    )

    expired = await session.execute(
        update(TestSession)
        .where(
            TestSession.status.in_(("CREATED", "DEVICE_CHECK", "READY")),
            TestSession.expires_at <= now,
        )
        .values(status="EXPIRED")
    )
    await session.commit()
    _logger.info(
        "retention run: media_deleted=%s transcripts_blanked=%s tests_expired=%s",
        deleted,
        blanked.rowcount,
        expired.rowcount,
    )
    return deleted
