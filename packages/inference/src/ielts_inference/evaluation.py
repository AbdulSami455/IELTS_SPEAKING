"""Real evaluation pipeline: STT, features, acoustics, LLM scoring, assembler."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ielts_audio.media import concat_wavs, measure_wav, normalize_to_wav, acoustic_observations
from ielts_config import EnvironmentConfig
from ielts_db.models import (
    Answer,
    ConversationEvent,
    CriterionScore,
    PracticeAction,
    ProcessingJob,
    Report,
    SkillObservation,
    SpeechObservation,
    TestSession,
    Transcript,
)
from ielts_db.storage import ObjectStore
from ielts_domain import AnswerEvent, AnswerState, TestEvent, TestState, apply_answer_transition, apply_transition
from ielts_inference.assembler import EVALUATOR_VERSION, assemble
from ielts_inference.features import extract_features
from ielts_inference.openrouter import InferenceError, OpenRouterClient, TranscriptResult
from ielts_inference.progress import rebuild_progress_snapshot
from ielts_inference.pronunciation import check_pronunciation
from ielts_inference.quota import reserve_model_call
from ielts_inference.transcript import clean_transcript


PUBLIC_STAGES = (
    "validating_audio",
    "transcribing",
    "analyzing_language",
    "analyzing_pronunciation",
    "building_report",
    "completed",
    "failed",
)

SCORING_INSTRUCTIONS = """Score this IELTS-style speaking practice test.

Return JSON with:
{
  "criteria": [
    {
      "criterion": "fluency_and_coherence|lexical_resource|grammatical_range_and_accuracy|pronunciation",
      "band": 0-9 in 0.5 steps,
      "confidence": "high|medium|low|inconclusive",
      "subdimensions": {"key": number},
      "evidence": [{"quote": "exact transcript span", "note": "why"}]
    }
  ],
  "strengths": ["..."],
  "improvements": ["three highest-value changes"],
  "mistakes": [
    {"type": "grammar|lexical|fluency|pronunciation", "quote": "exact transcript span", "correction": "...", "note": "..."}
  ],
  "fluencyNotes": ["grounded in WPM, pauses, silence — not accent"],
  "exampleRewrites": [{"original": "...", "saferRewrite": "..."}],
  "practicePlan": {"days": [{"day": 1, "focus": "...", "task": "..."}]}
}

