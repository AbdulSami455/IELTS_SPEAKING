const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";
const TOKEN_KEY = "ielts_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, authed = true): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (authed && token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.headers.get("content-type")?.includes("text/html")) {
    return (await response.text()) as T;
  }
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body.error?.message ?? "Request failed", body.error?.code ?? "ERROR");
  }
  return body.data as T;
}

export type User = {
  id: string;
  displayName?: string;
  email?: string;
  consentRequired: boolean;
  consentVersion?: string;
};

export type Question = {
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
};

export type TestSession = {
  testId: string;
  state: string;
  revision: number;
  questions: Question[];
  permittedActions: string[];
  reportId?: string | null;
  expiresAt?: string;
  part2PrepSeconds?: number;
};

export type Report = {
  reportId: string;
  testId: string;
  overallBand?: number;
  confidenceLabel: string;
  criteria: {
    criterion: string;
    band: number;
    confidence: string;
    subdimensions: { key: string; band: number }[];
    evidence?: { quote?: string; note?: string }[];
  }[];
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
  pronunciation?: {
    unclearWords?: string[];
    issues?: string[];
    wordsPerMinute?: number;
    pauseCount?: number;
    coverage?: number;
    confidence?: string;
    modelNotes?: { findings?: string[]; notes?: string[] } | null;
  }[];
  mistakes?: { type?: string; quote?: string; correction?: string; note?: string }[];
  fluency?: string[];
};

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: User }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ email, password, displayName }) },
      false,
    ),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    ),
  me: () => request<User>("/me"),
  consent: () => request<User>("/me/consent", { method: "POST", body: JSON.stringify({ version: "2026-08-18", accepted: true }) }),
  questionSets: () => request<{ slug: string; version: string; language: string }[]>("/question-sets"),
  createTest: (slug?: string) =>
    request<TestSession>(`/tests${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`, { method: "POST" }),
  getTest: (id: string) => request<TestSession>(`/tests/${id}`),
  listTests: () => request<{ testId: string; state: string; createdAt?: string }[]>("/tests"),
  deviceCheck: (id: string, payload: object) =>
    request<TestSession>(`/tests/${id}/device-check`, { method: "POST", body: JSON.stringify(payload) }),
  transition: (id: string, event: string, expectedRevision: number) =>
    request<TestSession>(`/tests/${id}/transitions`, {
      method: "POST",
      body: JSON.stringify({ event, expectedRevision }),
    }),
  uploadUrl: (testId: string, answerId: string) =>
    request<{ uploadUrl: string; headers: Record<string, string>; maxBytes: number }>(
      `/tests/${testId}/answers/${answerId}/upload`,
      { method: "POST" },
    ),
  uploadComplete: (testId: string, answerId: string, payload: object) =>
    request<TestSession>(`/tests/${testId}/answers/${answerId}/upload-complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submit: (id: string) => request<TestSession>(`/tests/${id}/submit`, { method: "POST" }),
  status: (id: string) =>
    request<{ state: string; stage: string; progress: number; reportId?: string; error?: string }>(`/tests/${id}/status`),
  examinerAudio: (testId: string, questionId: string) =>
    request<{ playbackUrl: string }>(`/tests/${testId}/questions/${questionId}/examiner-audio`),
  answerPlayback: (testId: string, answerId: string) =>
    request<{ playbackUrl: string }>(`/tests/${testId}/answers/${answerId}/playback`),
  exportReport: async (id: string) => {
    const token = getToken();
    const response = await fetch(`${API_BASE}/reports/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.text();
  },
  deleteAccount: () => request<{ deleted: boolean }>("/me", { method: "DELETE" }),
  report: (id: string) => request<Report>(`/reports/${id}`),
  progress: () =>
    request<{
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
    }>("/progress/overview"),
  saveGoal: (payload: object) => request("/progress/goals/current", { method: "PUT", body: JSON.stringify(payload) }),
  patchAction: (id: string, payload: object) =>
    request(`/practice-actions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTest: (id: string) => request(`/tests/${id}`, { method: "DELETE" }),
};

export async function sha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
