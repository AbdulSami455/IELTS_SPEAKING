"""Normalize STT text before it is stored or scored."""

from __future__ import annotations

import re

_NON_LATIN = re.compile(
    r"[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+"
)
_SPEECH_CHARS = re.compile(r"[A-Za-z0-9]")


def clean_transcript(text: str) -> str:
    cleaned = _NON_LATIN.sub(" ", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Drop STT noise that is only punctuation / symbols (common with false barge-ins).
    if len(_SPEECH_CHARS.findall(cleaned)) < 2:
        return ""
    return cleaned
