"""Core domain types and value objects."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class UUID:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> UUID:
        return cls(uuid.uuid7())

    @classmethod
    def from_string(cls, s: str) -> UUID:
        return cls(uuid.UUID(s))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class BandScore:
    value: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.value <= 9.0):
            raise ValueError(f"Band score must be between 0 and 9, got {self.value}")
        if self.value * 2 != int(self.value * 2):
            raise ValueError(f"Band score must be in 0.5 increments, got {self.value}")

    @staticmethod
    def round_to_nearest_half(value: float) -> BandScore:
        d = Decimal(str(value))
        rounded = (d * Decimal(2)).quantize(Decimal(1), rounding=ROUND_HALF_UP) * Decimal("0.5")
        return BandScore(float(rounded))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class Timestamp:
    value: datetime

    @classmethod
    def now(cls) -> Timestamp:
        return cls(datetime.now(UTC))

    @classmethod
    def from_string(cls, s: str) -> Timestamp:
        return cls(datetime.fromisoformat(s))

    def isoformat(self) -> str:
        return self.value.isoformat()

    def __ge__(self, other: Timestamp) -> bool:
        return self.value >= other.value

    def __le__(self, other: Timestamp) -> bool:
        return self.value <= other.value

    def __lt__(self, other: Timestamp) -> bool:
        return self.value < other.value


@dataclass(frozen=True)
class Duration:
    milliseconds: int

    @classmethod
    def from_seconds(cls, seconds: float) -> Duration:
        return cls(int(seconds * 1000))

    @property
    def seconds(self) -> float:
        return self.milliseconds / 1000.0


@dataclass(frozen=True)
class Microdollars:
    value: int

    @classmethod
    def from_dollars(cls, dollars: float) -> Microdollars:
        return cls(int(dollars * 1_000_000))

    def as_dollars(self) -> float:
        return self.value / 1_000_000.0


@dataclass(frozen=True)
class MediaObjectRef:
    bucket: str
    object_key: str
    version: str | None = None
    sha256: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
