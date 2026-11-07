"""Retention: expired audio is deleted from storage and its transcript text is blanked."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

pytestmark = pytest.mark.postgres


async def test_reconcile_retention_deletes_expired_media_and_blanks_text(migrated_db, monkeypatch):
    from ielts_config import get_config
    from ielts_db.database import DatabaseConfig
    from ielts_db.models import Answer, MediaObject, SessionQuestion, TestSession, Transcript, User
    from ielts_inference import retention

    deleted_keys: list[tuple[str, str]] = []

    class FakeStore:
        def __init__(self, config):
            pass

        def delete(self, bucket: str, key: str) -> None:
            deleted_keys.append((bucket, key))

    monkeypatch.setattr(retention, "ObjectStore", FakeStore)
    config = get_config()
    db = DatabaseConfig()  # DATABASE_URL is pinned to TEST_DATABASE_URL by conftest
    now = datetime.now(UTC)
    suffix = uuid.uuid4().hex[:8]
    try:
        async with db.session_factory() as session:
            user = User(auth_subject=f"retention-{suffix}", email=f"retention-{suffix}@example.com", display_name="R")
            session.add(user)
            await session.flush()
            test = TestSession(id=str(uuid.uuid4()), user_id=user.id, status="COMPLETED", expires_at=now + timedelta(days=1))
            session.add(test)
            await session.flush()
            question = SessionQuestion(test_session_id=test.id, prompt_text="Q?", part=1, sort_order=0)
            question2 = SessionQuestion(test_session_id=test.id, prompt_text="Q2?", part=1, sort_order=1)
            session.add_all([question, question2])
            expired = MediaObject(
                bucket=config.minio_candidate_bucket, object_key=f"tests/{test.id}/expired.webm", category="candidate",
                content_sha256="a" * 64, mime_type="audio/webm", size_bytes=10, retention_expires_at=now - timedelta(days=1),
            )
            fresh = MediaObject(
                bucket=config.minio_candidate_bucket, object_key=f"tests/{test.id}/fresh.webm", category="candidate",
                content_sha256="b" * 64, mime_type="audio/webm", size_bytes=10, retention_expires_at=now + timedelta(days=5),
            )
            orphan = MediaObject(
                bucket=config.minio_candidate_bucket, object_key=f"tests/{test.id}/orphan.webm", category="candidate",
                content_sha256="pending", mime_type="audio/webm", size_bytes=0, retention_expires_at=None,
                created_at=now - timedelta(days=config.raw_audio_retention_days + 1),
            )
            session.add_all([expired, fresh, orphan])
            await session.flush()
            old_answer = Answer(id=str(uuid.uuid4()), test_session_id=test.id, session_question_id=question.id, media_object_id=expired.id, status="VALID")
            new_answer = Answer(id=str(uuid.uuid4()), test_session_id=test.id, session_question_id=question2.id, media_object_id=fresh.id, status="VALID")
            session.add_all([old_answer, new_answer])
            await session.flush()
            session.add_all(
                [
                    Transcript(answer_id=old_answer.id, part=1, evaluator_version="v", language="en", model_policy_version="p", text="old words", words=[{"w": "old"}]),
                    Transcript(answer_id=new_answer.id, part=1, evaluator_version="v", language="en", model_policy_version="p", text="new words", words=[]),
                ]
            )
            test_id, old_id, new_id, expired_id, fresh_id = test.id, old_answer.id, new_answer.id, expired.id, fresh.id
            await session.commit()

        async with db.session_factory() as session:
            deleted = await retention.reconcile_retention(session, config)
            await session.commit()

        assert deleted == 2
        assert sorted(deleted_keys) == sorted(
            [(config.minio_candidate_bucket, f"tests/{test_id}/expired.webm"), (config.minio_candidate_bucket, f"tests/{test_id}/orphan.webm")]
        )

        async with db.session_factory() as session:
            assert await session.get(MediaObject, expired_id) is None
            assert await session.get(MediaObject, fresh_id) is not None
            old = await session.scalar(select(Transcript).where(Transcript.answer_id == old_id))
            new = await session.scalar(select(Transcript).where(Transcript.answer_id == new_id))
            assert old is not None and old.text == "" and old.words == []
            assert new is not None and new.text == "new words"
            old_answer_row = await session.get(Answer, old_id)
            assert old_answer_row is not None and old_answer_row.status == "DELETED" and old_answer_row.media_object_id is None
    finally:
        await db.dispose()
