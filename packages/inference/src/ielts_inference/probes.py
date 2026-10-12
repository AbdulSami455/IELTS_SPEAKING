"""Provider smoke probes: speech-to-text on a known clip and a text-to-speech round trip.

Used three ways:

* ``make evals`` / ``python -m ielts_inference.probes`` prints the results and exits non-zero
  when a probe fails.
* Celery beat runs :func:`run_provider_probes` every 30 minutes and :func:`publish_results`
  stores the outcome in Redis, updates Prometheus gauges, and raises an alert.
* ``GET /health/providers`` serves the last stored outcome.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ielts_config import EnvironmentConfig

from ielts_inference.openrouter import LIVE_READ_TIMEOUT, InferenceError, OpenRouterClient

logger = logging.getLogger(__name__)

ASSETS = Path(__file__).resolve().parent / "assets"
KNOWN_CLIP = ASSETS / "known_sentence.wav"
KNOWN_TEXT = "I usually practise my English in the evening, after work, and I try to speak for at least ten minutes."
TTS_TEXT = "Thank you. Now let's talk about your free time. What do you usually do at the weekend?"
REDIS_KEY = "probes:providers"
REDIS_TTL_SECONDS = 2 * 60 * 60

DEFAULT_LIMITS: dict[str, float] = {
    "max_stt_wer": 0.25,
    "max_stt_latency_seconds": 20,
    "max_tts_latency_seconds": 15,
    "min_tts_bytes": 1024,
}

_SPELLING = {"practice": "practise"}


def _tokens(text: str) -> list[str]:
    words = re.sub(r"[^a-z0-9' ]+", " ", text.lower()).split()
    return [_SPELLING.get(word, word) for word in words]


def wer(reference: str, hypothesis: str) -> float:
    """Word error rate via Levenshtein distance over normalised tokens (0.0 = perfect)."""
    ref, hyp = _tokens(reference), _tokens(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    previous = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        current = [i]
        for j, h in enumerate(hyp, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (r != h)))
        previous = current
    return round(previous[-1] / len(ref), 3)


@dataclass
class ProbeResult:
    provider: str
    ok: bool
    latency_seconds: float
    detail: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


def probe_stt(client: OpenRouterClient, limits: dict[str, float] | None = None, clip: Path = KNOWN_CLIP) -> ProbeResult:
    limits = {**DEFAULT_LIMITS, **(limits or {})}
    started = time.perf_counter()
    try:
        result = client.transcribe(clip.read_bytes(), fmt="wav")
    except (InferenceError, OSError) as exc:
        return ProbeResult("stt", False, round(time.perf_counter() - started, 2), error=str(exc)[:300])
    latency = round(time.perf_counter() - started, 2)
    error_rate = wer(KNOWN_TEXT, result.text)
    detail = {"model": result.model, "wer": error_rate, "transcript": result.text[:200], "language": result.language}
    error = None
    if error_rate > limits["max_stt_wer"]:
        error = f"wer {error_rate} > {limits['max_stt_wer']}"
    elif latency > limits["max_stt_latency_seconds"]:
        error = f"latency {latency}s > {limits['max_stt_latency_seconds']}s"
    return ProbeResult("stt", error is None, latency, detail, error)


def probe_tts(client: OpenRouterClient, limits: dict[str, float] | None = None) -> ProbeResult:
    limits = {**DEFAULT_LIMITS, **(limits or {})}
    started = time.perf_counter()
    try:
        audio, mime = client.synthesize(TTS_TEXT)
    except InferenceError as exc:
        return ProbeResult("tts", False, round(time.perf_counter() - started, 2), error=str(exc)[:300])
    latency = round(time.perf_counter() - started, 2)
    detail = {"bytes": len(audio), "mime": mime}
    error = None
    if len(audio) < limits["min_tts_bytes"]:
        error = f"audio too small ({len(audio)} bytes)"
    elif not mime.startswith("audio/"):
        error = f"unexpected content type {mime}"
    elif latency > limits["max_tts_latency_seconds"]:
        error = f"latency {latency}s > {limits['max_tts_latency_seconds']}s"
    return ProbeResult("tts", error is None, latency, detail, error)


def run_provider_probes(config: EnvironmentConfig | None = None, limits: dict[str, float] | None = None) -> dict[str, Any]:
    config = config or EnvironmentConfig.from_env()
    client = OpenRouterClient(config, read_timeout=LIVE_READ_TIMEOUT)
    results = [probe_stt(client, limits), probe_tts(client, limits)]
    return {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ok": all(item.ok for item in results),
        "providers": {item.provider: asdict(item) for item in results},
    }


def publish_results(results: dict[str, Any], config: EnvironmentConfig) -> None:
    """Persist to Redis, update gauges, and alert on failure. Each step is best-effort."""
    from ielts_observability.metrics import set_probe_result

    for name, item in results["providers"].items():
        set_probe_result(name, item["ok"], item["latency_seconds"])
        if item["ok"]:
            logger.info("provider probe ok", extra={"provider": name, "latency_seconds": item["latency_seconds"]})
        else:
            logger.error("provider probe failed", extra={"provider": name, "error": item.get("error")})
    try:
        import redis

        client = redis.Redis.from_url(config.redis_url, socket_timeout=2, socket_connect_timeout=2)
        try:
            client.set(REDIS_KEY, json.dumps(results), ex=REDIS_TTL_SECONDS)
        finally:
            client.close()
    except Exception as exc:  # noqa: BLE001 - probes must never crash the worker
        logger.warning("could not store probe results", extra={"error": type(exc).__name__})
    if not results["ok"] and config.alert_webhook_url:
        try:
            import httpx

            failed = {k: v.get("error") for k, v in results["providers"].items() if not v["ok"]}
            httpx.post(
                config.alert_webhook_url,
                json={"text": f"IELTS Speaking provider probe failed: {failed}", "source": "probe_providers", "results": results},
                timeout=5.0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("alert webhook failed", extra={"error": type(exc).__name__})


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Run STT/TTS provider probes against OpenRouter.")
    parser.add_argument("--publish", action="store_true", help="also store results in Redis and update metrics")
    args = parser.parse_args(argv)
    config = EnvironmentConfig.from_env()
    results = run_provider_probes(config)
    if args.publish:
        publish_results(results, config)
    print(json.dumps(results, indent=2))
    return 0 if results["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
