"""Conversation question generation safeguards."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from ielts_api.services.conversation import ConversationOrchestrator


@pytest.mark.asyncio
async def test_chat_turn_retries_a_repeated_question(monkeypatch: pytest.MonkeyPatch) -> None:
    generated = AsyncMock(
        side_effect=[
            {"question": "Should cities provide more opportunities for outdoor activities?"},
            {"question": "Why do some people spend little time outdoors?"},
        ]
    )
    monkeypatch.setattr(ConversationOrchestrator, "_chat_json", generated)
    orchestrator = ConversationOrchestrator.__new__(ConversationOrchestrator)

    turn = await orchestrator._chat_turn(
        SimpleNamespace(),
        "system",
        "prompt",
        timing_seconds=40,
        excluded_prompts=["Should cities provide more opportunities for outdoor activities?"],
    )

    assert turn.prompt_text == "Why do some people spend little time outdoors?"
    assert generated.await_count == 2
