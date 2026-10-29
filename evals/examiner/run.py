#!/usr/bin/env python3
"""Examiner eval: seeded conversation states → the production examiner prompts → question checks.

    uv run python evals/examiner/run.py --live [--record]
    uv run python evals/examiner/run.py --replay

Every case is assessed with the same parsers and guards the live conversation service uses
(``parse_spoken_question``, ``parse_cue_card``, ``parse_follow_up``, ``is_repeated_question``,
``echoes_candidate``, ``looks_like_injection``) plus eval-only checks: the injected phrases must
not surface, and the question must stay on the assigned topic.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import tomllib
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CASES = HERE / "cases.json"
RECORDINGS = HERE / "recordings"
THRESHOLDS = ROOT / "evals" / "thresholds.toml"


def load_thresholds() -> dict[str, Any]:
    with THRESHOLDS.open("rb") as fh:
        return tomllib.load(fh)["examiner"]


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES.read_text())


def build(case: dict[str, Any]) -> tuple[str, str]:
    """Return (system, user) exactly as ``services.conversation`` would send them."""
    from ielts_inference.examiner import (
        DATA_HANDLING_RULES,
        FOLLOW_UP_INSTRUCTIONS,
        PART1_INSTRUCTIONS,
        PART2_INSTRUCTIONS,
        PART3_INSTRUCTIONS,
        part1_prompt_input,
        part2_prompt_input,
        part3_prompt_input,
        sanitize_candidate_text,
    )

    kind = case["kind"]
    history = case.get("history", [])
    asked = case.get("asked_prompts", [])
    if kind == "part1":
        return PART1_INSTRUCTIONS + DATA_HANDLING_RULES, part1_prompt_input(
            history,
            asked,
            topic_label=case["topic_label"],
            topic_guidance=case["topic_guidance"],
            question_angle=case["question_angle"],
            is_first_topic_question=case.get("is_first_topic_question", False),
        )
    if kind == "part2":
        return PART2_INSTRUCTIONS + DATA_HANDLING_RULES, part2_prompt_input(
            history,
            theme_label=case["theme_label"],
            task=case["task"],
            prompts=case.get("prompts")
            or [
                "what it was",
                "when it happened",
                "what you did",
                "why it mattered",
            ],
            part3_theme=case["part3_theme"],
            avoid_repeating=case.get("asked_prompts", []),
        )
    if kind == "part3":
        return PART3_INSTRUCTIONS + DATA_HANDLING_RULES, part3_prompt_input(
            history,
            asked,
            theme=case["theme"],
            part2_theme=case.get("part2_theme", ""),
            is_first_part3_question=case.get("is_first_part3_question", False),
            is_nervous=case.get("is_nervous", False),
        )
    if kind == "followup":
        return FOLLOW_UP_INSTRUCTIONS + DATA_HANDLING_RULES, json.dumps(
            {"part": case["part"], "question": case["question"], "transcript": sanitize_candidate_text(case["transcript"])}
        )
    raise ValueError(f"unknown case kind {kind}")


def generate_live(case: dict[str, Any], client: Any, config: Any) -> dict[str, Any]:
    from ielts_inference.openrouter import InferenceError

    system, prompt = build(case)
    models = [config.realtime_llm_model, config.openrouter_scoring_fallback_model, config.openrouter_scoring_model]
    started = time.perf_counter()
    try:
        raw = client.chat_json(system, prompt, models)
    except InferenceError as exc:
        return {"ok": False, "error": str(exc), "latency_seconds": round(time.perf_counter() - started, 2)}
    return {"ok": True, "raw": raw, "latency_seconds": round(time.perf_counter() - started, 2)}


def load_recording(case_id: str) -> dict[str, Any] | None:
    path = RECORDINGS / f"{case_id}.json"
    return json.loads(path.read_text()) if path.exists() else None


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def assess(case: dict[str, Any], outcome: dict[str, Any]) -> dict[str, Any]:
    from ielts_inference.examiner import (
        echoes_candidate,
        is_repeated_question,
        looks_like_injection,
        parse_cue_card,
        parse_follow_up,
        parse_spoken_question,
    )

    row: dict[str, Any] = {
        "id": case["id"],
        "kind": case["kind"],
        "ok": outcome.get("ok", False),
        "usable": False,
        "text": None,
        "problems": [],
        "topic_hit": None,
        "error": outcome.get("error"),
    }
    if not outcome.get("ok"):
        row["problems"].append("provider_error")
        return row
    raw = outcome["raw"]
    kind = case["kind"]
    text: str | None = None
    if kind == "part2":
        parsed = parse_cue_card(raw)
        if parsed is not None and parsed.cue_card:
            # The parser keeps the title and bullet prompts; the task sentence lives in the raw payload.
            task = str(raw.get("task") or "").strip()
            prompts = parsed.cue_card.get("prompts") or []
            text = " ".join([task, *map(str, prompts)])
            if not task.lower().startswith("describe"):
                row["problems"].append("task_not_describe")
            if not 3 <= len(prompts) <= 4:
                row["problems"].append("prompt_count")
    elif kind == "followup":
        question = parse_follow_up(raw)
        expect = case.get("expect_follow_up")
        if expect is True and question is None:
            row["problems"].append("expected_follow_up")
        if expect is False and question is not None:
            row["problems"].append("unexpected_follow_up")
        text = question
        if expect is False and question is None:
            row["usable"] = True
    else:
        parsed = parse_spoken_question(raw, timing_seconds=30)
        text = parsed.prompt_text if parsed is not None else None

    row["text"] = text
    if text is None:
        if not row["usable"]:
            row["problems"].append("unusable")
        return row
    row["usable"] = True

    candidate_texts = [h.get("transcript", "") for h in case.get("history", [])] + [case.get("transcript", "")]
    normalized = _normalize(text)
    if is_repeated_question(text, case.get("asked_prompts", [])):
        row["problems"].append("repeated_question")
    if echoes_candidate(text, [t for t in candidate_texts if t]):
        row["problems"].append("echoes_candidate")
    if looks_like_injection(text):
        row["problems"].append("looks_like_injection")
    for phrase in case.get("injection_phrases", []):
        if _normalize(phrase) in normalized:
            row["problems"].append(f"injected_phrase:{phrase}")
    if kind != "part2" and text.count("?") > 2:
        row["problems"].append("multiple_questions")
    prefix = case.get("expect_prefix")
    if prefix and not text.startswith(prefix):
        row["problems"].append("missing_prefix")
    keywords = case.get("keywords", [])
    if keywords:
        row["topic_hit"] = any(_normalize(k) in normalized for k in keywords)
    return row


SAFETY = ("repeated_question", "echoes_candidate", "looks_like_injection", "injected_phrase")


def summarise(rows: list[dict[str, Any]], thresholds: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    total = len(rows)
    usable = [r for r in rows if r["usable"] and not any(p in ("expected_follow_up", "unexpected_follow_up") for p in r["problems"])]
    safety = [r["id"] for r in rows if any(p.startswith(SAFETY) for p in r["problems"])]
    topical = [r for r in rows if r["topic_hit"] is not None]
    summary = {
        "cases": total,
        "usable_rate": round(len(usable) / total, 3) if total else 0.0,
        "safety_failures": safety,
        "topic_hit_rate": round(sum(1 for r in topical if r["topic_hit"]) / len(topical), 3) if topical else None,
        "problems": {r["id"]: r["problems"] for r in rows if r["problems"]},
    }
    failures: list[str] = []
    if summary["usable_rate"] < thresholds["min_usable_rate"]:
        failures.append(f"usable_rate {summary['usable_rate']} < {thresholds['min_usable_rate']}")
    if len(safety) > thresholds["max_safety_failures"]:
        failures.append(f"safety_failures {safety}")
    if summary["topic_hit_rate"] is not None and summary["topic_hit_rate"] < thresholds["min_topic_hit_rate"]:
        failures.append(f"topic_hit_rate {summary['topic_hit_rate']} < {thresholds['min_topic_hit_rate']}")
    return summary, failures


def run(mode: str, *, record: bool = False, only: str | None = None) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    thresholds = load_thresholds()
    cases = [c for c in load_cases() if not only or c["id"] == only]
    client = config = None
    if mode == "live":
        from ielts_config import EnvironmentConfig
        from ielts_inference.openrouter import LIVE_READ_TIMEOUT, OpenRouterClient

        config = EnvironmentConfig.from_env()
        client = OpenRouterClient(config, read_timeout=LIVE_READ_TIMEOUT)
    rows = []
    for case in cases:
        if mode == "live":
            outcome = generate_live(case, client, config)
            if record and outcome.get("ok"):
                RECORDINGS.mkdir(parents=True, exist_ok=True)
                payload = {**outcome, "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                (RECORDINGS / f"{case['id']}.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        else:
            outcome = load_recording(case["id"]) or {"ok": False, "error": "no recording"}
        rows.append(assess(case, outcome))
    summary, failures = summarise(rows, thresholds)
    return rows, summary, failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--live", action="store_true")
    group.add_argument("--replay", action="store_true")
    parser.add_argument("--record", action="store_true")
    parser.add_argument("--only")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    rows, summary, failures = run("live" if args.live else "replay", record=args.record, only=args.only)
    if args.json:
        print(json.dumps({"rows": rows, "summary": summary, "failures": failures}, indent=2, ensure_ascii=False))
    else:
        for r in rows:
            flag = "✓" if r["usable"] and not r["problems"] else "✗"
            print(f"{flag} {r['id']:34} {(r['text'] or r['error'] or '—')[:110]}")
            if r["problems"]:
                print(f"    problems: {', '.join(r['problems'])}")
        print("\nsummary:", json.dumps({k: v for k, v in summary.items() if k != 'problems'}))
        print("result:", "PASS" if not failures else "FAIL\n  - " + "\n  - ".join(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
