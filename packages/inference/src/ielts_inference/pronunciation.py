"""Pronunciation checks from STT confidence and acoustics. Never assigns a band."""

from __future__ import annotations


def check_pronunciation(
    words: list[dict],
    features: dict,
    coverage: float,
) -> dict:
    unclear: list[str] = []
    for item in words:
        token = str(item.get("w") or "").strip()
        confidence = item.get("confidence")
        if not token or item.get("granularity") == "segment" or len(token.split()) > 1:
            continue
        if isinstance(confidence, (int, float)) and confidence < 0.55:
            unclear.append(token)
    issues: list[str] = []
    wpm = float(features.get("words_per_minute") or 0)
    word_count = int(features.get("word_count") or 0)
    pause_count = int(features.get("pause_count") or 0)
    silence = float(features.get("silence_ratio") or 0)
    clipping = float(features.get("clipping_ratio") or 0)
    if word_count >= 20 and wpm > 190:
        issues.append("speech_rate_fast")
    if word_count >= 20 and 0 < wpm < 80:
        issues.append("speech_rate_slow")
    if pause_count >= 6:
        issues.append("frequent_pauses")
    if silence > 0.35:
        issues.append("high_silence")
    if clipping > 0.08:
        issues.append("clipping")
    if unclear:
        issues.append("low_word_confidence")
    confidence = "high"
    if coverage < 0.7 or word_count < 12:
        confidence = "low" if word_count else "inconclusive"
    elif issues:
        confidence = "medium"
    result = {
        "unclear_words": unclear[:20],
        "issues": issues,
        "words_per_minute": wpm,
        "pause_count": pause_count,
        "coverage": round(coverage, 3),
        "confidence": confidence,
    }
    if wpm > 190 and word_count >= 20:
        result["telemetry"] = {"speech_rate_warning": True, "wpm": wpm}
    elif 0 < wpm < 80 and word_count >= 20:
        result["telemetry"] = {"speech_rate_warning": True, "wpm": wpm, "too_slow": True}
    return result
