"""Delete expired candidate/derivative objects, then protected transcript text."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_config import EnvironmentConfig
from ielts_db.models import Answer, MediaObject, Transcript
from ielts_db.storage import ObjectStore


async def reconcile_retention(session: AsyncSession, config: EnvironmentConfig) -> int:
    now = datetime.now(timezone.utc)
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
        store.delete(media.bucket, media.object_key)
        answers = await session.execute(select(Answer).where(Answer.media_object_id == media.id))
        for answer in answers.scalars():
            transcripts = await session.execute(select(Transcript).where(Transcript.answer_id == answer.id))
            for transcript in transcripts.scalars():
                transcript.text = ""
                transcript.words = []
            answer.status = "DELETED"
        await session.delete(media)
        deleted += 1
    await session.commit()
    return deleted
