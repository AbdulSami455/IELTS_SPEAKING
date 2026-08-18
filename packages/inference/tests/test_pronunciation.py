from ielts_inference.pronunciation import check_pronunciation


def test_pronunciation_flags_low_confidence_without_a_band():
    words = [
        {"w": "village", "confidence": 0.2},
        {"w": "market", "confidence": 0.9},
    ]
    result = check_pronunciation(
        words,
        {"words_per_minute": 210, "word_count": 40, "pause_count": 8, "silence_ratio": 0.1, "clipping_ratio": 0.0},
        coverage=0.9,
    )
    assert "band" not in result
    assert "village" in result["unclear_words"]
    assert "speech_rate_fast" in result["issues"]
    assert "frequent_pauses" in result["issues"]


def test_pronunciation_is_inconclusive_when_coverage_is_poor():
    result = check_pronunciation([], {"words_per_minute": 0, "word_count": 0, "pause_count": 0}, coverage=0.1)
    assert result["confidence"] == "inconclusive"
