"""Structured presentation payloads for speaking reports (vocabulary, fluency, pronunciation)."""

from __future__ import annotations

import re
from typing import Any

from ielts_inference.features import FILLERS, extract_features

_STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "can",
    "could",
    "should",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "my",
    "your",
    "his",
    "her",
    "our",
    "their",
    "this",
    "that",
    "these",
    "those",
    "as",
    "so",
    "not",
    "no",
    "yes",
    "just",
    "very",
    "really",
    "also",
    "than",
    "then",
    "when",
    "what",
    "which",
    "who",
    "how",
    "about",
    "from",
    "into",
    "there",
    "here",
    "because",
    "like",
    "know",
    "think",
    "say",
    "said",
    "get",
    "got",
    "go",
    "went",
    "make",
    "made",
}

_ISSUE_COPY: dict[str, dict[str, str]] = {
    "speech_rate_fast": {
        "title": "Pace is quite fast",
        "detail": "You spoke faster than typical IELTS interview pace.",
        "action": "Slow slightly on key words and at the end of clauses so ideas land clearly.",
    },
    "speech_rate_slow": {
        "title": "Pace is quite slow",
        "detail": "Long stretches of slow delivery can reduce fluency impressions.",
        "action": "Practise answering common topics in 45–60 seconds without rushing.",
    },
    "frequent_pauses": {
        "title": "Many short pauses",
        "detail": "Frequent pauses can interrupt flow even when grammar is accurate.",
        "action": "Use linking phrases (firstly, for example, on the other hand) to bridge ideas.",
    },
    "high_silence": {
        "title": "Long silent gaps",
        "detail": "Extended silence between ideas was detected in the recording.",
        "action": "Prepare a one-sentence opener for Part 2 and Part 3 so you can start confidently.",
    },
    "clipping": {
        "title": "Audio quality issue",
        "detail": "Clipping or distortion made some speech harder to analyse.",
        "action": "Move slightly back from the mic and avoid shouting; re-check levels on device check.",
    },
    "low_word_confidence": {
        "title": "Some words were unclear to the recogniser",
        "detail": "This often points to unclear stress or consonants — not accent.",
        "action": "Practise the words listed below in short sentences, exaggerating final sounds.",
    },
}


def build_vocabulary_insights(
    transcripts: list[dict[str, Any]],
    criteria: list[dict[str, Any]],
    mistakes: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    combined = " ".join(str(item.get("text") or "") for item in transcripts).strip()
    features = extract_features(combined, [], {}) if combined else {}
    tokens = re.findall(r"[A-Za-z']+", combined.lower()) if combined else []
    content = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]
    freq: dict[str, int] = {}
    for token in content:
        freq[token] = freq.get(token, 0) + 1
    notable = sorted(freq.keys(), key=lambda w: (-len(w), -freq[w]))[:12]

    lexical = _criterion_block(criteria, "lexical_resource")
    lexical_evidence = [
        {
            "quote": item.get("quote"),
            "note": item.get("note"),
            "practice": item.get("practice"),
        }
        for item in (lexical.get("evidence") or [])
        if isinstance(item, dict)
    ]
    phrase_issues = [
        item
        for item in mistakes or []
        if str(item.get("type") or "").lower() in {"phrase", "lexical", "vocabulary", "word_choice"}
    ]
    grammar_vocab = [
        item for item in mistakes or [] if str(item.get("type") or "").lower() == "grammar"
    ][:3]

    tips: list[str] = []
    ttr = float(features.get("type_token_ratio") or 0)
    if tokens and ttr < 0.42:
        tips.append("Widen vocabulary: swap repeated words (good → beneficial, important → significant).")
    if int(features.get("filler_count") or 0) >= 4:
        tips.append("Reduce fillers (um, like, you know) — pause silently instead.")
    return {
        "has_content": bool(combined),
        "stats": _stat_row(features, tokens),
        "words_you_used": notable,
        "lexical_highlights": lexical_evidence,
        "phrase_fixes": phrase_issues[:6],
        "grammar_word_choices": grammar_vocab,
        "coaching_tips": tips[:5],
    }


