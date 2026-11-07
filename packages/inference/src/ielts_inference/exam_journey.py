"""Build per-exam score series and first-to-last journey deltas for progress UI."""

from __future__ import annotations

from typing import Any

CRITERIA_ORDER = (
    "fluency_and_coherence",
    "lexical_resource",
    "grammatical_range_and_accuracy",
    "pronunciation",
)


def build_exam_history(
    rows: list[tuple[Any, Any]],
    criteria_by_test: dict[str, list[dict]],
    *,
    evaluator_version: str,
) -> dict[str, Any]:
    exams: list[dict[str, Any]] = []
    for test, report in rows:
        if report.evaluator_version != evaluator_version or report.is_inconclusive:
            continue
        if report.overall_band is None:
            continue
        crit_rows = criteria_by_test.get(test.id, [])
        criteria: dict[str, float] = {}
        for item in crit_rows:
            if item.get("confidence") == "inconclusive":
                continue
            band = item.get("band")
            if band is not None:
                criteria[str(item["criterion"])] = float(band)
        exams.append(
            {
                "test_id": test.id,
                "report_id": report.id,
                "date": report.created_at.isoformat(),
                "overall_band": float(report.overall_band),
                "criteria": criteria,
            }
        )
    for index, exam in enumerate(exams, start=1):
        exam["exam_index"] = index
        exam["label"] = f"Exam {index}"

    lifetime = None
    if exams:
        lifetime = round(sum(e["overall_band"] for e in exams) / len(exams) * 2) / 2

    journey = _first_to_last_delta(exams)
    return {
        "exams": exams,
        "lifetime_overall_band": lifetime,
        "scored_exam_count": len(exams),
        "journey": journey,
    }


def _first_to_last_delta(exams: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(exams) < 2:
        return None
    first, last = exams[0], exams[-1]
    per_criterion: list[dict[str, Any]] = []
    for key in CRITERIA_ORDER:
        start = first["criteria"].get(key)
        end = last["criteria"].get(key)
        if start is None or end is None:
            continue
        delta = round(end - start, 1)
        per_criterion.append(
            {
                "criterion": key,
                "first_band": start,
                "last_band": end,
                "delta": delta,
            }
        )
    overall_delta = round(last["overall_band"] - first["overall_band"], 1)
    return {
        "from_label": first["label"],
        "to_label": last["label"],
        "first_overall_band": first["overall_band"],
        "last_overall_band": last["overall_band"],
        "overall_delta": overall_delta,
        "criteria": per_criterion,
    }
