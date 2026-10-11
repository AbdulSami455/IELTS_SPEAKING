"""Request guards that run before routing: body caps, CSRF origin checks, auth IP limits."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ielts_api.errors import AppError
from ielts_api.rate_limit import AUTH_LIMITS, Limit, allow, client_ip

_AUTH_PATH = re.compile(r"^/v1/auth/(login|register|refresh)/?$")
_AUDIO_PATH = re.compile(r"^/v1/tests/[^/]+/realtime/turns/[^/]+/audio/?$")
_STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}


def _error_body(code: str, message: str, status: int, retryable: bool = False) -> bytes:
    return json.dumps(
        {"error": {"code": code, "message": message, "retryable": retryable, "details": {}}, "requestId": "guard"}
    ).encode()


async def _reject(send: Send, status: int, code: str, message: str, retryable: bool = False, extra_headers: Iterable[tuple[bytes, bytes]] = ()) -> None:
    body = _error_body(code, message, status, retryable)
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode()),
        *extra_headers,
    ]
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class RequestGuardMiddleware:
    """Pure-ASGI so it can refuse a request before any body is read.

    Order of checks: origin (CSRF) → declared body size → auth IP limits. Streamed
    bodies are counted as they arrive and raise ``AppError`` (413) from ``receive``,
    which the app's error handler turns into the normal error envelope.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        allowed_origins: Iterable[str],
        json_max_bytes: int,
        audio_max_bytes: int,
        trusted_proxy_hops: int,
        auth_limits: tuple[Limit, ...] = AUTH_LIMITS,
    ) -> None:
        self.app = app
        self.allowed_origins = {origin.rstrip("/") for origin in allowed_origins if origin}
        self.json_max_bytes = json_max_bytes
        self.audio_max_bytes = audio_max_bytes
        self.trusted_proxy_hops = trusted_proxy_hops
        self.auth_limits = auth_limits

    def _origin_allowed(self, headers: Headers) -> bool:
        origin = headers.get("origin")
        if origin:
            return origin.rstrip("/") in self.allowed_origins
        referer = headers.get("referer")
        if referer:
            return any(referer.startswith(f"{allowed}/") or referer == allowed for allowed in self.allowed_origins)
        # No browser-set origin information: not a cross-site browser request.
        return True

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        method: str = scope["method"]
        path: str = scope["path"]
        headers = Headers(scope=scope)

        if method in _STATE_CHANGING and not self._origin_allowed(headers):
            await _reject(send, 403, "ORIGIN_NOT_ALLOWED", "Cross-site requests are not accepted.")
            return

        limit = self.audio_max_bytes if method == "POST" and _AUDIO_PATH.match(path) else self.json_max_bytes
        declared = headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > limit:
            await _reject(send, 413, "PAYLOAD_TOO_LARGE", f"Request body exceeds {limit} bytes.")
            return

        if method == "POST" and _AUTH_PATH.match(path):
            client = scope.get("client")
            ip = client_ip(headers, client[0] if client else None, self.trusted_proxy_hops)
            for auth_limit in self.auth_limits:
                if not await allow(ip, auth_limit):
                    await _reject(
                        send,
                        429,
                        "RATE_LIMITED",
                        "Too many sign-in attempts. Wait a minute and try again.",
                        retryable=True,
                        extra_headers=[(b"retry-after", str(auth_limit.window_seconds).encode())],
                    )
                    return

        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise AppError("PAYLOAD_TOO_LARGE", f"Request body exceeds {limit} bytes.", 413)
            return message

        await self.app(scope, counting_receive, send)
