"""IELTS domain model - pure typed Python with no infrastructure dependencies.

Package boundary rules:
- domain imports no FastAPI, SQLAlchemy, Celery, HTTP client, queue, or provider code.
- domain is pure typed Python with explicit types and value objects.
"""

from ielts_domain.answer import (
    AnswerEvent,
    AnswerState,
    AnswerStateConflictError,
    AnswerTransition,
    apply_answer_transition,
)
from ielts_domain.test_session import (
    StateConflictError,
    StateTransition,
    TestEvent,
    TestPolicy,
    TestState,
    apply_transition,
)
from ielts_domain.types import (
    UUID,
    BandScore,
    Duration,
    MediaObjectRef,
    Microdollars,
    Timestamp,
)

__all__ = [
    "UUID",
    "AnswerEvent",
    "AnswerState",
    "AnswerStateConflictError",
    "AnswerTransition",
    "BandScore",
    "Duration",
    "MediaObjectRef",
    "Microdollars",
    "StateConflictError",
    "StateTransition",
    "TestEvent",
    "TestPolicy",
    "TestState",
    "Timestamp",
    "apply_answer_transition",
    "apply_transition",
]
