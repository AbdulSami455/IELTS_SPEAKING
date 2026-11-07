"""Model-written report text must be HTML-escaped in the exported page."""

from __future__ import annotations

from unittest.mock import AsyncMock

from ielts_api.services.tests import TestService


async def test_export_escapes_model_text():
    service = TestService.__new__(TestService)
    service.get_report = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "overall_band": 6.5,
            "disclaimer": "<img src=x onerror=alert(1)>",
            "strengths": ["<script>alert('xss')</script>", "Clear & steady pace"],
            "improvements": ["Use \"precise\" words"],
            "evaluator_version": "eval<1>",
            "rubric_version": "rubric\">",
        }
    )
    page = await service.export_report(1, "report-1")
    assert "<script>" not in page
    assert "onerror" not in page.split("<body>")[1].replace("&lt;img src=x onerror", "")
    assert "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;" in page
    assert "Clear &amp; steady pace" in page
    assert "&quot;precise&quot;" in page
    assert "eval&lt;1&gt;" in page
    assert page.startswith("<!doctype html>")


def test_bounded_read_refuses_oversized_objects():
    """An object swapped in after validation must not be loaded past the configured limit."""
    import io

    import pytest
    from ielts_db.storage import ObjectStore

    class FakeResponse:
        def __init__(self, data: bytes) -> None:
            self._buf = io.BytesIO(data)

        def read(self, n: int = -1) -> bytes:
            return self._buf.read(n)

        def close(self) -> None: ...

        def release_conn(self) -> None: ...

    class FakeClient:
        def __init__(self, data: bytes) -> None:
            self.data = data

        def get_object(self, bucket: str, key: str) -> FakeResponse:
            return FakeResponse(self.data)

    store = ObjectStore.__new__(ObjectStore)
    store._require_client = lambda: FakeClient(b"x" * 101)  # type: ignore[method-assign]
    with pytest.raises(ValueError):
        store.get_bytes("b", "k", max_bytes=100)
    store._require_client = lambda: FakeClient(b"x" * 100)  # type: ignore[method-assign]
    assert len(store.get_bytes("b", "k", max_bytes=100)) == 100
    assert len(store.get_bytes("b", "k")) == 100


def test_presigned_post_pins_key_type_and_size(monkeypatch):
    """The signed policy, not our later check, is what stops an oversized upload."""
    from ielts_db.storage import ObjectStore

    store = ObjectStore.__new__(ObjectStore)
    store._ttl = 900
    store._public_base = "https://files.example.com"
    store._require_client = lambda: None  # type: ignore[method-assign]

    class FakeClient:
        def presigned_post_policy(self, policy):
            return {"policy": "signed"}

    seen = {}

    class Policy:
        def __init__(self, bucket, expiration):
            seen["bucket"] = bucket
            seen["conditions"] = []

        def add_equals_condition(self, name, value):
            seen["conditions"].append(("eq", name, value))

        def add_content_length_range_condition(self, lower, upper):
            seen["conditions"].append(("range", lower, upper))

    monkeypatch.setattr("minio.datatypes.PostPolicy", Policy)
    store._public_client = FakeClient()
    url, fields = store.presigned_post("bucket", "tests/1/answers/2.webm", 1000, "audio/webm")
    assert url == "https://files.example.com/bucket"
    assert fields["key"] == "tests/1/answers/2.webm" and fields["Content-Type"] == "audio/webm"
    assert ("range", 1, 1000) in seen["conditions"]
    assert ("eq", "key", "tests/1/answers/2.webm") in seen["conditions"]
    assert ("eq", "Content-Type", "audio/webm") in seen["conditions"]
