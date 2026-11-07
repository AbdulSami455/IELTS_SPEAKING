"""High-quality Part 2 cue-card catalog used by topic rotation."""

from __future__ import annotations

from typing import TypedDict


class Part2Theme(TypedDict):
    id: str
    label: str
    task: str
    prompts: list[str]
    part3: str


PART2_THEMES: tuple[Part2Theme, ...] = (
    {
        "id": "person_influence",
        "label": "a person who influenced you",
        "task": "Describe a person who has had a strong positive influence on the way you live or study.",
        "prompts": [
            "who this person is and how you know them",
            "what they did or said that influenced you",
            "how your behaviour or choices changed afterwards",
            "and explain why their influence still matters to you",
        ],
        "part3": "role models, influence, and relationships in society",
    },
    {
        "id": "teacher",
        "label": "a teacher you remember",
        "task": "Describe a teacher who helped you understand something difficult.",
        "prompts": [
            "who the teacher was and what they taught",
            "what you found difficult before their help",
            "how they explained it or supported you",
            "and explain why you still remember them",
        ],
        "part3": "education, teaching quality, and lifelong learning",
    },
    {
        "id": "friend",
        "label": "a close friend",
        "task": "Describe a friend you particularly enjoy spending time with.",
        "prompts": [
            "who this friend is and how you met",
            "what you usually do together",
            "what you like about their personality",
            "and explain why this friendship is important to you",
        ],
        "part3": "friendship, social life, and how people maintain relationships",
    },
    {
        "id": "place_city",
        "label": "a place in your city",
        "task": "Describe a place in your hometown or city that you often enjoy visiting.",
        "prompts": [
            "where this place is and what it looks like",
            "what you usually do when you go there",
            "who you go with, if anyone",
            "and explain why this place attracts you",
        ],
        "part3": "cities, public spaces, and urban life",
    },
    {
        "id": "natural_place",
        "label": "a natural place",
        "task": "Describe a natural place you have visited that left a strong impression on you.",
        "prompts": [
            "where this place is and what you can see there",
            "when you went and who you were with",
            "what you did during the visit",
            "and explain why the place impressed you",
        ],
        "part3": "nature, tourism, and protecting the environment",
    },
    {
        "id": "journey",
        "label": "a journey",
        "task": "Describe a journey you remember clearly because something unusual happened.",
        "prompts": [
            "where you were going and how you travelled",
            "what made the journey unusual or memorable",
            "how you felt at the time",
            "and explain what you learned from it",
        ],
        "part3": "travel, transport, and tourism",
    },
    {
        "id": "building",
        "label": "an interesting building",
        "task": "Describe an interesting building you have seen in person.",
        "prompts": [
            "where the building is and what it is used for",
            "what it looks like from the outside or inside",
            "when you saw it and why you were there",
            "and explain what makes it interesting to you",
        ],
        "part3": "architecture, housing, and how cities are designed",
    },
    {
        "id": "object",
        "label": "an object you use often",
        "task": "Describe a useful object you rely on in your daily life.",
        "prompts": [
            "what the object is and where you got it",
            "how and when you usually use it",
            "what problem it helps you solve",
            "and explain why it would be hard to replace",
        ],
        "part3": "consumer goods, technology in daily life, and possessions",
    },
    {
        "id": "gift",
        "label": "a gift",
        "task": "Describe a gift you received that meant a lot to you.",
        "prompts": [
            "what the gift was and who gave it to you",
            "when you received it and for what occasion",
            "how you used or kept it afterwards",
            "and explain why it was meaningful",
        ],
        "part3": "giving, consumer culture, and celebrating occasions",
    },
    {
        "id": "book",
        "label": "a book",
        "task": "Describe a book you enjoyed reading and would recommend to someone else.",
        "prompts": [
            "what the book was about",
            "when and where you read it",
            "what you liked most about it",
            "and explain who you would recommend it to, and why",
        ],
        "part3": "reading habits, literature, and education",
    },
    {
        "id": "film",
        "label": "a film or TV programme",
        "task": "Describe a film or television programme that you found especially engaging.",
        "prompts": [
            "what it was about and what type it was",
            "when you watched it and who you watched it with",
            "which part or character stayed with you",
            "and explain why you would watch something like it again",
        ],
        "part3": "media, entertainment, and the influence of screens",
    },
    {
        "id": "website_app",
        "label": "a website or app",
        "task": "Describe a website or app that has made a practical difference to your life.",
        "prompts": [
            "what the website or app is used for",
            "how you first discovered it",
            "a specific way you use it in daily life",
            "and explain what you would do without it",
        ],
        "part3": "the internet, digital skills, and online life",
    },
    {
        "id": "skill",
        "label": "a useful skill",
        "task": "Describe a practical skill you learned that later helped you in real life.",
        "prompts": [
            "what the skill is",
            "how and where you learned it",
            "a situation when it was useful",
            "and explain why you think others should learn it too",
        ],
        "part3": "skills, training, and the future of work",
    },
    {
        "id": "job",
        "label": "a job you would like",
        "task": "Describe a job you would like to do in the future and why it appeals to you.",
        "prompts": [
            "what the job involves",
            "what skills or qualities it would require",
            "how you first became interested in it",
            "and explain what difference you hope to make in that role",
        ],
        "part3": "careers, work-life balance, and employment",
    },
    {
        "id": "event",
        "label": "an event or festival",
        "task": "Describe a festival or public event you attended that you found memorable.",
        "prompts": [
            "what the event was and where it took place",
            "what people did there",
            "what you personally saw or took part in",
            "and explain why it was memorable for you",
        ],
        "part3": "culture, traditions, and public celebrations",
    },
    {
        "id": "sport_event",
        "label": "a sports event",
        "task": "Describe a sports event you watched or took part in that excited you.",
        "prompts": [
            "what the event was and where it happened",
            "what your role was — player, spectator, or helper",
            "what made the event exciting",
            "and explain how you felt afterwards",
        ],
        "part3": "sport in society, competition, and health",
    },
    {
        "id": "helping",
        "label": "a time you helped someone",
        "task": "Describe a time when you helped someone who really needed support.",
        "prompts": [
            "who needed help and what the situation was",
            "what you did to help",
            "how the other person responded",
            "and explain what you learned from helping them",
        ],
        "part3": "volunteering, community, and social responsibility",
    },
    {
        "id": "childhood_memory",
        "label": "a childhood memory",
        "task": "Describe a happy childhood memory that you still think about.",
        "prompts": [
            "when and where this happened",
            "who was with you",
            "what made the moment special",
            "and explain why you still remember it clearly",
        ],
        "part3": "childhood, family life, and growing up",
    },
    {
        "id": "late",
        "label": "a time you were late",
        "task": "Describe a time when being late caused a problem for you.",
        "prompts": [
            "what you were late for",
            "why you were delayed",
            "what happened as a result",
            "and explain what you changed afterwards, if anything",
        ],
        "part3": "punctuality, time pressure, and modern work culture",
    },
    {
        "id": "advertisement",
        "label": "an advertisement",
        "task": "Describe an advertisement that caught your attention and made you think.",
        "prompts": [
            "where you saw or heard the advertisement",
            "what product, service, or message it promoted",
            "what made it stand out",
            "and explain whether it influenced your behaviour",
        ],
        "part3": "advertising, consumer behaviour, and media influence",
    },
    {
        "id": "news_story",
        "label": "a piece of news",
        "task": "Describe a news story that interested you recently.",
        "prompts": [
            "what the story was about",
            "where you read or heard it",
            "why it interested you at the time",
            "and explain whether it changed your opinion about anything",
        ],
        "part3": "news media, information, and public opinion",
    },
    {
        "id": "environment_issue",
        "label": "an environmental problem",
        "task": "Describe an environmental problem you have noticed in your area or country.",
        "prompts": [
            "what the problem is and where it occurs",
            "how it affects people or nature",
            "what people or authorities are doing about it",
            "and explain what you personally think should happen next",
        ],
        "part3": "the environment, government action, and individual responsibility",
    },
    {
        "id": "photo",
        "label": "a photograph",
        "task": "Describe a photograph that is important to you personally.",
        "prompts": [
            "what the photograph shows",
            "when and where it was taken",
            "who took it, if you know",
            "and explain why you keep or remember it",
        ],
        "part3": "memories, photography, and sharing images",
    },
    {
        "id": "clothes_item",
        "label": "an item of clothing",
        "task": "Describe an item of clothing you like to wear for a particular reason.",
        "prompts": [
            "what the item is and what it looks like",
            "where or when you usually wear it",
            "how you got it",
            "and explain why it suits you or the occasion",
        ],
        "part3": "fashion, identity, and the clothing industry",
    },
    {
        "id": "language_moment",
        "label": "learning a language",
        "task": "Describe a time when you successfully used a foreign language in real life.",
        "prompts": [
            "where you were and who you were speaking to",
            "what you needed to communicate",
            "how well it went",
            "and explain how the experience affected your confidence",
        ],
        "part3": "language learning, global communication, and education",
    },
    {
        "id": "meal",
        "label": "a meal you enjoyed",
        "task": "Describe a meal you shared with other people that you particularly enjoyed.",
        "prompts": [
            "where you ate and who was there",
            "what you ate or drank",
            "what made the occasion special",
            "and explain why you remember that meal",
        ],
        "part3": "food culture, eating habits, and hospitality",
    },
    {
        "id": "decision",
        "label": "a difficult decision",
        "task": "Describe a difficult decision you had to make and how you handled it.",
        "prompts": [
            "what the decision was about",
            "what options you considered",
            "how you finally decided",
            "and explain what the result was",
        ],
        "part3": "decision-making, independence, and advice",
    },
    {
        "id": "team_project",
        "label": "a team project",
        "task": "Describe a project you completed successfully with other people.",
        "prompts": [
            "what the project was and what your role was",
            "who else was involved",
            "what challenges the team faced",
            "and explain what made the teamwork succeed",
        ],
        "part3": "teamwork, leadership, and working independently",
    },
    {
        "id": "solved_problem",
        "label": "a problem you solved",
        "task": "Describe a practical problem you solved by yourself.",
        "prompts": [
            "what the problem was",
            "what you tried first",
            "how you finally fixed it",
            "and explain what this experience taught you",
        ],
        "part3": "practical skills, repairing possessions, and problem-solving",
    },
    {
        "id": "community_tradition",
        "label": "a community tradition",
        "task": "Describe a tradition in your community that people still take seriously.",
        "prompts": [
            "what the tradition is and when it happens",
            "what people usually do",
            "how you personally take part, if you do",
            "and explain why the tradition still matters locally",
        ],
        "part3": "traditions, cultural identity, and social change",
    },
    {
        "id": "outdoor_activity",
        "label": "an outdoor activity",
        "task": "Describe an outdoor activity you tried that was new for you.",
        "prompts": [
            "what the activity was and where you did it",
            "who introduced you to it",
            "what you found easy or difficult",
            "and explain whether you would do it again",
        ],
        "part3": "outdoor recreation, health, and urban planning",
    },
    {
        "id": "local_improvement",
        "label": "an improvement to your local area",
        "task": "Describe a change that improved life in your local area.",
        "prompts": [
            "what changed and where it happened",
            "who made the change",
            "how daily life improved afterwards",
            "and explain whether people in the area supported it",
        ],
        "part3": "neighbourhood planning, local government, and public consultation",
    },
    {
        "id": "memorable_conversation",
        "label": "a memorable conversation",
        "task": "Describe a conversation you remember clearly because it changed your thinking.",
        "prompts": [
            "who you talked to and where you were",
            "what the conversation was about",
            "what idea or advice stayed with you",
            "and explain how it affected you afterwards",
        ],
        "part3": "communication, memory, and digital messaging",
    },
    {
        "id": "organised_event",
        "label": "a well-organised event",
        "task": "Describe an event you attended that was particularly well organised.",
        "prompts": [
            "what the event was and where it took place",
            "what arrangements impressed you",
            "how those arrangements helped the audience or guests",
            "and explain what organisers elsewhere could learn from it",
        ],
        "part3": "event planning, accessibility, and public participation",
    },
    {
        "id": "routine_change",
        "label": "a change to your routine",
        "task": "Describe a change you made to your daily routine that improved your life.",
        "prompts": [
            "what your routine was like before",
            "what change you made",
            "how hard it was to keep the new habit",
            "and explain what benefit you noticed",
        ],
        "part3": "habits, routines, productivity, and personal freedom",
    },
)
