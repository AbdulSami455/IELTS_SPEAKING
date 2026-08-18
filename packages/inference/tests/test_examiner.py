from ielts_inference.examiner import parse_follow_up


def test_parse_follow_up_requires_a_real_question():
    assert parse_follow_up({"ask_follow_up": False, "question": "Why?"}) is None
    assert parse_follow_up({"ask_follow_up": True, "question": "Why?"}) is None
    result = parse_follow_up({"ask_follow_up": True, "question": "Can you tell me more about that place"})
    assert result is not None
    assert result.endswith("?")
