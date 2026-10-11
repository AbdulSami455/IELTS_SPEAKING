"""Pydantic v1 API schemas with camelCase JSON."""

from __future__ import annotations

import json
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


def to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(part.title() for part in parts[1:])


def camelize(value):
    if isinstance(value, list):
        return [camelize(item) for item in value]
    if isinstance(value, dict):
        return {to_camel(key): camelize(item) for key, item in value.items()}
    return value


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SuccessEnvelope(ApiModel, Generic[T]):
    data: T
    request_id: str


class ErrorBody(ApiModel):
    code: str
    message: str
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorEnvelope(ApiModel):
    error: ErrorBody
    request_id: str


class UserResponse(ApiModel):
    id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    consent_version: Optional[str] = None
    consent_required: bool = True
    current_consent_version: Optional[str] = None


class ConsentRequest(ApiModel):
    # The server records the version it currently requires; a client-sent
    # version is accepted for compatibility but never trusted.
    version: Optional[str] = Field(default=None, max_length=32)
    accepted: bool


class TurnResponse(ApiModel):
    id: str
    answer_id: str
    part: int
    sort_order: int
    prompt_text: str
    timing_seconds: Optional[int] = None
    cue_card: Optional[dict[str, Any]] = None
    follow_ups: Optional[list[str]] = None
    answer_status: str
    has_examiner_audio: bool = False
    is_follow_up: bool = False
    playback_available: bool = False
    transcript_text: Optional[str] = None


class TestSessionResponse(ApiModel):
    test_id: str
    state: str
    revision: int
    turns: list[TurnResponse]
    current_turn: Optional[TurnResponse] = None
    permitted_actions: list[str]
    started_at: Optional[str] = None
    expires_at: Optional[str] = None
    report_id: Optional[str] = None
    part2_prep_seconds: Optional[int] = None


class RealtimeSessionResponse(ApiModel):
    session_id: str
    transport: str
    state: str
    phase: str
    llm_model: str
    stt_model: str
    tts_model: str
    tts_voice: str
    ws_url: Optional[str] = None
    examiner_playback_url: Optional[str] = None
    current_turn_id: Optional[str] = None
    test: TestSessionResponse


MAX_EVENT_PAYLOAD_BYTES = 8192


class RealtimeClientEventRequest(ApiModel):
    event_type: str = Field(max_length=64)
    speaker_role: str = Field(default="system", max_length=32)
    provider_event_id: Optional[str] = Field(default=None, max_length=128)
    transcript_text: Optional[str] = Field(default=None, max_length=8000)
    prompt_text: Optional[str] = Field(default=None, max_length=2000)
    started_at: Optional[str] = Field(default=None, max_length=40)
    ended_at: Optional[str] = Field(default=None, max_length=40)
    latency_ms: Optional[int] = Field(default=None, ge=0, le=3_600_000)
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("payload")
    @classmethod
    def _bounded_payload(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(value, separators=(",", ":"))) > MAX_EVENT_PAYLOAD_BYTES:
            raise ValueError(f"payload must be at most {MAX_EVENT_PAYLOAD_BYTES} bytes")
        return value


class RealtimeAudioTurnResponse(ApiModel):
    test: TestSessionResponse
    examiner_playback_url: Optional[str] = None
    next_turn_id: Optional[str] = None


class DeviceCheckRequest(ApiModel):
    sample_duration_ms: int = Field(ge=0, le=600_000)
    silence_ratio: float = Field(ge=0, le=1)
    clipping_ratio: float = Field(ge=0, le=1)
    microphone_available: bool
    speaker_available: bool


class TransitionRequest(ApiModel):
    event: str = Field(max_length=64)
    expected_revision: int = Field(ge=0)


class UploadCompleteRequest(ApiModel):
    content_sha256: str = Field(max_length=64)
    mime_type: str = Field(max_length=100)
    size_bytes: int = Field(ge=0)


class UploadUrlResponse(ApiModel):
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    max_bytes: int
    expires_in_seconds: int


class ExaminerAudioResponse(ApiModel):
    playback_url: str
    expires_in_seconds: int


class StatusResponse(ApiModel):
    test_id: str
    state: str
    stage: str
    progress: int
    report_id: Optional[str] = None


class SubdimensionScore(ApiModel):
    key: str
    band: float


class CriterionScoreResponse(ApiModel):
    criterion: str
    band: float
    confidence: str
    subdimensions: list[SubdimensionScore]


class ReportResponse(ApiModel):
    report_id: str
    test_id: str
    overall_band: Optional[float] = None
    confidence_label: str
    criteria: list[CriterionScoreResponse]
    strengths: list[str]
    improvements: list[str]
    example_rewrites: list[dict[str, Any]]
    practice_plan: dict[str, Any]
    disclaimer: str
    evaluator_version: str
    rubric_version: str
    model_policy_version: str
    created_at: str
    is_inconclusive: bool
    transcripts: Optional[list[dict[str, Any]]] = None
    pronunciation: list[dict[str, Any]] = Field(default_factory=list)
    mistakes: list[dict[str, Any]] = Field(default_factory=list)
    fluency: list[str] = Field(default_factory=list)


class GoalRequest(ApiModel):
    target_band: float = Field(ge=0, le=9)
    target_date: str = Field(max_length=40)
    focus_skills: list[str] = Field(max_length=4)

    @field_validator("focus_skills")
    @classmethod
    def _short_skill_keys(cls, value: list[str]) -> list[str]:
        if any(len(item) > 64 for item in value):
            raise ValueError("focus skill keys are too long")
        return value


class GoalResponse(ApiModel):
    id: str
    target_band: float
    target_date: str
    focus_skills: list[str]


class PracticeActionPatch(ApiModel):
    completed: Optional[bool] = None
    skipped: Optional[bool] = None


class ProgressOverviewResponse(ApiModel):
    overall_trend: str
    sample_size: int
    confidence: str
    latest_band: Optional[float] = None
    active_goal: Optional[GoalResponse] = None
    priorities: list[str]
    timeline: list[dict[str, Any]]
    actions: list[dict[str, Any]]
