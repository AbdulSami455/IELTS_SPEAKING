// API fixtures for the end-to-end suite. Shapes mirror src/lib/api/types.ts.
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const user = {
  id: "u1",
  displayName: "Shots Learner",
  email: "shots@example.com",
  consentRequired: false,
  consentVersion: "2026-10-12",
  currentConsentVersion: "2026-10-12",
};

export const userNeedingConsent = { ...user, consentRequired: true, consentVersion: "2026-01-01" };

const criterion = (name: string, band: number, confidence = "medium") => ({
  criterion: name,
  band,
  confidence,
  subdimensions: [{ key: "range", band }],
  evidence: [{ quote: "an example from the transcript", note: "Why it matters." }],
});

export const report = {
  reportId: "fixture-report",
  testId: "t4",
  overallBand: 6.5,
  confidenceLabel: "medium",
  createdAt: day(1),
  evaluatorVersion: "eval-2026.10",
  rubricVersion: "rubric-3",
  modelPolicyVersion: "policy-2",
  disclaimer: "Practice estimate only. Not an official IELTS result.",
  isInconclusive: false,
  criteria: [
    criterion("fluency_and_coherence", 6.5),
    criterion("lexical_resource", 6),
    criterion("grammatical_range_and_accuracy", 6.5, "high"),
    criterion("pronunciation", 7, "low"),
  ],
  strengths: ["Clear opinions in Part 3 with a reason for each.", "Steady pace without long silences."],
  improvements: ["Replace repeated adjectives with precise words.", "Finish complex sentences."],
  minorImprovements: ["Fewer fillers than your previous test."],
  progressComparison: {
    hasPrevious: true,
    previousTestAt: day(9),
    previousOverallBand: 6,
    overallDelta: 0.5,
    improvedAreas: ["Fluency: fewer fillers and longer turns."],
    minorGains: ["Vocabulary: one new topic collocation."],
    stillWorkingOn: ["Lexical precision in Part 1 answers."],
    mistakeTrends: { resolved: [{ type: "grammar" }], recurring: [{ type: "phrase" }], newIssues: [] },
  },
  exampleRewrites: [{ original: "It was a very good experience.", saferRewrite: "It was a memorable experience." }],
  practicePlan: {
    days: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      focus: "lexical_resource",
      task: `Practice task ${i + 1}`,
      minutes: 15,
      successCriteria: "No repeated adjective.",
    })),
  },
  transcripts: [
    { part: 1, promptText: "Do you prefer to spend your free time indoors or outdoors?", text: "I usually go to the park near my house." },
    { part: 2, promptText: "Describe a trip you remember well.", text: "Last year I went to the mountains with my cousins." },
  ],
  mistakes: [
    {
      type: "grammar",
      quote: "they are very friendly",
      correction: "are very friendly",
      note: "Avoid a double subject.",
      practice: "Say three sentences.",
    },
  ],
  fluency: [],
  vocabularyInsights: {
    hasContent: true,
    stats: [{ label: "Distinct words", value: "212", status: "good" }],
    wordsYouUsed: ["nature", "cousins", "mountains"],
    lexicalHighlights: [{ quote: "families can afford to travel", note: "A natural collocation." }],
    phraseFixes: [],
    grammarWordChoices: [],
    coachingTips: ["Prepare three precise adjectives per topic."],
  },
  fluencyInsights: {
    band: 6.5,
    confidence: "medium",
    metrics: [{ label: "Words per minute", value: "128", status: "good" }],
    observations: [{ kind: "coach", title: "Pace", body: "Comfortable for a listener." }],
    focusNext: ["Plan the second sentence before you finish the first."],
  },
  pronunciationInsights: {
    practiceWords: ["mountains", "afford"],
    improvements: [
      { title: "Word stress", detail: "Even stress blurred two-syllable nouns.", action: "Exaggerate the stressed syllable." },
    ],
    findings: [],
    notes: [],
    accentNote: null,
    disclaimer: "Clarity and rhythm feedback from your recording. Accent is not an error.",
  },
};

