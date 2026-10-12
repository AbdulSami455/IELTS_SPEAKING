"""Pure domain state machine for test session lifecycle.

Implements Section 6.3 of the product plan.
All transitions are pure functions taking explicit state, event, policy, and time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum


class TestState(str, Enum):
    CREATED = "CREATED"
    DEVICE_CHECK = "DEVICE_CHECK"
    READY = "READY"
    PART1 = "PART1"
    PART2_PREP = "PART2_PREP"
    PART2_SPEAK = "PART2_SPEAK"
    PART3 = "PART3"
    UPLOADING = "UPLOADING"
    SUBMITTED = "SUBMITTED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    ABANDONED = "ABANDONED"
    DELETING = "DELETING"
    DELETED = "DELETED"


class TestEvent(str, Enum):
    START_DEVICE_CHECK = "START_DEVICE_CHECK"
    COMPLETE_DEVICE_CHECK = "COMPLETE_DEVICE_CHECK"
    READY_TO_START = "READY_TO_START"
    START_PART1 = "START_PART1"
    COMPLETE_PART1 = "COMPLETE_PART1"
    START_PART2_PREP = "START_PART2_PREP"
    COMPLETE_PART2_PREP = "COMPLETE_PART2_PREP"
    START_PART2_SPEAK = "START_PART2_SPEAK"
    COMPLETE_PART2_SPEAK = "COMPLETE_PART2_SPEAK"
    START_PART3 = "START_PART3"
    COMPLETE_PART3 = "COMPLETE_PART3"
    START_UPLOADING = "START_UPLOADING"
    COMPLETE_UPLOAD = "COMPLETE_UPLOAD"
    SUBMIT = "SUBMIT"
    MARK_PROCESSING = "MARK_PROCESSING"
    MARK_COMPLETED = "MARK_COMPLETED"
    MARK_FAILED = "MARK_FAILED"
    RETRY_PROCESSING = "RETRY_PROCESSING"
    EXPIRE = "EXPIRE"
    ABANDON = "ABANDON"
    RESUME = "RESUME"
    DELETE = "DELETE"


class StateConflictError(Exception):
    pass


@dataclass(frozen=True)
class TestPolicy:
    resume_window_minutes: int = 1440
    part2_prep_seconds: int = 60
    part2_speak_seconds: int = 120
    test_ttl_days: int = 2


@dataclass(frozen=True)
class StateTransition:
    old_state: TestState
    new_state: TestState
    event: TestEvent
    expected_revision: int
    new_revision: int
    audit_message: str


_TRANSITION_TABLE: dict[tuple[TestState, TestEvent], TestState] = {
    (TestState.CREATED, TestEvent.START_DEVICE_CHECK): TestState.DEVICE_CHECK,
    (TestState.DEVICE_CHECK, TestEvent.COMPLETE_DEVICE_CHECK): TestState.READY,
    (TestState.DEVICE_CHECK, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.READY, TestEvent.READY_TO_START): TestState.PART1,
    (TestState.READY, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.PART1, TestEvent.COMPLETE_PART1): TestState.PART2_PREP,
    (TestState.PART1, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.PART1, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.PART2_PREP, TestEvent.COMPLETE_PART2_PREP): TestState.PART2_SPEAK,
    (TestState.PART2_PREP, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.PART2_PREP, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.PART2_SPEAK, TestEvent.COMPLETE_PART2_SPEAK): TestState.PART3,
    (TestState.PART2_SPEAK, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.PART2_SPEAK, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.PART3, TestEvent.COMPLETE_PART3): TestState.UPLOADING,
    (TestState.PART3, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.PART3, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.UPLOADING, TestEvent.COMPLETE_UPLOAD): TestState.SUBMITTED,
    (TestState.UPLOADING, TestEvent.SUBMIT): TestState.SUBMITTED,
    (TestState.UPLOADING, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.UPLOADING, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.SUBMITTED, TestEvent.MARK_PROCESSING): TestState.PROCESSING,
    (TestState.SUBMITTED, TestEvent.SUBMIT): TestState.SUBMITTED,
    (TestState.SUBMITTED, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.CREATED, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.PROCESSING, TestEvent.MARK_COMPLETED): TestState.COMPLETED,
    (TestState.PROCESSING, TestEvent.MARK_FAILED): TestState.FAILED,
    (TestState.FAILED, TestEvent.RETRY_PROCESSING): TestState.PROCESSING,
    (TestState.FAILED, TestEvent.DELETE): TestState.DELETING,
    (TestState.COMPLETED, TestEvent.DELETE): TestState.DELETING,
    (TestState.ABANDONED, TestEvent.DELETE): TestState.DELETING,
    (TestState.ABANDONED, TestEvent.RESUME): TestState.DEVICE_CHECK,
    (TestState.ABANDONED, TestEvent.EXPIRE): TestState.EXPIRED,
    (TestState.EXPIRED, TestEvent.DELETE): TestState.DELETING,
    (TestState.DELETING, TestEvent.DELETE): TestState.DELETED,
    (TestState.DEVICE_CHECK, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.CREATED, TestEvent.ABANDON): TestState.ABANDONED,
    (TestState.CREATED, TestEvent.DELETE): TestState.DELETING,
    (TestState.DEVICE_CHECK, TestEvent.DELETE): TestState.DELETING,
    (TestState.READY, TestEvent.DELETE): TestState.DELETING,
    (TestState.PART1, TestEvent.DELETE): TestState.DELETING,
    (TestState.PART2_PREP, TestEvent.DELETE): TestState.DELETING,
    (TestState.PART2_SPEAK, TestEvent.DELETE): TestState.DELETING,
    (TestState.PART3, TestEvent.DELETE): TestState.DELETING,
    (TestState.UPLOADING, TestEvent.DELETE): TestState.DELETING,
    (TestState.SUBMITTED, TestEvent.DELETE): TestState.DELETING,
    (TestState.PROCESSING, TestEvent.DELETE): TestState.DELETING,
}

_TERMINAL_STATES = frozenset({
    TestState.COMPLETED,
    TestState.FAILED,
    TestState.EXPIRED,
    TestState.DELETED,
})


def apply_transition(
    current_state: TestState,
    event: TestEvent,
    expected_revision: int,
    current_revision: int,
    now: datetime | None = None,
    policy: TestPolicy | None = None,
    created_at: datetime | None = None,
) -> StateTransition:
    now = now or datetime.now(UTC)
    policy = policy or TestPolicy()
    if expected_revision != current_revision:
        raise StateConflictError(
            f"Expected revision {expected_revision}, got {current_revision}"
        )

    if current_state in _TERMINAL_STATES and event != TestEvent.DELETE and not (
        current_state == TestState.FAILED and event == TestEvent.RETRY_PROCESSING
    ) and not (current_state == TestState.COMPLETED):
        raise StateConflictError(
            f"Cannot apply {event} to terminal state {current_state}"
        )

    key = (current_state, event)
    if key not in _TRANSITION_TABLE:
        raise StateConflictError(
            f"No transition from {current_state} on {event}"
        )

    new_state = _TRANSITION_TABLE[key]

    if created_at and now - created_at > timedelta(hours=policy.resume_window_minutes / 60):
        if event == TestEvent.RESUME:
            raise StateConflictError(
                f"Resume window of {policy.resume_window_minutes} minutes expired"
            )
        if new_state == TestState.ABANDONED and event in {
            TestEvent.RESUME
        }:
            raise StateConflictError("Cannot resume after resume window expiration")

    audit_msg = f"Transition {current_state} -> {new_state} via {event}"

    return StateTransition(
        old_state=current_state,
        new_state=new_state,
        event=event,
        expected_revision=expected_revision,
        new_revision=current_revision + 1,
        audit_message=audit_msg,
    )
