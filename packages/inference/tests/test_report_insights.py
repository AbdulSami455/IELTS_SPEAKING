from ielts_inference.report_insights import (
    build_fluency_insights,
    build_pronunciation_insights,
    build_vocabulary_insights,
)


def test_vocabulary_insights_from_transcript():
    transcripts = [{"text": "I enjoy photography and environmental conservation projects."}]
    criteria = [
        {
            "criterion": "lexical_resource",
            "band": 6.5,
            "confidence": "medium",
            "evidence": [{"quote": "environmental conservation", "note": "Strong collocation."}],
        }
    ]
    out = build_vocabulary_insights(transcripts, criteria, [])
    assert out["has_content"]
    assert "photography" in out["words_you_used"] or "environmental" in out["words_you_used"]
    assert out["lexical_highlights"][0]["quote"] == "environmental conservation"


def test_pronunciation_insights_humanizes_issues():
    out = build_pronunciation_insights(
        [{"unclear_words": ["thorough"], "issues": ["low_word_confidence"], "words_per_minute": 140}],
        None,
    )
    assert out["practice_words"] == ["thorough"]
    assert out["improvements"][0]["title"] == "Some words were unclear to the recogniser"


def test_fluency_insights_includes_metrics():
    out = build_fluency_insights(
        ["Good coherence across answers."],
        [{"words_per_minute": 130, "pause_count": 2}],
        [{"criterion": "fluency_and_coherence", "band": 6.0, "confidence": "medium", "evidence": []}],
        [{"text": "I like reading. I read every day."}],
    )
    assert out["metrics"][0]["label"] == "Average pace"
    assert out["observations"][0]["body"] == "Good coherence across answers."
