"""Conversation orchestration for the AI examiner flow."""

from __future__ import annotations

import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ielts_config import EnvironmentConfig
from ielts_db.models import Answer, SessionQuestion, TestSession, Transcript
from ielts_domain import AnswerState, TestEvent, TestState, apply_transition
from ielts_inference.examiner import (
    FOLLOW_UP_INSTRUCTIONS,
    PART1_INSTRUCTIONS,
    PART1_TARGET_QUESTIONS,
    PART2_INSTRUCTIONS,
    PART3_INSTRUCTIONS,
    PART3_TARGET_QUESTIONS,
    GeneratedTurn,
    parse_cue_card,
    parse_follow_up,
    parse_spoken_question,
    part1_intro_turn,
    part1_prompt_input,
    part2_prompt_input,
    part3_prompt_input,
)
from ielts_inference.openrouter import InferenceError, OpenRouterClient
from ielts_inference.quota import reserve_model_call
from ielts_inference.topics import (
    SessionTopicPlan,
    choose_session_topics,
    part1_question_angle,
    part1_questions_on_topic,
    part1_topic_for_index,
    part2_theme,
)


VALID_ANSWER_STATES = {AnswerState.VALID.value, AnswerState.READY.value}


class ConversationOrchestrator:
    def __init__(self, session: AsyncSession, config: EnvironmentConfig) -> None:
        self._session = session
        self._config = config

    async def start(self, test: TestSession) -> None:
        test.topic_plan = await self._assign_topic_plan(test)
        self._transition(test, TestEvent.READY_TO_START)
        self._append_turn(test, part1_intro_turn(), part=1, asset_version="intro")

    async def on_answer_completed(self, test: TestSession, answer: Answer) -> None:
        question = answer.session_question
        if question is None:
            return
        if self._has_later_open_turn(test, answer):
            return
        if test.status == TestState.PART1.value:
            await self._advance_part1(test)
            return
        if test.status == TestState.PART2_SPEAK.value:
            await self._advance_part2(test, question)
            return
        if test.status == TestState.PART3.value:
            await self._advance_part3(test)

    def _has_later_open_turn(self, test: TestSession, answer: Answer) -> bool:
        ordered = sorted(test.session_questions, key=lambda item: (item.sort_order, item.id))
        seen = False
        for question in ordered:
            if question.id == answer.session_question_id:
                seen = True
                continue
            if seen and question.answer and question.answer.status not in VALID_ANSWER_STATES:
                return True
        return False

    def current_turn(self, test: TestSession) -> SessionQuestion | None:
        ordered = sorted(test.session_questions, key=lambda item: (item.sort_order, item.id))
        for question in ordered:
            if question.answer and question.answer.status not in VALID_ANSWER_STATES:
                return question
        return ordered[-1] if ordered else None

    def _transition(self, test: TestSession, event: TestEvent) -> None:
        result = apply_transition(
            TestState(test.status),
            event,
            expected_revision=test.revision,
            current_revision=test.revision,
        )
        test.status = result.new_state.value
        test.revision = result.new_revision

    async def _advance_part1(self, test: TestSession) -> None:
        count = self._part1_main_question_count(test)
        if count < PART1_TARGET_QUESTIONS:
            last_answer = self._last_answer_for_part(test, 1)
            if last_answer and len(last_answer.split()) < 15:
                follow_up = await self._generate_part1_follow_up(test, last_answer)
                if follow_up is not None:
                    self._append_turn(test, follow_up, part=1, asset_version="follow-up")
                    return
            turn = await self._generate_part1_turn(test)
            self._append_turn(test, turn, part=1)
            return
        self._transition(test, TestEvent.COMPLETE_PART1)
        cue = await self._generate_part2_prompt(test)
        self._append_turn(test, cue, part=2)

    async def _advance_part2(self, test: TestSession, question: SessionQuestion) -> None:
        if question.examiner_asset_version == "follow-up":
            self._transition(test, TestEvent.COMPLETE_PART2_SPEAK)
            turn = await self._generate_part3_turn(test)
            self._append_turn(test, turn, part=3)
            return
        follow_up = await self._generate_part2_follow_up(test, question)
        if follow_up is not None:
            self._append_turn(test, follow_up, part=2, asset_version="follow-up")
            return
        self._transition(test, TestEvent.COMPLETE_PART2_SPEAK)
        turn = await self._generate_part3_turn(test)
        self._append_turn(test, turn, part=3)

    async def _advance_part3(self, test: TestSession) -> None:
        count = self._answered_count(test, 3)
        if count < PART3_TARGET_QUESTIONS:
            turn = await self._generate_part3_turn(test)
            self._append_turn(test, turn, part=3)
            return
        self._transition(test, TestEvent.COMPLETE_PART3)

    def _last_answer_for_part(self, test: TestSession, part: int) -> str | None:
        history = sorted(test.conversation_events, key=lambda item: (item.sequence_index, item.id))
        for event in reversed(history):
            if event.phase and f"PART{part}" in event.phase and event.transcript_text:
                return event.transcript_text
        return None

    async def _generate_part1_follow_up(self, test: TestSession, transcript: str) -> GeneratedTurn | None:
        from ielts_inference.examiner import FOLLOW_UP_INSTRUCTIONS, parse_follow_up

        prompt = json.dumps(
            {
                "part": 1,
                "question": test.session_questions[-1].prompt_text if test.session_questions else "",
                "transcript": transcript,
            }
        )
        payload = await self._chat_json(test, FOLLOW_UP_INSTRUCTIONS, prompt)
        follow_up = parse_follow_up(payload)
        if follow_up is None:
            return None
        return GeneratedTurn(prompt_text=follow_up, timing_seconds=35, asset_version="follow-up")

    async def _generate_part3_turn(self, test: TestSession) -> GeneratedTurn:
        asked = [item.prompt_text for item in test.session_questions if item.part == 3]
        history = await self._history(test.id)
        plan = self._topic_plan(test)
        part2_theme = ""
        is_nervous = self._detect_nervousness(test, history)
        if test.topic_plan and isinstance(test.topic_plan, dict) and "part2" in test.topic_plan:
            from ielts_inference.topics import part2_theme as get_part2_theme

            theme_info = get_part2_theme(test.topic_plan["part2"])
            part2_theme = theme_info["label"]
        part3_count = self._answered_count(test, 3)
        return await self._chat_turn(
            test,
            PART3_INSTRUCTIONS,
            part3_prompt_input(
                history,
                asked,
                theme=plan["part3_theme"],
                part2_theme=part2_theme,
                is_first_part3_question=part3_count == 0,
                is_nervous=is_nervous,
            ),
            timing_seconds=40,
        )

    def _detect_nervousness(self, test: TestSession, history: list[dict]) -> bool:
        part1_answers = [h for h in history if h.get("part") == 1]
        if len(part1_answers) < 3:
            return False
        short_count = sum(1 for h in part1_answers if len(h.get("transcript", "").split()) < 5)
        return short_count >= 2

    def _append_turn(
        self,
        test: TestSession,
        turn: GeneratedTurn,
        *,
        part: int,
        asset_version: str | None = None,
    ) -> SessionQuestion:
        sequence = len(test.session_questions) + 1
        question = SessionQuestion(
            test_session=test,
            question_id=None,
            prompt_text=turn.prompt_text,
            part=part,
            sort_order=sequence,
            timing_seconds=turn.timing_seconds,
            cue_card=turn.cue_card,
            follow_ups=None,
            examiner_asset_version=asset_version or turn.asset_version,
        )
        answer = Answer(
            id=str(uuid.uuid4()),
            test_session=test,
            session_question=question,
            status=AnswerState.PENDING.value,
        )
        self._session.add(question)
        self._session.add(answer)
        return question

    def _answered_count(self, test: TestSession, part: int) -> int:
        return sum(
            1
            for question in test.session_questions
            if question.part == part and question.answer and question.answer.status in VALID_ANSWER_STATES
        )

    def _part1_main_question_count(self, test: TestSession) -> int:
        return sum(
            1
            for question in test.session_questions
            if question.part == 1
            and question.examiner_asset_version not in {"intro", "follow-up"}
            and question.answer
            and question.answer.status in VALID_ANSWER_STATES
        )

    async def _history(self, test_id: str, part: int | None = None) -> list[dict]:
        stmt = (
            select(SessionQuestion.prompt_text, SessionQuestion.part, Transcript.text)
            .join(Answer, Answer.session_question_id == SessionQuestion.id)
            .join(Transcript, Transcript.answer_id == Answer.id)
            .where(SessionQuestion.test_session_id == test_id)
            .order_by(SessionQuestion.sort_order.asc(), SessionQuestion.id.asc())
        )
        if part is not None:
            stmt = stmt.where(SessionQuestion.part == part)
        result = await self._session.execute(stmt)
        return [
            {"part": row.part, "prompt": row.prompt_text, "transcript": row.text}
            for row in result.all()
            if row.text
        ]

    async def _assign_topic_plan(self, test: TestSession) -> SessionTopicPlan:
        stmt = (
            select(TestSession.topic_plan)
            .where(
                TestSession.user_id == test.user_id,
                TestSession.id != test.id,
                TestSession.topic_plan.is_not(None),
            )
            .order_by(TestSession.created_at.desc())
            .limit(16)
        )
        rows = await self._session.execute(stmt)
        recent = [plan for plan in rows.scalars().all() if isinstance(plan, dict) and plan.get("part1") and plan.get("part2")]
        return choose_session_topics(recent)

    def _topic_plan(self, test: TestSession) -> SessionTopicPlan:
        plan = test.topic_plan
        if isinstance(plan, dict) and plan.get("part1") and plan.get("part2"):
            return plan  # type: ignore[return-value]
        return choose_session_topics([])

    async def _generate_part1_turn(self, test: TestSession) -> GeneratedTurn:
        asked = [
            item.prompt_text
            for item in test.session_questions
            if item.part == 1 and item.examiner_asset_version not in {"intro", "follow-up"}
        ]
        history = await self._history(test.id, 1)
        plan = self._topic_plan(test)
        main_index = self._part1_main_question_count(test)
        topic = part1_topic_for_index(plan, main_index)
        on_topic = part1_questions_on_topic(plan, main_index)
        return await self._chat_turn(
            test,
            PART1_INSTRUCTIONS,
            part1_prompt_input(
                history,
                asked,
                topic_label=topic["label"],
                topic_guidance=topic["guidance"],
                question_angle=part1_question_angle(topic["id"], on_topic),
                is_first_topic_question=main_index == 0,
            ),
            timing_seconds=45,
        )

    async def _generate_part2_prompt(self, test: TestSession) -> GeneratedTurn:
        history = await self._history(test.id)
        theme = part2_theme(self._topic_plan(test)["part2"])
        payload = await self._chat_json(
            test,
            PART2_INSTRUCTIONS,
            part2_prompt_input(
                history,
                theme_label=theme["label"],
                task=theme["task"],
                part3_theme=theme["part3"],
            ),
        )
        parsed = parse_cue_card(payload)
        if parsed is None:
            raise InferenceError("Part 2 prompt generation returned invalid JSON", retryable=True)
        return parsed

    async def _generate_part2_follow_up(self, test: TestSession, question: SessionQuestion) -> GeneratedTurn | None:
        history = await self._history(test.id, 2)
        transcript = history[-1]["transcript"] if history else ""
        if not transcript.strip():
            return None
        payload = await self._chat_json(
            test,
            FOLLOW_UP_INSTRUCTIONS,
            json.dumps(
                {
                    "part": 2,
                    "question": question.prompt_text,
                    "transcript": transcript,
                }
            ),
        )
        follow_up = parse_follow_up(payload)
        if follow_up is None:
            return None
        return GeneratedTurn(prompt_text=follow_up, timing_seconds=35, asset_version="follow-up")

    async def _chat_turn(self, test: TestSession, system: str, prompt: str, *, timing_seconds: int) -> GeneratedTurn:
        retry_prompt = (
            f"{prompt}\n\n"
            'Your previous reply was unusable. Return JSON only: {"question": "one spoken examiner question"}'
        )
        for attempt, user_prompt in enumerate((prompt, retry_prompt)):
            payload = await self._chat_json(test, system, user_prompt)
            parsed = parse_spoken_question(payload, timing_seconds=timing_seconds)
            if parsed is not None:
                return parsed
            if attempt == 0:
                continue
        raise InferenceError("Examiner prompt generation returned invalid JSON", retryable=True)

    async def _chat_json(self, test: TestSession, system: str, prompt: str) -> dict:
        await reserve_model_call(self._session, test.user_id, test.id, "examiner", self._config)
        client = OpenRouterClient(self._config)
        return client.chat_json(
            system,
            prompt,
            models=[
                self._config.realtime_llm_model,
                self._config.openrouter_scoring_fallback_model,
                self._config.openrouter_scoring_model,
            ],
        )
