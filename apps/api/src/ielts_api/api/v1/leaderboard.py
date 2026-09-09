"""Authenticated community leaderboard."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_api.api.v1.schemas import SuccessEnvelope
from ielts_api.auth.identity import AuthenticatedUser
from ielts_api.deps import get_session, require_user
from ielts_api.services.leaderboard import LeaderboardPeriod, LeaderboardResponse, get_leaderboard

router = APIRouter()


@router.get("/leaderboard", response_model=SuccessEnvelope[LeaderboardResponse])
async def leaderboard(
    period: LeaderboardPeriod = LeaderboardPeriod.TODAY,
    user: AuthenticatedUser = Depends(require_user),
    session: AsyncSession = Depends(get_session),
) -> SuccessEnvelope[LeaderboardResponse]:
    return SuccessEnvelope(data=await get_leaderboard(session, user.user_id, period), request_id="local")
