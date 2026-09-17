import json

import httpx
import pytest

from ielts_config.config import EnvironmentConfig
from ielts_inference.openrouter import InferenceError, OpenRouterClient


def _config() -> EnvironmentConfig:
    return EnvironmentConfig(
        app_env="development",
        web_origin="http://localhost:3000",
        api_host="0.0.0.0",
        api_port=4000,
        auth_mode="dev",
        dev_auth_user_id="x",
        auth_token_secret="",
        auth_jwt_issuer="",
        auth_jwt_audience="",
        inference_mode="openrouter",
        database_url="postgresql://ielts:ielts@localhost/ielts",
        redis_url="redis://localhost:6379/0",
        celery_broker_url="redis://localhost:6379/1",
        minio_endpoint="http://localhost:9000",
        minio_access_key="minio",
        minio_secret_key="minio-development-only",
        minio_region="us-east-1",
        minio_candidate_bucket="ielts-candidate-private",
        minio_derivative_bucket="ielts-derived-private",
        minio_examiner_bucket="ielts-examiner-private",
        minio_force_path_style=True,
        minio_signed_url_ttl_seconds=900,
        openrouter_api_key="test-key",
        openrouter_base_url="https://openrouter.ai/api/v1",
        openrouter_stt_model="openai/whisper-large-v3-turbo",
        openrouter_stt_fallback_model="openai/whisper-large-v3",
        openrouter_tts_model="openai/gpt-4o-mini-tts",
        openrouter_tts_voice="alloy",
        openrouter_scoring_model="google/gemma-3-27b-it:free",
        openrouter_scoring_fallback_model="google/gemma-3-27b-it",
        openrouter_pronunciation_model="google/gemma-3-27b-it:free",
        realtime_transport="websocket",
        realtime_llm_model="google/gemma-3-27b-it",
        realtime_stt_model="openai/whisper-large-v3-turbo",
        realtime_tts_model="openai/gpt-4o-mini-tts",
        realtime_tts_voice="alloy",
        raw_audio_retention_days=7,
        transcript_retention_days=30,
        report_retention_days=365,
        upload_max_bytes_per_answer=26214400,
        upload_max_bytes_per_test=104857600,
        log_level="info",
        free_request_daily_hard_limit=1000,
        free_request_daily_soft_limit=800,
        paid_daily_budget_usd=5.0,
        paid_test_cost_ceiling_usd=0.035,
    )


def test_transcribe_parses_verbose_json(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/audio/transcriptions")
        return httpx.Response(
            200,
            json={
                "text": "I live near a market.",
                "language": "en",
                "duration": 2.4,
                "words": [{"word": "I", "start": 0.0, "end": 0.2}],
            },
        )

    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    result = client.transcribe(b"RIFF", "wav")
    assert result.text == "I live near a market."
    assert result.words[0]["w"] == "I"


def test_synthesize_returns_audio_bytes():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/audio/speech")
        assert json.loads(request.content)["response_format"] == "mp3"
        return httpx.Response(200, content=b"ID3fake", headers={"content-type": "audio/mpeg"})

    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    audio, content_type = client.synthesize("Where are you from?")
    assert audio.startswith(b"ID3")
    assert content_type == "audio/mpeg"


@pytest.mark.parametrize("content_type, content", [
    ("audio/pcm", b"raw-pcm"),
    ("application/json", b'{"error":"provider failed"}'),
    ("audio/mpeg", b""),
    ("", b"unknown"),
])
def test_synthesize_rejects_unplayable_response(content_type, content):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=content, headers={"content-type": content_type})

    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    with pytest.raises(InferenceError, match="MP3 audio") as exc:
        client.synthesize("Where are you from?")
    assert exc.value.retryable


def test_score_speaking_requires_json_object():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "gen-1",
                "choices": [
                    {
                        "message": {
                            "content": '{"criteria":[{"criterion":"fluency_and_coherence","band":6.5,"confidence":"medium"}]}'
                        }
                    }
                ],
            },
        )

    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    scored = client.score_speaking("score this")
    assert scored.raw["criteria"][0]["band"] == 6.5
    assert scored.generation_id == "gen-1"


def test_score_repairs_malformed_primary_response_before_fallback():
    import json
    calls = []
    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        content = '{"criteria":[{"criterion":"fluency_and_coherence|lexical_resource","band":6,"confidence":"medium"}],"practicePlan":[]}' if len(calls) == 1 else '{"criteria":[{"criterion":"fluency_and_coherence","band":6,"confidence":"medium"}],"practicePlan":{"days":[]}}'
        return httpx.Response(200, json={"choices":[{"message":{"content":content}}]})
    client = OpenRouterClient(_config())
    client._client = httpx.Client(transport=httpx.MockTransport(handler), base_url="https://openrouter.ai/api/v1")
    result = client.score_speaking("Use the supplied evidence")
    assert result.raw["criteria"][0]["criterion"] == "fluency_and_coherence"
    assert len(calls) == 2
    assert calls[0]["model"] == calls[1]["model"]
    assert len(calls[1]["messages"]) == 4
