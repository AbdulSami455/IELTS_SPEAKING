"""Tests for the answer state machine."""

import pytest

from ielts_domain.answer import (
    AnswerEvent,
    AnswerState,
    AnswerStateConflictError,
    apply_answer_transition,
)


class TestAnswerStateMachine:
    def test_full_lifecycle(self):
        state = AnswerState.PENDING
        for expected_state, event in [
            (AnswerState.RECORDING, AnswerEvent.START_RECORDING),
            (AnswerState.RECORDED, AnswerEvent.STOP_RECORDING),
            (AnswerState.UPLOAD_AUTHORIZED, AnswerEvent.UPLOAD_START),
            (AnswerState.UPLOADED, AnswerEvent.UPLOAD_COMPLETE),
            (AnswerState.VALIDATING, AnswerEvent.VALIDATE),
            (AnswerState.VALID, AnswerEvent.MARK_VALID),
            (AnswerState.PROCESSING, AnswerEvent.MARK_PROCESSING),
            (AnswerState.READY, AnswerEvent.MARK_READY),
        ]:
            result = apply_answer_transition(state, event)
            assert result.new_state == expected_state
            state = result.new_state

    def test_upload_failure_returns_to_recorded(self):
        result = apply_answer_transition(
            AnswerState.UPLOAD_AUTHORIZED, AnswerEvent.UPLOAD_FAILED
        )
        assert result.new_state == AnswerState.RECORDED

    def test_invalid_media_allows_re_record(self):
        result = apply_answer_transition(
            AnswerState.INVALID_MEDIA, AnswerEvent.MARK_VALID
        )
        assert result.new_state == AnswerState.VALID

    def test_failed_retryable_can_retry(self):
        result = apply_answer_transition(
            AnswerState.FAILED_RETRYABLE, AnswerEvent.MARK_PROCESSING
        )
        assert result.new_state == AnswerState.PROCESSING

    def test_forbidden_transitions(self):
        forbidden = [
            (AnswerState.VALID, AnswerEvent.UPLOAD_FAILED),
            (AnswerState.READY, AnswerEvent.DELETE) if False else (AnswerState.VALID, AnswerEvent.STOP_RECORDING),
            (AnswerState.PENDING, AnswerEvent.MARK_VALID),
            (AnswerState.PROCESSING, AnswerEvent.UPLOAD_COMPLETE),
            (AnswerState.VALID, AnswerEvent.STOP_RECORDING),
            (AnswerState.READY, AnswerEvent.MARK_PROCESSING),
        ]
        for state, event in forbidden:
            with pytest.raises(AnswerStateConflictError):
                apply_answer_transition(state, event)

    def test_deletion_from_any_state(self):
        states = [
            AnswerState.PENDING, AnswerState.RECORDING, AnswerState.RECORDED,
            AnswerState.UPLOAD_AUTHORIZED, AnswerState.UPLOADED,
            AnswerState.VALIDATING, AnswerState.VALID, AnswerState.PROCESSING,
            AnswerState.READY, AnswerState.INVALID_MEDIA,
            AnswerState.FAILED_RETRYABLE, AnswerState.FAILED_TERMINAL,
        ]
        for state in states:
            result = apply_answer_transition(state, AnswerEvent.DELETE)
            assert result.new_state == AnswerState.DELETED

    def test_recording_can_restart(self):
        result = apply_answer_transition(
            AnswerState.RECORDING, AnswerEvent.START_RECORDING
        )
        assert result.new_state == AnswerState.RECORDING
