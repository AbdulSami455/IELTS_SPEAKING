from ielts_inference.report_compare import compare_reports


def _criteria(**bands: float) -> list[dict]:
    return [
        {"criterion": key, "band": value, "confidence": "medium"}
        for key, value in bands.items()
    ]


def test_compare_reports_shows_band_improvements_and_mistake_trends():
    result = compare_reports(
        current_criteria=_criteria(
            fluency_and_coherence=6.5,
            lexical_resource=6.0,
            grammatical_range_and_accuracy=5.5,
            pronunciation=6.0,
        ),
        previous_criteria=_criteria(
            fluency_and_coherence=6.0,
            lexical_resource=6.0,
            grammatical_range_and_accuracy=5.5,
            pronunciation=6.0,
        ),
        current_mistakes=[{"type": "grammar", "quote": "I go there yesterday", "correction": "I went there yesterday"}],
        previous_mistakes=[
            {"type": "grammar", "quote": "I go there yesterday", "correction": "I went there yesterday"},
            {"type": "phrase", "quote": "very good food", "correction": "delicious food"},
        ],
        current_overall=6.0,
        previous_overall=5.5,
        previous_created_at="2026-09-01T10:00:00+00:00",
    )
    assert result["overall_delta"] == 0.5
    assert any("Fluency" in item for item in result["improved_areas"])
    assert result["mistake_trends"]["resolved"]
    assert result["mistake_trends"]["recurring"]
    assert result["mistake_trends"]["new_issues"] == []
