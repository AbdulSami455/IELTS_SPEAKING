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


def test_confidence_below_threshold_is_flagged():
    result = check_pronunciation(
        [
            {"w": "market", "confidence": 0.54},
            {"w": "village", "confidence": 0.55},
            {"w": "beautiful", "confidence": 0.30},
        ],
        {"words_per_minute": 150, "word_count": 30, "pause_count": 2},
        coverage=0.7,
    )
    assert "market" in result["unclear_words"]
    assert "beautiful" in result["unclear_words"]
    assert "village" not in result["unclear_words"]
    assert "low_word_confidence" in result["issues"]


def test_confidence_downgraded_when_coverage_below_threshold():
    result = check_pronunciation(
        [{"w": "hello", "confidence": 0.9}],
        {"words_per_minute": 150, "word_count": 20, "pause_count": 1},
        coverage=0.55,
    )
    assert result["confidence"] == "low"


def test_pronunciation_downgrades_confidence_for_coverage_below_thresholds():
    result = check_pronunciation(
        [{"w": "hello", "confidence": 0.9}],
        {"words_per_minute": 150, "word_count": 20, "pause_count": 1},
        coverage=0.69,
    )
    assert result["confidence"] == "low"

    result = check_pronunciation([], {"words_per_minute": 0, "word_count": 0, "pause_count": 0}, coverage=0.7)
    assert result["confidence"] == "inconclusive"
