"""Identity verification adapters."""

from __future__ import annotations

from dataclasses import dataclass

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


class DevIdentityVerifier:
    def __init__(self, config: EnvironmentConfig) -> None:
        self._subject = config.dev_auth_user_id

    async def verify(self, token: str) -> AuthenticatedUser | None:
        allowed = {self._subject, "dev-token", "dev-token-for-testing"}
        if token not in allowed:
            return None
        return AuthenticatedUser(
            user_id=0,
            auth_subject=self._subject,
            email="dev@example.com",
            display_name="Practice Candidate",
        )


class JwtIdentityVerifier:
    def __init__(self, config: EnvironmentConfig) -> None:
        self._secret = config.auth_token_secret
        self._issuer = config.auth_jwt_issuer or None
        self._audience = config.auth_jwt_audience or None

    def issue(self, user_id: int, auth_subject: str, email: str | None, display_name: str | None) -> str:
        payload = {
            "sub": auth_subject,
            "uid": user_id,
            "email": email,
            "name": display_name,
        }
        if self._issuer:
            payload["iss"] = self._issuer
        if self._audience:
            payload["aud"] = self._audience
        return jwt.encode(payload, self._secret, algorithm="HS256")

    async def verify(self, token: str) -> AuthenticatedUser | None:
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
        subject = payload.get("sub")
        if not subject:
            return None
        return AuthenticatedUser(
            user_id=int(payload.get("uid") or 0),
            auth_subject=str(subject),
            email=payload.get("email"),
            display_name=payload.get("name"),
        )


class AppIdentityVerifier:
    def __init__(self, config: EnvironmentConfig) -> None:
        self._jwt = JwtIdentityVerifier(config)
        self._dev = (
            DevIdentityVerifier(config)
            if config.auth_mode == "dev" and not config.is_production
            else None
        )

    async def verify(self, token: str) -> AuthenticatedUser | None:
        identity = await self._jwt.verify(token)
        if identity is not None:
            return identity
        if self._dev is not None:
            return await self._dev.verify(token)
        return None


def get_identity_verifier(config: EnvironmentConfig):
    if config.auth_mode == "clerk":
        raise RuntimeError("Clerk authentication has been removed")
    return AppIdentityVerifier(config)
