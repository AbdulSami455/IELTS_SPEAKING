from ielts_audio.media import inspect_audio
from ielts_db.keys import examiner_object_key


def test_inspect_rejects_tiny_payloads():
    assert inspect_audio(b"short")["ok"] is False


def test_examiner_object_key_is_stable():
    assert examiner_object_key("Hello") == examiner_object_key("Hello")
    assert examiner_object_key("Hello") != examiner_object_key("Other")
    assert examiner_object_key("Hello", model="a") != examiner_object_key("Hello", model="b")
    assert examiner_object_key("Hello").startswith("examiner/v1/")
