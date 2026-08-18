"""Examiner follow-up questions from a transcript. Never assigns a band."""

from __future__ import annotations


FOLLOW_UP_LIMITS = {1: 2, 2: 1, 3: 2}

FOLLOW_UP_INSTRUCTIONS = """You are an IELTS Speaking examiner in a practice test.

Given the part, the question you asked, and the candidate's transcript, decide whether to ask one short spoken follow-up (a cross-question).

Return JSON only:
{"ask_follow_up": true or false, "question": "one spoken question or empty"}

Rules:
- Sound like a real examiner. One sentence. English only.
- Part 1: everyday follow-up if the answer was short or invites a related detail.
- Part 2: after the long turn, at most one rounding-off question about what they said.
- Part 3: a discussion probe that asks why, compared with, or consequences.
- Do not teach, correct, or score.
- If the transcript is empty or unusable, ask_follow_up false.
"""


def parse_follow_up(raw: dict) -> str | None:
    if not raw.get("ask_follow_up"):
        return None
    question = str(raw.get("question") or "").strip()
    if len(question) < 10 or len(question) > 240:
        return None
    if "?" not in question:
        question = question.rstrip(".") + "?"
    return question
