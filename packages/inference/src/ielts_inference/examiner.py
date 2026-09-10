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

PART1_INTRO_TEXT = (
    "Good morning. My name is Sarah, and I will be your examiner today. "
    "This is a three-part IELTS Speaking practice test. "
    "In Part 1 I will ask short questions about familiar topics. "
    "To begin, could you tell me your full name, please?"
)

PART2_INTRO_PREFIX = (
    "That is the end of Part 1. Now we move on to Part 2. "
    "I am going to give you a topic, and I would like you to speak for one to two minutes. "
    "You have one minute to think about what you are going to say. You may make notes if you wish. "
    "Here is your topic. "
)

PART3_INTRO_PREFIX = (
    "Thank you. That is the end of Part 2. "
    "Now I would like to ask you some more general questions related to what we have been discussing. "
)

PART1_INSTRUCTIONS = """You are an IELTS Speaking examiner for a practice test.

Generate exactly one short spoken Part 1 question in English.

Rules:
- Ask only one question.
- Sound natural, formal, and brief, like a real Cambridge examiner.
- Stay strictly on the assigned topic and the assigned question angle in the user payload.
- Use the assigned angle to make the question specific and concrete — not a vague opener.
- If is_first_topic_question is true, begin with: "Thank you. Now let's talk about {assigned_topic}." then your question.
- If the previous answer was very short (< 15 words), ask a simpler, more guided question on the same angle.
- If the previous answer was long (> 30 words), ask a deeper or more specific follow-on on the same topic.
- Avoid generic questions such as "Do you like X?", "Tell me about X", or "What do you think about X?" without a concrete angle.
- Good examples: "How often do you take public transport in your city, and has that changed since you were younger?"
- Bad examples: "Do you like travel?", "Tell me about music."
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
- Make the task specific and vivid — not a generic "describe something important".
- Bullet prompts must ask for concrete details (who, where, when, what happened, how you felt, why it matters).
- Include 3 or 4 bullet prompts.
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
- Prefer why, compare, impact, or future angles. Be specific — avoid vague "What do you think about society?"
- If is_first_part3_question is true, begin with the provided part3_intro_prefix, then ask your question.
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


def part1_intro_turn() -> GeneratedTurn:
    return GeneratedTurn(PART1_INTRO_TEXT, 25, None, "intro")


def first_part1_turn_after_intro(topic_label: str, question_angle: str) -> GeneratedTurn:
    question = (
        f"Thank you. Now let's talk about {topic_label}. "
        f"Could you tell me about {question_angle}?"
    )
    return GeneratedTurn(question, 45, None, "generated")


def parse_cue_card(raw: dict, *, include_part2_intro: bool = True) -> GeneratedTurn | None:
    topic = str(raw.get("topic") or "").strip()
    task = str(raw.get("task") or "").strip()
    prompts = [str(item).strip() for item in (raw.get("prompts") or []) if str(item).strip()]
    if len(task) < 20 or len(task) > 320:
        return None
    if len(prompts) < 3 or len(prompts) > 4:
        return None
    cue = {"title": topic or "Part 2", "prompts": prompts}
    spoken_parts = []
    if include_part2_intro:
        spoken_parts.append(PART2_INTRO_PREFIX)
    spoken_parts.extend([task, cue["title"], *prompts])
    spoken = " ".join(spoken_parts)
    return GeneratedTurn(spoken, 120, cue, "generated-part2")


def part1_prompt_input(
    history: list[dict],
    asked_prompts: list[str],
    *,
    topic_label: str,
    topic_guidance: str,
    question_angle: str,
    is_first_topic_question: bool = False,
) -> str:
    return json.dumps(
        {
            "part": 1,
            "assigned_topic": topic_label,
            "stay_on": topic_guidance,
            "question_angle": question_angle,
            "is_first_topic_question": is_first_topic_question,
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


def part3_prompt_input(
    history: list[dict],
    asked_prompts: list[str],
    *,
    theme: str,
    part2_theme: str = "",
    is_first_part3_question: bool = False,
    is_nervous: bool = False,
) -> str:
    return json.dumps(
        {
            "part": 3,
            "assigned_theme": theme,
            "part2_theme": part2_theme,
            "part3_intro_prefix": PART3_INTRO_PREFIX,
            "is_first_part3_question": is_first_part3_question,
            "is_nervous": is_nervous,
            "asked_prompts": asked_prompts[-8:],
            "candidate_history": history[-5:],
        }
    )
