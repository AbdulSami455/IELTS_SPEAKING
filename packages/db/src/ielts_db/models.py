"""SQLAlchemy async ORM models for the IELTS Speaking platform.

Implements the database contract from Section 6.2 of the product plan.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text as sql_text,
)
from sqlalchemy.ext.asyncio import AsyncAttrs, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(511), nullable=True)
    consent_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    consent_accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    voice_preference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="alloy")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    test_sessions = relationship("TestSession", back_populates="user", cascade="all, delete-orphan")
    practice_goals = relationship("PracticeGoal", back_populates="user", cascade="all, delete-orphan")


class QuestionSet(Base):
    __tablename__ = "question_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    questions = relationship("Question", back_populates="question_set", order_by="Question.part")

    __table_args__ = (
        UniqueConstraint("slug", "version", name="uq_question_set_slug_version"),
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question_sets.id"), nullable=False
    )
    part: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    cue_card: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    follow_ups: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    topic: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    examiner_asset_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("examiner_audio_assets.id"), nullable=True
    )
    examiner_asset_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    timing_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    question_set = relationship("QuestionSet", back_populates="questions")

    __table_args__ = (
        CheckConstraint("part IN (1, 2, 3)", name="ck_question_part_valid"),
        UniqueConstraint("question_set_id", "sort_order", name="uq_question_sort_order"),
    )


class TestSession(Base):
    __tablename__ = "test_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    question_set_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("question_sets.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="CREATED")
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    topic_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    user = relationship("User", back_populates="test_sessions")
    question_set = relationship("QuestionSet", backref="test_sessions")
    session_questions = relationship("SessionQuestion", back_populates="test_session",
                                      cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="test_session",
                           cascade="all, delete-orphan")
    realtime_sessions = relationship("RealtimeSession", back_populates="test_session", cascade="all, delete-orphan")
    conversation_events = relationship("ConversationEvent", back_populates="test_session", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="test_session",
                                    cascade="all, delete-orphan")
    report = relationship("Report", back_populates="test_session", uselist=False,
                           cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_test_sessions_user_status", "user_id", "status"),
        CheckConstraint(
            "status IN ('CREATED','DEVICE_CHECK','READY','PART1','PART2_PREP','PART2_SPEAK','PART3','UPLOADING','SUBMITTED','PROCESSING','COMPLETED','FAILED','EXPIRED','ABANDONED','DELETING','DELETED')",
            name="ck_test_session_status"
        ),
    )


class SessionQuestion(Base):
    __tablename__ = "session_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    question_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("questions.id"), nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    part: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timing_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cue_card: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    follow_ups: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    examiner_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    examiner_asset_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    test_session = relationship("TestSession", back_populates="session_questions")
    question = relationship("Question")
    answer = relationship("Answer", back_populates="session_question", uselist=False)

    __table_args__ = (
        UniqueConstraint("test_session_id", "question_id",
                         name="uq_session_question_pair"),
    )


class ExaminerAudioAsset(Base):
    __tablename__ = "examiner_audio_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    voice: Mapped[str] = mapped_column(String(50), nullable=False, default="default")
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    settings_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    asset_schema_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")
    media_object_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("media_objects.id"), nullable=True
    )
    duration_milliseconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sample_rate_hz: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    is_retired: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    media_object = relationship("MediaObject")

    __table_args__ = (
        UniqueConstraint("prompt_text", "voice", "model", "settings_hash", "asset_schema_version",
                         name="uq_examiner_audio_asset"),
    )


class MediaObject(Base):
    __tablename__ = "media_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bucket: Mapped[str] = mapped_column(String(100), nullable=False)
    object_key: Mapped[str] = mapped_column(String(511), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    encryption_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    retention_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    answer = relationship("Answer", back_populates="media_object", uselist=False)
    conversation_events = relationship("ConversationEvent", back_populates="media_object")

    __table_args__ = (
        UniqueConstraint("bucket", "object_key", name="uq_media_object_bucket_key"),
        CheckConstraint(
            "category IN ('candidate','derivative','examiner')",
            name="ck_media_object_category"
        ),
    )


class RealtimeSession(Base):
    __tablename__ = "realtime_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    transport: Mapped[str] = mapped_column(String(20), nullable=False, default="websocket")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    current_phase: Mapped[str] = mapped_column(String(20), nullable=False, default="READY")
    llm_model: Mapped[str] = mapped_column(String(120), nullable=False)
    stt_model: Mapped[str] = mapped_column(String(120), nullable=False)
    tts_model: Mapped[str] = mapped_column(String(120), nullable=False)
    tts_voice: Mapped[str] = mapped_column(String(50), nullable=False)
    session_notes: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    test_session = relationship("TestSession", back_populates="realtime_sessions")
    conversation_events = relationship("ConversationEvent", back_populates="realtime_session")

    __table_args__ = (
        Index("idx_realtime_sessions_test_status", "test_session_id", "status"),
        CheckConstraint(
            "status IN ('ACTIVE','FINISHED','FAILED','ABANDONED')",
            name="ck_realtime_session_status",
        ),
    )


class ConversationEvent(Base):
    __tablename__ = "conversation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    realtime_session_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("realtime_sessions.id"), nullable=True
    )
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    media_object_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("media_objects.id"), nullable=True
    )
    phase: Mapped[str] = mapped_column(String(20), nullable=False)
    speaker_role: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    transcript_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider_event_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    realtime_session = relationship("RealtimeSession", back_populates="conversation_events")
    test_session = relationship("TestSession", back_populates="conversation_events")
    media_object = relationship("MediaObject", back_populates="conversation_events")

    __table_args__ = (
        Index("idx_conversation_events_test_sequence", "test_session_id", "sequence_index"),
        CheckConstraint(
            "speaker_role IN ('examiner','candidate','system')",
            name="ck_conversation_event_speaker_role",
        ),
    )


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    session_question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("session_questions.id"), nullable=False
    )
    media_object_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("media_objects.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    duration_seconds: Mapped[Optional[float]] = mapped_column(nullable=True)
    recorded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    upload_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    validated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    validation_error_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    test_session = relationship("TestSession", back_populates="answers")
    session_question = relationship("SessionQuestion", back_populates="answer")
    media_object = relationship("MediaObject", back_populates="answer")
    transcript = relationship("Transcript", back_populates="answer", uselist=False,
                              cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("test_session_id", "session_question_id",
                         name="uq_answer_session_question"),
        CheckConstraint(
            "status IN ('PENDING','RECORDING','RECORDED','UPLOAD_AUTHORIZED','UPLOADED','VALIDATING','VALID','PROCESSING','READY','INVALID_MEDIA','FAILED_RETRYABLE','FAILED_TERMINAL','DELETED')",
            name="ck_answer_status"
        ),
    )


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    test_session = relationship("TestSession", back_populates="processing_jobs")

    __table_args__ = (
        UniqueConstraint("test_session_id", "job_type", "input_version",
                         name="uq_processing_job_type_version"),
        Index("idx_processing_jobs_status", "status"),
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    answer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("answers.id"), nullable=False
    )
    part: Mapped[int] = mapped_column(Integer, nullable=False)
    evaluator_version: Mapped[str] = mapped_column(String(50), nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    words: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    model_policy_version: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    answer = relationship("Answer", back_populates="transcript")

    __table_args__ = (
        UniqueConstraint("answer_id", "part", "evaluator_version",
                         name="uq_transcript_answer_part_version"),
    )


class SpeechObservation(Base):
    __tablename__ = "speech_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    answer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("answers.id"), nullable=False
    )
    evaluator_version: Mapped[str] = mapped_column(String(50), nullable=False)
    acoustic_model_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    feature_version: Mapped[str] = mapped_column(String(20), nullable=False)
    observations: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_object_key: Mapped[str] = mapped_column(String(511), nullable=False)
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    coverage_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    alignment_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        Index("idx_speech_obs_answer", "answer_id", "evaluator_version"),
    )


class CriterionScore(Base):
    __tablename__ = "criterion_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    criterion: Mapped[str] = mapped_column(String(50), nullable=False)
    band: Mapped[float] = mapped_column(nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    subdimensions: Mapped[dict] = mapped_column(JSON, nullable=False)
    evaluator_version: Mapped[str] = mapped_column(String(50), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        CheckConstraint("criterion IN ('fluency_and_coherence','lexical_resource','grammatical_range_and_accuracy','pronunciation')",
                        name="ck_criterion_score_criterion"),
        CheckConstraint(
            "confidence IN ('high','medium','low','inconclusive')",
            name="ck_criterion_score_confidence"
        ),
        UniqueConstraint("test_session_id", "criterion", name="uq_criterion_score_session"),
    )


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), unique=True, nullable=False
    )
    evaluator_version: Mapped[str] = mapped_column(String(50), nullable=False)
    rubric_version: Mapped[str] = mapped_column(String(50), nullable=False)
    model_policy_version: Mapped[str] = mapped_column(String(50), nullable=False)
    report_schema_version: Mapped[str] = mapped_column(String(20), nullable=False)
    overall_band: Mapped[Optional[float]] = mapped_column(nullable=True)
    confidence_label: Mapped[str] = mapped_column(String(20), nullable=False)
    parts: Mapped[dict] = mapped_column(JSON, nullable=False)
    strengths: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    improvements: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    example_rewrites: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    practice_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    disclaimer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    is_inconclusive: Mapped[bool] = mapped_column(default=False, nullable=False)

    test_session = relationship("TestSession", back_populates="report")


class SkillObservation(Base):
    __tablename__ = "skill_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    skill_key: Mapped[str] = mapped_column(String(50), nullable=False)
    comparability_group: Mapped[str] = mapped_column(String(50), nullable=False)
    band: Mapped[float] = mapped_column(nullable=False)
    confidence_label: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    evaluator_version: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("test_session_id", "skill_key", name="uq_skill_obs_session"),
        Index("idx_skill_obs_user_skill", "test_session_id", "skill_key"),
    )


class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    comparability_group: Mapped[str] = mapped_column(String(50), nullable=False)
    criterion_trends: Mapped[dict] = mapped_column(JSON, nullable=False)
    skill_trends: Mapped[dict] = mapped_column(JSON, nullable=True)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_label: Mapped[str] = mapped_column(String(20), nullable=False)
    previous_snapshot_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        Index("idx_progress_user_window", "user_id", "window_start", "window_end"),
    )


class PracticeGoal(Base):
    __tablename__ = "practice_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    target_band: Mapped[float] = mapped_column(nullable=False)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    focus_skills: Mapped[list] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"),
        onupdate=sql_text("now()"), nullable=False
    )

    user = relationship("User", back_populates="practice_goals")

    __table_args__ = (
        UniqueConstraint("user_id", "is_active",
                         name="uq_practice_goals_active_per_user"),
    )


class PracticeAction(Base):
    __tablename__ = "practice_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed: Mapped[bool] = mapped_column(default=False, nullable=False)
    skipped: Mapped[bool] = mapped_column(default=False, nullable=False)
    source_report_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("reports.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        Index("idx_practice_actions_user", "user_id", "completed", "skipped"),
    )


class ModelCallAttempt(Base):
    __tablename__ = "model_call_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    test_session_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=True
    )
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    route: Mapped[str] = mapped_column(String(50), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(50), nullable=False)
    request_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    request_ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    input_tokens: Mapped[Optional[int]] = mapped_column(nullable=True)
    output_tokens: Mapped[Optional[int]] = mapped_column(nullable=True)
    audio_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    audio_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reserved_microdollars: Mapped[int] = mapped_column(Integer, nullable=False)
    provider_generation_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    finalized_microdollars: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    free_request_impact: Mapped[bool] = mapped_column(default=False, nullable=False)
    outcome: Mapped[str] = mapped_column(String(30), nullable=False)

    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_model_call_idempotency"),
        Index("idx_model_call_test_session", "test_session_id"),
    )


class UsageLedger(Base):
    __tablename__ = "usage_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    free_requests_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_cost_microdollars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    free_budget_microdollars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    paid_budget_microdollars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_usage_ledger_user_date"),
    )


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    route: Mapped[str] = mapped_column(String(255), nullable=False)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "route", "key", name="uq_idempotency_user_route_key"),
    )


class DeletionRequest(Base):
    __tablename__ = "deletion_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    test_session_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("test_sessions.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="REQUESTED")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    support_id: Mapped[str] = mapped_column(String(64), nullable=False)

    __table_args__ = (
        Index("idx_deletion_requests_status", "status"),
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    safe_metadata: Mapped[dict] = mapped_column(JSON, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(511), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sql_text("now()"), nullable=False
    )

    __table_args__ = (
        Index("idx_audit_events_type_created", "event_type", "created_at"),
        Index("idx_audit_events_user_created", "user_id", "created_at"),
    )