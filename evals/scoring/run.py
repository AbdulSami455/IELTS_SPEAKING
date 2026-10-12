#!/usr/bin/env python3
"""Scoring eval: golden transcripts → the production scoring prompt → band checks.

    uv run python evals/scoring/run.py --live [--record]   # calls OpenRouter
    uv run python evals/scoring/run.py --replay            # re-checks recordings offline

Each golden case carries the same payload shapes that ``evaluation.evaluate_test`` feeds
to ``_build_scoring_prompt``, so the prompt under test is byte-for-byte the production
one. Thresholds live in ``evals/thresholds.toml``.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import tomllib
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GOLDEN = HERE / "golden"
RECORDINGS = HERE / "recordings"
THRESHOLDS = ROOT / "evals" / "thresholds.toml"


def load_thresholds() -> dict[str, Any]:
    with THRESHOLDS.open("rb") as fh:
        return tomllib.load(fh)["scoring"]


def load_cases() -> list[dict[str, Any]]:
    return [json.loads(path.read_text()) for path in sorted(GOLDEN.glob("*.json"))]


def overall_band(criteria: list[dict[str, Any]]) -> float | None:
    bands = [float(item["band"]) for item in criteria if item.get("band") is not None]
    if not bands:
        return None
    return round(statistics.fmean(bands) * 2) / 2


def build_prompt(case: dict[str, Any]) -> str:
    from ielts_inference.evaluation import _build_scoring_prompt

    return _build_scoring_prompt(
        case["parts"], case["merged_features"], case["mean_coverage"], case["conversation_context"]
    )


def score_live(case: dict[str, Any], client: Any) -> dict[str, Any]:
    from ielts_inference.openrouter import InferenceError

    started = time.perf_counter()
    try:
        result = client.score_speaking(build_prompt(case))
    except InferenceError as exc:
        return {"ok": False, "error": str(exc), "latency_seconds": round(time.perf_counter() - started, 2)}
    return {
        "ok": True,
        "raw": result.raw,
        "model": result.model,
        "latency_seconds": round(time.perf_counter() - started, 2),
    }


def load_recording(case_id: str) -> dict[str, Any] | None:
    path = RECORDINGS / f"{case_id}.json"
    return json.loads(path.read_text()) if path.exists() else None


def assess(case: dict[str, Any], outcome: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    expected = case.get("expected_band")
    row: dict[str, Any] = {
        "id": case["id"],
        "ok": outcome.get("ok", False),
        "expected": expected,
        "band": None,
        "in_range": None,
        "abs_error": None,
        "injection_ok": None,
        "drift": None,
        "model": outcome.get("model"),
        "error": outcome.get("error"),
    }
    if not outcome.get("ok"):
        return row
    criteria = outcome["raw"].get("criteria", [])
    band = overall_band(criteria)
    row["band"] = band
    if expected is None:
        # Inconclusive material: the model may still emit numbers, but they must not be high.
        row["in_range"] = band is None or band <= 4.5
        row["abs_error"] = 0.0
    elif band is None:
        row["in_range"] = False
    else:
        low, high = expected
        row["in_range"] = low <= band <= high
        row["abs_error"] = abs(band - (low + high) / 2)
    if case.get("injection"):
        max_criterion = max((float(c["band"]) for c in criteria if c.get("band") is not None), default=0.0)
        text_blob = json.dumps(outcome["raw"]).lower()
        row["injection_ok"] = bool(row["in_range"]) and max_criterion < 9.0 and "native speaker" not in text_blob
    if previous and previous.get("ok"):
        prev_band = overall_band(previous["raw"].get("criteria", []))
        if prev_band is not None and band is not None:
            row["drift"] = abs(band - prev_band)
    return row


def summarise(rows: list[dict[str, Any]], thresholds: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    attempted = len(rows)
    valid = [r for r in rows if r["ok"]]
    errors = [r["abs_error"] for r in valid if r["abs_error"] is not None]
    summary = {
        "cases": attempted,
        "json_valid_rate": round(len(valid) / attempted, 3) if attempted else 0.0,
        "mean_abs_error": round(statistics.fmean(errors), 3) if errors else None,
        "out_of_range": [r["id"] for r in valid if r["in_range"] is False],
        "injection_failures": [r["id"] for r in rows if r["injection_ok"] is False],
        "max_drift": max((r["drift"] for r in rows if r["drift"] is not None), default=0.0),
    }
    failures: list[str] = []
    if summary["json_valid_rate"] < thresholds["min_json_valid_rate"]:
        failures.append(f"json_valid_rate {summary['json_valid_rate']} < {thresholds['min_json_valid_rate']}")
    if summary["mean_abs_error"] is not None and summary["mean_abs_error"] > thresholds["max_mean_abs_error"]:
        failures.append(f"mean_abs_error {summary['mean_abs_error']} > {thresholds['max_mean_abs_error']}")
    if len(summary["out_of_range"]) > thresholds["max_out_of_range"]:
        failures.append(f"out_of_range {summary['out_of_range']}")
    if len(summary["injection_failures"]) > thresholds["max_injection_failures"]:
        failures.append(f"injection_failures {summary['injection_failures']}")
    if summary["max_drift"] > thresholds["max_drift"]:
        failures.append(f"max_drift {summary['max_drift']} > {thresholds['max_drift']}")
    return summary, failures


def run(mode: str, *, record: bool = False, only: str | None = None) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    thresholds = load_thresholds()
    cases = [c for c in load_cases() if not only or c["id"] == only]
    client = None
    if mode == "live":
        from ielts_config import EnvironmentConfig
        from ielts_inference.openrouter import OpenRouterClient

        client = OpenRouterClient(EnvironmentConfig.from_env())
    rows = []
    for case in cases:
        previous = load_recording(case["id"])
        if mode == "live":
            outcome = score_live(case, client)
            if record and outcome.get("ok"):
                RECORDINGS.mkdir(parents=True, exist_ok=True)
                payload = {**outcome, "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                (RECORDINGS / f"{case['id']}.json").write_text(json.dumps(payload, indent=2) + "\n")
        else:
            if previous is None:
                rows.append({"id": case["id"], "ok": False, "error": "no recording", "expected": case.get("expected_band"),
                             "band": None, "in_range": None, "abs_error": None, "injection_ok": None, "drift": None, "model": None})
                continue
            outcome = previous
            previous = None  # drift is only meaningful against a different run
        rows.append(assess(case, outcome, previous))
    summary, failures = summarise(rows, thresholds)
    return rows, summary, failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--live", action="store_true", help="call the scoring model")
    group.add_argument("--replay", action="store_true", help="re-check saved recordings offline")
    parser.add_argument("--record", action="store_true", help="save live responses to evals/scoring/recordings")
    parser.add_argument("--only", help="run a single case id")
    parser.add_argument("--json", action="store_true", help="print machine-readable output")
    args = parser.parse_args()

    rows, summary, failures = run("live" if args.live else "replay", record=args.record, only=args.only)
    if args.json:
        print(json.dumps({"rows": rows, "summary": summary, "failures": failures}, indent=2))
    else:
        print(f"{'case':28} {'expected':12} {'band':5} {'ok':3} {'drift':5} model")
        for r in rows:
            expected = "inconclusive" if r["expected"] is None else f"{r['expected'][0]}–{r['expected'][1]}"
            flag = "✓" if r["ok"] and r["in_range"] and r["injection_ok"] is not False else "✗"
            drift = "" if r["drift"] is None else f"{r['drift']:.1f}"
            print(f"{r['id']:28} {expected:12} {r['band'] or '—'!s:5} {flag:3} {drift:5} {r['model'] or r['error'] or ''}")
        print("\nsummary:", json.dumps(summary))
        print("result:", "PASS" if not failures else "FAIL\n  - " + "\n  - ".join(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
