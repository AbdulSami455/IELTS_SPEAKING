from random import Random

from ielts_inference.topics import (
    PART1_TOPICS,
    PART2_THEMES,
    choose_session_topics,
    part1_topic_for_index,
)


def test_catalog_covers_core_ielts_ranges():
    part1 = {item["id"] for item in PART1_TOPICS}
    part2 = {item["id"] for item in PART2_THEMES}
    assert "food" in part1
    assert {"hometown", "work_study", "travel", "technology", "sport", "music"}.issubset(part1)
    assert {"teacher", "journey", "skill", "environment_issue"}.issubset(part2)
    assert len(PART1_TOPICS) >= 30
    assert len(PART2_THEMES) >= 20


def test_part1_uses_two_questions_per_topic():
    plan = {"part1": ["travel", "music"], "part2": "journey", "part3_theme": "travel"}
    assert part1_topic_for_index(plan, 0)["id"] == "travel"
    assert part1_topic_for_index(plan, 1)["id"] == "travel"
    assert part1_topic_for_index(plan, 2)["id"] == "music"
    assert part1_topic_for_index(plan, 3)["id"] == "music"


def test_recent_food_is_not_selected_again_immediately():
    recent = [
        {
            "part1": ["food", "housework"],
            "part2": "meal",
            "part3_theme": "food culture, eating habits, and hospitality",
        }
    ]
    plan = choose_session_topics(recent, rng=Random(0))
    assert "food" not in plan["part1"]
    assert plan["part2"] != "meal"


def test_rotation_eventually_returns_to_food():
    rng = Random(3)
    recent: list[dict] = []
    seen: set[str] = set()
    for _ in range(25):
        plan = choose_session_topics(recent, rng=rng)
        seen.update(plan["part1"])
        recent.append(plan)
    assert "food" in seen
