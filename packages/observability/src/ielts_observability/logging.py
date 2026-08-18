"""JSON logs with redaction of secrets, transcripts, and signed URLs."""

from __future__ import annotations

import json
import logging
import re
import sys
from typing import Any

SECRET_KEYS = {
    "authorization",
    "cookie",
    "password",
    "secret",
    "token",
    "api_key",
    "openrouter_api_key",
    "minio_secret_key",
    "playback_url",
    "upload_url",
    "transcript",
    "text",
    "prompt",
    "audio",
    "words",
}

URL_RE = re.compile(r"https?://[^\s]+X-Amz-[^\s]+", re.IGNORECASE)
BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE)


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if str(key).lower() in SECRET_KEYS or any(part in str(key).lower() for part in ("secret", "token", "transcript")):
                out[key] = "[redacted]"
            else:
                out[key] = redact(item)
        return out
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        text = URL_RE.sub("[redacted-url]", value)
        return BEARER_RE.sub("Bearer [redacted]", text)
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "test_id": getattr(record, "test_id", None),
        }
        return json.dumps(redact(payload), default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
