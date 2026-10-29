"""Stable IELTS Speaking topic catalog and per-test rotation."""

from __future__ import annotations

from collections import Counter
from random import Random
from typing import TypedDict

from ielts_inference.part2_catalog import PART2_THEMES, Part2Theme


class Topic(TypedDict):
    id: str
    label: str
    guidance: str


class SessionTopicPlan(TypedDict):
    part1: list[str]
    part2: str
    part3_theme: str


PART1_TOPICS: tuple[Topic, ...] = (
    {"id": "work_study", "label": "work or studies", "guidance": "job, course, typical day, likes and dislikes"},
    {"id": "hometown", "label": "hometown", "guidance": "where it is, what it is like, changes, what you like"},
    {"id": "accommodation", "label": "home and accommodation", "guidance": "house or flat, rooms, neighbourhood, living alone or with others"},
    {"id": "daily_routine", "label": "daily routine", "guidance": "mornings, evenings, weekdays, habits"},
    {"id": "weekends", "label": "weekends", "guidance": "how you spend them, plans, rest versus activity"},
    {"id": "friends", "label": "friends", "guidance": "how you met, time together, qualities of a good friend"},
    {"id": "family", "label": "family", "guidance": "who you live with, family time, important relatives"},
    {"id": "neighbours", "label": "neighbours and community", "guidance": "knowing neighbours, local area, community events"},
    {"id": "free_time", "label": "free time and hobbies", "guidance": "what you do to relax, how often, how it started"},
    {"id": "sport", "label": "sport and exercise", "guidance": "watching or playing, school sport, keeping fit"},
    {"id": "music", "label": "music", "guidance": "listening habits, instruments, live music, favourite kinds"},
    {"id": "reading", "label": "reading", "guidance": "books, news, where you read, paper versus screens"},
    {"id": "films_tv", "label": "films and television", "guidance": "what you watch, cinema, series, who you watch with"},
    {"id": "shopping", "label": "shopping", "guidance": "markets, online shops, clothes, whether you enjoy it"},
    {"id": "clothes", "label": "clothes and fashion", "guidance": "what you wear, uniforms, style, shopping for clothes"},
    {"id": "food", "label": "food and eating", "guidance": "meals, restaurants, cooking, food from your country"},
    {"id": "travel", "label": "travel and holidays", "guidance": "trips you take, how you travel, places you want to visit"},
    {"id": "transport", "label": "transport", "guidance": "how you get around, public transport, driving, traffic"},
    {"id": "weather", "label": "weather and seasons", "guidance": "favourite season, rain, how weather affects your plans"},
    {"id": "technology", "label": "technology", "guidance": "computers, gadgets, how tech helps daily life"},
    {"id": "phones", "label": "mobile phones", "guidance": "how often you use one, apps, calls versus messages"},
    {"id": "internet", "label": "the internet", "guidance": "what you use it for, social media, learning online"},
    {"id": "photography", "label": "photography", "guidance": "taking photos, sharing pictures, cameras versus phones"},
    {"id": "art", "label": "art and drawing", "guidance": "galleries, making art, design, colours"},
    {"id": "languages", "label": "languages", "guidance": "languages you speak, learning English, accents"},
    {"id": "health", "label": "health and sleep", "guidance": "keeping healthy, sleep habits, walking, rest"},
    {"id": "festivals", "label": "festivals and celebrations", "guidance": "national days, birthdays, how your family celebrates"},
    {"id": "gifts", "label": "gifts", "guidance": "giving and receiving presents, memorable gifts"},
    {"id": "animals", "label": "animals and pets", "guidance": "pets, wildlife, zoos, animals in your country"},
    {"id": "plants_nature", "label": "plants and the outdoors", "guidance": "gardens, parks, trees, time in nature"},
    {"id": "environment", "label": "the environment", "guidance": "recycling, pollution, green spaces near you"},
    {"id": "news", "label": "news and current events", "guidance": "how you follow news, newspapers, whether you enjoy it"},
    {"id": "advertising", "label": "advertising", "guidance": "ads you notice, online ads, whether they influence you"},
    {"id": "colours", "label": "colours", "guidance": "favourite colours, colours in your home or clothes"},
    {"id": "names", "label": "names", "guidance": "your name, remembering names, names in your culture"},
    {"id": "childhood", "label": "childhood", "guidance": "games, school memories, where you grew up"},
    {"id": "time", "label": "time and punctuality", "guidance": "being on time, watching the clock, busy days"},
    {"id": "housework", "label": "housework", "guidance": "chores, cooking at home, who does what"},
)

