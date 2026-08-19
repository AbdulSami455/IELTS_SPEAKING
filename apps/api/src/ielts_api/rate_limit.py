"""Per-user request rate limit."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request

from ielts_api.errors import AppError

_hits: dict[int, deque[float]] = defaultdict(deque)


def check_rate(user_id: int, request: Request | None = None, limit: int = 180, window_seconds: int = 60) -> None:
    if request is not None:
        if request.method in {"GET", "OPTIONS", "HEAD"}:
            return
        path = request.url.path.rstrip("/")
        if path.endswith("/realtime/events") or path.endswith("/status"):
            return
    now = time.monotonic()
    bucket = _hits[user_id]
    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise AppError("RATE_LIMITED", "Too many requests. Wait and retry.", 429, retryable=True)
    bucket.append(now)
