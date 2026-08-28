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
  band: number;
  confidence: string;
  subdimensions: { key: string; band: number }[];
  evidence?: { quote?: string; note?: string }[];
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

export type Report = {
  reportId: string;
  testId: string;
  overallBand?: number;
  confidenceLabel: string;
  criteria: CriterionScore[];
  strengths: string[];
  improvements: string[];
  exampleRewrites: { original?: string; saferRewrite?: string }[];
  practicePlan: { days?: { day: number; focus: string; task: string }[] };
  disclaimer: string;
  evaluatorVersion: string;
  rubricVersion: string;
  modelPolicyVersion: string;
  createdAt: string;
  isInconclusive?: boolean;
  transcripts?: { part: number; promptText: string; text: string }[];
  pronunciation?: PronunciationPart[];
  mistakes?: { type?: string; quote?: string; correction?: string; note?: string }[];
  fluency?: string[];
};

export type ProgressOverview = {
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
