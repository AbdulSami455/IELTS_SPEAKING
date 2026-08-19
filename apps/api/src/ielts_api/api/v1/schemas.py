"""Pydantic v1 API schemas with camelCase JSON."""

from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

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


class ConsentRequest(ApiModel):
    version: str
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


class RealtimeClientEventRequest(ApiModel):
    event_type: str
    speaker_role: str = "system"
    provider_event_id: Optional[str] = None
    transcript_text: Optional[str] = None
    prompt_text: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    latency_ms: Optional[int] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class RealtimeAudioTurnResponse(ApiModel):
    test: TestSessionResponse
    examiner_playback_url: Optional[str] = None
    next_turn_id: Optional[str] = None


class DeviceCheckRequest(ApiModel):
    sample_duration_ms: int
    silence_ratio: float
    clipping_ratio: float
    microphone_available: bool
    speaker_available: bool


class TransitionRequest(ApiModel):
    event: str
    expected_revision: int


class UploadCompleteRequest(ApiModel):
    content_sha256: str
    mime_type: str
    size_bytes: int


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
    target_band: float
    target_date: str
    focus_skills: list[str]


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
