from fastapi import APIRouter

from ielts_api.api.v1.auth import router as auth_router
from ielts_api.api.v1.tests import router as tests_router

from ielts_api.api.v1.leaderboard import router as leaderboard_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(tests_router)

api_router.include_router(leaderboard_router)
