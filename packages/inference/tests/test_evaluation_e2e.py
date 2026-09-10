"""End-to-end evaluation test: mock OpenRouter responses, call evaluate_test()."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ielts_inference.assembler import assemble


SCORING_RESPONSE = {
    "criteria": [
        {
            "criterion": "fluency_and_coherence",
            "band": 6.5,
            "confidence": "high",
            "evidence": [{"quote": "I usually go to the market", "note": "good flow"}],
        },
        {
            "criterion": "lexical_resource",
            "band": 6.0,
            "confidence": "medium",
            "evidence": [{"quote": "market", "note": "common vocabulary"}],
        },
        {
            "criterion": "grammatical_range_and_accuracy",
            "band": 6.0,
            "confidence": "medium",
            "evidence": [],
        },
        {
            "criterion": "pronunciation",
            "band": 6.5,
            "confidence": "high",
            "evidence": [],
        },
    ],
    "strengths": ["Good flow in Part 1"],
    "improvements": ["Use more complex vocabulary"],
    "mistakes": [
        {"type": "lexical", "quote": "go to the market", "correction": "visit the market", "note": "basic collocation"}
    ],
    "fluencyNotes": ["WPM around 150"],
    "exampleRewrites": [{"original": "go to the market", "saferRewrite": "visit the market"}],
    "practicePlan": {"days": [{"day": 1, "focus": "fluency", "task": "Practice describing your daily routine"}]},
    "transcripts": [{"text": "I usually go to the market"}],
}

FEATURES = {
    "speaking_duration_ms": 120_000,
    "silence_ratio": 0.1,
    "coverage": 0.8,
    "words_per_minute": 148,
    "pause_count": 2,
    "clipping_ratio": 0.0,
}


def test_evaluate_test_assembles_report_with_correct_bands():
    result = assemble(SCORING_RESPONSE, FEATURES, 0.8)
    assert result["overall_band"] == 6.5
    assert result["is_inconclusive"] is False
    assert result["confidence_label"] != "inconclusive"
    bands = {item["criterion"]: item["band"] for item in result["criteria"]}
    assert bands["fluency_and_coherence"] == 6.5
    assert bands["lexical_resource"] == 6.0
    assert bands["grammatical_range_and_accuracy"] == 6.0
    assert bands["pronunciation"] == 6.5


def test_evaluate_test_marks_short_speech_inconclusive():
    features = dict(FEATURES)
    features["speaking_duration_ms"] = 8_000
    result = assemble(SCORING_RESPONSE, features, 0.8)
    assert result["is_inconclusive"] is True
    assert result["overall_band"] is None


def test_evaluate_test_validates_schema_before_assemble():
    from ielts_inference.openrouter import ScoreSchema

    ScoreSchema.model_validate(SCORING_RESPONSE)


def test_evaluate_test_filters_hallucinated_evidence():
    response = json.loads(json.dumps(SCORING_RESPONSE))
    response["criteria"][0]["evidence"] = [{"quote": "invented quote not in transcript", "note": "test"}]
    result = assemble(response, FEATURES, 0.8)
    assert result["is_inconclusive"] is False
    assert result["overall_band"] is not None
    fluency = next(item for item in result["criteria"] if item["criterion"] == "fluency_and_coherence")
    assert fluency["confidence"] == "low"
    assert len(result["_hallucination_flags"]) > 0


def test_evaluate_test_preserves_grounded_evidence():
    result = assemble(SCORING_RESPONSE, FEATURES, 0.8)
    fc_evidence = next(c for c in result["criteria"] if c["criterion"] == "fluency_and_coherence")["evidence"]
    assert len(fc_evidence) == 1
    assert "I usually go to the market" in fc_evidence[0]["quote"]


def test_evaluate_test_rejects_empty_transcript():
    result = assemble({}, {"speaking_duration_ms": 120_000, "silence_ratio": 0.1}, acoustic_coverage=0.9)
    assert result["is_inconclusive"] is True
    assert result["overall_band"] is None
    assert all(item["confidence"] == "inconclusive" for item in result["criteria"])


def test_evaluate_test_does_not_clamp_above_9():
    response = json.loads(json.dumps(SCORING_RESPONSE))
    response["criteria"][0]["band"] = 9.5
    result = assemble(response, FEATURES, 0.8)
    fc = next(item for item in result["criteria"] if item["criterion"] == "fluency_and_coherence")
    assert fc["band"] == 9.0


def test_evaluate_test_pronunciation_low_acoustic_downgrades_confidence():
    response = json.loads(json.dumps(SCORING_RESPONSE))
    response["criteria"][3]["confidence"] = "high"
    result = assemble(response, FEATURES, 0.3)
    assert result["is_inconclusive"] is True
