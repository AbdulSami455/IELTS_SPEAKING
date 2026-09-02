"""Examiner prompt generation for conversational IELTS-style practice."""

from __future__ import annotations

import json
from dataclasses import dataclass


FOLLOW_UP_LIMITS = {1: 2, 2: 1, 3: 2}
PART1_TARGET_QUESTIONS = 4
PART3_TARGET_QUESTIONS = 3


@dataclass(frozen=True)
class GeneratedTurn:
    prompt_text: str
    timing_seconds: int
    cue_card: dict | None = None
    asset_version: str = "generated"


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

PART1_INSTRUCTIONS = """You are an IELTS Speaking examiner for a practice test.

Generate exactly one short spoken Part 1 question in English.

Rules:
- Ask only one question.
- Sound natural, formal, and brief, like a real Cambridge examiner.
- Stay strictly on the assigned topic in the user payload.
- If the previous answer was very short (< 15 words), ask a simpler, more guided question.
- If the previous answer was long (> 30 words), ask a deeper or more complex question.
- Cover a typical IELTS angle for that topic (habits, preferences, how often, change, people you do it with).
- Do not switch to food, cooking, restaurants, or meals unless the assigned topic is food.
- Do not explain the test, give feedback, or score.
- Do not repeat earlier prompts.

Return JSON only:
{"question": "one spoken question"}
"""

PART2_INSTRUCTIONS = """You are an IELTS Speaking examiner for a practice test.

Generate one Part 2 cue-card task in English for the assigned theme.

Rules:
- Stay on the assigned theme. You may rephrase the task slightly so it sounds natural.
- The spoken prompt should tell the candidate what to describe.
- Include 3 or 4 bullet prompts (who/what/where, when, what happened, and why it matters).
- Do not switch to an unrelated theme such as food unless that is the assigned theme.
- Do not score, teach, or add extra commentary.

Return JSON only:
{
  "topic": "short cue-card title",
  "task": "Describe ...",
  "prompts": ["...", "...", "..."]
}
"""

PART3_INSTRUCTIONS = """You are an IELTS Speaking examiner for a practice test.

Generate exactly one Part 3 discussion question in English.

Rules:
- Ask only one question.
- Stay on the assigned Part 3 theme (provided as "assigned_theme"). You may reference the candidate's Part 2 topic ("part2_theme") to build continuity.
- Prefer why, compare, impact, or future angles.
- If the candidate flag "is_nervous" is true, use encouraging, supportive language and avoid challenging or judgmental phrasing.
- Do not score, teach, or correct.

Return JSON only:
{"question": "one spoken question"}
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


def _spoken_question_text(raw: dict) -> str:
    for key in ("question", "prompt", "spoken_question", "text"):
        value = str(raw.get(key) or "").strip()
        if value:
            return value
    return ""


def parse_spoken_question(raw: dict, *, timing_seconds: int, asset_version: str = "generated") -> GeneratedTurn | None:
    question = _spoken_question_text(raw)
    if len(question) < 8 or len(question) > 280:
        return None
    if "?" not in question:
        question = question.rstrip(".") + "?"
    return GeneratedTurn(question, timing_seconds, None, asset_version)


def parse_cue_card(raw: dict) -> GeneratedTurn | None:
    topic = str(raw.get("topic") or "").strip()
    task = str(raw.get("task") or "").strip()
    prompts = [str(item).strip() for item in (raw.get("prompts") or []) if str(item).strip()]
    if len(task) < 20 or len(task) > 320:
        return None
    if len(prompts) < 3 or len(prompts) > 4:
        return None
    cue = {"title": topic or "Part 2", "prompts": prompts}
    spoken = " ".join([task, cue["title"], *prompts])
    return GeneratedTurn(spoken, 120, cue, "generated-part2")


def part1_prompt_input(
    history: list[dict],
    asked_prompts: list[str],
    *,
    topic_label: str,
    topic_guidance: str,
) -> str:
    return json.dumps(
        {
            "part": 1,
            "assigned_topic": topic_label,
            "stay_on": topic_guidance,
            "asked_prompts": asked_prompts[-8:],
            "candidate_history": history[-3:],
        }
    )


def part2_prompt_input(history: list[dict], *, theme_label: str, task: str, part3_theme: str) -> str:
    return json.dumps(
        {
            "part": 2,
            "assigned_theme": theme_label,
            "preferred_task": task,
            "later_part3_theme": part3_theme,
            "candidate_profile": history[-4:],
        }
    )


def part3_prompt_input(history: list[dict], asked_prompts: list[str], *, theme: str, part2_theme: str = "") -> str:
    return json.dumps(
        {
            "part": 3,
            "assigned_theme": theme,
            "part2_theme": part2_theme,
            "asked_prompts": asked_prompts[-8:],
            "candidate_history": history[-5:],
        }
    )
