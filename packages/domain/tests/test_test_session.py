"""Tests for the test session state machine."""

from datetime import UTC, datetime, timedelta

import pytest
from ielts_domain.test_session import (
    StateConflictError,
    TestEvent,
    TestPolicy,
    TestState,
    apply_transition,
)


@pytest.fixture
def now() -> datetime:
    return datetime(2026, 8, 18, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def created_at() -> datetime:
    return datetime(2026, 8, 18, 11, 0, 0, tzinfo=UTC)


@pytest.fixture
def policy() -> TestPolicy:
    return TestPolicy(resume_window_minutes=1440)


class TestSessionStateMachine:
    def test_all_allowed_transitions(self, now, created_at, policy):
        transitions = [
            (TestState.CREATED, TestEvent.START_DEVICE_CHECK, TestState.DEVICE_CHECK),
            (TestState.DEVICE_CHECK, TestEvent.COMPLETE_DEVICE_CHECK, TestState.READY),
            (TestState.READY, TestEvent.READY_TO_START, TestState.PART1),
            (TestState.PART1, TestEvent.COMPLETE_PART1, TestState.PART2_PREP),
            (TestState.PART2_PREP, TestEvent.COMPLETE_PART2_PREP, TestState.PART2_SPEAK),
            (TestState.PART2_SPEAK, TestEvent.COMPLETE_PART2_SPEAK, TestState.PART3),
            (TestState.PART3, TestEvent.COMPLETE_PART3, TestState.UPLOADING),
            (TestState.UPLOADING, TestEvent.COMPLETE_UPLOAD, TestState.SUBMITTED),
            (TestState.SUBMITTED, TestEvent.MARK_PROCESSING, TestState.PROCESSING),
            (TestState.PROCESSING, TestEvent.MARK_COMPLETED, TestState.COMPLETED),
            (TestState.PROCESSING, TestEvent.MARK_FAILED, TestState.FAILED),
            (TestState.FAILED, TestEvent.RETRY_PROCESSING, TestState.PROCESSING),
            (TestState.COMPLETED, TestEvent.DELETE, TestState.DELETING),
            (TestState.FAILED, TestEvent.DELETE, TestState.DELETING),
            (TestState.DELETING, TestEvent.DELETE, TestState.DELETED),
        ]
        for from_state, event, expected_state in transitions:
            result = apply_transition(
                from_state, event, expected_revision=1, current_revision=1,
                now=now, policy=policy, created_at=created_at
            )
            assert result.new_state == expected_state

    def test_forbidden_transitions(self, now, created_at, policy):
        forbidden = [
            (TestState.CREATED, TestEvent.COMPLETE_PART1),
            (TestState.CREATED, TestEvent.MARK_COMPLETED),
            (TestState.COMPLETED, TestEvent.START_DEVICE_CHECK),
            (TestState.EXPIRED, TestEvent.START_PART1),
            (TestState.DELETED, TestEvent.DELETE),
            (TestState.PART1, TestEvent.COMPLETE_PART3),
            (TestState.PROCESSING, TestEvent.START_DEVICE_CHECK),
        ]
        for from_state, event in forbidden:
            with pytest.raises(StateConflictError):
                apply_transition(
                    from_state, event, expected_revision=1, current_revision=1,
                    now=now, policy=policy, created_at=created_at
                )

    def test_expiry_transition(self, now, created_at, policy):
        result = apply_transition(
            TestState.READY, TestEvent.EXPIRE, expected_revision=1, current_revision=1,
            now=now + timedelta(days=7), policy=policy, created_at=created_at
        )
        assert result.new_state == TestState.EXPIRED

    def test_abandon_and_resume(self, now, created_at, policy):
        result = apply_transition(
            TestState.PART1, TestEvent.ABANDON, expected_revision=1, current_revision=1,
            now=now, policy=policy, created_at=created_at
        )
        assert result.new_state == TestState.ABANDONED

        result = apply_transition(
            TestState.ABANDONED, TestEvent.RESUME, expected_revision=2, current_revision=2,
            now=now, policy=policy, created_at=created_at
        )
        assert result.new_state == TestState.DEVICE_CHECK

    def test_stale_revision_raises(self, now, created_at, policy):
        with pytest.raises(StateConflictError, match="Expected revision"):
            apply_transition(
                TestState.CREATED, TestEvent.START_DEVICE_CHECK,
                expected_revision=1, current_revision=2,
                now=now, policy=policy, created_at=created_at
            )

    def test_resume_window_expiration(self, now, created_at, policy):
        expired_time = now + timedelta(hours=policy.resume_window_minutes)
        with pytest.raises(StateConflictError, match="Resume window"):
            apply_transition(
                TestState.ABANDONED, TestEvent.RESUME,
                expected_revision=1, current_revision=1,
                now=expired_time, policy=policy, created_at=created_at
            )

    def test_duplicate_event_raises(self, now, created_at, policy):
        result = apply_transition(
            TestState.CREATED, TestEvent.START_DEVICE_CHECK,
            expected_revision=1, current_revision=1,
            now=now, policy=policy, created_at=created_at
        )
        assert result.new_state == TestState.DEVICE_CHECK

    def test_deletion_from_any_state(self, now, created_at, policy):
        states_to_delete = [
            TestState.CREATED, TestState.DEVICE_CHECK, TestState.READY,
            TestState.PART1, TestState.PART2_PREP, TestState.PART2_SPEAK,
            TestState.PART3, TestState.UPLOADING, TestState.SUBMITTED,
            TestState.PROCESSING, TestState.COMPLETED, TestState.FAILED,
            TestState.ABANDONED, TestState.EXPIRED,
        ]
        for state in states_to_delete:
            result = apply_transition(
                state, TestEvent.DELETE, expected_revision=1, current_revision=1,
                now=now, policy=policy, created_at=created_at
            )
            assert result.new_state == TestState.DELETING

    @pytest.mark.parametrize("state", [
        TestState.CREATED, TestState.DEVICE_CHECK, TestState.READY,
        TestState.PART1, TestState.PART2_PREP, TestState.PART2_SPEAK,
        TestState.PART3, TestState.UPLOADING, TestState.SUBMITTED,
        TestState.PROCESSING, TestState.COMPLETED, TestState.FAILED,
        TestState.ABANDONED, TestState.EXPIRED, TestState.DELETING,
        TestState.DELETED,
    ])
    def test_terminal_states_never_return_to_active(self, state, now, created_at, policy):
        terminal_active_events = [
            TestEvent.START_DEVICE_CHECK, TestEvent.COMPLETE_PART1,
            TestEvent.START_PART3, TestEvent.SUBMIT, TestEvent.MARK_COMPLETED,
        ]
        for event in terminal_active_events:
            if (state, event) in _get_transitions():
                continue
            with pytest.raises(StateConflictError):
                apply_transition(
                    state, event, expected_revision=1, current_revision=1,
                    now=now, policy=policy, created_at=created_at
                )


def _get_transitions():
    from ielts_domain.test_session import _TRANSITION_TABLE
    return _TRANSITION_TABLE.keys()
