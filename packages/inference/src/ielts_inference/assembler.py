"""Deterministic report assembly. Model JSON never writes the report table directly."""

from __future__ import annotations

from difflib import SequenceMatcher

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

HALLUCINATION_THRESHOLD = 0.7


def _gather_transcripts(features: dict, model_json: dict, mean_coverage: float) -> str:
    transcripts = features.get("transcripts") if isinstance(features, dict) else None
    if isinstance(transcripts, str):
        return transcripts.lower()
    if isinstance(transcripts, list):
        parts = [str(t.get("text", t)) if isinstance(t, dict) else str(t) for t in transcripts]
        return " ".join(parts).lower()
    model_transcripts = model_json.get("transcripts") if isinstance(model_json, dict) else None
    if isinstance(model_transcripts, str):
        return model_transcripts.lower()
    if isinstance(model_transcripts, list):
        parts = [str(t.get("text", t)) if isinstance(t, dict) else str(t) for t in model_transcripts]
        return " ".join(parts).lower()
    return ""


def _evidence_is_grounded(quote: str, transcript: str) -> bool:
    if not quote or not transcript:
        return False
    quote_norm = _normalize_text(quote)
    transcript_norm = _normalize_text(transcript)
    ratio = SequenceMatcher(None, quote_norm, transcript_norm).ratio()
    if ratio >= HALLUCINATION_THRESHOLD:
        return True
    if quote_norm in transcript_norm:
        return True
    return False


def _normalize_text(text: str) -> str:
    import re

    cleaned = re.sub(r"[^\w\s]", "", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _validate_evidence(criterion_name: str, evidence_list: list, transcript: str, rejected: list[str]) -> list:
    validated = []
    for item in evidence_list:
        if not isinstance(item, dict):
            continue
        quote = str(item.get("quote") or "")
        if _evidence_is_grounded(quote, transcript):
            validated.append(item)
        else:
            rejected.append(f"{criterion_name}: evidence quote not found in transcript: {quote[:80]}")
    return validated


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

    transcript_text = _gather_transcripts(features, model_json, acoustic_coverage)
    rejected_evidence: list[str] = []

    for key in CRITERIA:
        item = _criterion(model_json, key)
        band = BandScore.round_to_nearest_half(item["band"])
        confidence = item["confidence"]
        validated_evidence = _validate_evidence(key, item["evidence"], transcript_text, rejected_evidence)
        if item["evidence"] and not validated_evidence:
            inconclusive = True
            confidence = "low"
        elif validated_evidence and len(validated_evidence) < len(item["evidence"]) * 0.5:
            confidence = "low"
        criteria.append(
            {
                "criterion": key,
                "band": band.value,
                "confidence": confidence,
                "subdimensions": item["subdimensions"],
                "evidence": validated_evidence,
            }
        )
        if confidence == "inconclusive":
            inconclusive = True

    mean = sum(item["band"] for item in criteria) / 4
    overall = None if inconclusive else BandScore.round_to_nearest_half(mean).value
    strengths = _strings(model_json.get("strengths"), 3)
    improvements = _strings(model_json.get("improvements"), 3)
    mistakes = _validate_mistakes(model_json.get("mistakes") or [], transcript_text, rejected_evidence)
    return {
        "overall_band": overall,
        "is_inconclusive": inconclusive,
        "confidence_label": "inconclusive" if inconclusive else _overall_confidence(criteria),
        "criteria": criteria,
        "strengths": strengths,
        "improvements": improvements,
        "example_rewrites": _validate_rewrites(model_json.get("exampleRewrites") or model_json.get("example_rewrites") or [], transcript_text),
        "mistakes": mistakes,
        "fluency": model_json.get("fluencyNotes") or model_json.get("fluency") or [],
        "practice_plan": model_json.get("practicePlan") or model_json.get("practice_plan") or {"days": []},
        "disclaimer": DISCLAIMER,
        "evaluator_version": EVALUATOR_VERSION,
        "rubric_version": RUBRIC_VERSION,
        "model_policy_version": EVALUATOR_VERSION,
        "_hallucination_flags": rejected_evidence,
    }


def _validate_mistakes(mistakes: list, transcript: str, rejected: list[str]) -> list:
    validated = []
    for item in mistakes:
        if not isinstance(item, dict):
            continue
        quote = str(item.get("quote") or "")
        if quote and _evidence_is_grounded(quote, transcript):
            validated.append(item)
        elif not quote:
            validated.append(item)
        else:
            rejected.append(f"mistake: evidence quote not found in transcript: {quote[:80]}")
    return validated


def _validate_rewrites(rewrites: list, transcript: str) -> list:
    validated = []
    for item in rewrites:
        if not isinstance(item, dict):
            continue
        original = str(item.get("original") or "")
        if original and _evidence_is_grounded(original, transcript):
            validated.append(item)
        elif not original:
            validated.append(item)
    return validated


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
