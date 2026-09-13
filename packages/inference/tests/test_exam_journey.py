from ielts_inference.exam_journey import build_exam_history


class _Report:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Test:
    def __init__(self, id: str):
        self.id = id


def test_build_exam_history_and_journey():
    rows = [
        (_Test("t1"), _Report(evaluator_version="eval-1", is_inconclusive=False, overall_band=6.0, created_at=type("D", (), {"isoformat": lambda self: "2026-01-01"})(), id="r1")),
        (_Test("t2"), _Report(evaluator_version="eval-1", is_inconclusive=False, overall_band=6.5, created_at=type("D", (), {"isoformat": lambda self: "2026-02-01"})(), id="r2")),
    ]
    criteria = {
        "t1": [
            {"criterion": "fluency_and_coherence", "band": 6.0, "confidence": "high"},
            {"criterion": "lexical_resource", "band": 6.0, "confidence": "high"},
        ],
        "t2": [
            {"criterion": "fluency_and_coherence", "band": 6.5, "confidence": "high"},
            {"criterion": "lexical_resource", "band": 6.5, "confidence": "high"},
        ],
    }
    out = build_exam_history(rows, criteria, evaluator_version="eval-1")
    assert out["scored_exam_count"] == 2
    assert out["exams"][0]["label"] == "Exam 1"
    assert out["exams"][1]["overall_band"] == 6.5
    assert out["lifetime_overall_band"] == 6.0  # mean 6.25 → nearest half band
    journey = out["journey"]
    assert journey["overall_delta"] == 0.5
    assert journey["criteria"][0]["delta"] == 0.5