def build_fluency_insights(
    fluency_notes: list[Any],
    pronunciation_parts: list[dict[str, Any]],
    criteria: list[dict[str, Any]],
    transcripts: list[dict[str, Any]],
) -> dict[str, Any]:
    fluency = _criterion_block(criteria, "fluency_and_coherence")
    combined = " ".join(str(item.get("text") or "") for item in transcripts)
    features = extract_features(combined, [], {}) if combined else {}

    metrics: list[dict[str, Any]] = []
    wpm_values = [
        float(item.get("words_per_minute") or 0)
        for item in pronunciation_parts
        if float(item.get("words_per_minute") or 0) > 0
    ]
    if wpm_values:
        avg_wpm = round(sum(wpm_values) / len(wpm_values))
        status = "good"
        if avg_wpm > 175:
            status = "watch"
        elif avg_wpm < 90:
            status = "watch"
        metrics.append(
            {
                "label": "Average pace",
                "value": f"{avg_wpm} words/min",
                "status": status,
                "hint": _pace_hint(avg_wpm),
            }
        )
    pause_total = sum(int(item.get("pause_count") or 0) for item in pronunciation_parts)
    if pause_total or features.get("filler_count"):
        metrics.append(
            {
                "label": "Flow signals",
                "value": f"{pause_total} pauses · {int(features.get('filler_count') or 0)} fillers",
                "status": "watch" if pause_total >= 6 or int(features.get("filler_count") or 0) >= 4 else "good",
                "hint": "Smooth links between ideas help fluency more than speed alone.",
            }
        )
    if features.get("mean_sentence_words"):
        metrics.append(
            {
                "label": "Sentence length",
                "value": f"{features['mean_sentence_words']} words/sentence (avg)",
                "status": "good",
                "hint": "Mix short and longer sentences for natural rhythm.",
            }
        )
    for sub in fluency.get("subdimensions") or []:
        if isinstance(sub, dict) and sub.get("key"):
            metrics.append(
                {
                    "label": sub["key"].replace("_", " ").title(),
                    "value": f"Band {sub.get('band')}",
                    "status": "good",
                    "hint": "Sub-score from this attempt’s fluency rubric.",
                }
            )

    observations: list[dict[str, str]] = []
    for note in _strings(fluency_notes, 8):
        observations.append({"kind": "coach", "title": "Coach note", "body": note})
    for item in fluency.get("evidence") or []:
        if not isinstance(item, dict):
            continue
        observations.append(
            {
                "kind": "evidence",
                "title": "From your speech",
                "body": item.get("note") or "Example from this test.",
                "quote": item.get("quote"),
            }
        )

    focus: list[str] = []
    for item in fluency.get("improvements") or []:
        if isinstance(item, str):
            focus.append(item)
    if not focus:
        for code in _collect_issue_codes(pronunciation_parts):
            copy = _ISSUE_COPY.get(code)
            if copy:
                focus.append(copy["action"])

    return {
        "band": fluency.get("band"),
        "confidence": fluency.get("confidence"),
        "metrics": metrics,
        "observations": observations,
        "focus_next": focus[:4],
    }


def build_pronunciation_insights(
    pronunciation_parts: list[dict[str, Any]],
    accent_note: str | None,
) -> dict[str, Any]:
    practice_words: list[str] = []
    improvements: list[dict[str, str]] = []
    findings: list[str] = []
    notes: list[str] = []

    for part in pronunciation_parts:
        for word in part.get("unclear_words") or part.get("unclearWords") or []:
            token = str(word).strip()
            if token and token.lower() not in {w.lower() for w in practice_words}:
                practice_words.append(token)
        for code in part.get("issues") or []:
            copy = _ISSUE_COPY.get(str(code))
            if copy and not any(item["title"] == copy["title"] for item in improvements):
                improvements.append(copy)
        model = part.get("model_notes") or part.get("modelNotes") or {}
        if isinstance(model, dict):
            for item in model.get("findings") or []:
                if item and item not in findings:
                    findings.append(str(item))
            for item in model.get("notes") or []:
                if item and item not in notes:
                    notes.append(str(item))

    return {
        "practice_words": practice_words[:20],
        "improvements": improvements,
        "findings": findings,
        "notes": notes,
        "accent_note": accent_note,
        "disclaimer": "Feedback focuses on clarity and rhythm. Accent is not marked as an error.",
    }


def _criterion_block(criteria: list[dict[str, Any]], key: str) -> dict[str, Any]:
    for item in criteria:
        if item.get("criterion") == key:
            return item
    return {}


def _stat_row(features: dict[str, Any], tokens: list[str]) -> list[dict[str, str]]:
    if not tokens:
        return []
    return [
        {"label": "Words spoken", "value": str(len(tokens))},
        {"label": "Different words", "value": str(features.get("unique_word_count") or 0)},
        {"label": "Vocabulary variety", "value": f"{int(float(features.get('type_token_ratio') or 0) * 100)}%"},
        {"label": "Sentences", "value": str(features.get("sentence_count") or 0)},
    ]


def _pace_hint(wpm: int) -> str:
    if wpm > 175:
        return "Aim for roughly 120–160 wpm in interview answers."
    if wpm < 90:
        return "Try slightly quicker delivery once your idea is clear."
    return "Pace sits in a comfortable range for interview practice."


def _collect_issue_codes(parts: list[dict[str, Any]]) -> list[str]:
    codes: list[str] = []
    for part in parts:
        for code in part.get("issues") or []:
            key = str(code)
            if key not in codes:
                codes.append(key)
    return codes


def _strings(values: list[Any] | None, limit: int) -> list[str]:
    out: list[str] = []
    for item in values or []:
        text = str(item).strip()
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out
