"""Sliding-window limiter semantics and proxy-aware client IP resolution."""

from __future__ import annotations

import asyncio

import pytest
from ielts_api import rate_limit
from ielts_api.errors import AppError
from ielts_api.rate_limit import Limit, allow, client_ip, enforce
from starlette.datastructures import Headers


async def test_allow_counts_within_window(fake_redis):
    limit = Limit("unit", 2, 60)
    assert await allow("k", limit) is True
    assert await allow("k", limit) is True
    assert await allow("k", limit) is False
    # Other keys have their own budget.
    assert await allow("other", limit) is True


async def test_window_slides(fake_redis):
    limit = Limit("slide", 1, 1)
    assert await allow("k", limit) is True
    assert await allow("k", limit) is False
    await asyncio.sleep(1.1)
    assert await allow("k", limit) is True


async def test_enforce_raises_429(fake_redis):
    limit = Limit("enf", 1, 60)
    await enforce("k", limit)
    with pytest.raises(AppError) as excinfo:
        await enforce("k", limit)
    assert excinfo.value.status_code == 429
    assert excinfo.value.code == "RATE_LIMITED"


async def test_limiter_fails_open_when_redis_is_down():
    class Broken:
        def pipeline(self, *args, **kwargs):
            raise ConnectionError("redis down")

        async def eval(self, *args, **kwargs):
            raise ConnectionError("redis down")

        def __getattr__(self, name):
            raise ConnectionError("redis down")

    rate_limit.set_client(Broken())
    try:
        assert await allow("k", Limit("open", 1, 60)) is True
    finally:
        rate_limit.set_client(None)


@pytest.mark.parametrize(
    ("forwarded", "hops", "host", "expected"),
    [
        ("", 1, "9.9.9.9", "9.9.9.9"),
        ("1.1.1.1", 0, "9.9.9.9", "9.9.9.9"),  # no trusted proxy: header is client-supplied
        ("1.1.1.1", 1, "9.9.9.9", "1.1.1.1"),
        ("6.6.6.6, 1.1.1.1", 1, "9.9.9.9", "1.1.1.1"),  # spoofed left-most entry ignored
        ("6.6.6.6, 1.1.1.1, 2.2.2.2", 2, "9.9.9.9", "1.1.1.1"),
        (" , ", 1, None, "unknown"),
    ],
)
def test_client_ip(forwarded, hops, host, expected):
    headers = Headers({"x-forwarded-for": forwarded} if forwarded else {})
    assert client_ip(headers, host, hops) == expected
