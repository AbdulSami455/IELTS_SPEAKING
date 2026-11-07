"""Live evals: call the real providers. Excluded by default (`-m 'not eval_live'`).

    uv run pytest evals/tests/test_live.py -m eval_live
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
pytestmark = [
    pytest.mark.eval_live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set"),
]


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_scoring_live_meets_thresholds():
    scoring = _load("scoring_run_live", ROOT / "evals" / "scoring" / "run.py")
    rows, summary, failures = scoring.run("live", record=True)
    assert not failures, json.dumps({"summary": summary, "rows": rows}, indent=2)


def test_examiner_live_meets_thresholds():
    examiner = _load("examiner_run_live", ROOT / "evals" / "examiner" / "run.py")
    rows, summary, failures = examiner.run("live", record=True)
    assert not failures, json.dumps({"summary": summary, "rows": rows}, indent=2, ensure_ascii=False)


def test_provider_probes_pass():
    from ielts_inference.probes import run_provider_probes

    results = run_provider_probes()
    assert results["ok"], json.dumps(results, indent=2)
