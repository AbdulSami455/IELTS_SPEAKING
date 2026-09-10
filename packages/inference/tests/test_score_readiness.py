import io
import math
import struct
import wave
from datetime import datetime, timedelta, timezone

from ielts_audio.media import measure_wav, pause_features
from ielts_db.models import Report
from ielts_inference.assembler import CRITERIA, EVALUATOR_VERSION, assemble
from ielts_inference.evaluation import _merge_features
from ielts_inference.score_summary import summarize_scores


def audio(seconds=1, silent_half=False):
    samples = [int(5000 * math.sin(2 * math.pi * 200 * i / 16000)) if not silent_half or i < 8000 else 0 for i in range(16000 * seconds)]
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return output.getvalue()


def test_waveform_zero_crossings_are_not_silence():
    quality = measure_wav(audio())
    assert quality.duration_ms == 1000
    assert quality.silence_ratio == 0
    assert quality.speech_ratio == 1


def test_frame_measurement_detects_real_silence():
    assert measure_wav(audio(silent_half=True)).silence_ratio == 0.5


def test_saved_transcript_is_used_for_evidence_not_model_echo():
    scored = {"criteria": [{"criterion": key, "band": 7, "confidence": "medium", "evidence": [{"quote": "I enjoy cooking"}]} for key in CRITERIA]}
    result = assemble(scored, {"transcripts": ["I enjoy cooking for my family."], "speaking_duration_ms": 120000, "silence_ratio": 0.1}, 0.8)
    assert result["overall_band"] == 7
    assert result["score_readiness"]["reasons"] == []


def test_missing_evidence_has_actionable_reasons():
    result = assemble({}, {"speaking_duration_ms": 1000, "silence_ratio": 0.9}, 0.1)
    assert result["overall_band"] is None
    assert result["score_readiness"]["minimum_tests"] == 1
    assert any("microphone" in reason for reason in result["score_readiness"]["reasons"])


def test_combined_rates_are_not_summed():
    combined = _merge_features({"speaking_duration_ms": 60000, "word_count": 120, "words_per_minute": 120, "silence_ratio": 0.1}, {"speaking_duration_ms": 30000, "word_count": 60, "words_per_minute": 120, "silence_ratio": 0.4})
    assert combined["words_per_minute"] == 120
    assert combined["silence_ratio"] == 0.2


def test_segment_text_counts_words_not_segments():
    assert pause_features([{"w": "I like to cook", "startMs": 0, "endMs": 2000}], 2000)["words_per_minute"] == 120


def report(band, index=0, version=EVALUATOR_VERSION, inconclusive=False):
    return Report(overall_band=band, is_inconclusive=inconclusive, evaluator_version=version, created_at=datetime(2026, 9, 10, tzinfo=timezone.utc) + timedelta(minutes=index))


def test_one_test_provides_first_estimate():
    summary = summarize_scores([report(6.5)])
    assert summary.overall_estimate == 6.5
    assert summary.estimate_sample_size == 1


def test_summary_excludes_inconclusive_and_old_versions():
    summary = summarize_scores([report(9, version="old"), report(None, inconclusive=True), report(6.5), report(7.5)])
    assert summary.overall_estimate == 7
    assert summary.scored_tests == 2
    assert summary.observed_low == 6.5
    assert summary.observed_high == 7.5


def test_summary_uses_recent_five_and_keeps_individual_scores():
    reports = [report(3)] + [report(7, index) for index in range(1, 6)]
    summary = summarize_scores(reports)
    assert summary.overall_estimate == 7
    assert summary.estimate_sample_size == 5
    assert summary.scored_tests == 6
    assert reports[0].overall_band == 3


def test_pauses_do_not_hide_a_band_when_usable_speech_is_sufficient():
    scored = {"criteria": [{"criterion": key, "band": 6, "confidence": "medium"} for key in CRITERIA]}
    result = assemble(scored, {"transcripts": ["I enjoy cooking for my family."], "speaking_duration_ms": 300000, "voiced_duration_ms": 150000, "silence_ratio": 0.5}, 0.5)
    assert result["overall_band"] == 6
    assert result["score_readiness"]["voiced_seconds"] == 150


def test_long_mostly_silent_recording_is_still_inconclusive():
    scored = {"criteria": [{"criterion": key, "band": 9, "confidence": "high"} for key in CRITERIA]}
    result = assemble(scored, {"transcripts": ["Hello"], "speaking_duration_ms": 300000, "voiced_duration_ms": 10000, "silence_ratio": 0.95}, 0.1)
    assert result["overall_band"] is None
