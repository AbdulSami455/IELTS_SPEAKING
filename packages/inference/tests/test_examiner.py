from ielts_inference.examiner import (
    PART1_INTRO_TEXT,
    PART2_INTRO_PREFIX,
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
