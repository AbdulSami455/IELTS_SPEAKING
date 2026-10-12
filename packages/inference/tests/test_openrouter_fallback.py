"""Provider failure handling: transport errors fall through to the fallback model, then surface as retryable."""

from __future__ import annotations

import json

import httpx
import pytest
from ielts_inference.openrouter import InferenceError, OpenRouterClient
from test_openrouter import _config


def _client(handler) -> OpenRouterClient:
    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    return client


def _score_body(band: float = 6.0) -> dict:
    criteria = [
        {"criterion": name, "band": band, "confidence": "medium", "subdimensions": {}, "evidence": []}
        for name in ("fluency_and_coherence", "lexical_resource", "grammatical_range_and_accuracy", "pronunciation")
    ]
    return {"choices": [{"message": {"content": json.dumps({"criteria": criteria, "strengths": ["ok"], "improvements": ["more"]})}}]}


def test_scoring_falls_back_when_primary_times_out():
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        seen.append(model)
        if model == "google/gemma-3-27b-it:free":
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(200, json=_score_body())

    result = _client(handler).score_speaking("prompt")
    assert seen == ["google/gemma-3-27b-it:free", "google/gemma-3-27b-it"]
    assert result.model == "google/gemma-3-27b-it"


def test_scoring_raises_retryable_when_every_model_fails():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(InferenceError) as excinfo:
        _client(handler).score_speaking("prompt")
    assert excinfo.value.retryable is True
    assert "timeout" not in str(excinfo.value).lower() or "ConnectError" in str(excinfo.value)


def test_scoring_handles_missing_content_without_crashing():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": None}}]})

    with pytest.raises(InferenceError) as excinfo:
        _client(handler).score_speaking("prompt")
    assert excinfo.value.retryable is True


def test_rate_limited_response_is_retried_once():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"retry-after": "0"}, json={"error": "slow down"})
        return httpx.Response(200, json=_score_body())

    result = _client(handler).score_speaking("prompt")
    assert calls["n"] == 2
    assert result.model == "google/gemma-3-27b-it:free"


def test_transcribe_falls_back_on_transport_error():
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = request.content.decode(errors="ignore")
        # multipart body; the model name appears in the form data
        if "whisper-large-v3-turbo" in model and "turbo" not in "".join(seen):
            seen.append("turbo")
            raise httpx.ConnectError("boom", request=request)
        seen.append("fallback")
        return httpx.Response(200, json={"text": "hello there", "language": "en", "duration": 1.0, "words": []})

    result = _client(handler).transcribe(b"RIFF", "wav")
    assert result.text == "hello there"
    assert seen == ["turbo", "fallback"]


def test_synthesize_uses_fallback_model_when_configured():
    config = _config()
    object.__setattr__(config, "openrouter_tts_fallback_model", "backup/tts")
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        seen.append(model)
        if model == "openai/gpt-4o-mini-tts":
            return httpx.Response(502, text="bad gateway")
        return httpx.Response(200, content=b"\xff\xfb" + b"0" * 2048, headers={"content-type": "audio/mpeg"})

    client = OpenRouterClient(config)
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    audio, mime = client.synthesize("Hello learner")
    assert mime.startswith("audio/")
    assert len(audio) > 1024
    assert seen == ["openai/gpt-4o-mini-tts", "backup/tts"]
