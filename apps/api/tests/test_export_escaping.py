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
