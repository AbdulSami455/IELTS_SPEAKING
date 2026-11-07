"""Repositories for application data access."""

from __future__ import annotations

import uuid

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ielts_db.models import (
    Answer,
    ConsentRecord,
    ConversationEvent,
    CriterionScore,
    PracticeAction,
    PracticeGoal,
    ProcessingJob,
    QuestionSet,
    RealtimeSession,
    Report,
    SessionQuestion,
    TestSession,
    User,
)


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self._session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def create_local(self, email: str, display_name: str, password_hash: str) -> User:
        user = User(
            # Random and never reused: a token minted for a deleted account must not
            # resolve to a later account that registers with the same email.
            auth_subject=f"local:{uuid.uuid4()}",
            email=email.lower(),
            display_name=display_name,
            password_hash=password_hash,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_by_auth_subject(self, auth_subject: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.auth_subject == auth_subject)
        )
        return result.scalar_one_or_none()

    async def create_or_update(
        self,
        auth_subject: str,
        email: str | None = None,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        existing = await self.get_by_auth_subject(auth_subject)
        if existing:
            if email is not None:
                existing.email = email
            if display_name is not None:
                existing.display_name = display_name
            if avatar_url is not None:
                existing.avatar_url = avatar_url
            await self._session.flush()
            return existing

        user = User(
            auth_subject=auth_subject,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def record_consent(self, user_id: int, version: str) -> User:
        user = await self.get_by_id(user_id)
        if user is None:
            raise ValueError("user not found")
        user.consent_version = version
        user.consent_accepted_at = datetime.now(UTC)
        await self._session.flush()
        return user


class ConsentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        user: User,
        version: str,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> ConsentRecord:
        """Append a consent row and move the user's pointer to this version."""
        row = ConsentRecord(
            user_id=user.id,
            version=version[:32],
            ip_address=(ip or "")[:64] or None,
            user_agent=(user_agent or "")[:255] or None,
        )
        self._session.add(row)
        user.consent_version = version[:32]
        user.consent_accepted_at = datetime.now(UTC)
        await self._session.flush()
        return row


class QuestionSetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_published(self, slug: str | None = None) -> QuestionSet | None:
        stmt = (
            select(QuestionSet)
            .options(selectinload(QuestionSet.questions))
            .where(QuestionSet.is_published.is_(True))
        )
        if slug:
            stmt = stmt.where(QuestionSet.slug == slug)
        stmt = stmt.order_by(QuestionSet.id.desc())
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_published(self) -> Sequence[QuestionSet]:
        result = await self._session.execute(
            select(QuestionSet)
            .where(QuestionSet.is_published.is_(True))
            .order_by(QuestionSet.slug.asc(), QuestionSet.id.desc())
        )
        return result.scalars().all()


class TestSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_owned(self, test_id: str, user_id: int) -> TestSession | None:
        result = await self._session.execute(
            select(TestSession)
            .options(
                selectinload(TestSession.session_questions)
                .selectinload(SessionQuestion.answer)
                .selectinload(Answer.transcript),
                selectinload(TestSession.session_questions)
                .selectinload(SessionQuestion.answer)
                .selectinload(Answer.media_object),
                selectinload(TestSession.answers).selectinload(Answer.transcript),
                selectinload(TestSession.realtime_sessions),
                selectinload(TestSession.conversation_events),
                selectinload(TestSession.report),
                selectinload(TestSession.processing_jobs),
            )
            .where(TestSession.id == test_id)
            .where(TestSession.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, test_id: str) -> TestSession | None:
        result = await self._session.execute(
            select(TestSession)
            .options(
                selectinload(TestSession.session_questions)
                .selectinload(SessionQuestion.answer)
                .selectinload(Answer.transcript),
                selectinload(TestSession.session_questions)
                .selectinload(SessionQuestion.answer)
                .selectinload(Answer.media_object),
                selectinload(TestSession.answers).selectinload(Answer.transcript),
                selectinload(TestSession.realtime_sessions),
                selectinload(TestSession.conversation_events),
                selectinload(TestSession.report),
                selectinload(TestSession.processing_jobs),
            )
            .where(TestSession.id == test_id)
        )
        return result.scalar_one_or_none()

    async def list_owned(self, user_id: int, limit: int) -> Sequence[TestSession]:
        result = await self._session.execute(
            select(TestSession)
            .where(TestSession.user_id == user_id)
            .where(TestSession.status != "DELETED")
            .order_by(TestSession.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def active_for_user(self, user_id: int) -> TestSession | None:
        result = await self._session.execute(
            select(TestSession)
            .where(TestSession.user_id == user_id)
            .where(
                TestSession.status.notin_(
                    ["COMPLETED", "FAILED", "DELETED", "EXPIRED", "DELETING"]
                )
            )
            .order_by(TestSession.created_at.desc())
        )
        return result.scalars().first()


class AnswerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_owned(self, answer_id: str, test_id: str) -> Answer | None:
        result = await self._session.execute(
            select(Answer)
            .options(
                selectinload(Answer.media_object),
                selectinload(Answer.session_question),
                selectinload(Answer.transcript),
            )
            .where(Answer.id == answer_id)
            .where(Answer.test_session_id == test_id)
        )
        return result.scalar_one_or_none()

    async def list_for_test(self, test_id: str) -> Sequence[Answer]:
        result = await self._session.execute(
            select(Answer)
            .options(selectinload(Answer.session_question), selectinload(Answer.media_object))
            .where(Answer.test_session_id == test_id)
        )
        return result.scalars().all()


class RealtimeSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def active_for_test(self, test_id: str) -> RealtimeSession | None:
        result = await self._session.execute(
            select(RealtimeSession)
            .where(RealtimeSession.test_session_id == test_id)
            .where(RealtimeSession.status == "ACTIVE")
            .order_by(RealtimeSession.created_at.desc())
        )
        return result.scalars().first()

    async def list_events(self, test_id: str) -> Sequence[ConversationEvent]:
        result = await self._session.execute(
            select(ConversationEvent)
            .where(ConversationEvent.test_session_id == test_id)
            .order_by(ConversationEvent.sequence_index.asc(), ConversationEvent.id.asc())
        )
        return result.scalars().all()


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, report_id: str) -> Report | None:
        result = await self._session.execute(select(Report).where(Report.id == report_id))
        return result.scalar_one_or_none()

    async def get_for_test(self, test_id: str) -> Report | None:
        result = await self._session.execute(
            select(Report).where(Report.test_session_id == test_id)
        )
        return result.scalar_one_or_none()

    async def list_criteria(self, test_id: str) -> Sequence[CriterionScore]:
        result = await self._session.execute(
            select(CriterionScore).where(CriterionScore.test_session_id == test_id)
        )
        return result.scalars().all()

    async def previous_comparable(
        self,
        user_id: int,
        before_created_at,
        evaluator_version: str,
    ) -> tuple[TestSession, Report] | None:
        result = await self._session.execute(
            select(TestSession, Report)
            .join(Report, Report.test_session_id == TestSession.id)
            .where(TestSession.user_id == user_id)
            .where(TestSession.status == "COMPLETED")
            .where(Report.evaluator_version == evaluator_version)
            .where(Report.is_inconclusive.is_(False))
            .where(Report.created_at < before_created_at)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        row = result.first()
        return row if row is None else (row[0], row[1])


class ProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def current_goal(self, user_id: int) -> PracticeGoal | None:
        result = await self._session.execute(
            select(PracticeGoal)
            .where(PracticeGoal.user_id == user_id)
            .where(PracticeGoal.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def upsert_goal(
        self,
        user_id: int,
        goal_id: str,
        target_band: float,
        target_date: datetime,
        focus_skills: list[str],
    ) -> PracticeGoal:
        existing = await self.current_goal(user_id)
        if existing:
            existing.target_band = target_band
            existing.target_date = target_date
            existing.focus_skills = focus_skills
            await self._session.flush()
            return existing
        goal = PracticeGoal(
            id=goal_id,
            user_id=user_id,
            target_band=target_band,
            target_date=target_date,
            focus_skills=focus_skills,
            is_active=True,
        )
        self._session.add(goal)
        await self._session.flush()
        return goal

    async def list_actions(self, user_id: int) -> Sequence[PracticeAction]:
        result = await self._session.execute(
            select(PracticeAction)
            .where(PracticeAction.user_id == user_id)
            .order_by(PracticeAction.created_at.desc())
        )
        return result.scalars().all()

    async def get_action(self, action_id: str, user_id: int) -> PracticeAction | None:
        result = await self._session.execute(
            select(PracticeAction)
            .where(PracticeAction.id == action_id)
            .where(PracticeAction.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def completed_reports(self, user_id: int) -> Sequence[tuple[TestSession, Report]]:
        result = await self._session.execute(
            select(TestSession, Report)
            .join(Report, Report.test_session_id == TestSession.id)
            .where(TestSession.user_id == user_id)
            .where(TestSession.status == "COMPLETED")
            .order_by(Report.created_at.asc())
        )
        return result.tuples().all()

    async def criterion_stats(self, user_id: int, evaluator_version: str) -> list[dict]:
        from sqlalchemy import func

        result = await self._session.execute(
            select(
                CriterionScore.criterion,
                func.avg(CriterionScore.band),
                func.count(CriterionScore.id),
            )
            .join(TestSession, TestSession.id == CriterionScore.test_session_id)
            .where(TestSession.user_id == user_id)
            .where(TestSession.status == "COMPLETED")
            .where(CriterionScore.confidence != "inconclusive")
            .where(CriterionScore.evaluator_version == evaluator_version)
            .group_by(CriterionScore.criterion)
        )
        rows = []
        for criterion, average, count in result.all():
            rows.append(
                {
                    "criterion": criterion,
                    "average_band": round(float(average), 1) if average is not None else None,
                    "samples": int(count),
                }
            )
        return rows


class JobRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def claim_or_create(
        self,
        job_id: str,
        test_session_id: str,
        job_type: str,
        input_version: str,
        payload: dict,
    ) -> ProcessingJob:
        result = await self._session.execute(
            select(ProcessingJob)
            .where(ProcessingJob.test_session_id == test_session_id)
            .where(ProcessingJob.job_type == job_type)
            .where(ProcessingJob.input_version == input_version)
        )
        existing = result.scalar_one_or_none()
        if existing:
            if existing.status == "COMPLETED":
                return existing
            existing.status = "RUNNING"
            existing.attempt += 1
            existing.started_at = datetime.now(UTC)
            await self._session.flush()
            return existing
        job = ProcessingJob(
            id=job_id,
            test_session_id=test_session_id,
            job_type=job_type,
            input_version=input_version,
            status="RUNNING",
            attempt=1,
            payload=payload,
            started_at=datetime.now(UTC),
        )
        self._session.add(job)
        await self._session.flush()
        return job
