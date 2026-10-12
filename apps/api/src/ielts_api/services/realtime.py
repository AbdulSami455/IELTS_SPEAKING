"""Realtime speaking session service."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta

from ielts_audio.media import inspect_audio
from ielts_config import EnvironmentConfig
from ielts_db.models import Answer, ConversationEvent, MediaObject, RealtimeSession, SessionQuestion
from ielts_db.repositories import RealtimeSessionRepository, TestSessionRepository
from ielts_db.storage import ObjectStore
from ielts_domain import AnswerEvent, AnswerState, StateConflictError, TestState, apply_answer_transition
from ielts_inference.openrouter import InferenceError
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.errors import AppError, not_found, validation
from ielts_api.services.tests import TestService, _current_turn, serialize_test

_logger = logging.getLogger(__name__)

# Clients may only report playback and speaking telemetry. Transcript and prompt
# text are written by the server, so nothing a client sends can reach a prompt.
CLIENT_EVENT_TYPES = frozenset(
    {
        "examiner_playback_started",
        "examiner_playback_ended",
        "candidate_speaking_started",
        "candidate_speaking_stopped",
        "part2_prep_started",
        "part2_prep_completed",
        "client_reconnected",
        "client_note",
    }
)
CLIENT_SPEAKER_ROLES = frozenset({"system", "examiner", "candidate"})


class RealtimeSessionService:
    def __init__(self, session: AsyncSession, config: EnvironmentConfig, store: ObjectStore) -> None:
        self._session = session
        self._config = config
        self._store = store
        self._tests = TestSessionRepository(session)
        self._realtime = RealtimeSessionRepository(session)
        self._test_service = TestService(session, config, store)

    async def create_session(self, user_id: int, test_id: str) -> dict:
        test = await self._tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        if test.status == TestState.READY.value and not test.session_questions:
            await self._test_service.start_conversation(user_id, test_id)
            test = await self._tests.get_owned(test_id, user_id)
            assert test is not None
        live = await self._realtime.active_for_test(test_id)
        if live is None:
            from ielts_db.repositories import UserRepository

            user_repo = UserRepository(self._session)
            user = await user_repo.get_by_id(user_id)
            user_voice = getattr(user, "voice_preference", None) or self._config.realtime_tts_voice
            live = RealtimeSession(
                id=str(uuid.uuid4()),
                test_session_id=test.id,
                transport=self._config.realtime_transport,
                status="ACTIVE",
                current_phase=test.status,
                llm_model=self._config.realtime_llm_model,
                stt_model=self._config.realtime_stt_model,
                tts_model=self._config.realtime_tts_model,
                tts_voice=user_voice,
                session_notes={"mode": "internal-realtime-agent"},
            )
            self._session.add(live)
            self._append_event(test, live, "system", "session_started", payload={"transport": live.transport})
        else:
            live.current_phase = test.status
        turn = _current_turn(sorted(test.session_questions, key=lambda item: (item.sort_order, item.id)))
        examiner_playback_url = None
        if turn is not None and test.status != TestState.PART2_SPEAK.value:
            self._ensure_examiner_prompt_event(test, live, turn)
            examiner_playback_url = await self._examiner_playback_url(user_id, test.id, str(turn.id))
        await self._session.commit()
        return {
            "session_id": live.id,
            "transport": live.transport,
            "state": live.status,
            "phase": test.status,
            "llm_model": live.llm_model,
            "stt_model": live.stt_model,
            "tts_model": live.tts_model,
            "tts_voice": live.tts_voice,
            "ws_url": f"/v1/tests/{test.id}/realtime/live",
            "examiner_playback_url": examiner_playback_url,
            "current_turn_id": str(turn.id) if turn is not None else None,
            "test": serialize_test(test),
        }

    async def ingest_event(self, user_id: int, test_id: str, payload: dict) -> dict:
        test = await self._tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        live = await self._realtime.active_for_test(test_id)
        event_type = payload["event_type"]
        speaker_role = payload.get("speaker_role") or "system"
        if event_type not in CLIENT_EVENT_TYPES or speaker_role not in CLIENT_SPEAKER_ROLES:
            raise validation("Unsupported client event")
        self._append_event(
            test,
            live,
            speaker_role,
            event_type,
            provider_event_id=payload.get("provider_event_id"),
            transcript_text=None,
            prompt_text=None,
            payload=payload.get("payload") or {},
            started_at=self._parse_datetime(payload.get("started_at")),
            ended_at=self._parse_datetime(payload.get("ended_at")),
            latency_ms=payload.get("latency_ms"),
        )
        await self._session.commit()
        return {"accepted": True}

    async def upload_turn_audio(
        self,
        user_id: int,
        test_id: str,
        turn_id: str,
        audio: bytes,
        mime_type: str,
    ) -> dict:
        if not mime_type or not mime_type.startswith("audio/"):
            raise validation("Only audio/* MIME types are accepted for STT processing")
        test = await self._tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        live = await self._realtime.active_for_test(test_id)
        turn = next((item for item in test.session_questions if str(item.id) == turn_id), None)
        if turn is None or turn.answer is None:
            raise not_found("Turn not found")
        answer = turn.answer
        recorded = answer.status in {AnswerState.VALID.value, AnswerState.READY.value}
        if not recorded:
            extension = self._extension_for_mime(mime_type)
            if len(audio) < 2500:
                raise validation("Recording failed validation (too-small)")
            if len(audio) > self._config.upload_max_bytes_per_answer:
                raise validation("Recording failed validation (too-large)")
            stored_total = sum(
                item.media_object.size_bytes or 0
                for item in test.answers
                if item.media_object is not None and item.id != answer.id
            )
            if stored_total + len(audio) > self._config.upload_max_bytes_per_test:
                raise validation("This test has reached its total recording limit")
            inspected = inspect_audio(audio, extension)
            if not inspected["ok"] and inspected["reason"] != "unprobed":
                raise validation(f"Recording failed validation ({inspected['reason']})")
            self._prepare_answer_for_upload(answer)
            object_key = f"tests/{test_id}/answers/{answer.id}{extension}"
            retention_expires_at = datetime.now(UTC) + timedelta(days=self._config.raw_audio_retention_days)
            if answer.media_object is None:
                media = MediaObject(
                    bucket=self._config.minio_candidate_bucket,
                    object_key=object_key,
                    category="candidate",
                    content_sha256=hashlib.sha256(audio).hexdigest(),
                    mime_type=mime_type,
                    size_bytes=len(audio),
                    retention_expires_at=retention_expires_at,
                )
                self._session.add(media)
                await self._session.flush()
                answer.media_object_id = media.id
            else:
                answer.media_object.bucket = self._config.minio_candidate_bucket
                answer.media_object.object_key = object_key
                answer.media_object.mime_type = mime_type
                answer.media_object.size_bytes = len(audio)
                answer.media_object.content_sha256 = hashlib.sha256(audio).hexdigest()
                answer.media_object.retention_expires_at = retention_expires_at
            await asyncio.to_thread(
                self._store.put_bytes, self._config.minio_candidate_bucket, object_key, audio, mime_type
            )
            completed = apply_answer_transition(AnswerState(answer.status), AnswerEvent.UPLOAD_COMPLETE)
            validating_state = apply_answer_transition(completed.new_state, AnswerEvent.VALIDATE)
            valid = apply_answer_transition(validating_state.new_state, AnswerEvent.MARK_VALID)
            answer.status = valid.new_state.value
            answer.recorded_at = datetime.now(UTC)
            answer.upload_completed_at = datetime.now(UTC)
            answer.validated_at = datetime.now(UTC)
            self._append_event(
                test,
                live,
                "candidate",
                "candidate_turn_completed",
                transcript_text=None,
                media_object_id=answer.media_object_id,
                started_at=answer.recorded_at,
                ended_at=answer.upload_completed_at,
            )
            await self._session.commit()
            test = await self._tests.get_owned(test_id, user_id)
            assert test is not None
            live = await self._realtime.active_for_test(test_id)
            turn = next((item for item in test.session_questions if str(item.id) == turn_id), None)
            assert turn is not None and turn.answer is not None
            answer = turn.answer
        await self._ensure_answer_transcript(test, answer, audio)
        if answer.transcript is None or not (answer.transcript.text or "").strip():
            # Inline transcription failed; let the worker retry so the report is still complete.
            from ielts_api.jobs import enqueue_transcribe

            enqueue_transcribe(user_id, test_id, answer.id)
        try:
            await self._test_service.conversation.on_answer_completed(test, answer)
        except (InferenceError, StateConflictError) as extra:
            await self._session.commit()
            if isinstance(extra, InferenceError):
                # Provider details stay in the logs; learners get a plain, actionable message.
                _logger.warning("conversation step failed test=%s error=%s", test_id, extra)
                raise AppError(
                    "CONVERSATION_STEP_FAILED",
                    "The examiner couldn’t process that answer. Please try again.",
                    502,
                    retryable=extra.retryable,
                ) from extra
            raise AppError("CONVERSATION_STEP_FAILED", "The session moved on. Reload and continue.", 409, retryable=True) from extra
        await self._session.flush()
        next_test = await self._tests.get_owned(test_id, user_id)
        assert next_test is not None
        if live is not None:
            live.current_phase = next_test.status
        next_turn = _current_turn(sorted(next_test.session_questions, key=lambda item: (item.sort_order, item.id)))
        next_audio = None
        if next_turn is not None and next_test.status not in {TestState.PART2_SPEAK.value, TestState.UPLOADING.value}:
            self._ensure_examiner_prompt_event(next_test, live, next_turn)
            try:
                next_audio = await self._examiner_playback_url(user_id, test_id, str(next_turn.id))
            except AppError as exc:
                if exc.code != "EXAMINER_TTS_FAILED":
                    raise
                next_audio = None
        if live is not None and next_test.status == TestState.UPLOADING.value:
            live.status = "FINISHED"
            live.finished_at = datetime.now(UTC)
        await self._session.commit()
        saved = await self._tests.get_owned(test_id, user_id)
        assert saved is not None
        return {
            "test": serialize_test(saved),
            "examiner_playback_url": next_audio,
            "next_turn_id": str(next_turn.id) if next_turn is not None else None,
        }

    def _prepare_answer_for_upload(self, answer: Answer) -> None:
        if answer.status == AnswerState.PENDING.value:
            started = apply_answer_transition(AnswerState.PENDING, AnswerEvent.START_RECORDING)
            stopped = apply_answer_transition(started.new_state, AnswerEvent.STOP_RECORDING)
            authorized = apply_answer_transition(stopped.new_state, AnswerEvent.UPLOAD_START)
            answer.status = authorized.new_state.value
            return
        if answer.status == AnswerState.RECORDING.value:
            stopped = apply_answer_transition(AnswerState.RECORDING, AnswerEvent.STOP_RECORDING)
            authorized = apply_answer_transition(stopped.new_state, AnswerEvent.UPLOAD_START)
            answer.status = authorized.new_state.value
            return
        if answer.status != AnswerState.UPLOAD_AUTHORIZED.value:
            authorized = apply_answer_transition(AnswerState(answer.status), AnswerEvent.UPLOAD_START)
            answer.status = authorized.new_state.value

    def _ensure_examiner_prompt_event(
        self,
        test,
        live: RealtimeSession | None,
        turn: SessionQuestion,
    ) -> None:
        exists = any(
            item.event_type == "examiner_prompt"
            and item.prompt_text == turn.prompt_text
            and item.sequence_index > 0
            for item in test.conversation_events
        )
        if exists:
            return
        self._append_event(
            test,
            live,
            "examiner",
            "examiner_prompt",
            prompt_text=turn.prompt_text,
            started_at=datetime.now(UTC),
        )

    def _append_event(
        self,
        test,
        live: RealtimeSession | None,
        speaker_role: str,
        event_type: str,
        *,
        provider_event_id: str | None = None,
        transcript_text: str | None = None,
        prompt_text: str | None = None,
        payload: dict | None = None,
        media_object_id: int | None = None,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
        latency_ms: int | None = None,
    ) -> ConversationEvent:
        event = ConversationEvent(
            realtime_session_id=live.id if live is not None else None,
            test_session_id=test.id,
            media_object_id=media_object_id,
            phase=test.status,
            speaker_role=speaker_role,
            event_type=event_type,
            sequence_index=len(test.conversation_events) + 1,
            transcript_text=transcript_text,
            prompt_text=prompt_text,
            provider_event_id=provider_event_id,
            payload=payload,
            started_at=started_at,
            ended_at=ended_at,
            latency_ms=latency_ms,
        )
        test.conversation_events.append(event)
        self._session.add(event)
        return event

    async def _ensure_answer_transcript(
        self,
        test,
        answer: Answer,
        audio: bytes | None,
    ) -> None:
        if answer.transcript is not None and (answer.transcript.text or "").strip():
            return
        payload = audio
        if payload is None and answer.media_object is not None:
            payload = self._store.get_bytes(answer.media_object.bucket, answer.media_object.object_key)
        if not payload:
            return
        try:
            await self._test_service.persist_transcript(test, answer, payload)
            await self._session.flush()
        except InferenceError:
            # Conversation can still advance; worker transcription may catch up later.
            return

    async def _examiner_playback_url(self, user_id: int, test_id: str, turn_id: str) -> str:
        audio = await self._test_service.examiner_audio(user_id, test_id, turn_id)
        return str(audio["playback_url"])

    @staticmethod
    def _extension_for_mime(mime_type: str) -> str:
        if "wav" in mime_type:
            return ".wav"
        if "mpeg" in mime_type or "mp3" in mime_type:
            return ".mp3"
        if "ogg" in mime_type:
            return ".ogg"
        return ".webm"

    @staticmethod
    def _parse_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
