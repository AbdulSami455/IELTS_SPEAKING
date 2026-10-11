"""Redis-backed sliding-window rate limits shared by every API replica.

Each limit is a sorted set of request timestamps under ``rl:<scope>:<key>``.
If Redis is unreachable the limiter fails open and records a metric, so an
outage degrades protection rather than taking the API down.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass

from fastapi import Request
from starlette.datastructures import Headers

from ielts_api.errors import AppError
from ielts_observability import record_rate_limited, record_rate_limiter_error

_logger = logging.getLogger(__name__)
_client = None


@dataclass(frozen=True)
class Limit:
    scope: str
    limit: int
    window_seconds: int


# Authenticated traffic, keyed by auth subject (checked before any DB work).
USER_LIMIT = Limit("user", 300, 60)
# Live-room telemetry can be chatty but must not become a write amplifier.
EVENTS_LIMIT = Limit("events", 120, 60)
# One socket message per second, sustained.
SOCKET_LIMIT = Limit("socket", 60, 60)
# Public auth routes, keyed by client IP: short burst plus hourly ceiling.
AUTH_LIMITS = (Limit("auth-burst", 10, 60), Limit("auth-hour", 50, 3600))


def set_client(client) -> None:
    """Inject a Redis client (tests use fakeredis)."""
    global _client
    _client = client


def _redis():
    global _client
    if _client is None:
        import redis.asyncio as redis

        from ielts_config import get_config

        _client = redis.from_url(
            get_config().redis_url,
            decode_responses=True,
            socket_timeout=0.5,
            socket_connect_timeout=0.5,
        )
    return _client


async def allow(key: str, limit: Limit) -> bool:
    """Record one hit and report whether it stays within the limit."""
    now = time.time()
    redis_key = f"rl:{limit.scope}:{key}"
    member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"
    try:
        client = _redis()
        async with client.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(redis_key, 0, now - limit.window_seconds)
            pipe.zadd(redis_key, {member: now})
            pipe.zcard(redis_key)
            pipe.expire(redis_key, limit.window_seconds)
            _, _, count, _ = await pipe.execute()
    except Exception:  # noqa: BLE001 - any Redis failure fails open
        record_rate_limiter_error()
        _logger.warning("rate limiter unavailable; allowing request", exc_info=True)
        return True
    if int(count) > limit.limit:
        record_rate_limited(limit.scope)
        return False
    return True


async def enforce(key: str, limit: Limit) -> None:
    if not await allow(key, limit):
        raise AppError("RATE_LIMITED", "Too many requests. Wait a moment and try again.", 429, retryable=True)


def client_ip(headers: Headers, client_host: str | None, trusted_proxy_hops: int) -> str:
    """The caller's IP as seen by the nearest trusted proxy.

    ``X-Forwarded-For`` grows from the left as each proxy appends the address it
    saw, so with N trusted hops the Nth entry from the right is the real client.
    Anything further left is client-supplied and must be ignored.
    """
    forwarded = headers.get("x-forwarded-for", "")
    if trusted_proxy_hops > 0 and forwarded:
        parts = [part.strip() for part in forwarded.split(",") if part.strip()]
        if parts:
            index = max(0, len(parts) - trusted_proxy_hops)
            return parts[index]
    return client_host or "unknown"


async def enforce_for_request(request: Request, limit: Limit, *, key: str | None = None) -> None:
    """Apply a limit keyed by the request's client IP unless a key is given."""
    if key is None:
        from ielts_config import get_config

        key = client_ip(request.headers, request.client.host if request.client else None, get_config().trusted_proxy_hops)
    await enforce(key, limit)
