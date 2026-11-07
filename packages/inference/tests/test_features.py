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


def test_pause_features_use_audio_duration_not_broken_timestamps():
    from ielts_audio.media import pause_features

    words = [{"w": "hello", "start": 0.0, "end": 0.2}, {"w": "there", "start": 0.3, "end": 0.5}] * 40
    result = pause_features(words, duration_ms=40_000)
    assert result["words_per_minute"] <= 250
    assert result["words_per_minute"] < 200


def test_clean_transcript_drops_non_english_script():
    from ielts_inference.transcript import clean_transcript

    assert "pizza" in clean_transcript("I received pizza. 有的。 别把人冲了。").lower()
    assert "有" not in clean_transcript("I received pizza. 有的。")


def test_clean_transcript_drops_punctuation_only_noise():
    from ielts_inference.transcript import clean_transcript

    assert clean_transcript("！ ！ ， ， 。") == ""
    assert clean_transcript("？ ， 。") == ""
    assert clean_transcript("OK.") == "OK."
    from ielts_audio.media import acoustic_observations

    result = acoustic_observations(b"not-a-wav", [{"w": "hello", "startMs": 0, "endMs": 200}])
    assert result["band"] is None
    assert "coverage" in result
