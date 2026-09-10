"""Test session application service."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.errors import AppError, conflict, not_found, validation
from ielts_api.services.conversation import ConversationOrchestrator
from ielts_audio.media import inspect_audio
from ielts_config import EnvironmentConfig
from ielts_db.models import Answer, MediaObject, Report, SessionQuestion, TestSession, Transcript
from ielts_db.repositories import (
    AnswerRepository,
    ProgressRepository,
    ReportRepository,
    TestSessionRepository,
    UserRepository,
)
from ielts_db.keys import examiner_object_key
from ielts_db.storage import ObjectStore
from ielts_domain import (
    AnswerEvent,
    AnswerState,
    StateConflictError,
    TestEvent,
    TestState,
    apply_answer_transition,
    apply_transition,
)
from ielts_inference.evaluation import PUBLIC_STAGES
from ielts_inference.assembler import EVALUATOR_VERSION
from ielts_inference.report_compare import compare_reports
from ielts_inference.score_summary import summarize_scores
from ielts_inference.openrouter import InferenceError, OpenRouterClient
from ielts_inference.transcript import clean_transcript


def _examiner_script(question: SessionQuestion) -> str:
    lines = [question.prompt_text]
    cue = question.cue_card if isinstance(question.cue_card, dict) else {}
    title = cue.get("title")
    if title:
        lines.append(str(title))
    for item in cue.get("prompts") or []:
        lines.append(str(item))
    return " ".join(part for part in lines if part)


def permitted_actions(state: str) -> list[str]:
    from ielts_domain.test_session import _TRANSITION_TABLE

    current = TestState(state)
    return sorted({event.value for (src, event), _dst in _TRANSITION_TABLE.items() if src == current})


def _loaded_transcript_text(answer: Answer | None) -> str | None:
    if answer is None:
        return None
    loaded = inspect(answer).dict.get("transcript")
    if loaded is None:
        return None
    return loaded.text


def _serialize_turn(question: SessionQuestion) -> dict:
    answer = question.answer
    return {
        "id": str(question.id),
        "answer_id": answer.id if answer else "",
        "part": question.part,
        "sort_order": question.sort_order,
        "prompt_text": question.prompt_text,
        "timing_seconds": question.timing_seconds,
        "cue_card": question.cue_card,
        "follow_ups": question.follow_ups,
        "answer_status": answer.status if answer else "PENDING",
        "has_examiner_audio": True,
        "is_follow_up": question.examiner_asset_version == "follow-up",
        "is_intro": question.examiner_asset_version == "intro",
        "playback_available": bool(
            answer and answer.status in {AnswerState.VALID.value, AnswerState.READY.value}
        ),
        "transcript_text": _loaded_transcript_text(answer),
    }


def _current_turn(questions: list[SessionQuestion]) -> SessionQuestion | None:
    for question in questions:
        answer = question.answer
        if answer is not None and answer.status not in {AnswerState.VALID.value, AnswerState.READY.value}:
            return question
    return questions[-1] if questions else None


def serialize_test(test: TestSession) -> dict:
    questions = sorted(test.session_questions, key=lambda item: (item.sort_order, item.id))
    payload = [_serialize_turn(question) for question in questions]
    active = _current_turn(questions)
    return {
        "test_id": test.id,
        "state": test.status,
        "revision": test.revision,
        "turns": payload,
        "current_turn": _serialize_turn(active) if active else None,
        "permitted_actions": permitted_actions(test.status),
        "started_at": test.created_at.isoformat() if test.created_at else None,
        "expires_at": test.expires_at.isoformat() if test.expires_at else None,
        "report_id": test.report.id if test.report and test.status == TestState.COMPLETED.value else None,
        "part2_prep_seconds": 60,
    }


class TestService:
    def __init__(self, session: AsyncSession, config: EnvironmentConfig, store: ObjectStore) -> None:
        self.session = session
        self.config = config
        self.store = store
        self.tests = TestSessionRepository(session)
        self.answers = AnswerRepository(session)
        self.reports = ReportRepository(session)
        self.users = UserRepository(session)
        self.progress = ProgressRepository(session)
        self.conversation = ConversationOrchestrator(session, config)

    async def create_test(self, user_id: int, slug: str | None = None) -> dict:
        test_id = str(uuid.uuid4())
        test = TestSession(
            id=test_id,
            user_id=user_id,
            question_set_id=None,
            status=TestState.CREATED.value,
            revision=0,
            expires_at=datetime.now(timezone.utc) + timedelta(days=2),
            topic_plan=None,
        )
        self.session.add(test)
        start = apply_transition(
            TestState.CREATED,
            TestEvent.START_DEVICE_CHECK,
            expected_revision=0,
            current_revision=0,
        )
        test.status = start.new_state.value
        test.revision = start.new_revision
        await self.session.commit()
        created = await self.tests.get_owned(test_id, user_id)
        if created is None:
            raise not_found()
        return serialize_test(created)

    async def list_question_sets(self) -> list[dict]:
        return []

    async def get_test(self, user_id: int, test_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        return serialize_test(test)

    async def list_tests(self, user_id: int) -> list[dict]:
        rows = await self.tests.list_owned(user_id, 50)
        return [
            {
                "test_id": row.id,
                "state": row.status,
                "revision": row.revision,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "report_id": None,
            }
            for row in rows
        ]

    async def device_check(self, user_id: int, test_id: str, payload: dict) -> dict:
        if not payload.get("microphone_available"):
            raise validation("A microphone is required")
        if payload.get("silence_ratio", 0) > 0.95:
            raise validation("The sample sounded silent. Check your microphone.")
        if payload.get("clipping_ratio", 0) > 0.2:
            raise validation("The sample was clipped. Move farther from the microphone.")
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        state = TestState(test.status)
        if state in {
            TestState.READY,
            TestState.PART1,
            TestState.PART2_PREP,
            TestState.PART2_SPEAK,
            TestState.PART3,
            TestState.UPLOADING,
            TestState.SUBMITTED,
            TestState.PROCESSING,
            TestState.COMPLETED,
        }:
            return serialize_test(test)
        if state == TestState.CREATED:
            started = apply_transition(
                TestState.CREATED,
                TestEvent.START_DEVICE_CHECK,
                expected_revision=test.revision,
                current_revision=test.revision,
            )
            test.status = started.new_state.value
            test.revision = started.new_revision
            state = TestState.DEVICE_CHECK
        try:
            transition = apply_transition(
                state,
                TestEvent.COMPLETE_DEVICE_CHECK,
                expected_revision=test.revision,
                current_revision=test.revision,
            )
        except StateConflictError as exc:
            raise conflict(str(exc)) from exc
        test.status = transition.new_state.value
        test.revision = transition.new_revision
        await self.session.commit()
        updated = await self.tests.get_owned(test_id, user_id)
        assert updated is not None
        return serialize_test(updated)

    async def transition(self, user_id: int, test_id: str, event_name: str, expected_revision: int) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        try:
            event = TestEvent(event_name.upper())
        except ValueError as exc:
            raise validation("Unknown event") from exc
        try:
            result = apply_transition(
                TestState(test.status),
                event,
                expected_revision=expected_revision,
                current_revision=test.revision,
            )
        except StateConflictError as exc:
            raise conflict(str(exc)) from exc
        test.status = result.new_state.value
        test.revision = result.new_revision
        await self.session.commit()
        updated = await self.tests.get_owned(test_id, user_id)
        assert updated is not None
        return serialize_test(updated)

    async def start_conversation(self, user_id: int, test_id: str, practice_mode: bool = False) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        if test.status == TestState.READY.value and not test.session_questions:
            try:
                await self.conversation.start(test)
            except InferenceError as exc:
                raise AppError("EXAMINER_GENERATION_FAILED", str(exc), 502, retryable=exc.retryable) from exc
            await self.session.commit()
            updated = await self.tests.get_owned(test_id, user_id)
            assert updated is not None
            result = serialize_test(updated)
            result["practice_mode"] = practice_mode
            return result
        return serialize_test(test)

    async def authorize_turn_upload(self, user_id: int, test_id: str, turn_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        question = next((item for item in test.session_questions if str(item.id) == turn_id), None)
        if question is None or question.answer is None:
            raise not_found("Turn not found")
        return await self.authorize_upload(user_id, test_id, question.answer.id)

    async def retake_turn(self, user_id: int, test_id: str, turn_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        question = next((item for item in test.session_questions if str(item.id) == turn_id), None)
        if question is None or question.answer is None:
            raise not_found("Turn not found")
        answer = question.answer
        state = AnswerState(answer.status)
        if state not in {
            AnswerState.INVALID_MEDIA,
            AnswerState.FAILED_RETRYABLE,
            AnswerState.READY,
            AnswerState.VALID,
        }:
            raise conflict("Retake is available after a completed or failed answer")
        if answer.transcript is not None:
            await self.session.delete(answer.transcript)
        answer.status = AnswerState.PENDING.value
        answer.recorded_at = None
        answer.upload_completed_at = None
        answer.validated_at = None
        answer.validation_error_code = None
        await self.session.commit()
        updated = await self.tests.get_owned(test_id, user_id)
        assert updated is not None
        return serialize_test(updated)

    async def complete_turn_upload(self, user_id: int, test_id: str, turn_id: str, payload: dict) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        question = next((item for item in test.session_questions if str(item.id) == turn_id), None)
        if question is None or question.answer is None:
            raise not_found("Turn not found")
        return await self.complete_upload(user_id, test_id, question.answer.id, payload)

    async def authorize_upload(self, user_id: int, test_id: str, answer_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        answer = await self.answers.get_owned(answer_id, test_id)
        if answer is None:
            raise not_found("Answer not found")
        if answer.status in {AnswerState.PENDING.value}:
            started = apply_answer_transition(AnswerState.PENDING, AnswerEvent.START_RECORDING)
            stopped = apply_answer_transition(started.new_state, AnswerEvent.STOP_RECORDING)
            answer.status = stopped.new_state.value
        elif answer.status == AnswerState.RECORDING.value:
            stopped = apply_answer_transition(AnswerState.RECORDING, AnswerEvent.STOP_RECORDING)
            answer.status = stopped.new_state.value
        if answer.status != AnswerState.UPLOAD_AUTHORIZED.value:
            authorized = apply_answer_transition(AnswerState(answer.status), AnswerEvent.UPLOAD_START)
            answer.status = authorized.new_state.value
        object_key = f"tests/{test_id}/answers/{answer_id}.webm"
        if answer.media_object is None:
            media = MediaObject(
                bucket=self.config.minio_candidate_bucket,
                object_key=object_key,
                category="candidate",
                content_sha256="pending",
                mime_type="audio/webm",
                size_bytes=0,
            )
            self.session.add(media)
            await self.session.flush()
            answer.media_object_id = media.id
        await self.session.commit()
        url = self.store.presigned_put(self.config.minio_candidate_bucket, object_key)
        return {
            "upload_url": url,
            "method": "PUT",
            "headers": {"Content-Type": "audio/webm"},
            "max_bytes": self.config.upload_max_bytes_per_answer,
            "expires_in_seconds": self.config.minio_signed_url_ttl_seconds,
        }

    async def complete_upload(self, user_id: int, test_id: str, answer_id: str, payload: dict) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        answer = await self.answers.get_owned(answer_id, test_id)
        if answer is None:
            raise not_found("Answer not found")
        if answer.status == AnswerState.VALID.value:
            updated = await self.tests.get_owned(test_id, user_id)
            assert updated is not None
            return serialize_test(updated)
        if payload["size_bytes"] <= 0 or payload["size_bytes"] > self.config.upload_max_bytes_per_answer:
            raise validation("Recording size is outside allowed limits")
        object_key = f"tests/{test_id}/answers/{answer_id}.webm"
        head = self.store.head(self.config.minio_candidate_bucket, object_key)
        if not head.exists:
            raise validation("Uploaded object was not found in private storage")
        audio = self.store.get_bytes(self.config.minio_candidate_bucket, object_key)
        inspected = inspect_audio(audio, ".webm")
        if not inspected["ok"]:
            raise validation(f"Recording failed validation ({inspected['reason']})")
        completed = apply_answer_transition(AnswerState(answer.status), AnswerEvent.UPLOAD_COMPLETE)
        validating = apply_answer_transition(completed.new_state, AnswerEvent.VALIDATE)
        valid = apply_answer_transition(validating.new_state, AnswerEvent.MARK_VALID)
        answer.status = valid.new_state.value
        answer.upload_completed_at = datetime.now(timezone.utc)
        answer.validated_at = datetime.now(timezone.utc)
        if answer.media_object is not None:
            answer.media_object.size_bytes = payload["size_bytes"]
            answer.media_object.mime_type = payload["mime_type"]
            answer.media_object.content_sha256 = payload["content_sha256"] or hashlib.sha256(object_key.encode()).hexdigest()
            answer.media_object.retention_expires_at = datetime.now(timezone.utc) + timedelta(days=self.config.raw_audio_retention_days)
        try:
            await self._transcribe_and_advance(test, answer, audio)
        except InferenceError as exc:
            raise AppError("CONVERSATION_STEP_FAILED", str(exc), 502, retryable=exc.retryable) from exc
        await self.session.commit()
        updated = await self.tests.get_owned(test_id, user_id)
        assert updated is not None
        return serialize_test(updated)

    async def persist_transcript(self, test: TestSession, answer: Answer, audio: bytes) -> Transcript:
        from ielts_audio.media import normalize_to_wav
        from ielts_inference.assembler import EVALUATOR_VERSION
        from ielts_inference.quota import reserve_model_call

        question = answer.session_question
        if question is None:
            raise validation("Answer is missing its question")
        if answer.transcript is not None and answer.transcript.text:
            return answer.transcript
        client = OpenRouterClient(self.config)
        suffix = ".wav" if audio[:4] == b"RIFF" else ".webm"
        wav = normalize_to_wav(audio, suffix)
        fmt = "wav" if wav[:4] == b"RIFF" else suffix.lstrip(".")
        await reserve_model_call(self.session, test.user_id, test.id, "transcription", self.config)
        result = client.transcribe(wav if fmt == "wav" else audio, fmt)
        text = clean_transcript(result.text)
        existing = await self.session.execute(select(Transcript).where(Transcript.answer_id == answer.id))
        saved = existing.scalar_one_or_none()
        if saved is None:
            saved = Transcript(
                answer_id=answer.id,
                part=question.part,
                evaluator_version=EVALUATOR_VERSION,
                text=text,
                words=result.words,
                model_policy_version=self.config.openrouter_stt_model[:50],
            )
            self.session.add(saved)
        saved.text = text
        saved.words = result.words
        answer.transcript = saved
        await self.session.flush()
        return saved

    async def transcribe_saved_answer(self, user_id: int, test_id: str, answer_id: str) -> None:
        test = await self.tests.get_owned(test_id, user_id)
        answer = await self.answers.get_owned(answer_id, test_id)
        if test is None or answer is None or answer.media_object is None:
            return
        audio = self.store.get_bytes(answer.media_object.bucket, answer.media_object.object_key)
        await self.persist_transcript(test, answer, audio)
        await self.session.commit()

    async def _transcribe_and_advance(self, test: TestSession, answer: Answer, audio: bytes) -> None:
        await self.persist_transcript(test, answer, audio)
        await self.session.commit()
        refreshed = await self.tests.get_owned(test.id, test.user_id)
        if refreshed is None:
            return
        next_answer = next((item for item in refreshed.answers if item.id == answer.id), None)
        if next_answer is None:
            return
        await self.conversation.on_answer_completed(refreshed, next_answer)

    async def submit(self, user_id: int, test_id: str, practice_mode: bool = False) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        for answer in test.answers:
            if answer.status not in {AnswerState.VALID.value, AnswerState.READY.value, AnswerState.DELETED.value}:
                answer.status = AnswerState.DELETED.value
        answers = [item for item in test.answers if item.status in {AnswerState.VALID.value, AnswerState.READY.value}]
        if not answers:
            raise conflict("Speak at least one answer before finishing")
        current = TestState(test.status)
        for state, event in (
            (TestState.READY, TestEvent.READY_TO_START),
            (TestState.PART1, TestEvent.COMPLETE_PART1),
            (TestState.PART2_PREP, TestEvent.COMPLETE_PART2_PREP),
            (TestState.PART2_SPEAK, TestEvent.COMPLETE_PART2_SPEAK),
            (TestState.PART3, TestEvent.COMPLETE_PART3),
            (TestState.UPLOADING, TestEvent.SUBMIT),
        ):
            if current == state:
                step = apply_transition(
                    current,
                    event,
                    expected_revision=test.revision,
                    current_revision=test.revision,
                )
                test.status = step.new_state.value
                test.revision = step.new_revision
                current = step.new_state
        if current != TestState.SUBMITTED:
            raise conflict(f"Cannot submit from {current}")
        if not practice_mode:
            from ielts_api.errors import AppError
            from ielts_inference.openrouter import InferenceError
            from ielts_inference.quota import assert_capacity

            try:
                await assert_capacity(self.session, user_id, self.config)
            except InferenceError as extra:
                raise AppError("BUDGET_EXCEEDED", str(extra), 402) from extra
        await self.session.commit()
        updated = await self.tests.get_owned(test_id, user_id)
        assert updated is not None
        result = serialize_test(updated)
        result["practice_mode"] = practice_mode
        return result

    async def status(self, user_id: int, test_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        stage = "recording"
        progress = 20
        if test.status in {TestState.SUBMITTED.value, TestState.PROCESSING.value}:
            stage = "validating_audio"
            progress = 10
            jobs = sorted(test.processing_jobs, key=lambda item: item.created_at, reverse=True)
            if jobs and isinstance(jobs[0].payload, dict):
                stage = str(jobs[0].payload.get("stage") or stage)
                progress = int(jobs[0].payload.get("progress") or progress)
                if stage not in PUBLIC_STAGES:
                    stage = "validating_audio"
        if test.status == TestState.COMPLETED.value:
            stage = "completed"
            progress = 100
        if test.status == TestState.FAILED.value:
            stage = "failed"
            progress = 100
        error = None
        if test.processing_jobs:
            latest = sorted(test.processing_jobs, key=lambda item: item.created_at, reverse=True)[0]
            error = latest.error_message
        return {
            "test_id": test.id,
            "state": test.status,
            "stage": stage,
            "progress": progress,
            "report_id": test.report.id if test.report and test.status == TestState.COMPLETED.value else None,
            "error": error,
        }

    async def examiner_audio(self, user_id: int, test_id: str, question_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        question = next((item for item in test.session_questions if str(item.id) == question_id), None)
        if question is None:
            raise not_found("Question not found")
        user_voice = getattr(await self.users.get_by_id(user_id), "voice_preference", None) or self.config.openrouter_tts_voice
        object_key = examiner_object_key(
            _examiner_script(question),
            question.examiner_asset_version or "v1",
            model=self.config.openrouter_tts_model,
            voice=user_voice,
        )
        head = self.store.head(self.config.minio_examiner_bucket, object_key)
        if not head.exists:
            from ielts_api.errors import AppError
            from ielts_inference.openrouter import InferenceError, OpenRouterClient
            from ielts_inference.quota import reserve_model_call

            try:
                await reserve_model_call(self.session, user_id, test_id, "tts", self.config)
                client = OpenRouterClient(self.config)
                audio, content_type = client.synthesize(_examiner_script(question))
                self.store.put_bytes(self.config.minio_examiner_bucket, object_key, audio, content_type)
                await self.session.commit()
            except InferenceError as extra:
                raise AppError("EXAMINER_TTS_FAILED", str(extra), 502, retryable=True) from extra
        url = self.store.presigned_get(self.config.minio_examiner_bucket, object_key)
        return {
            "playback_url": url,
            "expires_in_seconds": self.config.minio_signed_url_ttl_seconds,
        }

    async def answer_playback(self, user_id: int, test_id: str, answer_id: str) -> dict:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        answer = await self.answers.get_owned(answer_id, test_id)
        if answer is None:
            raise not_found("Answer not found")
        if answer.status not in {AnswerState.VALID.value, AnswerState.READY.value}:
            raise conflict("Playback is available after the recording is uploaded")
        object_key = f"tests/{test_id}/answers/{answer_id}.webm"
        head = self.store.head(self.config.minio_candidate_bucket, object_key)
        if not head.exists:
            raise not_found("Recording is not in storage")
        url = self.store.presigned_get(self.config.minio_candidate_bucket, object_key)
        return {
            "playback_url": url,
            "expires_in_seconds": self.config.minio_signed_url_ttl_seconds,
        }

    async def reassess_report(self, user_id: int, report_id: str) -> str:
        report = await self.reports.get_by_id(report_id)
        if report is None:
            raise not_found("Report not found")
        await self.session.execute(
            select(TestSession.id).where(
                TestSession.id == report.test_session_id, TestSession.user_id == user_id,
            ).with_for_update()
        )
        test = await self.tests.get_owned(report.test_session_id, user_id)
        if test is None:
            raise not_found("Report not found")
        if test.status not in {TestState.COMPLETED.value, TestState.FAILED.value}:
            raise conflict("This test is already being processed")
        if not test.answers or any(answer.media_object is None for answer in test.answers):
            raise validation("Saved recordings are unavailable. Please start a new test.")
        test.status = TestState.SUBMITTED.value
        test.revision += 1
        await self.session.commit()
        return test.id

    async def get_report(self, user_id: int, report_id: str) -> dict:
        report = await self.reports.get_by_id(report_id)
        if report is None:
            raise not_found("Report not found")
        test = await self.tests.get_owned(report.test_session_id, user_id)
        if test is None:
            raise not_found("Report not found")
        criteria = await self.reports.list_criteria(test.id)
        criteria_payload = [
            {
                "criterion": item.criterion,
                "band": item.band if item.confidence != "inconclusive" else None,
                "confidence": item.confidence,
                "subdimensions": [
                    {"key": key, "band": value} for key, value in (item.subdimensions or {}).items()
                ],
                "evidence": item.evidence or [],
            }
            for item in criteria
        ]
        parts = report.parts or {}
        minor_improvements = parts.get("minor_improvements") or []
        progress_comparison = {"has_previous": False}
        previous = await self.reports.previous_comparable(
            user_id, report.created_at, report.evaluator_version,
        )
        if previous is not None:
            _prev_test, prev_report = previous
            prev_criteria = await self.reports.list_criteria(_prev_test.id)
            prev_criteria_payload = [
                {
                    "criterion": item.criterion,
                    "band": item.band,
                    "confidence": item.confidence,
                }
                for item in prev_criteria
            ]
            progress_comparison = compare_reports(
                current_criteria=criteria_payload,
                previous_criteria=prev_criteria_payload,
                current_mistakes=parts.get("mistakes"),
                previous_mistakes=(prev_report.parts or {}).get("mistakes"),
                current_overall=report.overall_band,
                previous_overall=prev_report.overall_band,
                previous_created_at=prev_report.created_at.isoformat(),
            )
        return {
            "report_id": report.id,
            "test_id": test.id,
            "overall_band": report.overall_band,
            "confidence_label": report.confidence_label,
            "criteria": criteria_payload,
            "strengths": report.strengths or [],
            "improvements": report.improvements or [],
            "minor_improvements": minor_improvements,
            "example_rewrites": report.example_rewrites or [],
            "practice_plan": report.practice_plan or {},
            "disclaimer": report.disclaimer,
            "evaluator_version": report.evaluator_version,
            "rubric_version": report.rubric_version,
            "model_policy_version": report.model_policy_version,
            "created_at": report.created_at.isoformat(),
            "is_inconclusive": report.is_inconclusive,
            "score_readiness": parts.get("score_readiness") or {
                "reasons": ["This older report did not retain scoring diagnostics. Reassess the saved test with the current evaluator."] if report.is_inconclusive else [],
                "minimum_tests": 1,
            },
            "progress_comparison": progress_comparison,
            "transcripts": await self._transcripts(test.id),
            "pronunciation": parts.get("pronunciation") or [],
            "mistakes": parts.get("mistakes") or [],
            "fluency": parts.get("fluency") or [],
            "accent_note": self._accent_note(report),
        }

    def _accent_note(self, report: Report) -> str | None:
        parts = report.parts or {}
        pronunciation = parts.get("pronunciation") or []
        for item in pronunciation:
            if isinstance(item, dict) and item.get("coverage", 1.0) < 0.5:
                return "The recognizer had difficulty matching your speech. Speak a little slower and more clearly for more reliable feedback."
        return None

    async def _transcripts(self, test_id: str) -> list[dict]:
        result = await self.session.execute(
            select(Transcript, SessionQuestion)
            .join(Answer, Answer.id == Transcript.answer_id)
            .join(SessionQuestion, SessionQuestion.id == Answer.session_question_id)
            .where(Answer.test_session_id == test_id)
            .order_by(SessionQuestion.sort_order.asc())
        )
        rows = []
        for transcript, question in result.all():
            rows.append(
                {
                    "part": question.part,
                    "prompt_text": question.prompt_text,
                    "text": transcript.text,
                }
            )
        return rows

    async def export_report(self, user_id: int, report_id: str) -> str:
        data = await self.get_report(user_id, report_id)
        strengths = "".join(f"<li>{item}</li>" for item in data["strengths"])
        improvements = "".join(f"<li>{item}</li>" for item in data["improvements"])
        return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Practice report</title></head>
<body>
<h1>IELTS-style speaking practice report</h1>
<p><strong>Estimated band:</strong> {data["overall_band"]}</p>
<p>{data["disclaimer"]}</p>
<h2>Strengths</h2><ul>{strengths}</ul>
<h2>Improvements</h2><ul>{improvements}</ul>
<p>Evaluator {data["evaluator_version"]} · Rubric {data["rubric_version"]}</p>
</body></html>"""

    async def delete_test(self, user_id: int, test_id: str) -> None:
        test = await self.tests.get_owned(test_id, user_id)
        if test is None:
            raise not_found("Test session not found")
        for answer in test.answers:
            for bucket, suffix in (
                (self.config.minio_candidate_bucket, ".webm"),
                (self.config.minio_derivative_bucket, ".wav"),
            ):
                key = f"tests/{test_id}/answers/{answer.id}{suffix}"
                try:
                    self.store.delete(bucket, key)
                except Exception:
                    pass
            answer.status = AnswerState.DELETED.value
        result = apply_transition(
            TestState(test.status),
            TestEvent.DELETE,
            expected_revision=test.revision,
            current_revision=test.revision,
        )
        test.status = result.new_state.value
        test.revision = result.new_revision
        deleted = apply_transition(
            TestState(test.status),
            TestEvent.DELETE,
            expected_revision=test.revision,
            current_revision=test.revision,
        )
        test.status = deleted.new_state.value
        test.revision = deleted.new_revision
        from ielts_inference.progress import rebuild_progress_snapshot

        await rebuild_progress_snapshot(self.session, user_id)
        await self.session.commit()

    async def delete_account(self, user_id: int) -> None:
        tests = await self.tests.list_owned(user_id, 500)
        for test in tests:
            await self.delete_test(user_id, test.id)
        user = await self.users.get_by_id(user_id)
        if user is not None:
            await self.session.delete(user)
            await self.session.commit()

    async def progress_overview(self, user_id: int) -> dict:
        rows = await self.progress.completed_reports(user_id)
        goal = await self.progress.current_goal(user_id)
        actions = await self.progress.list_actions(user_id)
        criteria = await self.progress.criterion_stats(user_id, EVALUATOR_VERSION)
        summary = summarize_scores([report for _test, report in rows])
        timeline = [
            {
                "testId": test.id,
                "date": report.created_at.isoformat(),
                "overallBand": report.overall_band if not report.is_inconclusive and report.evaluator_version == EVALUATOR_VERSION else None,
                "reportId": report.id,
            }
            for test, report in rows
        ]
        latest = timeline[-1]["overallBand"] if timeline else None
        bands = [item["overallBand"] for item in timeline if item["overallBand"] is not None]
        trend = "insufficient_data"
        if len(bands) >= 2:
            trend = "up" if bands[-1] > bands[0] else "down" if bands[-1] < bands[0] else "stable"
        elif bands:
            trend = "stable"
        weakest = None
        scored = [item for item in criteria if item["average_band"] is not None]
        if scored:
            weakest = min(scored, key=lambda item: item["average_band"])["criterion"]
        priorities = []
        if weakest:
            priorities.append(f"Focus on {weakest.replace('_', ' ')}")
        priorities.extend(["Extend Part 2 answers", "Practise linking phrases"])
        return {
            "overall_trend": trend,
            "sample_size": summary.scored_tests,
            "confidence": "medium" if summary.scored_tests >= 2 else "low",
            "overall_estimate": summary.overall_estimate,
            "scored_tests": summary.scored_tests,
            "estimate_sample_size": summary.estimate_sample_size,
            "observed_low": summary.observed_low,
            "observed_high": summary.observed_high,
            "latest_report_id": rows[-1][1].id if rows else None,
            "latest_band": latest,
            "tests_completed": len(timeline),
            "criterion_stats": criteria,
            "weakest_skill": weakest,
            "active_goal": {
                "id": goal.id,
                "target_band": goal.target_band,
                "target_date": goal.target_date.isoformat(),
                "focus_skills": goal.focus_skills,
            }
            if goal
            else None,
            "priorities": priorities[:3],
            "timeline": timeline,
            "actions": [
                {
                    "id": action.id,
                    "description": action.description,
                    "category": action.category,
                    "completed": action.completed,
                    "skipped": action.skipped,
                }
                for action in actions
            ],
        }

    async def upsert_goal(self, user_id: int, payload: dict) -> dict:
        goal = await self.progress.upsert_goal(
            user_id=user_id,
            goal_id=str(uuid.uuid4()),
            target_band=payload["target_band"],
            target_date=datetime.fromisoformat(payload["target_date"].replace("Z", "+00:00")),
            focus_skills=payload["focus_skills"],
        )
        await self.session.commit()
        return {
            "id": goal.id,
            "target_band": goal.target_band,
            "target_date": goal.target_date.isoformat(),
            "focus_skills": goal.focus_skills,
        }

    async def patch_action(self, user_id: int, action_id: str, payload: dict) -> dict:
        action = await self.progress.get_action(action_id, user_id)
        if action is None:
            raise not_found("Practice action not found")
        if payload.get("completed") is not None:
            action.completed = payload["completed"]
        if payload.get("skipped") is not None:
            action.skipped = payload["skipped"]
        await self.session.commit()
        return {
            "id": action.id,
            "description": action.description,
            "completed": action.completed,
            "skipped": action.skipped,
        }
