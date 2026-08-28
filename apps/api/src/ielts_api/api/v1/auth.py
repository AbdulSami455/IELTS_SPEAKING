"""Register and sign in with email and password."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.api.v1.schemas import ApiModel, camelize
from ielts_api.auth.identity import JwtIdentityVerifier, get_identity_verifier
from ielts_api.auth.passwords import hash_password, verify_password
from ielts_api.deps import get_session, settings
from ielts_api.errors import conflict, validation
from ielts_config import EnvironmentConfig
from ielts_db.repositories import UserRepository

router = APIRouter()


class AuthRequest(ApiModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str | None = None


def envelope(data):
    return {"data": camelize(jsonable_encoder(data)), "requestId": "local"}


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
        path="/auth/refresh",
    )


def _clear_auth_cookies(response: Response) -> None:
    for key, path in (("auth-token", "/"), ("auth-refresh", "/auth/refresh")):
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
    response: Response,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email:
        raise validation("Enter a valid email")
    repo = UserRepository(session)
    if await repo.get_by_email(email) is not None:
        raise conflict("An account with this email already exists")
    user = await repo.create_local(
        email=email,
        display_name=(payload.display_name or email.split("@")[0]).strip(),
        password_hash=hash_password(payload.password),
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
    return envelope(
        {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "consent_required": True,
            },
        }
    )


@router.post("/auth/login")
async def login(
    payload: AuthRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    repo = UserRepository(session)
    user = await repo.get_by_email(payload.email.strip().lower())
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise validation("Email or password is incorrect")
    access_token, refresh_token = _issue_auth_tokens(
        JwtIdentityVerifier(config),
        user_id=user.id,
        auth_subject=user.auth_subject,
        email=user.email,
        display_name=user.display_name,
    )
    _set_auth_cookies(response, access_token, refresh_token, config)
    return envelope(
        {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "consent_required": user.consent_version is None,
            },
        }
    )


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
