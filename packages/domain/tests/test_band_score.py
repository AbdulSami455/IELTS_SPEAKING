"""Tests for the BandScore rounding logic."""

import pytest

from ielts_domain.types import BandScore


class TestBandScore:
    def test_valid_band_scores(self):
        for val in [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5,
                     5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]:
            score = BandScore(val)
            assert score.value == val

    def test_invalid_band_score_below_zero(self):
        with pytest.raises(ValueError, match="between 0 and 9"):
            BandScore(-0.5)

    def test_invalid_band_score_above_nine(self):
        with pytest.raises(ValueError, match="between 0 and 9"):
            BandScore(9.5)

    def test_non_half_increment_rejected(self):
        with pytest.raises(ValueError, match="0\\.5 increments"):
            BandScore(6.3)


class TestBandScoreRounding:
    @pytest.mark.parametrize("value,expected", [
        (5.0, 5.0),
        (5.1, 5.0),
        (5.2, 5.0),
        (5.24, 5.0),
        (5.25, 5.5),
        (5.3, 5.5),
        (5.4, 5.5),
        (5.5, 5.5),
        (5.6, 5.5),
        (5.7, 5.5),
        (5.74, 5.5),
        (5.75, 6.0),
        (5.8, 6.0),
        (6.0, 6.0),
        (6.2, 6.0),
        (6.24, 6.0),
        (6.25, 6.5),
        (6.26, 6.5),
        (6.5, 6.5),
        (6.7, 6.5),
        (6.74, 6.5),
        (6.75, 7.0),
        (6.76, 7.0),
        (7.0, 7.0),
        (7.2, 7.0),
        (7.25, 7.5),
        (7.7, 7.5),
        (7.75, 8.0),
        (8.0, 8.0),
        (8.2, 8.0),
        (8.25, 8.5),
        (8.7, 8.5),
        (8.75, 9.0),
        (0.0, 0.0),
        (0.1, 0.0),
        (0.2, 0.0),
        (0.24, 0.0),
        (0.25, 0.5),
        (0.3, 0.5),
        (0.7, 0.5),
        (0.75, 1.0),
        (8.3, 8.5),
        (8.2, 8.0),
    ])
    def test_round_to_nearest_half(self, value, expected):
        result = BandScore.round_to_nearest_half(value)
        assert result.value == expected

    def test_round_boundary(self):
        assert BandScore.round_to_nearest_half(5.25).value == 5.5
        assert BandScore.round_to_nearest_half(5.75).value == 6.0
