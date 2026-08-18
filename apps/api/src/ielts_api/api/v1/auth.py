"""Register and sign in with email and password."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.api.v1.schemas import ApiModel, camelize
from ielts_api.auth.identity import JwtIdentityVerifier
from ielts_api.auth.passwords import hash_password, verify_password
from ielts_api.deps import get_session, settings
from ielts_api.errors import conflict, validation
from ielts_config import EnvironmentConfig
from ielts_db.repositories import UserRepository
from fastapi.encoders import jsonable_encoder

router = APIRouter()


class AuthRequest(ApiModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str | None = None


def envelope(data):
    return {"data": camelize(jsonable_encoder(data)), "requestId": "local"}


@router.post("/auth/register")
async def register(
    payload: AuthRequest,
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
    token = JwtIdentityVerifier(config).issue(user.id, user.auth_subject, user.email, user.display_name)
    return envelope(
        {
            "token": token,
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
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> dict:
    repo = UserRepository(session)
    user = await repo.get_by_email(payload.email.strip().lower())
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise validation("Email or password is incorrect")
    token = JwtIdentityVerifier(config).issue(user.id, user.auth_subject, user.email, user.display_name)
    return envelope(
        {
            "token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "consent_required": user.consent_version is None,
            },
        }
    )
