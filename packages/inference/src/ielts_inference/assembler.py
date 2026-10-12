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

EVALUATOR_VERSION = "eval-2026.09.11"
RUBRIC_VERSION = "ielts-speaking-practice-v2"

HALLUCINATION_THRESHOLD = 0.7
MIN_VOICED_MS = 60_000
MIN_SCORABLE_CRITERIA = 3
MAX_MISTAKES = 6


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
    return quote_norm in transcript_norm


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
    reasons: list[str] = []
    speaking_ms = int(features.get("speaking_duration_ms") or 0)
    voiced_ms = int(features.get("voiced_duration_ms", speaking_ms * (1 - float(features.get("silence_ratio") or 0))))
    if voiced_ms < MIN_VOICED_MS:
        inconclusive = True
        reasons.append(
            "Less than one minute of usable speech was detected. Complete all three parts with developed answers."
        )
    if features.get("silence_ratio", 0) > 0.45 and voiced_ms < MIN_VOICED_MS:
        inconclusive = True
        reasons.append("Too much silence or very quiet audio was detected. Check microphone distance before starting.")
    low_audio = acoustic_coverage < 0.35
    if low_audio:
        reasons.append("Audio coverage is limited; fluency and pronunciation bands use extra caution.")

    transcript_text = _gather_transcripts(features, model_json, acoustic_coverage)
    if not transcript_text.strip():
        inconclusive = True
        reasons.append("No usable transcript was available for language scoring.")
    rejected_evidence: list[str] = []

    for key in CRITERIA:
        item = _criterion(model_json, key)
        confidence = item["confidence"]
        band_value = None
        if item["band"] is not None:
            band_value = BandScore.round_to_nearest_half(item["band"]).value
        if not transcript_text.strip() or key in {"fluency_and_coherence", "pronunciation"} and (low_audio or voiced_ms < MIN_VOICED_MS):
            confidence = "inconclusive"
            band_value = None
        validated_evidence = _validate_evidence(key, item["evidence"], transcript_text, rejected_evidence)
        if item["evidence"] and not validated_evidence:
            if confidence != "inconclusive":
                confidence = "low"
            reasons.append(f"{key.replace('_', ' ')}: some score evidence could not be verified in your transcript.")
        elif validated_evidence and len(validated_evidence) < len(item["evidence"]) * 0.5:
            if confidence == "high":
                confidence = "medium"
        criteria.append(
            {
                "criterion": key,
                "band": band_value,
                "confidence": confidence,
                "subdimensions": item["subdimensions"],
                "evidence": validated_evidence,
            }
        )
        if confidence == "inconclusive":
            reasons.append(f"{key.replace('_', ' ')}: not enough evidence to assign a band.")

    scorable = [
        item["band"] for item in criteria
        if item["band"] is not None and item["confidence"] != "inconclusive"
    ]
    if len(scorable) < MIN_SCORABLE_CRITERIA:
        inconclusive = True
    overall = None
    if not inconclusive and scorable:
        overall = BandScore.round_to_nearest_half(sum(scorable) / len(scorable)).value
    strengths = _strings(model_json.get("strengths"), 3)
    improvements = _strings(model_json.get("improvements"), 3)
    minor_improvements = _strings(
        model_json.get("minorImprovements") or model_json.get("minor_improvements"),
        5,
    )
    mistakes = _validate_mistakes(model_json.get("mistakes") or [], transcript_text, rejected_evidence)[:MAX_MISTAKES]
    return {
        "score_readiness": {
            "reasons": reasons,
            "recorded_seconds": round(speaking_ms / 1000),
            "voiced_seconds": round(voiced_ms / 1000),
            "audio_coverage": round(acoustic_coverage, 3),
            "minimum_tests": 1,
        },
        "overall_band": overall,
        "is_inconclusive": inconclusive,
        "confidence_label": "inconclusive" if inconclusive else _overall_confidence(criteria),
        "criteria": criteria,
        "strengths": strengths,
        "improvements": improvements,
        "minor_improvements": minor_improvements,
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
        else:
            rejected.append(f"mistake: evidence quote not found in transcript: {quote[:80]}")
    return validated


def _validate_rewrites(rewrites: list, transcript: str) -> list:
    validated = []
    for item in rewrites:
        if not isinstance(item, dict):
            continue
        original = str(item.get("original") or "")
        if original and _evidence_is_grounded(original, transcript) or not original:
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
            "band": None,
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
