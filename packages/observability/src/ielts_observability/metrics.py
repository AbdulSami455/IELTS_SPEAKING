from __future__ import annotations

from fastapi import Response

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest
except ModuleNotFoundError:
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"
    Counter = None
    generate_latest = None


def _counter(name: str, description: str):
    if Counter is None:
        return None
    return Counter(name, description)


_TESTS_COMPLETED = _counter("tests_completed_total", "Total completed tests")
_STT_CALLS = _counter("stt_calls_total", "Total STT calls")
_SCORING_CALLS = _counter("scoring_calls_total", "Total scoring calls")
_MODEL_CALL_ERRORS = _counter("model_call_errors_total", "Total model call errors")


def metrics_response() -> Response:
    if generate_latest is None:
        return Response("prometheus_client unavailable\n", media_type="text/plain", status_code=503)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def record_test_completed() -> None:
    if _TESTS_COMPLETED is not None:
        _TESTS_COMPLETED.inc()


def record_stt_call() -> None:
    if _STT_CALLS is not None:
        _STT_CALLS.inc()


def record_scoring_call() -> None:
    if _SCORING_CALLS is not None:
        _SCORING_CALLS.inc()


def record_model_call_error() -> None:
    if _MODEL_CALL_ERRORS is not None:
        _MODEL_CALL_ERRORS.inc()
