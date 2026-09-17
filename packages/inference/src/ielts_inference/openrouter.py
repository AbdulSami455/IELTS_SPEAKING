"""OpenRouter HTTP adapter for STT, TTS, pronunciation notes, and scoring."""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from ielts_config import EnvironmentConfig
from ielts_observability import record_model_call_error, record_scoring_call, record_stt_call

logger = logging.getLogger(__name__)


class InferenceError(Exception):
    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass
class TranscriptResult:
    text: str
    language: str
    duration_seconds: float
    words: list[dict]
    segments: list[dict]
    model: str


@dataclass
class ScoreResult:
    raw: dict
    model: str
    generation_id: str | None


class EvidenceItem(BaseModel):
    quote: str
    note: Optional[str] = None


class CriterionScore(BaseModel):
    criterion: str
    band: float
    confidence: str
    subdimensions: dict = Field(default_factory=dict)
    evidence: list[EvidenceItem] = Field(default_factory=list)

    @field_validator("criterion")
    @classmethod
    def _valid_criterion(cls, v: str) -> str:
        allowed = {
            "fluency_and_coherence",
            "lexical_resource",
            "grammatical_range_and_accuracy",
            "pronunciation",
        }
        if v not in allowed:
            raise ValueError(f"Unknown criterion: {v}")
        return v

    @field_validator("band")
    @classmethod
    def _valid_band(cls, v: float) -> float:
        return min(9.0, max(0.0, v))

    @field_validator("confidence")
    @classmethod
    def _valid_confidence(cls, v: str) -> str:
        allowed = {"high", "medium", "low", "inconclusive"}
        if v not in allowed:
            raise ValueError(f"Invalid confidence: {v}")
        return v


class FeedbackMistake(BaseModel):
    type: str = "grammar"
    quote: str = ""
    correction: str = ""
    note: str = ""
    practice: str = ""


class PracticeDay(BaseModel):
    day: int = Field(ge=1, le=7)
    focus: str
    task: str
    minutes: int = Field(default=15, ge=1, le=120)
    successCriteria: str = ""


class PracticePlan(BaseModel):
    days: list[PracticeDay] = Field(default_factory=list, max_length=7)


class ScoreSchema(BaseModel):
    criteria: list[CriterionScore]
    strengths: list[str] = Field(default_factory=list, max_length=10)
    improvements: list[str] = Field(default_factory=list, max_length=10)
    minorImprovements: list[str] = Field(default_factory=list, max_length=6)
    mistakes: list[FeedbackMistake] = Field(default_factory=list)
    fluencyNotes: list[str] = Field(default_factory=list)
    exampleRewrites: list[dict] = Field(default_factory=list)
    practicePlan: PracticePlan = Field(default_factory=PracticePlan)

    @field_validator("criteria")
    @classmethod
    def _validate_criteria(cls, v: list[CriterionScore]) -> list[CriterionScore]:
        if not v:
            raise ValueError("At least one criterion is required")
        return v


