"""IELTS domain model - pure typed Python with no infrastructure dependencies.

Package boundary rules:
- domain imports no FastAPI, SQLAlchemy, Celery, HTTP client, queue, or provider code.
- domain is pure typed Python with explicit types and value objects.
"""

from ielts_domain.types import (
    UUID,
    BandScore,
    Duration,
    MediaObjectRef,
    Microdollars,
    Timestamp,
)
from ielts_domain.test_session import (
    TestState,
    TestEvent,
    TestPolicy,
    StateTransition,
    StateConflictError,
    apply_transition,
)
from ielts_domain.answer import (
    AnswerState,
    AnswerEvent,
    AnswerTransition,
    AnswerStateConflictError,
    apply_answer_transition,
)

__all__ = [
    "UUID",
    "BandScore",
    "Duration",
    "MediaObjectRef",
    "Microdollars",
    "Timestamp",
    "TestState",
    "TestEvent",
    "TestPolicy",
    "StateTransition",
    "StateConflictError",
    "apply_transition",
    "AnswerState",
    "AnswerEvent",
    "AnswerTransition",
    "AnswerStateConflictError",
    "apply_answer_transition",
]
