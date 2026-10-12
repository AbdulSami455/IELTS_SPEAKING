"""Rebuild immutable progress snapshots from comparable completed reports."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from ielts_db.models import ProgressSnapshot, Report, TestSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_inference.assembler import EVALUATOR_VERSION


async def rebuild_progress_snapshot(session: AsyncSession, user_id: int) -> ProgressSnapshot:
    result = await session.execute(
        select(Report, TestSession)
        .join(TestSession, TestSession.id == Report.test_session_id)
        .where(TestSession.user_id == user_id)
        .where(TestSession.status == "COMPLETED")
        .where(Report.evaluator_version == EVALUATOR_VERSION)
        .order_by(Report.created_at.asc())
    )
    rows = result.all()
    bands = [report.overall_band for report, _test in rows if report.overall_band is not None]
    trend = "insufficient_data"
    if len(bands) >= 2:
        if bands[-1] > bands[0]:
            trend = "up"
        elif bands[-1] < bands[0]:
            trend = "down"
        else:
            trend = "stable"
    elif bands:
        trend = "stable"
    now = datetime.now(UTC)
    window_start = rows[0][0].created_at if rows else now
    snapshot = ProgressSnapshot(
        id=str(uuid.uuid4()),
        user_id=user_id,
        window_start=window_start,
        window_end=now,
        comparability_group=EVALUATOR_VERSION,
        criterion_trends={"overall": {"trend": trend, "bands": bands}},
        skill_trends={},
        sample_size=len(rows),
        confidence_label="medium" if len(bands) >= 2 else "low",
    )
    session.add(snapshot)
    await session.flush()
    return snapshot
