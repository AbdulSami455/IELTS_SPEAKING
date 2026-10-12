"""Object-key helpers that do not depend on the API layer."""

from __future__ import annotations

import hashlib


def examiner_object_key(prompt_text: str, version: str = "v1", model: str = "", voice: str = "") -> str:
    digest = hashlib.sha256(f"{prompt_text}\n{model}\n{voice}".encode()).hexdigest()[:16]
    return f"examiner/{version}/{digest}.mp3"
