"""Identity verification adapters."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from ielts_config import EnvironmentConfig


@dataclass
class AuthenticatedUser:
    user_id: int
    auth_subject: str
    email: str | None
    display_name: str | None
    consent_version: str | None = None
    is_admin: bool = False
    token_version: int = 0


class JwtIdentityVerifier:
    def __init__(self, config: EnvironmentConfig) -> None:
        self._secret = config.auth_token_secret
        self._issuer = config.auth_jwt_issuer or None
        self._audience = config.auth_jwt_audience or None

    def issue(
        self,
        user_id: int,
        auth_subject: str,
        email: str | None,
        display_name: str | None,
        *,
        token_type: str = "access",
        ttl: timedelta | None = None,
        token_version: int = 0,
    ) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": auth_subject,
            "uid": user_id,
            "email": email,
            "name": display_name,
            "typ": token_type,
            "tv": token_version,
            "iat": int(now.timestamp()),
            "exp": int((now + (ttl or timedelta(days=7))).timestamp()),
        }
        if self._issuer:
            payload["iss"] = self._issuer
        if self._audience:
            payload["aud"] = self._audience
        return jwt.encode(payload, self._secret, algorithm="HS256")

    async def verify(self, token: str, *, expected_token_type: str | None = None) -> AuthenticatedUser | None:
        if not self._secret or token.count(".") != 2:
            return None
        options: dict[str, bool] = {"verify_aud": bool(self._audience)}
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                audience=self._audience or None,
                issuer=self._issuer or None,
                options=options,
            )
        except jwt.InvalidTokenError:
            return None
        token_type = payload.get("typ")
        if expected_token_type is not None and token_type != expected_token_type:
            return None
        subject = payload.get("sub")
        if not subject:
            return None
        return AuthenticatedUser(
            user_id=int(payload.get("uid") or 0),
            auth_subject=str(subject),
            email=payload.get("email"),
            display_name=payload.get("name"),
            token_version=int(payload.get("tv") or 0),
        )


def get_identity_verifier(config: EnvironmentConfig) -> JwtIdentityVerifier:
    if config.auth_mode != "jwt":
        raise RuntimeError(f"Unsupported AUTH_MODE={config.auth_mode!r}; only 'jwt' is available")
    return JwtIdentityVerifier(config)