class OpenRouterClient:
    def __init__(self, config: EnvironmentConfig) -> None:
        if not config.openrouter_api_key:
            raise InferenceError("OPENROUTER_API_KEY is required for real evaluation")
        self._config = config
        self._client = httpx.Client(
            base_url=config.openrouter_base_url.rstrip("/"),
            timeout=120.0,
            follow_redirects=False,
            headers={
                "Authorization": f"Bearer {config.openrouter_api_key}",
                "HTTP-Referer": config.web_origin,
                "X-OpenRouter-Title": "IELTS Speaking Practice",
            },
        )

    def transcribe(self, audio: bytes, fmt: str = "webm") -> TranscriptResult:
        models = _unique_models(self._config.openrouter_stt_model, self._config.openrouter_stt_fallback_model)
        last_error = "transcription failed"
        safe_fmt = fmt if fmt in {"wav", "mp3", "flac", "m4a", "ogg", "webm", "aac"} else "webm"
        for model in models:
            files = {"file": (f"audio.{safe_fmt}", audio, f"audio/{safe_fmt}")}
            data = {
                "model": model,
                "language": "en",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
            }
            record_stt_call()
            response = self._client.post("/audio/transcriptions", data=data, files=files)
            if response.status_code >= 400:
                record_model_call_error()
                payload = {
                    "model": model,
                    "language": "en",
                    "response_format": "verbose_json",
                    "input_audio": {
                        "data": base64.b64encode(audio).decode("ascii"),
                        "format": safe_fmt,
                    },
                }
                record_stt_call()
                response = self._client.post("/audio/transcriptions", json=payload)
            if response.status_code >= 400:
                record_model_call_error()
                last_error = response.text[:300]
                continue
            body = response.json()
            text = body.get("text") or ""
            words = []
            for item in body.get("words") or []:
                words.append(
                    {
                        "w": item.get("word") or item.get("w") or "",
                        "startMs": int(float(item.get("start", 0)) * 1000),
                        "endMs": int(float(item.get("end", 0)) * 1000),
                        "confidence": item.get("confidence"),
                    }
                )
            if not words:
                for segment in body.get("segments") or []:
                    words.append(
                        {
                            "w": segment.get("text", "").strip(),
                            "startMs": int(float(segment.get("start", 0)) * 1000),
                            "endMs": int(float(segment.get("end", 0)) * 1000),
                            "confidence": None,
                            "granularity": "segment",
                        }
                    )
            detected_language = body.get("language") or "en"
            language_warning = None
            if detected_language and detected_language != "en" and detected_language != "english":
                language_warning = f"Detected language '{detected_language}'; expected 'en'. Scoring may be unreliable."
            if language_warning:
                logger.warning(language_warning)
            return TranscriptResult(
                text=text.strip(),
                language=detected_language,
                duration_seconds=float(body.get("duration") or 0),
                words=words,
                segments=body.get("segments") or [],
                model=model,
            )
        raise InferenceError(f"STT failed: {last_error}", retryable=True)

    def synthesize(self, text: str) -> tuple[bytes, str]:
        spoken = text.strip()
        if not spoken:
            raise InferenceError("TTS input is empty")
        body = {
            "model": self._config.openrouter_tts_model,
            "input": spoken[:4000],
            "voice": self._config.openrouter_tts_voice,
            "response_format": "mp3",
        }
        response = self._client.post("/audio/speech", json=body)
        if response.status_code >= 400:
            raise InferenceError(f"TTS failed: {response.text[:300]}", retryable=True)
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type != "audio/mpeg" or not response.content:
            raise InferenceError("TTS did not return non-empty MP3 audio", retryable=True)
        return response.content, content_type

    def pronunciation_notes(self, prompt: str) -> dict:
        model = self._config.openrouter_pronunciation_model
        body = {
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You check IELTS-style pronunciation using only the supplied measurements "
                        "and transcript. Do not assign a band. Accent is not an error. "
                        "These measurements do not identify mispronounced phonemes. Never infer sound, stress, "
                        "or intonation errors from transcript text or recognizer confidence. "
                        "Return JSON with findings (supported pace, pause, and recording observations) and notes "
                        "(specific practice drills and limitations), both lists of strings."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
        response = self._client.post("/chat/completions", json=body)
        if response.status_code >= 400:
            raise InferenceError(f"Pronunciation check failed: {response.text[:300]}", retryable=True)
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise InferenceError("Pronunciation check did not return JSON object")
        parsed["model"] = model
        return parsed

    def score_speaking(self, prompt: str) -> ScoreResult:
        models = _unique_models(
            self._config.openrouter_scoring_model,
            self._config.openrouter_scoring_fallback_model,
        )
        errors: list[str] = []
        for model in models:
            messages = [
                {"role": "system", "content": (
                    "You are a fair IELTS speaking practice coach. Score communicative success from the transcript "
                    "and acoustic measurements only. Be consistent and neat: half-band increments, constructive evidence, "
                    "no harsh nitpicking. Never invent quotes. Return JSON only."
                )},
                {"role": "user", "content": prompt},
            ]
            for attempt in range(2):
                body = {"model": model, "temperature": 0.1,
                        "response_format": {"type": "json_object"}, "messages": messages}
                record_scoring_call()
                response = self._client.post("/chat/completions", json=body)
                if response.status_code >= 400:
                    record_model_call_error()
                    errors.append(f"{model}: {response.text[:300]}")
                    break
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                try:
                    parsed = json.loads(content)
                    validated = ScoreSchema.model_validate(parsed)
                except (json.JSONDecodeError, ValidationError) as exc:
                    record_model_call_error()
                    if isinstance(exc, ValidationError):
                        details = "; ".join(
                            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                            for error in exc.errors(include_input=False, include_url=False)
                        )
                    else:
                        details = "Response must be valid JSON without markdown fences."
                    errors.append(f"{model}: {details}")
                    if attempt == 0:
                        messages.extend([
                            {"role": "assistant", "content": content},
                            {"role": "user", "content": "Correct the response format using the original evidence. Do not add unsupported claims. "
                             + details + "\nReturn a JSON instance matching this schema: " + json.dumps(ScoreSchema.model_json_schema())},
                        ])
                    continue
                return ScoreResult(
                    raw=validated.model_dump(), model=model,
                    generation_id=payload.get("id") or response.headers.get("X-Generation-Id"),
                )
        raise InferenceError(f"Scoring failed: {'; '.join(errors)}", retryable=True)

    def chat_json(self, system: str, prompt: str, models: list[str] | None = None) -> dict:
        chosen = _dedupe_models(
            models
            or [
                self._config.openrouter_scoring_model,
                self._config.openrouter_scoring_fallback_model,
            ]
        )
        last_error = "chat failed"
        for model in chosen:
            body = {
                "model": model,
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            }
            response = self._client.post("/chat/completions", json=body)
            if response.status_code >= 400:
                last_error = response.text[:300]
                continue
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            parsed = _parse_json_object(content)
            if isinstance(parsed, dict):
                return parsed
            last_error = "model did not return a JSON object"
        raise InferenceError(f"Examiner turn failed: {last_error}", retryable=True)


def _parse_json_object(content: str) -> dict | None:
    text = content.strip()
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _unique_models(primary: str, fallback: str) -> list[str]:
    return _dedupe_models([primary, fallback])


def _dedupe_models(models: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for model in models:
        if model and model not in seen:
            seen.add(model)
            unique.append(model)
    return unique
