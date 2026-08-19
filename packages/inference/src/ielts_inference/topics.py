"""Stable IELTS Speaking topic catalog and per-test rotation."""

from __future__ import annotations

from collections import Counter
from random import Random
from typing import TypedDict


class Topic(TypedDict):
    id: str
    label: str
    guidance: str


class Part2Theme(TypedDict):
    id: str
    label: str
    task: str
    part3: str


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

PART2_THEMES: tuple[Part2Theme, ...] = (
    {
        "id": "person_influence",
        "label": "a person who influenced you",
        "task": "Describe a person who has had a positive influence on you.",
        "part3": "role models, influence, and relationships in society",
    },
    {
        "id": "teacher",
        "label": "a teacher you remember",
        "task": "Describe a teacher who helped you learn something important.",
        "part3": "education, teaching quality, and lifelong learning",
    },
    {
        "id": "friend",
        "label": "a close friend",
        "task": "Describe a friend you like to spend time with.",
        "part3": "friendship, social life, and how people maintain relationships",
    },
    {
        "id": "place_city",
        "label": "a place in your city",
        "task": "Describe a place in your hometown or city that you enjoy visiting.",
        "part3": "cities, public spaces, and urban life",
    },
    {
        "id": "natural_place",
        "label": "a natural place",
        "task": "Describe a natural place you have visited or would like to visit.",
        "part3": "nature, tourism, and protecting the environment",
    },
    {
        "id": "journey",
        "label": "a journey",
        "task": "Describe a journey you remember well.",
        "part3": "travel, transport, and tourism",
    },
    {
        "id": "building",
        "label": "an interesting building",
        "task": "Describe an interesting building you have seen.",
        "part3": "architecture, housing, and how cities are designed",
    },
    {
        "id": "object",
        "label": "an object you use often",
        "task": "Describe an object you use often that is important to you.",
        "part3": "consumer goods, technology in daily life, and possessions",
    },
    {
        "id": "gift",
        "label": "a gift",
        "task": "Describe a gift you received that was meaningful.",
        "part3": "giving, consumer culture, and celebrating occasions",
    },
    {
        "id": "book",
        "label": "a book",
        "task": "Describe a book you enjoyed reading.",
        "part3": "reading habits, literature, and education",
    },
    {
        "id": "film",
        "label": "a film or TV programme",
        "task": "Describe a film or television programme you enjoyed.",
        "part3": "media, entertainment, and the influence of screens",
    },
    {
        "id": "website_app",
        "label": "a website or app",
        "task": "Describe a website or app you find useful.",
        "part3": "the internet, digital skills, and online life",
    },
    {
        "id": "skill",
        "label": "a useful skill",
        "task": "Describe a skill you learned that has been useful.",
        "part3": "skills, training, and the future of work",
    },
    {
        "id": "job",
        "label": "a job you would like",
        "task": "Describe a job you would like to do in the future.",
        "part3": "careers, work-life balance, and employment",
    },
    {
        "id": "event",
        "label": "an event or festival",
        "task": "Describe an event or festival you attended.",
        "part3": "culture, traditions, and public celebrations",
    },
    {
        "id": "sport_event",
        "label": "a sports event",
        "task": "Describe a sports event you watched or took part in.",
        "part3": "sport in society, competition, and health",
    },
    {
        "id": "helping",
        "label": "a time you helped someone",
        "task": "Describe a time when you helped someone.",
        "part3": "volunteering, community, and social responsibility",
    },
    {
        "id": "childhood_memory",
        "label": "a childhood memory",
        "task": "Describe a happy memory from your childhood.",
        "part3": "childhood, family life, and growing up",
    },
    {
        "id": "late",
        "label": "a time you were late",
        "task": "Describe a time when you were late for something important.",
        "part3": "punctuality, time pressure, and modern work culture",
    },
    {
        "id": "advertisement",
        "label": "an advertisement",
        "task": "Describe an advertisement that caught your attention.",
        "part3": "advertising, consumer behaviour, and media influence",
    },
    {
        "id": "news_story",
        "label": "a piece of news",
        "task": "Describe a piece of news that interested you.",
        "part3": "news media, information, and public opinion",
    },
    {
        "id": "environment_issue",
        "label": "an environmental problem",
        "task": "Describe an environmental problem in your area or country.",
        "part3": "the environment, government action, and individual responsibility",
    },
    {
        "id": "photo",
        "label": "a photograph",
        "task": "Describe a photograph that is important to you.",
        "part3": "memories, photography, and sharing images",
    },
    {
        "id": "clothes_item",
        "label": "an item of clothing",
        "task": "Describe an item of clothing you like to wear.",
        "part3": "fashion, identity, and the clothing industry",
    },
    {
        "id": "language_moment",
        "label": "learning a language",
        "task": "Describe a time when you used a foreign language.",
        "part3": "language learning, global communication, and education",
    },
    {
        "id": "meal",
        "label": "a meal you enjoyed",
        "task": "Describe a meal you enjoyed with other people.",
        "part3": "food culture, eating habits, and hospitality",
    },
)

_PART1_BY_ID = {item["id"]: item for item in PART1_TOPICS}
_PART2_BY_ID = {item["id"]: item for item in PART2_THEMES}

QUESTIONS_PER_PART1_TOPIC = 2


def part1_topic(topic_id: str) -> Topic:
    return _PART1_BY_ID[topic_id]


def part2_theme(theme_id: str) -> Part2Theme:
    return _PART2_BY_ID[theme_id]


def part1_topic_for_index(plan: SessionTopicPlan, asked_count: int) -> Topic:
    ids = plan["part1"]
    index = min(asked_count // QUESTIONS_PER_PART1_TOPIC, len(ids) - 1)
    return part1_topic(ids[index])


def choose_session_topics(recent_plans: list[SessionTopicPlan], *, rng: Random | None = None) -> SessionTopicPlan:
    rng = rng or Random()
    used_part1 = [topic_id for plan in recent_plans for topic_id in plan.get("part1", [])]
    used_part2 = [plan["part2"] for plan in recent_plans if plan.get("part2")]
    part1 = _least_used((_PART1_BY_ID[item["id"]] for item in PART1_TOPICS), used_part1, 2, rng)
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