const exam = (i: number, date: string, overall: number, c: number[]) => ({
  testId: `t${i}`,
  reportId: i === 4 ? "fixture-report" : `r${i}`,
  date,
  examIndex: i,
  label: `Test ${i}`,
  overallBand: overall,
  criteria: { fluency_and_coherence: c[0], lexical_resource: c[1], grammatical_range_and_accuracy: c[2], pronunciation: c[3] },
});

export const progress = {
  overallEstimate: 6.5,
  scoredTests: 4,
  estimateSampleSize: 4,
  observedLow: 5.5,
  observedHigh: 6.5,
  latestReportId: "fixture-report",
  overallTrend: "improving",
  sampleSize: 4,
  confidence: "medium",
  latestBand: 6.5,
  testsCompleted: 4,
  weakestSkill: "lexical_resource",
  criterionStats: [
    { criterion: "fluency_and_coherence", averageBand: 6.5, samples: 4 },
    { criterion: "lexical_resource", averageBand: 5.9, samples: 4 },
    { criterion: "grammatical_range_and_accuracy", averageBand: 6.3, samples: 4 },
    { criterion: "pronunciation", averageBand: 6.8, samples: 4 },
  ],
  activeGoal: { targetBand: 7, targetDate: day(-60), focusSkills: ["lexical_resource"] },
  priorities: ["lexical_resource"],
  timeline: [
    { testId: "t1", date: day(30), overallBand: 5.5, reportId: "r1" },
    { testId: "t2", date: day(21), overallBand: 6, reportId: "r2" },
    { testId: "t3", date: day(9), overallBand: 6, reportId: "r3" },
    { testId: "t4", date: day(1), overallBand: 6.5, reportId: "fixture-report" },
  ],
  examHistory: {
    exams: [
      exam(1, day(30), 5.5, [6, 5, 5.5, 6]),
      exam(2, day(21), 6, [6, 5.5, 6, 6.5]),
      exam(3, day(9), 6, [6.5, 6, 6, 7]),
      exam(4, day(1), 6.5, [6.5, 6, 6.5, 7]),
    ],
    lifetimeOverallBand: 6,
    scoredExamCount: 4,
    journey: {
      fromLabel: "Test 1",
      toLabel: "Test 4",
      firstOverallBand: 5.5,
      lastOverallBand: 6.5,
      overallDelta: 1,
      criteria: [
        { criterion: "fluency_and_coherence", firstBand: 6, lastBand: 6.5, delta: 0.5 },
        { criterion: "lexical_resource", firstBand: 5, lastBand: 6, delta: 1 },
        { criterion: "grammatical_range_and_accuracy", firstBand: 5.5, lastBand: 6.5, delta: 1 },
        { criterion: "pronunciation", firstBand: 6, lastBand: 7, delta: 1 },
      ],
    },
  },
  actions: [
    { id: "a1", description: "Record a one-minute answer about a hobby.", category: "lexical_resource", completed: true, skipped: false },
    {
      id: "a2",
      description: "Describe your morning routine for 90 seconds.",
      category: "fluency_and_coherence",
      completed: false,
      skipped: false,
    },
  ],
};

export const tests = [
  { testId: "t4", state: "COMPLETED", createdAt: day(1) },
  { testId: "t3", state: "COMPLETED", createdAt: day(9) },
  { testId: "t5", state: "PART2_PREP", createdAt: day(0.2) },
  { testId: "t2", state: "COMPLETED", createdAt: day(21) },
  { testId: "t1", state: "COMPLETED", createdAt: day(30) },
];

export const leaderboard = (period: string) => ({
  period,
  updatedAt: new Date().toISOString(),
  totalParticipants: 14,
  yourEntry: { rank: 3, bestBand: 6.5, testsCompleted: 4 },
  entries: [
    { rank: 1, displayName: "Amara", bestBand: 7.5, testsCompleted: 9, isYou: false },
    { rank: 2, displayName: "Jun", bestBand: 7, testsCompleted: 5, isYou: false },
    { rank: 3, displayName: "Shots Learner", bestBand: 6.5, testsCompleted: 4, isYou: true },
    { rank: 5, displayName: "Diego", bestBand: 6, testsCompleted: 2, isYou: false },
  ],
});
