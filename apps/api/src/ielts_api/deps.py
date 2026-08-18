"""API dependencies."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.auth.identity import AuthenticatedUser, get_identity_verifier
from ielts_config import EnvironmentConfig, get_config
from ielts_db.database import DatabaseConfig
from ielts_db.repositories import UserRepository
from ielts_db.storage import ObjectStore

_db: DatabaseConfig | None = None
_store: ObjectStore | None = None
_security = HTTPBearer(auto_error=False)


def settings() -> EnvironmentConfig:
    return get_config()


def database() -> DatabaseConfig:
    global _db
    if _db is None:
        _db = DatabaseConfig()
    return _db


def object_store(config: EnvironmentConfig = Depends(settings)) -> ObjectStore:
    global _store
    if _store is None:
        _store = ObjectStore(config)
    return _store


async def get_session() -> AsyncIterator[AsyncSession]:
    factory = database().session_factory
    async with factory() as session:
        yield session


async def require_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
    session: AsyncSession = Depends(get_session),
    config: EnvironmentConfig = Depends(settings),
) -> AuthenticatedUser:
    token = credentials.credentials if credentials else request.headers.get("authorization", "").removeprefix("Bearer ")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    identity = await get_identity_verifier(config).verify(token)
    if identity is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    repo = UserRepository(session)
    user = await repo.create_or_update(
        auth_subject=identity.auth_subject,
        email=identity.email,
        display_name=identity.display_name,
    )
    await session.commit()
    await session.refresh(user)
    from ielts_api.rate_limit import check_rate

    check_rate(user.id)
    return AuthenticatedUser(
        user_id=user.id,
        auth_subject=user.auth_subject,
        email=user.email,
        display_name=user.display_name,
        consent_version=user.consent_version,
    )
