from ielts_inference.assembler import assemble


def test_assembler_rounds_and_does_not_invent_missing_criteria():
    result = assemble(
        {
            "criteria": [
                {"criterion": "fluency_and_coherence", "band": 6.2, "confidence": "high", "evidence": [{"quote": "I go"}]},
                {"criterion": "lexical_resource", "band": 6.8, "confidence": "medium", "evidence": [{"quote": "market"}]},
                {"criterion": "grammatical_range_and_accuracy", "band": 5.9, "confidence": "medium", "evidence": []},
                {"criterion": "pronunciation", "band": 7.1, "confidence": "high", "evidence": []},
            ],
            "strengths": ["Clear topic"],
            "improvements": ["Extend answers"],
            "transcripts": [{"text": "I go to the market"}],
        },
        {"speaking_duration_ms": 120_000, "silence_ratio": 0.1},
        acoustic_coverage=0.8,
    )
    bands = {item["criterion"]: item["band"] for item in result["criteria"]}
    assert bands["fluency_and_coherence"] == 6.0
    assert bands["lexical_resource"] == 7.0
    assert bands["grammatical_range_and_accuracy"] == 6.0
    assert bands["pronunciation"] == 7.0
    assert result["overall_band"] == 6.5
    assert result["is_inconclusive"] is False
    assert all(len(item["evidence"]) >= 0 for item in result["criteria"])


def test_short_speech_is_inconclusive_not_a_fake_band():
    result = assemble(
        {
            "criteria": [
                {"criterion": "fluency_and_coherence", "band": 8, "confidence": "high"},
                {"criterion": "lexical_resource", "band": 8, "confidence": "high"},
                {"criterion": "grammatical_range_and_accuracy", "band": 8, "confidence": "high"},
                {"criterion": "pronunciation", "band": 8, "confidence": "high"},
            ],
            "transcripts": [{"text": "short"}],
        },
        {"speaking_duration_ms": 8_000, "silence_ratio": 0.1},
        acoustic_coverage=0.9,
    )
    assert result["is_inconclusive"] is True
    assert result["overall_band"] is None


def test_missing_model_criteria_are_inconclusive():
    result = assemble({}, {"speaking_duration_ms": 120_000, "silence_ratio": 0.1}, acoustic_coverage=0.9)
    assert result["is_inconclusive"] is True
    assert result["overall_band"] is None
    assert all(item["confidence"] == "inconclusive" for item in result["criteria"])


def test_hallucination_guard_softens_single_criterion_without_killing_whole_report():
    result = assemble(
        {
            "criteria": [
                {
                    "criterion": "fluency_and_coherence",
                    "band": 7.0,
                    "confidence": "high",
                    "evidence": [{"quote": "this quote appears nowhere in the transcript", "note": "test"}],
                },
                {"criterion": "lexical_resource", "band": 6.5, "confidence": "medium", "evidence": []},
                {"criterion": "grammatical_range_and_accuracy", "band": 6.0, "confidence": "medium", "evidence": []},
                {"criterion": "pronunciation", "band": 6.5, "confidence": "medium", "evidence": []},
            ],
            "transcripts": [{"text": "I went to the market today"}],
        },
        {"speaking_duration_ms": 120_000, "silence_ratio": 0.1},
        acoustic_coverage=0.8,
    )
    assert result["is_inconclusive"] is False
    assert result["overall_band"] == 6.5
    fluency = next(item for item in result["criteria"] if item["criterion"] == "fluency_and_coherence")
    assert fluency["confidence"] == "low"
    assert len(result["_hallucination_flags"]) > 0


def test_hallucination_guard_passes_matching_evidence():
    result = assemble(
        {
            "criteria": [
                {
                    "criterion": "fluency_and_coherence",
                    "band": 7.0,
                    "confidence": "high",
                    "evidence": [{"quote": "I went to the market", "note": "spoke clearly"}],
                },
                {
                    "criterion": "lexical_resource",
                    "band": 7.0,
                    "confidence": "high",
                    "evidence": [],
                },
                {
                    "criterion": "grammatical_range_and_accuracy",
                    "band": 7.0,
                    "confidence": "high",
                    "evidence": [],
                },
                {
                    "criterion": "pronunciation",
                    "band": 7.0,
                    "confidence": "high",
                    "evidence": [],
                },
            ],
            "transcripts": [{"text": "I went to the market today and bought some fruit"}],
        },
        {"speaking_duration_ms": 120_000, "silence_ratio": 0.1},
        acoustic_coverage=0.8,
    )
    assert result["is_inconclusive"] is False
    assert result["overall_band"] is not None
