"""Deterministic linguistic features from transcript and timing."""

from __future__ import annotations

import re

FILLERS = {"um", "uh", "erm", "like", "you know"}


def extract_features(text: str, words: list[dict], acoustic: dict) -> dict:
    tokens = re.findall(r"[A-Za-z']+", text.lower())
    unique = set(tokens)
    fillers = [token for token in tokens if token in FILLERS]
    sentences = [part for part in re.split(r"[.!?]+", text) if part.strip()]
    duration_ms = acoustic.get("duration_ms") or 0
    from ielts_audio.media import pause_features

    pauses = pause_features(words) if words else {
        "pause_count": 0,
        "mean_pause_seconds": 0,
        "words_per_minute": 0,
        "mean_length_of_run": 0,
        "speaking_duration_ms": duration_ms,
    }
    ttr = round(len(unique) / max(len(tokens), 1), 3)
    return {
        "word_count": len(tokens),
        "unique_word_count": len(unique),
        "type_token_ratio": ttr,
        "sentence_count": len(sentences),
        "filler_count": len(fillers),
        "mean_sentence_words": round(len(tokens) / max(len(sentences), 1), 2),
        "silence_ratio": acoustic.get("silence_ratio"),
        "clipping_ratio": acoustic.get("clipping_ratio"),
        "speech_ratio": acoustic.get("speech_ratio"),
        "rms": acoustic.get("rms"),
        **pauses,
    }
