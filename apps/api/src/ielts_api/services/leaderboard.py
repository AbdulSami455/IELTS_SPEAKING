"""Comparable best-band rankings, one entry per participant."""
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from ielts_db.models import Report, TestSession, User
from ielts_inference.assembler import EVALUATOR_VERSION
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Subquery

from ielts_api.api.v1.schemas import ApiModel


class LeaderboardPeriod(StrEnum):
    TODAY = "today"
    WEEK = "week"
    OVERALL = "overall"


class LeaderboardEntry(ApiModel):
    rank: int
    display_name: str
    best_band: float
    tests_completed: int
    is_you: bool


class LeaderboardResponse(ApiModel):
    period: LeaderboardPeriod
    starts_at: datetime | None
    updated_at: datetime
    total_participants: int
    entries: list[LeaderboardEntry]
    your_entry: LeaderboardEntry | None


def period_start(period: LeaderboardPeriod, now: datetime) -> datetime | None:
    midnight = now.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == LeaderboardPeriod.TODAY:
        return midnight
    if period == LeaderboardPeriod.WEEK:
        return midnight - timedelta(days=midnight.weekday())
    return None


def ranked_scores(period: LeaderboardPeriod, now: datetime) -> Subquery:
    scores = (
        select(
            User.id.label("user_id"),
            User.display_name,
            func.max(Report.overall_band).label("best_band"),
            func.count(Report.id).label("tests_completed"),
        )
        .join(TestSession, TestSession.user_id == User.id)
        .join(Report, Report.test_session_id == TestSession.id)
        .where(
            TestSession.status == "COMPLETED",
            Report.is_inconclusive.is_(False),
            Report.overall_band.between(0, 9),
            Report.evaluator_version == EVALUATOR_VERSION,
            Report.created_at <= now,
        )
        .group_by(User.id, User.display_name)
    )
    start = period_start(period, now)
    if start is not None:
        scores = scores.where(Report.created_at >= start)
    best = scores.subquery()
    return select(
        best,
        func.rank().over(order_by=best.c.best_band.desc()).label("rank"),
        func.count().over().label("total_participants"),
        func.row_number().over(order_by=(best.c.best_band.desc(), best.c.user_id)).label("position"),
    ).subquery()


async def get_leaderboard(
    session: AsyncSession, user_id: int, period: LeaderboardPeriod,
) -> LeaderboardResponse:
    now = datetime.now(UTC)
    ranked = ranked_scores(period, now)
    rows = (await session.execute(
        select(ranked)
        .where((ranked.c.position <= 50) | (ranked.c.user_id == user_id))
        .order_by(ranked.c.position)
    )).all()
    entries: list[LeaderboardEntry] = []
    your_entry = None
    for row in rows:
        entry = LeaderboardEntry(
            rank=row.rank,
            display_name=(row.display_name or "").strip() or "Learner",
            best_band=row.best_band,
            tests_completed=row.tests_completed,
            is_you=row.user_id == user_id,
        )
        if row.position <= 50:
            entries.append(entry)
        if entry.is_you:
            your_entry = entry
    return LeaderboardResponse(
        period=period, starts_at=period_start(period, now), updated_at=now,
        total_participants=rows[0].total_participants if rows else 0,
        entries=entries, your_entry=your_entry,
    )
