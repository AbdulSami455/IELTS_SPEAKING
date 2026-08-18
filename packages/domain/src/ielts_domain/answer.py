"""Pure domain state machine for answer lifecycle.

Implements Section 6.4 of the product plan.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class AnswerState(str, Enum):
    PENDING = "PENDING"
    RECORDING = "RECORDING"
    RECORDED = "RECORDED"
    UPLOAD_AUTHORIZED = "UPLOAD_AUTHORIZED"
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    VALID = "VALID"
    PROCESSING = "PROCESSING"
    READY = "READY"
    INVALID_MEDIA = "INVALID_MEDIA"
    FAILED_RETRYABLE = "FAILED_RETRYABLE"
    FAILED_TERMINAL = "FAILED_TERMINAL"
    DELETED = "DELETED"


class AnswerEvent(str, Enum):
    START_RECORDING = "START_RECORDING"
    STOP_RECORDING = "STOP_RECORDING"
    UPLOAD_START = "UPLOAD_START"
    UPLOAD_COMPLETE = "UPLOAD_COMPLETE"
    UPLOAD_FAILED = "UPLOAD_FAILED"
    VALIDATE = "VALIDATE"
    MARK_VALID = "MARK_VALID"
    MARK_INVALID = "MARK_INVALID"
    MARK_PROCESSING = "MARK_PROCESSING"
    MARK_READY = "MARK_READY"
    MARK_FAILED_RETRYABLE = "MARK_FAILED_RETRYABLE"
    MARK_FAILED_TERMINAL = "MARK_FAILED_TERMINAL"
    DELETE = "DELETE"


class AnswerStateConflictError(Exception):
    pass


@dataclass(frozen=True)
class AnswerTransition:
    old_state: AnswerState
    new_state: AnswerState
    event: AnswerEvent
    reason: str


_ANSWER_TRANSITIONS: dict[tuple[AnswerState, AnswerEvent], tuple[AnswerState, str]] = {
    (AnswerState.PENDING, AnswerEvent.START_RECORDING): (AnswerState.RECORDING, "recording started"),
    (AnswerState.RECORDING, AnswerEvent.STOP_RECORDING): (AnswerState.RECORDED, "recording stopped"),
    (AnswerState.RECORDING, AnswerEvent.START_RECORDING): (AnswerState.RECORDING, "recording restarted"),
    (AnswerState.RECORDED, AnswerEvent.UPLOAD_START): (AnswerState.UPLOAD_AUTHORIZED, "upload authorized"),
    (AnswerState.RECORDED, AnswerEvent.START_RECORDING): (AnswerState.RECORDING, "re-record"),
    (AnswerState.INVALID_MEDIA, AnswerEvent.START_RECORDING): (AnswerState.RECORDING, "re-record after invalid media"),
    (AnswerState.UPLOAD_AUTHORIZED, AnswerEvent.UPLOAD_COMPLETE): (AnswerState.UPLOADED, "upload completed"),
    (AnswerState.UPLOAD_AUTHORIZED, AnswerEvent.UPLOAD_FAILED): (AnswerState.RECORDED, "upload failed, retry from local"),
    (AnswerState.UPLOADED, AnswerEvent.VALIDATE): (AnswerState.VALIDATING, "validation started"),
    (AnswerState.VALIDATING, AnswerEvent.MARK_VALID): (AnswerState.VALID, "media validated"),
    (AnswerState.VALIDATING, AnswerEvent.MARK_INVALID): (AnswerState.INVALID_MEDIA, "media invalid"),
    (AnswerState.VALID, AnswerEvent.MARK_PROCESSING): (AnswerState.PROCESSING, "processing started"),
    (AnswerState.PROCESSING, AnswerEvent.MARK_READY): (AnswerState.READY, "processing complete"),
    (AnswerState.PROCESSING, AnswerEvent.MARK_FAILED_RETRYABLE): (AnswerState.FAILED_RETRYABLE, "failed retryable"),
    (AnswerState.PROCESSING, AnswerEvent.MARK_FAILED_TERMINAL): (AnswerState.FAILED_TERMINAL, "failed terminal"),
    (AnswerState.PROCESSING, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.FAILED_RETRYABLE, AnswerEvent.MARK_PROCESSING): (AnswerState.PROCESSING, "retry processing"),
    (AnswerState.FAILED_RETRYABLE, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.FAILED_TERMINAL, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.VALID, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.READY, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.RECORDED, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.UPLOAD_AUTHORIZED, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.UPLOADED, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.VALIDATING, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.INVALID_MEDIA, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.INVALID_MEDIA, AnswerEvent.MARK_VALID): (AnswerState.VALID, "re-validated after re-record"),
    (AnswerState.PENDING, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
    (AnswerState.RECORDING, AnswerEvent.DELETE): (AnswerState.DELETED, "deleted"),
}

_TERMINAL_ANSWER_STATES = frozenset({
    AnswerState.READY,
    AnswerState.FAILED_TERMINAL,
    AnswerState.DELETED,
})


def apply_answer_transition(
    current_state: AnswerState,
    event: AnswerEvent,
    re_record_allowed: bool = False,
) -> AnswerTransition:
    key = (current_state, event)
    if key in _ANSWER_TRANSITIONS:
        new_state, reason = _ANSWER_TRANSITIONS[key]
        return AnswerTransition(
            old_state=current_state,
            new_state=new_state,
            event=event,
            reason=reason,
        )

    if isinstance(event, AnswerEvent) and current_state == AnswerState.RECORDED:
        if event == AnswerEvent.UPLOAD_START:
            return AnswerTransition(
                old_state=current_state,
                new_state=AnswerState.UPLOAD_AUTHORIZED,
                event=event,
                reason="upload started from local recovery",
            )

    raise AnswerStateConflictError(
        f"No transition from {current_state} on {event.value}"
    )
