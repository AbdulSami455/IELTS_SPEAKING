from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from ielts_api.services.tests import TestService as SpeakingService
from ielts_db.storage import ObjectHead


@pytest.mark.asyncio
@pytest.mark.parametrize("head, regenerate", [
    (ObjectHead(True, 4000, None, "audio/pcm"), True),
    (ObjectHead(True, 0, None, "audio/mpeg"), True),
    (ObjectHead(False, 0, None, None), True),
    (ObjectHead(True, 4000, None, "audio/mpeg"), False),
])
async def test_examiner_audio_repairs_incompatible_cache(monkeypatch, head, regenerate):
    session = AsyncMock()
    config = SimpleNamespace(
        openrouter_tts_voice="alloy", openrouter_tts_model="tts",
        minio_examiner_bucket="examiner", minio_signed_url_ttl_seconds=900,
    )
    store = MagicMock()
    store.head.return_value = head
    store.presigned_get.return_value = "https://storage/question.mp3"
    service = SpeakingService(session, config, store)
    question = SimpleNamespace(id=87, prompt_text="Where are you from?", cue_card=None, examiner_asset_version="v1")
    service.tests.get_owned = AsyncMock(return_value=SimpleNamespace(session_questions=[question]))
    service.users.get_by_id = AsyncMock(return_value=SimpleNamespace(voice_preference=None))
    client = MagicMock()
    client.synthesize.return_value = (b"ID3audio", "audio/mpeg")
    monkeypatch.setattr("ielts_inference.openrouter.OpenRouterClient", lambda *_args, **_kwargs: client)
    reserve = AsyncMock()
    monkeypatch.setattr("ielts_inference.quota.reserve_model_call", reserve)

    result = await service.examiner_audio(1, "test", "87")

    assert result["playback_url"] == "https://storage/question.mp3"
    if regenerate:
        client.synthesize.assert_called_once_with(question.prompt_text)
        store.put_bytes.assert_called_once_with("examiner", store.head.call_args.args[1], b"ID3audio", "audio/mpeg")
        session.commit.assert_awaited_once()
    else:
        client.synthesize.assert_not_called()
        store.put_bytes.assert_not_called()
        reserve.assert_not_awaited()