Rules:
- Grammar and vocabulary from the transcripts only. Quote the exact span.
- Fluency and coherence from acoustics (WPM, pauses, silence, clipping) plus how ideas connect in the transcript.
- Pronunciation from the pronunciation checker and acoustics. Accent is not an error.
- fluency_and_coherence and pronunciation must not be invented from text alone when coverage is low.
- Never invent a score when the transcript is empty or the audio is unusable.
"""


async def evaluate_test(session: AsyncSession, test_id: str, config: EnvironmentConfig | None = None) -> Report:
    config = config or EnvironmentConfig.from_env()
    if config.inference_mode == "fake":
        raise InferenceError("INFERENCE_MODE=fake is disabled; reports require real STT and scoring")
    result = await session.execute(
        select(TestSession)
        .options(
            selectinload(TestSession.answers).selectinload(Answer.session_question),
            selectinload(TestSession.answers).selectinload(Answer.media_object),
            selectinload(TestSession.answers).selectinload(Answer.transcript),
            selectinload(TestSession.conversation_events),
            selectinload(TestSession.report),
        )
        .where(TestSession.id == test_id)
    )
    test = result.scalar_one()
    if test.status == TestState.COMPLETED.value and test.report is not None:
        return test.report

    job = await _job(session, test_id, "evaluate-test")
    try:
        if test.status == TestState.SUBMITTED.value:
            transition = apply_transition(
                TestState(test.status),
                TestEvent.MARK_PROCESSING,
                expected_revision=test.revision,
                current_revision=test.revision,
            )
            test.status = transition.new_state.value
            test.revision = transition.new_revision
            await session.commit()

        client = OpenRouterClient(config)
        store = ObjectStore(config)
        part_payloads: list[dict] = []
        coverage_values: list[float] = []
        merged_features: dict = {}
        wav_parts: list[bytes] = []
        conversation_context = _conversation_context(test.conversation_events)

        _set_stage(job, "validating_audio", 15)
        await session.commit()

        usable_answers = [
            answer
            for answer in sorted(test.answers, key=lambda item: item.session_question.sort_order if item.session_question else 0)
            if answer.status != AnswerState.DELETED.value
        ]
        if not usable_answers:
            raise InferenceError("No uploaded answers to evaluate")

        for answer in usable_answers:
            object_key = answer.media_object.object_key if answer.media_object is not None else f"tests/{test_id}/answers/{answer.id}.webm"
            audio = store.get_bytes(config.minio_candidate_bucket, object_key)
            source_ext = Path(object_key).suffix or ".webm"
            wav = normalize_to_wav(audio, source_ext)
            wav_parts.append(wav)
            quality = measure_wav(wav)
            acoustic = {
                "duration_ms": quality.duration_ms,
                "rms": quality.rms,
                "silence_ratio": quality.silence_ratio,
                "clipping_ratio": quality.clipping_ratio,
                "speech_ratio": quality.speech_ratio,
            }
            derivative_key = f"tests/{test_id}/answers/{answer.id}.wav"
            if wav[:4] == b"RIFF":
                store.put_bytes(config.minio_derivative_bucket, derivative_key, wav, "audio/wav")
            _set_stage(job, "transcribing", 40)
            await session.commit()
            part = answer.session_question.part if answer.session_question else 1
            prompt = answer.session_question.prompt_text if answer.session_question else ""
            existing = await session.execute(select(Transcript).where(Transcript.answer_id == answer.id))
            saved = existing.scalar_one_or_none()
            if saved and saved.text:
                transcript = TranscriptResult(
                    text=clean_transcript(saved.text),
                    language="en",
                    duration_seconds=0,
                    words=saved.words or [],
                    segments=[],
                    model="cached",
                )
            else:
                await reserve_model_call(session, test.user_id, test_id, "transcription", config)
                fmt = "wav" if wav[:4] == b"RIFF" else "webm"
                transcript = client.transcribe(wav if fmt == "wav" else audio, fmt)
                text = clean_transcript(transcript.text)
                session.add(
                    Transcript(
                        answer_id=answer.id,
                        part=part,
                        evaluator_version=EVALUATOR_VERSION,
                        text=text,
                        words=transcript.words,
                        model_policy_version=config.openrouter_scoring_model[:50],
                    )
                )
                transcript = TranscriptResult(
                    text=text,
                    language=transcript.language,
                    duration_seconds=transcript.duration_seconds,
                    words=transcript.words,
                    segments=transcript.segments,
                    model=transcript.model,
                )
            fmt = "wav" if wav[:4] == b"RIFF" else "webm"
            features = extract_features(transcript.text, transcript.words, acoustic)
            merged_features = _merge_features(merged_features, features)
            speech = acoustic_observations(wav if fmt == "wav" else audio, transcript.words)
            coverage = float(speech.get("coverage") or 0)
            if quality.speech_ratio < 0.3:
                coverage = min(coverage, quality.speech_ratio)
            coverage_values.append(coverage)
            session.add(
                SpeechObservation(
                    answer_id=answer.id,
                    evaluator_version=EVALUATOR_VERSION,
                    acoustic_model_hash=str(speech.get("acoustic_model_hash") or "signal-quality-v1"),
                    feature_version="v1",
                    observations=speech,
                    source_object_key="redacted",
                    source_sha256=answer.media_object.content_sha256 if answer.media_object else "0" * 64,
                    coverage_percent=int(coverage * 100),
                    alignment_confidence=coverage,
                )
            )
            try:
                processing = apply_answer_transition(AnswerState(answer.status), AnswerEvent.MARK_PROCESSING)
                answer.status = processing.new_state.value
                ready = apply_answer_transition(AnswerState(answer.status), AnswerEvent.MARK_READY)
                answer.status = ready.new_state.value
            except Exception:
                answer.status = AnswerState.READY.value
            pronunciation = check_pronunciation(transcript.words, features, coverage)
            try:
                await reserve_model_call(session, test.user_id, test_id, "pronunciation", config)
                pronunciation["model_notes"] = client.pronunciation_notes(
                    json.dumps(
                        {
                            "question": prompt,
                            "transcript": transcript.text,
                            "measurements": pronunciation,
                        }
                    )
                )
            except InferenceError:
                pronunciation["model_notes"] = None
            part_payloads.append(
                {
                    "part": part,
                    "question": prompt,
                    "transcript": transcript.text,
                    "features": features,
                    "acoustic": acoustic,
                    "speech": {k: v for k, v in speech.items() if k != "evidence_spans"},
                    "pronunciation": pronunciation,
                }
            )

        _set_stage(job, "analyzing_language", 70)
        await session.commit()
        if wav_parts:
            combined = concat_wavs(wav_parts)
            store.put_bytes(
                config.minio_derivative_bucket,
                f"tests/{test_id}/manifest.wav",
                combined,
                "audio/wav",
            )
        mean_coverage = sum(coverage_values) / max(len(coverage_values), 1)
        scoring_prompt = (
            SCORING_INSTRUCTIONS
            + "\n\nAcoustic/feature summary:\n"
            + json.dumps({"merged": merged_features, "coverage": mean_coverage}, indent=2)
            + "\n\nConversation summary:\n"
            + json.dumps(conversation_context, indent=2)
            + "\n\nAnswers:\n"
            + json.dumps(part_payloads, indent=2)
        )
        _set_stage(job, "analyzing_pronunciation", 80)
        await session.commit()
        await reserve_model_call(session, test.user_id, test_id, "holistic_scoring", config)
        scored = client.score_speaking(scoring_prompt)
        assembled = assemble(scored.raw, merged_features, mean_coverage)
        _set_stage(job, "building_report", 90)
        await session.commit()

        report_row = await session.execute(select(Report).where(Report.test_session_id == test_id))
        existing_report = report_row.scalar_one_or_none()
        if existing_report is None:
            existing_report = Report(
                id=str(uuid.uuid4()),
                test_session_id=test_id,
                evaluator_version=assembled["evaluator_version"],
                rubric_version=assembled["rubric_version"],
                model_policy_version=assembled["model_policy_version"],
                report_schema_version="v1",
                overall_band=assembled["overall_band"],
                confidence_label=assembled["confidence_label"],
                parts={
                    "answers": len(part_payloads),
                    "pronunciation": [item["pronunciation"] for item in part_payloads],
                    "mistakes": assembled["mistakes"],
                    "fluency": assembled["fluency"],
                },
                strengths=assembled["strengths"],
                improvements=assembled["improvements"],
                example_rewrites=assembled["example_rewrites"],
                practice_plan=assembled["practice_plan"],
                disclaimer=assembled["disclaimer"],
                is_inconclusive=assembled["is_inconclusive"],
            )
            session.add(existing_report)
            await session.flush()
            for item in assembled["criteria"]:
                session.add(
                    CriterionScore(
                        test_session_id=test_id,
                        criterion=item["criterion"],
                        band=item["band"],
                        confidence=item["confidence"],
                        evidence=item["evidence"],
                        subdimensions=item["subdimensions"] if isinstance(item["subdimensions"], dict) else {},
                        evaluator_version=assembled["evaluator_version"],
                    )
                )
                subdims = item["subdimensions"] if isinstance(item["subdimensions"], dict) else {}
                for skill_key, band in subdims.items():
                    try:
                        numeric = float(band)
                    except (TypeError, ValueError):
                        continue
                    session.add(
                        SkillObservation(
                            test_session_id=test_id,
                            skill_key=str(skill_key),
                            comparability_group=assembled["evaluator_version"],
                            band=numeric,
                            confidence_label=item["confidence"],
                            evidence=item["evidence"],
                            evaluator_version=assembled["evaluator_version"],
                        )
                    )
            for day in (assembled["practice_plan"].get("days") or [])[:7]:
                session.add(
                    PracticeAction(
                        id=str(uuid.uuid4()),
                        test_session_id=test_id,
                        user_id=test.user_id,
                        description=str(day.get("task") or day),
                        category=str(day.get("focus") or "practice"),
                        source_report_id=existing_report.id,
                        completed=False,
                        skipped=False,
                    )
                )

        completed = apply_transition(
            TestState(test.status),
            TestEvent.MARK_COMPLETED,
            expected_revision=test.revision,
            current_revision=test.revision,
        )
        test.status = completed.new_state.value
        test.revision = completed.new_revision
        job.status = "COMPLETED"
        job.completed_at = datetime.now(timezone.utc)
        _set_stage(job, "completed", 100)
        await rebuild_progress_snapshot(session, test.user_id)
        await session.commit()
        await session.refresh(existing_report)
        return existing_report
    except Exception as extra:
        try:
            source = (
                TestState.PROCESSING
                if test.status in {TestState.SUBMITTED.value, TestState.PROCESSING.value}
                else TestState(test.status)
            )
            failed = apply_transition(
                source,
                TestEvent.MARK_FAILED,
                expected_revision=test.revision,
                current_revision=test.revision,
            )
            test.status = failed.new_state.value
            test.revision = failed.new_revision
        except Exception:
            test.status = TestState.FAILED.value
        job.status = "FAILED"
        job.error_code = "EVALUATION_FAILED"
        job.error_message = str(extra)[:500]
        _set_stage(job, "failed", 100)
        await session.commit()
        raise


def _conversation_context(events: list[ConversationEvent]) -> list[dict]:
    summary: list[dict] = []
    for event in sorted(events, key=lambda item: (item.sequence_index, item.id)):
        if event.event_type not in {"examiner_prompt", "candidate_turn_completed"}:
            continue
        summary.append(
            {
                "phase": event.phase,
                "speaker": event.speaker_role,
                "text": event.transcript_text or event.prompt_text or "",
                "event": event.event_type,
            }
        )
    return summary


async def _job(session: AsyncSession, test_id: str, job_type: str) -> ProcessingJob:
    result = await session.execute(
        select(ProcessingJob).where(
            ProcessingJob.test_session_id == test_id,
            ProcessingJob.job_type == job_type,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.status = "RUNNING"
        existing.started_at = datetime.now(timezone.utc)
        return existing
    job = ProcessingJob(
        id=str(uuid.uuid4()),
        test_session_id=test_id,
        job_type=job_type,
        input_version="v1",
        status="RUNNING",
        payload={"stage": "validating_audio", "progress": 5},
        started_at=datetime.now(timezone.utc),
    )
    session.add(job)
    await session.flush()
    return job


def _set_stage(job: ProcessingJob, stage: str, progress: int) -> None:
    job.payload = {"stage": stage, "progress": progress}


def _merge_features(left: dict, right: dict) -> dict:
    if not left:
        return dict(right)
    merged = dict(left)
    for key, value in right.items():
        if isinstance(value, (int, float)) and isinstance(merged.get(key), (int, float)):
            if key.endswith("ratio") or key in {"type_token_ratio", "rms"}:
                merged[key] = round((float(merged[key]) + float(value)) / 2, 4)
            else:
                merged[key] = merged[key] + value
        else:
            merged[key] = value
    return merged