_PART1_BY_ID = {item["id"]: item for item in PART1_TOPICS}
_PART2_BY_ID = {item["id"]: item for item in PART2_THEMES}

QUESTIONS_PER_PART1_TOPIC = 2

PART1_ANGLES: dict[str, tuple[str, ...]] = {
    "work_study": (
        "what you are studying or working on at the moment",
        "which part of your job or course you find most engaging",
        "how your daily routine on a busy weekday looks",
        "whether you would choose the same path if you could start again",
    ),
    "hometown": (
        "where your hometown is and what it is known for",
        "how your hometown has changed since you were a child",
        "whether you would prefer to live there or somewhere else in the future",
        "what visitors usually enjoy doing in your hometown",
    ),
    "travel": (
        "the last trip you took and how you travelled",
        "a place you would like to visit and why",
        "whether you prefer short breaks or longer holidays",
        "how travel habits in your country have changed recently",
    ),
    "food": (
        "what you usually eat on a normal weekday",
        "a dish from your country that you would recommend to a visitor",
        "whether you prefer eating at home or eating out",
        "how eating habits in your family have changed over time",
    ),
    "music": (
        "what kind of music you listen to and when",
        "whether you ever play an instrument or sing",
        "a live music event you remember well",
        "how your taste in music has changed since you were younger",
    ),
    "technology": (
        "which device or app you use most often in daily life",
        "how technology has changed the way you study or work",
        "whether children should learn to code at school",
        "a problem that technology has helped you solve recently",
    ),
    "sport": (
        "a sport you play or follow and why you enjoy it",
        "whether you prefer team sports or individual activities",
        "how people in your country keep fit",
        "a sporting event you watched or joined that you remember",
    ),
    "friends": (
        "how you usually spend time with close friends",
        "what qualities you value most in a friend",
        "whether it is easy to make new friends where you live",
        "a friend who has influenced you in a positive way",
    ),
    "reading": (
        "what you like to read and where you read it",
        "whether you prefer paper books or reading on screens",
        "a book or article that stayed in your mind",
        "how reading habits have changed in your country",
    ),
    "weather": (
        "which season you enjoy most where you live",
        "how the weather affects what you do at weekends",
        "whether the climate has changed noticeably in recent years",
        "what people in your country do when the weather is extreme",
    ),
}


def part1_topic(topic_id: str) -> Topic:
    return _PART1_BY_ID[topic_id]


def part2_theme(theme_id: str) -> Part2Theme:
    return _PART2_BY_ID[theme_id]


def part1_topic_for_index(plan: SessionTopicPlan, main_question_index: int) -> Topic:
    ids = plan["part1"]
    topic_id = ids[main_question_index % len(ids)]
    return part1_topic(topic_id)


def part1_questions_on_topic(plan: SessionTopicPlan, main_question_index: int) -> int:
    ids = plan["part1"]
    topic_id = ids[main_question_index % len(ids)]
    return sum(1 for i in range(main_question_index) if ids[i % len(ids)] == topic_id)


def part1_question_angle(topic_id: str, question_index_on_topic: int) -> str:
    topic = part1_topic(topic_id)
    angles = PART1_ANGLES.get(topic_id) or _default_angles(topic)
    return angles[question_index_on_topic % len(angles)]


def _default_angles(topic: Topic) -> tuple[str, ...]:
    label = topic["label"]
    return (
        f"a typical example from your own life related to {label}",
        f"how {label} has changed for you in recent years",
        f"whether {label} is more important to young people or older people where you live",
        f"how {label} fits into your weekly routine",
    )


def choose_session_topics(recent_plans: list[SessionTopicPlan], *, rng: Random | None = None) -> SessionTopicPlan:
    rng = rng or Random()
    used_part1 = [topic_id for plan in recent_plans for topic_id in plan.get("part1", [])]
    used_part2 = [plan["part2"] for plan in recent_plans if plan.get("part2")]
    part1 = _least_used((_PART1_BY_ID[item["id"]] for item in PART1_TOPICS), used_part1, 3, rng)
    part2 = _least_used((_PART2_BY_ID[item["id"]] for item in PART2_THEMES), used_part2, 1, rng)[0]
    return {
        "part1": [item["id"] for item in part1],
        "part2": part2["id"],
        "part3_theme": part2["part3"],
    }


def _least_used(catalog, used: list[str], count: int, rng: Random) -> list:
    items = list(catalog)
    scores = Counter(used)
    items.sort(key=lambda item: (scores[item["id"]], rng.random()))
    return items[:count]
