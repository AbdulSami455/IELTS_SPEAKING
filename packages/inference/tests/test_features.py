from ielts_inference.features import extract_features


def test_features_are_deterministic_and_do_not_assign_a_band():
    text = "I usually go to the market. Um I buy fruit and then I go home."
    words = [
        {"w": "I", "startMs": 0, "endMs": 200},
        {"w": "usually", "startMs": 210, "endMs": 600},
        {"w": "go", "startMs": 1100, "endMs": 1300},
    ]
    first = extract_features(text, words, {"duration_ms": 4000, "silence_ratio": 0.2, "clipping_ratio": 0.0, "speech_ratio": 0.8, "rms": 0.1})
    second = extract_features(text, words, {"duration_ms": 4000, "silence_ratio": 0.2, "clipping_ratio": 0.0, "speech_ratio": 0.8, "rms": 0.1})
    assert first == second
    assert "band" not in first
    assert first["filler_count"] >= 1
    assert first["word_count"] > 0


def test_acoustic_observations_never_assign_a_band():
    from ielts_audio.media import acoustic_observations

    result = acoustic_observations(b"not-a-wav", [{"w": "hello", "startMs": 0, "endMs": 200}])
    assert result["band"] is None
    assert "coverage" in result
