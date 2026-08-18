"""Deterministic report assembly. Model JSON never writes the report table directly."""

from __future__ import annotations

from ielts_domain.types import BandScore

CRITERIA = (
    "fluency_and_coherence",
    "lexical_resource",
    "grammatical_range_and_accuracy",
    "pronunciation",
)

DISCLAIMER = (
    "This is a practice estimate produced by an AI coaching system. "
    "It is not an official IELTS score and does not predict a future examination result."
)

EVALUATOR_VERSION = "eval-2026.08.18"
RUBRIC_VERSION = "ielts-speaking-practice-v1"


def assemble(model_json: dict, features: dict, acoustic_coverage: float) -> dict:
    criteria = []
    inconclusive = False
    speaking_ms = int(features.get("speaking_duration_ms") or 0)
    if speaking_ms < 90_000:
        inconclusive = True
    if features.get("silence_ratio", 0) > 0.4:
        inconclusive = True
    if acoustic_coverage < 0.4:
        inconclusive = True

    for key in CRITERIA:
        item = _criterion(model_json, key)
        band = BandScore.round_to_nearest_half(item["band"])
        confidence = item["confidence"]
        if key == "pronunciation" and acoustic_coverage < 0.7:
            confidence = "low" if confidence == "high" else confidence
        criteria.append(
            {
                "criterion": key,
                "band": band.value,
                "confidence": confidence,
                "subdimensions": item["subdimensions"],
                "evidence": item["evidence"],
            }
        )
        if confidence == "inconclusive":
            inconclusive = True

    mean = sum(item["band"] for item in criteria) / 4
    overall = None if inconclusive else BandScore.round_to_nearest_half(mean).value
    strengths = _strings(model_json.get("strengths"), 3)
    improvements = _strings(model_json.get("improvements"), 3)
    return {
        "overall_band": overall,
        "is_inconclusive": inconclusive,
        "confidence_label": "inconclusive" if inconclusive else _overall_confidence(criteria),
        "criteria": criteria,
        "strengths": strengths,
        "improvements": improvements,
        "example_rewrites": model_json.get("exampleRewrites") or model_json.get("example_rewrites") or [],
        "mistakes": model_json.get("mistakes") or [],
        "fluency": model_json.get("fluencyNotes") or model_json.get("fluency") or [],
        "practice_plan": model_json.get("practicePlan") or model_json.get("practice_plan") or {"days": []},
        "disclaimer": DISCLAIMER,
        "evaluator_version": EVALUATOR_VERSION,
        "rubric_version": RUBRIC_VERSION,
        "model_policy_version": EVALUATOR_VERSION,
    }


def _criterion(model_json: dict, key: str) -> dict:
    block = {}
    for item in model_json.get("criteria") or []:
        name = item.get("criterion") or item.get("key")
        if name == key:
            block = item
            break
    if not block:
        return {
            "band": 0.0,
            "confidence": "inconclusive",
            "subdimensions": {},
            "evidence": [],
        }
    raw_band = float(block.get("band") or 0)
    raw_band = min(9.0, max(0.0, raw_band))
    return {
        "band": raw_band,
        "confidence": block.get("confidence") or "medium",
        "subdimensions": block.get("subdimensions") or {},
        "evidence": block.get("evidence") or [],
    }


def _strings(value: object, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value[:limit]]


def _overall_confidence(criteria: list[dict]) -> str:
    ranks = {"high": 3, "medium": 2, "low": 1, "inconclusive": 0}
    lowest = min(ranks.get(item["confidence"], 1) for item in criteria)
    return {3: "high", 2: "medium", 1: "low", 0: "inconclusive"}[lowest]
