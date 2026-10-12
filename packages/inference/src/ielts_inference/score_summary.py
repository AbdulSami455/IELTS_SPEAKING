"""Descriptive progress summary; never an official score or confidence interval."""
from collections.abc import Sequence
from dataclasses import dataclass

from ielts_db.models import Report
from ielts_domain.types import BandScore

from ielts_inference.assembler import EVALUATOR_VERSION


@dataclass(frozen=True)
class ScoreSummary:
    overall_estimate: float | None
    scored_tests: int
    estimate_sample_size: int
    observed_low: float | None
    observed_high: float | None


def summarize_scores(reports: Sequence[Report]) -> ScoreSummary:
    eligible = sorted(
        (report for report in reports if not report.is_inconclusive
         and report.overall_band is not None and report.evaluator_version == EVALUATOR_VERSION),
        key=lambda report: report.created_at,
    )
    bands = [float(report.overall_band) for report in eligible[-5:] if report.overall_band is not None]
    return ScoreSummary(
        overall_estimate=BandScore.round_to_nearest_half(sum(bands) / len(bands)).value if bands else None,
        scored_tests=len(eligible), estimate_sample_size=len(bands),
        observed_low=min(bands) if bands else None, observed_high=max(bands) if bands else None,
    )
