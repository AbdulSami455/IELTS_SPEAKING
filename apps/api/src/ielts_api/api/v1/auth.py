"""Register and sign in with email and password."""

from __future__ import annotations

import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from ielts_config import EnvironmentConfig
from ielts_db.models import User
from ielts_db.repositories import ConsentRepository, UserRepository
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.api.v1.schemas import ApiModel, camelize
from ielts_api.auth.identity import JwtIdentityVerifier, get_identity_verifier
from ielts_api.auth.passwords import hash_password, verify_password
from ielts_api.deps import get_session, settings
from ielts_api.errors import conflict, validation

router = APIRouter()

REFRESH_COOKIE_PATH = "/v1/auth/refresh"
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f-\x9f]")
# Verified against unknown emails so a login attempt takes the same time either way.
_DUMMY_HASH = hash_password("timing-equalizer-" + secrets.token_hex(8))


class AuthRequest(ApiModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)
    # Registration only: terms, privacy policy, and audio-recording consent.
    accept_terms: bool = False


def envelope(data):
    return {"data": camelize(jsonable_encoder(data)), "requestId": "local"}


def user_payload(user: User, config: EnvironmentConfig) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "consent_version": user.consent_version,
        "consent_required": user.consent_version != config.consent_version,
        "current_consent_version": config.consent_version,
    }


def _clean_display_name(value: str | None) -> str:
    cleaned = _CONTROL_CHARS.sub("", value or "")
    cleaned = re.sub(r"[<>]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned:
        return cleaned[:80]
    # Never default to the email local-part: it is shown on the public leaderboard.
    return f"Learner-{secrets.randbelow(9000) + 1000}"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    config: EnvironmentConfig,
) -> None:
    response.set_cookie(
        key="auth-token",
        value=access_token,
        max_age=60 * 60 * 24 * 7,
        httponly=True,
        secure=config.is_production,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key="auth-refresh",
        value=refresh_token,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=config.is_production,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def _clear_auth_cookies(response: Response) -> None:
    for key, path in (("auth-token", "/"), ("auth-refresh", REFRESH_COOKIE_PATH)):
        response.delete_cookie(key=key, path=path)


def _issue_auth_tokens(
    verifier: JwtIdentityVerifier,
    *,
    user_id: int,
    auth_subject: str,
    email: str | None,
    display_name: str | None,
) -> tuple[str, str]:
    access_token = verifier.issue(
        user_id,
        auth_subject,
        email,
        display_name,
        token_type="access",
    )
    refresh_token = verifier.issue(
        user_id,
        auth_subject,
        email,
        display_name,
        token_type="refresh",
        ttl=timedelta(days=30),
    )
    return access_token, refresh_token


@router.post("/auth/register")
async def register(
    payload: AuthRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    email = payload.email.strip().lower()
    if not _EMAIL.match(email):
        raise validation("Enter a valid email")
    if not payload.accept_terms:
        raise validation("Accept the terms, privacy policy, and audio-recording consent to create an account")
    repo = UserRepository(session)
    if await repo.get_by_email(email) is not None:
        raise conflict("An account with this email already exists")
    user = await repo.create_local(
        email=email,
        display_name=_clean_display_name(payload.display_name),
        password_hash=hash_password(payload.password),
    )
    await ConsentRepository(session).record(
        user,
        config.consent_version,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    access_token, refresh_token = _issue_auth_tokens(
        JwtIdentityVerifier(config),
        user_id=user.id,
        auth_subject=user.auth_subject,
        email=user.email,
        display_name=user.display_name,
    )
    _set_auth_cookies(response, access_token, refresh_token, config)
    return envelope({"user": user_payload(user, config)})


@router.post("/auth/login")
async def login(
    payload: AuthRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    repo = UserRepository(session)
    user = await repo.get_by_email(payload.email.strip().lower())
    stored_hash = user.password_hash if user is not None and user.password_hash else _DUMMY_HASH
    if not verify_password(payload.password, stored_hash) or user is None or not user.password_hash:
        raise validation("Email or password is incorrect")
    access_token, refresh_token = _issue_auth_tokens(
        JwtIdentityVerifier(config),
        user_id=user.id,
        auth_subject=user.auth_subject,
        email=user.email,
        display_name=user.display_name,
    )
    _set_auth_cookies(response, access_token, refresh_token, config)
    return envelope({"user": user_payload(user, config)})


@router.post("/auth/logout")
async def logout(response: Response) -> dict:
    _clear_auth_cookies(response)
    return envelope({"deleted": True})


@router.post("/auth/refresh")
async def refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    refresh_token = request.cookies.get("auth-refresh")
    if not refresh_token:
        raise validation("No refresh token")
    identity = await get_identity_verifier(config).verify(refresh_token, expected_token_type="refresh")
    if identity is None:
        raise validation("Invalid refresh token")
    repo = UserRepository(session)
    user = await repo.get_by_auth_subject(identity.auth_subject)
    if user is None:
        raise validation("Invalid refresh token")
    access_token, next_refresh_token = _issue_auth_tokens(
        JwtIdentityVerifier(config),
        user_id=user.id,
        auth_subject=user.auth_subject,
        email=user.email,
        display_name=user.display_name,
    )
    _set_auth_cookies(response, access_token, next_refresh_token, config)
    return envelope({"refreshed": True})
