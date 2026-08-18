"""Safe FFmpeg helpers and acoustic quality measurements."""

from __future__ import annotations

import io
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AcousticQuality:
    duration_ms: int
    rms: float
    silence_ratio: float
    clipping_ratio: float
    speech_ratio: float


def normalize_to_wav(source: bytes, suffix: str = ".webm") -> bytes:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return source
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"in{suffix}"
        dst = Path(tmp) / "out.wav"
        src.write_bytes(source)
        completed = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(src),
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(dst),
            ],
            check=False,
            capture_output=True,
            timeout=60,
        )
        if completed.returncode != 0 or not dst.exists():
            return source
        return dst.read_bytes()


def measure_wav(data: bytes) -> AcousticQuality:
    try:
        with wave.open(io.BytesIO(data), "rb") as handle:
            frames = handle.readframes(handle.getnframes())
            width = handle.getsampwidth()
            rate = handle.getframerate()
            duration_ms = int(handle.getnframes() / max(rate, 1) * 1000)
            rms = _pcm_rms(frames, width)
            silent = 0
            clipped = 0
            peak = 2 ** (8 * width - 1) - 1
            step = width
            for index in range(0, len(frames) - width + 1, step * 80 or step):
                sample = int.from_bytes(frames[index : index + width], "little", signed=True)
                if abs(sample) < peak * 0.02:
                    silent += 1
                if abs(sample) > peak * 0.98:
                    clipped += 1
            windows = max((len(frames) // width) // 80, 1)
            silence_ratio = min(1.0, silent / windows)
            clipping_ratio = min(1.0, clipped / windows)
            return AcousticQuality(
                duration_ms=duration_ms,
                rms=round(rms, 4),
                silence_ratio=round(silence_ratio, 4),
                clipping_ratio=round(clipping_ratio, 4),
                speech_ratio=round(max(0.0, 1.0 - silence_ratio), 4),
            )
    except Exception:
        return AcousticQuality(0, 0.0, 1.0, 0.0, 0.0)


def _pcm_rms(frames: bytes, width: int) -> float:
    if width <= 0 or not frames:
        return 0.0
    peak = 2 ** (8 * width - 1)
    total = 0.0
    count = 0
    for index in range(0, len(frames) - width + 1, width):
        sample = int.from_bytes(frames[index : index + width], "little", signed=True)
        total += sample * sample
        count += 1
    if count == 0:
        return 0.0
    return round((total / count) ** 0.5 / peak, 4)


def pause_features(words: list[dict]) -> dict:
    gaps = []
    previous_end = None
    for word in words:
        start = float(word.get("start") or word.get("startMs", 0) / 1000)
        end = float(word.get("end") or word.get("endMs", 0) / 1000)
        if previous_end is not None:
            gap = start - previous_end
            if gap >= 0.4:
                gaps.append(gap)
        previous_end = end
    duration = 0.0
    if words:
        last = words[-1]
        duration = float(last.get("end") or last.get("endMs", 0) / 1000)
    word_count = len(words)
    return {
        "pause_count": len(gaps),
        "mean_pause_seconds": round(sum(gaps) / len(gaps), 3) if gaps else 0.0,
        "words_per_minute": round(word_count / max(duration, 1) * 60, 1),
        "mean_length_of_run": round(word_count / max(len(gaps) + 1, 1), 2),
        "speaking_duration_ms": int(duration * 1000),
    }


def inspect_audio(data: bytes, suffix: str = ".webm") -> dict:
    if len(data) < 32:
        return {"ok": False, "duration_ms": 0, "reason": "too-small"}
    wav = normalize_to_wav(data, suffix)
    quality = measure_wav(wav)
    if quality.duration_ms == 0:
        return {"ok": True, "duration_ms": 0, "reason": "unprobed"}
    if quality.duration_ms < 400:
        return {"ok": False, "duration_ms": quality.duration_ms, "reason": "too-short"}
    return {"ok": True, "duration_ms": quality.duration_ms, "reason": "ok"}


def acoustic_observations(wav: bytes, words: list[dict]) -> dict:
    quality = measure_wav(wav)
    pauses = pause_features(words) if words else {"pause_count": 0, "words_per_minute": 0.0}
    coverage = quality.speech_ratio
    if quality.duration_ms < 3000:
        coverage = min(coverage, 0.2)
    if not words:
        coverage = min(coverage, 0.35)
    return {
        "acoustic_model_hash": "signal-quality-v1",
        "duration_ms": quality.duration_ms,
        "rms": quality.rms,
        "silence_ratio": quality.silence_ratio,
        "clipping_ratio": quality.clipping_ratio,
        "speech_ratio": quality.speech_ratio,
        "pause_count": int(pauses.get("pause_count") or 0),
        "words_per_minute": float(pauses.get("words_per_minute") or 0),
        "coverage": round(coverage, 4),
        "evidence_spans": [],
        "band": None,
    }


def concat_wavs(parts: list[bytes]) -> bytes:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None or not parts:
        return b"".join(parts)
    with tempfile.TemporaryDirectory() as tmp:
        list_path = Path(tmp) / "list.txt"
        lines = []
        for index, part in enumerate(parts):
            wav = normalize_to_wav(part, ".wav" if part[:4] == b"RIFF" else ".webm")
            path = Path(tmp) / f"p{index}.wav"
            path.write_bytes(wav)
            lines.append(f"file '{path}'")
        list_path.write_text("\n".join(lines))
        out = Path(tmp) / "all.wav"
        completed = subprocess.run(
            [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(list_path), "-c", "copy", str(out)],
            check=False,
            capture_output=True,
            timeout=60,
        )
        if completed.returncode != 0 or not out.exists():
            return parts[0]
        return out.read_bytes()
