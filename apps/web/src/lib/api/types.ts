export type User = {
  id: string;
  displayName?: string;
  email?: string;
  consentRequired: boolean;
  consentVersion?: string;
};

export type Turn = {
  id: string;
  answerId: string;
  part: number;
  sortOrder: number;
  promptText: string;
  timingSeconds?: number;
  cueCard?: { title?: string; prompts?: string[] };
  followUps?: string[];
  answerStatus: string;
  hasExaminerAudio: boolean;
  isFollowUp?: boolean;
  isIntro?: boolean;
  playbackAvailable?: boolean;
  transcriptText?: string | null;
  speechRateWpm?: number;
  speechRateWarning?: boolean;
  accentNote?: string | null;
};

export type TestSession = {
  testId: string;
  state: string;
  revision: number;
  turns: Turn[];
  currentTurn?: Turn | null;
  permittedActions: string[];
  reportId?: string | null;
  expiresAt?: string;
  part2PrepSeconds?: number;
};

export type TestListItem = {
  testId: string;
  state: string;
  createdAt?: string;
};

export type RealtimeSession = {
  sessionId: string;
  transport: string;
  state: string;
  phase: string;
  llmModel: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  wsUrl?: string | null;
  examinerPlaybackUrl?: string | null;
  currentTurnId?: string | null;
  test: TestSession;
};

export type TestStatus = {
  state: string;
  stage: string;
  progress: number;
  reportId?: string;
  error?: string;
};

export type CriterionScore = {
  criterion: string;
  band: number | null;
  confidence: string;
  subdimensions: { key: string; band: number }[];
  evidence?: { quote?: string; note?: string; practice?: string }[];
};

export type PronunciationPart = {
  unclearWords?: string[];
  issues?: string[];
  wordsPerMinute?: number;
  pauseCount?: number;
  coverage?: number;
  confidence?: string;
  modelNotes?: { findings?: string[]; notes?: string[] } | null;
};

export type VocabularyInsights = {
  hasContent: boolean;
  stats: { label: string; value: string }[];
  wordsYouUsed: string[];
  lexicalHighlights: { quote?: string; note?: string; practice?: string }[];
  phraseFixes: { type?: string; quote?: string; correction?: string; note?: string; practice?: string }[];
  grammarWordChoices: { type?: string; quote?: string; correction?: string; note?: string; practice?: string }[];
  coachingTips: string[];
};

export type FluencyInsights = {
  band?: number | null;
  confidence?: string;
  metrics: { label: string; value: string; status: "good" | "watch" | "low"; hint?: string }[];
  observations: { kind: string; title: string; body: string; quote?: string }[];
  focusNext: string[];
};

export type PronunciationInsights = {
  practiceWords: string[];
  improvements: { title: string; detail: string; action: string }[];
  findings: string[];
  notes: string[];
  accentNote?: string | null;
  disclaimer: string;
};

export type ReportComparison = {
  hasPrevious: boolean;
  previousTestAt?: string;
  previousOverallBand?: number | null;
  overallDelta?: number | null;
  criterionChanges?: {
    criterion: string;
    label: string;
    current: number | null;
    previous: number | null;
    delta: number | null;
    direction: "up" | "down" | "stable" | "unavailable";
  }[];
  improvedAreas?: string[];
  minorGains?: string[];
  stillWorkingOn?: string[];
  mistakeTrends?: {
    resolved: { type?: string; quote?: string; correction?: string }[];
    recurring: { type?: string; quote?: string; correction?: string }[];
    newIssues: { type?: string; quote?: string; correction?: string }[];
  };
};

export type Report = {
  scoreReadiness?: { reasons: string[]; recordedSeconds?: number; audioCoverage?: number; minimumTests: number };
  reportId: string;
  testId: string;
  overallBand?: number;
  confidenceLabel: string;
  criteria: CriterionScore[];
  strengths: string[];
  improvements: string[];
  minorImprovements?: string[];
  progressComparison?: ReportComparison;
  exampleRewrites: { original?: string; saferRewrite?: string }[];
  practicePlan: { days?: { day: number; focus: string; task: string; minutes?: number; successCriteria?: string }[] };
  disclaimer: string;
  evaluatorVersion: string;
  rubricVersion: string;
  modelPolicyVersion: string;
  createdAt: string;
  isInconclusive?: boolean;
  transcripts?: { part: number; promptText: string; text: string }[];
  pronunciation?: PronunciationPart[];
  mistakes?: { type?: string; quote?: string; correction?: string; note?: string; practice?: string }[];
  fluency?: string[];
  accentNote?: string | null;
  vocabularyInsights?: VocabularyInsights;
  fluencyInsights?: FluencyInsights;
  pronunciationInsights?: PronunciationInsights;
};

export type ExamHistoryEntry = {
  testId: string;
  reportId: string;
  date: string;
  examIndex: number;
  label: string;
  overallBand: number;
  criteria: Record<string, number>;
};

export type ExamJourney = {
  fromLabel: string;
  toLabel: string;
  firstOverallBand: number;
  lastOverallBand: number;
  overallDelta: number;
  criteria: {
    criterion: string;
    firstBand: number;
    lastBand: number;
    delta: number;
  }[];
};

export type ExamHistoryOverview = {
  exams: ExamHistoryEntry[];
  lifetimeOverallBand?: number | null;
  scoredExamCount: number;
  journey?: ExamJourney | null;
};

export type ProgressOverview = {
  overallEstimate?: number | null;
  scoredTests?: number;
  estimateSampleSize?: number;
  observedLow?: number | null;
  observedHigh?: number | null;
  latestReportId?: string | null;
  overallTrend: string;
  sampleSize: number;
  confidence: string;
  latestBand?: number;
  testsCompleted?: number;
  weakestSkill?: string;
  criterionStats?: { criterion: string; averageBand?: number; samples: number }[];
  activeGoal?: { targetBand: number; targetDate: string; focusSkills: string[] };
  priorities: string[];
  timeline: { testId: string; date: string; overallBand?: number; reportId: string }[];
  examHistory?: ExamHistoryOverview;
  actions: { id: string; description: string; category: string; completed: boolean; skipped: boolean }[];
};

export type DeviceCheckPayload = {
  sampleDurationMs: number;
  silenceRatio: number;
  clippingRatio: number;
  microphoneAvailable: boolean;
  speakerAvailable: boolean;
};

export type GoalInput = {
  targetBand: number;
  targetDate: string;
  focusSkills: string[];
};

export type ActionPatch = {
  completed?: boolean;
  skipped?: boolean;
};

export type UploadCompletePayload = {
  objectKey?: string;
  contentSha256?: string;
  mimeType?: string;
  sizeBytes?: number;
  [key: string]: unknown;
};

export type LeaderboardPeriod = "today" | "week" | "overall";
export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  bestBand: number;
  testsCompleted: number;
  isYou: boolean;
};
export type Leaderboard = {
  period: LeaderboardPeriod;
  startsAt: string | null;
  updatedAt: string;
  totalParticipants: number;
  entries: LeaderboardEntry[];
  yourEntry: LeaderboardEntry | null;
};
