"""Tests for LLM prompt injection guards and hallucination detection."""

from ielts_inference.assembler import _evidence_is_grounded, _normalize_text, assemble
from ielts_inference.evaluation import _build_scoring_prompt, _guard_transcript
from ielts_inference.openrouter import ScoreSchema


def test_guard_transcript_wraps_in_delimiters():
    result = _guard_transcript("Hello world")
    assert "<CANDIDATE_TRANSCRIPT>" in result
    assert "</CANDIDATE_TRANSCRIPT>" in result
    assert "Hello world" in result


def test_guard_transcript_escapes_angle_brackets():
    result = _guard_transcript("Tell me <script>alert(1)</script>")
    assert "<script>" not in result
    assert "&lt;script&gt;" in result


def test_guard_transcript_in_scoring_prompt():
    part_payloads = [{"transcript": "I went to the store"}]
    prompt = _build_scoring_prompt(part_payloads, {"speaking_duration_ms": 120000}, 0.8, [])
    assert "<CANDIDATE_TRANSCRIPT>" in prompt
    assert "<!-- NO_EXECUTE" in prompt or "<NO_EXECUTE>" in prompt


def test_evidence_is_grounded_matches():
    transcript = "i went to the market today and bought some fruit"
    assert _evidence_is_grounded("I went to the market", transcript) is True
    assert _evidence_is_grounded("bought some fruit", transcript) is True


def test_evidence_is_grounded_rejects_hallucination():
    transcript = "i went to the market today"
    assert _evidence_is_grounded("I visited Paris last summer", transcript) is False


def test_normalize_text_strips_punctuation():
    assert _normalize_text("Hello, World!") == "hello world"
    assert _normalize_text("It's  a  test.") == "its a test"


def test_score_schema_validates_correct_input():
    data = {
        "criteria": [
            {"criterion": "fluency_and_coherence", "band": 6.5, "confidence": "high"},
        ],
        "strengths": ["clear flow"],
        "improvements": ["extend answers"],
        "mistakes": [],
        "fluencyNotes": ["good pace"],
        "exampleRewrites": [],
        "practicePlan": {"days": []},
    }
    validated = ScoreSchema.model_validate(data)
    assert validated.criteria[0].band == 6.5


def test_score_schema_rejects_invalid_criterion():
    import pytest
    from pydantic import ValidationError

    data = {
        "criteria": [
            {"criterion": "invalid_criterion", "band": 6.5, "confidence": "high"},
        ],
        "strengths": [],
        "improvements": [],
        "mistakes": [],
        "fluencyNotes": [],
        "exampleRewrites": [],
        "practicePlan": {"days": []},
    }
    with pytest.raises(ValidationError):
        ScoreSchema.model_validate(data)


def test_score_schema_rejects_invalid_confidence():
    import pytest
    from pydantic import ValidationError

    data = {
        "criteria": [
            {"criterion": "fluency_and_coherence", "band": 6.5, "confidence": "invalid"},
        ],
        "strengths": [],
        "improvements": [],
        "mistakes": [],
        "fluencyNotes": [],
        "exampleRewrites": [],
        "practicePlan": {"days": []},
    }
    with pytest.raises(ValidationError):
        ScoreSchema.model_validate(data)


def test_score_schema_clamps_band():
    data = {
        "criteria": [
            {"criterion": "fluency_and_coherence", "band": 99.0, "confidence": "high"},
        ],
        "strengths": [],
        "improvements": [],
        "mistakes": [],
        "fluencyNotes": [],
        "exampleRewrites": [],
        "practicePlan": {"days": []},
    }
    validated = ScoreSchema.model_validate(data)
    assert validated.criteria[0].band == 9.0


def test_assembler_rejects_non_grounded_mistakes():
    result = assemble(
        {
            "criteria": [
                {"criterion": "fluency_and_coherence", "band": 7.0, "confidence": "high", "evidence": []},
                {"criterion": "lexical_resource", "band": 7.0, "confidence": "high", "evidence": []},
                {"criterion": "grammatical_range_and_accuracy", "band": 7.0, "confidence": "high", "evidence": []},
                {"criterion": "pronunciation", "band": 7.0, "confidence": "high", "evidence": []},
            ],
            "mistakes": [
                {"type": "grammar", "quote": "invented quote", "correction": "fix", "note": "test"},
            ],
            "transcripts": [{"text": "real transcript text here"}],
        },
        {"speaking_duration_ms": 120_000, "silence_ratio": 0.1},
        acoustic_coverage=0.8,
    )
    assert len(result["_hallucination_flags"]) > 0
    assert result["mistakes"] == []
