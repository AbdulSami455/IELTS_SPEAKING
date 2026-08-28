from ielts_audio.media import inspect_audio, normalize_to_wav
from ielts_db.keys import examiner_object_key


def test_inspect_rejects_tiny_payloads():
    assert inspect_audio(b"short")["ok"] is False


def test_examiner_object_key_is_stable():
    assert examiner_object_key("Hello") == examiner_object_key("Hello")
    assert examiner_object_key("Hello") != examiner_object_key("Other")
    assert examiner_object_key("Hello", model="a") != examiner_object_key("Hello", model="b")
    assert examiner_object_key("Hello").startswith("examiner/v1/")


def test_normalize_returns_source_on_ffmpeg_failure(monkeypatch):
    import subprocess

    class FakeCompleted:
        returncode = 1
        stdout = b""
        stderr = b"error"

    def fake_run(*args, **kwargs):
        return FakeCompleted()

    monkeypatch.setattr(subprocess, "run", fake_run)
    source = b"not-a-real-audio-file"
    result = normalize_to_wav(source, ".webm")
    assert result is source


def test_normalize_returns_source_when_ffmpeg_missing(monkeypatch):
    import shutil

    monkeypatch.setattr(shutil, "which", lambda _: None)
    source = b"some-bytes"
    result = normalize_to_wav(source, ".webm")
    assert result is source


def test_normalize_handles_non_zero_ffmpeg_returncode(monkeypatch):
    import subprocess

    original_run = subprocess.run

    def fake_run(*args, **kwargs):
        return original_run(*args, **kwargs, check=False)

    def failing_run(*args, **kwargs):
        class Fail:
            returncode = -1
            stdout = b""
            stderr = b"fail"

        return Fail()

    monkeypatch.setattr(subprocess, "run", failing_run)
    source = b"\x00\x00\x00\x18webm" + b"x" * 100
    result = normalize_to_wav(source, ".webm")
    assert result is source
