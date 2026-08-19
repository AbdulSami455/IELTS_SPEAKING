"""Normalize STT text before it is stored or scored."""

from __future__ import annotations

import re

_NON_LATIN = re.compile(
    r"[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+"
)


def clean_transcript(text: str) -> str:
    cleaned = _NON_LATIN.sub(" ", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()
