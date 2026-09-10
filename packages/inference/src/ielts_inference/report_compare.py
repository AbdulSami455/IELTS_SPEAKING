"""Compare a report with the user's previous comparable attempt."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ielts_inference.assembler import _normalize_text

CRITERION_LABELS = {
    "fluency_and_coherence": "Fluency & coherence",
    "lexical_resource": "Lexical resource",
    "grammatical_range_and_accuracy": "Grammar",
    "pronunciation": "Pronunciation",
}


@dataclass(frozen=True)
class CriterionChange:
    criterion: str
    label: str
    current: float | None
    previous: float | None
    delta: float | None
    direction: str


def _band_map(criteria: list[dict]) -> dict[str, float]:
    bands: dict[str, float] = {}
    for item in criteria:
        if item.get("confidence") == "inconclusive":
            continue
        band = item.get("band")
        if band is None:
            continue
        bands[str(item["criterion"])] = float(band)
    return bands


def _mistake_key(item: dict) -> tuple[str, str]:
    return (
        str(item.get("type") or "issue"),
        _normalize_text(str(item.get("quote") or ""))[:48],
    )


def _mistake_items(items: list[dict] | None) -> list[dict]:
    if not items:
        return []
    return [item for item in items if isinstance(item, dict)]


def compare_reports(
    *,
    current_criteria: list[dict],
    previous_criteria: list[dict],
    current_mistakes: list[dict] | None,
    previous_mistakes: list[dict] | None,
    current_overall: float | None,
    previous_overall: float | None,
    previous_created_at: str | None = None,
) -> dict[str, Any]:
    current_bands = _band_map(current_criteria)
    previous_bands = _band_map(previous_criteria)
    criterion_changes: list[CriterionChange] = []
    improved_areas: list[str] = []
    minor_gains: list[str] = []
    still_working_on: list[str] = []

    for key in (
        "fluency_and_coherence",
        "lexical_resource",
        "grammatical_range_and_accuracy",
        "pronunciation",
    ):
        label = CRITERION_LABELS[key]
        current = current_bands.get(key)
        previous = previous_bands.get(key)
        if current is None or previous is None:
            criterion_changes.append(
                CriterionChange(key, label, current, previous, None, "unavailable")
            )
            continue
        delta = round(current - previous, 1)
        if delta > 0:
            direction = "up"
            if delta >= 0.5:
                improved_areas.append(f"{label} up {delta:g} band{'s' if abs(delta) != 1 else ''} ({previous:g} → {current:g}).")
            else:
                minor_gains.append(f"{label} edged up slightly ({previous:g} → {current:g}).")
        elif delta < 0:
            direction = "down"
            still_working_on.append(f"{label} dipped {abs(delta):g} band{'s' if abs(delta) != 1 else ''} ({previous:g} → {current:g}).")
        else:
            direction = "stable"
            minor_gains.append(f"{label} held steady at {current:g}.")

    overall_delta = None
    if current_overall is not None and previous_overall is not None:
        overall_delta = round(float(current_overall) - float(previous_overall), 1)
        if overall_delta > 0:
            improved_areas.insert(0, f"Overall practice band up {overall_delta:g} ({previous_overall:g} → {current_overall:g}).")
        elif overall_delta < 0:
            still_working_on.insert(0, f"Overall practice band down {abs(overall_delta):g} ({previous_overall:g} → {current_overall:g}).")

    current_keys = {_mistake_key(item) for item in _mistake_items(current_mistakes)}
    previous_keys = {_mistake_key(item) for item in _mistake_items(previous_mistakes)}
    current_by_key = {_mistake_key(item): item for item in _mistake_items(current_mistakes)}
    previous_by_key = {_mistake_key(item): item for item in _mistake_items(previous_mistakes)}

    resolved = [previous_by_key[key] for key in previous_keys - current_keys]
    recurring = [current_by_key[key] for key in current_keys & previous_keys]
    new_issues = [current_by_key[key] for key in current_keys - previous_keys]

    if resolved:
        minor_gains.append(
            f"{len(resolved)} correction pattern{'s' if len(resolved) != 1 else ''} from your last test did not reappear."
        )
    for item in recurring[:3]:
        still_working_on.append(
            f"Still recurring ({item.get('type', 'issue')}): “{str(item.get('quote') or '')[:72]}”"
        )

    previous_types = {key[0] for key in previous_keys}
    current_types = {key[0] for key in current_keys}
    for mistake_type in sorted(previous_types - current_types):
        minor_gains.append(f"No new {mistake_type.replace('_', ' ')} issues flagged this time.")

    return {
        "has_previous": True,
        "previous_test_at": previous_created_at,
        "previous_overall_band": previous_overall,
        "overall_delta": overall_delta,
        "criterion_changes": [
            {
                "criterion": item.criterion,
                "label": item.label,
                "current": item.current,
                "previous": item.previous,
                "delta": item.delta,
                "direction": item.direction,
            }
            for item in criterion_changes
        ],
        "improved_areas": improved_areas,
        "minor_gains": minor_gains,
        "still_working_on": still_working_on,
        "mistake_trends": {
            "resolved": resolved[:5],
            "recurring": recurring[:5],
            "new_issues": new_issues[:5],
        },
    }
