from ielts_inference.examiner import (
    PART1_INTRO_TEXT,
    PART2_INTRO_PREFIX,
    PART3_INTRO_PREFIX,
    first_part1_turn_after_intro,
    first_part3_turn_after_part2,
    is_repeated_question,
    parse_cue_card,
    parse_follow_up,
    parse_spoken_question,
    part1_intro_turn,
    part1_prompt_input,
    part2_prompt_input,
    part3_prompt_input,
)


def test_parse_follow_up_requires_a_real_question():
    assert parse_follow_up({"ask_follow_up": False, "question": "Why?"}) is None
    assert parse_follow_up({"ask_follow_up": True, "question": "Why?"}) is None
    result = parse_follow_up({"ask_follow_up": True, "question": "Can you tell me more about that place"})
    assert result is not None
    assert result.endswith("?")


def test_parse_spoken_question_normalizes_question_mark():
    turn = parse_spoken_question({"question": "What do you enjoy doing after work"}, timing_seconds=30)
    assert turn is not None
    assert turn.prompt_text.endswith("?")
    assert turn.timing_seconds == 30


def test_parse_spoken_question_accepts_alternate_keys():
    turn = parse_spoken_question({"prompt": "How has technology changed education?"}, timing_seconds=30)
    assert turn is not None
    assert "technology" in turn.prompt_text.lower()


def test_repeated_question_detects_exact_and_near_duplicates():
    asked = ["Should cities provide more opportunities for outdoor activities?"]
    assert is_repeated_question("Should cities provide more opportunities for outdoor activities?", asked)
    assert is_repeated_question("Should cities provide more opportunities for outdoor activities", asked)
    assert not is_repeated_question("Why do some people spend little time outdoors?", asked)


def test_parse_cue_card_requires_three_points():
    assert parse_cue_card({"topic": "A teacher", "task": "Describe a teacher.", "prompts": ["one", "two"]}) is None
    turn = parse_cue_card(
        {
            "topic": "A teacher who helped you",
            "task": "Describe a teacher who helped you learn something important.",
            "prompts": ["who the person was", "what they taught you", "why you remember them"],
        }
    )
    assert turn is not None
    assert turn.cue_card is not None
    assert len(turn.cue_card["prompts"]) == 3


def test_part1_intro_is_mandatory_examiner_script():
    turn = part1_intro_turn()
    assert "full name" in turn.prompt_text.lower()
    assert PART1_INTRO_TEXT in turn.prompt_text
    assert turn.asset_version == "intro"
    assert turn.timing_seconds == 25


def test_first_part3_turn_includes_intro_and_question():
    turn = first_part3_turn_after_part2("education", "online learning")
    assert PART3_INTRO_PREFIX in turn.prompt_text
    assert "online learning" in turn.prompt_text
    assert turn.prompt_text.endswith("?")


def test_parse_spoken_question_accepts_part3_intro_length():
    intro = PART3_INTRO_PREFIX
    long_q = intro + "Why do you think technology has changed the way people learn languages today?"
    turn = parse_spoken_question({"question": long_q}, timing_seconds=40)
    assert turn is not None
    assert "?" in turn.prompt_text


def test_first_part1_turn_after_intro_is_instant_template():
    turn = first_part1_turn_after_intro("travel", "the last trip you took")
    assert "travel" in turn.prompt_text
    assert "last trip" in turn.prompt_text
    assert "?" in turn.prompt_text


def test_part2_cue_card_includes_examiner_intro():
    turn = parse_cue_card(
        {
            "topic": "A useful skill",
            "task": "Describe a skill you learned that has been useful.",
            "prompts": ["what the skill is", "how you learned it", "why it is useful"],
        }
    )
    assert turn is not None
    assert turn.prompt_text.startswith(PART2_INTRO_PREFIX)


def test_prompt_inputs_pin_the_assigned_topic():
    part1 = part1_prompt_input(
        [],
        [],
        topic_label="music",
        topic_guidance="listening habits",
        question_angle="a live music event you remember well",
        is_first_topic_question=True,
    )
    assert "music" in part1
    assert "listening habits" in part1
    assert "live music event" in part1
    part2 = part2_prompt_input([], theme_label="a useful skill", task="Describe a skill.", part3_theme="training")
    assert "a useful skill" in part2
    part3 = part3_prompt_input([], [], theme="education and teaching quality")
    assert "education and teaching quality" in part3
