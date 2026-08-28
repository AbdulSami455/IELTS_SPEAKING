import { API_BASE_URL, ApiError, fetchText, logout, request, wsUrl } from "./client";
import type {
  ActionPatch,
  DeviceCheckPayload,
  GoalInput,
  ProgressOverview,
  RealtimeSession,
  Report,
  TestListItem,
  TestSession,
  TestStatus,
  UploadCompletePayload,
  User,
} from "./types";

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ user: User }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ email, password, displayName }) },
    ),
  login: (email: string, password: string) =>
    request<{ user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  me: () => request<User>("/me"),
  consent: () =>
    request<User>("/me/consent", {
      method: "POST",
      body: JSON.stringify({ version: "2026-08-18", accepted: true }),
    }),
  questionSets: () => request<{ slug: string; version: string; language: string }[]>("/question-sets"),
  createTest: () => request<TestSession>("/tests", { method: "POST" }),
  getTest: (id: string) => request<TestSession>(`/tests/${id}`),
  listTests: () => request<TestListItem[]>("/tests"),
  deviceCheck: (id: string, payload: DeviceCheckPayload) =>
    request<TestSession>(`/tests/${id}/device-check`, { method: "POST", body: JSON.stringify(payload) }),
  createRealtimeSession: (id: string) =>
    request<RealtimeSession>(`/tests/${id}/realtime/session`, { method: "POST" }),
  realtimeEvent: (id: string, payload: Record<string, unknown>) =>
    request<{ accepted: boolean }>(`/tests/${id}/realtime/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  realtimeSocketUrl: (id: string) => wsUrl(`/tests/${id}/realtime/live`),
   realtimeTurnAudio: async (testId: string, turnId: string, blob: Blob) => {
    if (!blob.type.startsWith("audio/")) {
      throw new ApiError("Expected an audio blob", "INVALID_MIME");
    }
    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("audio", blob, `turn-${turnId}.${extension}`);
    const response = await fetch(`${API_BASE_URL}/tests/${testId}/realtime/turns/${turnId}/audio`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) {
      throw new ApiError(body.error?.message ?? "Upload failed", body.error?.code ?? "ERROR");
    }
    return body.data as { test: TestSession; examinerPlaybackUrl?: string | null; nextTurnId?: string | null };
  },
  retakeTurn: (testId: string, turnId: string) =>
    request<TestSession>(`/tests/${testId}/turns/${turnId}/retake`, { method: "POST" }),
  startConversation: (id: string) =>
    request<TestSession>(`/tests/${id}/conversation/start`, { method: "POST" }),
  transition: (id: string, event: string, expectedRevision: number) =>
    request<TestSession>(`/tests/${id}/transitions`, {
      method: "POST",
      body: JSON.stringify({ event, expectedRevision }),
    }),
  uploadUrl: (testId: string, turnId: string) =>
    request<{ uploadUrl: string; headers: Record<string, string>; maxBytes: number }>(
      `/tests/${testId}/turns/${turnId}/response/upload`,
      { method: "POST" },
    ),
  uploadComplete: (testId: string, turnId: string, payload: UploadCompletePayload) =>
    request<TestSession>(`/tests/${testId}/turns/${turnId}/response/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submit: (id: string) => request<TestSession>(`/tests/${id}/submit`, { method: "POST" }),
  finish: (id: string) => request<TestSession>(`/tests/${id}/finish`, { method: "POST" }),
  status: (id: string) => request<TestStatus>(`/tests/${id}/status`),
  examinerAudio: (testId: string, questionId: string) =>
    request<{ playbackUrl: string }>(`/tests/${testId}/questions/${questionId}/examiner-audio`),
  answerPlayback: (testId: string, answerId: string) =>
    request<{ playbackUrl: string }>(`/tests/${testId}/answers/${answerId}/playback`),
  exportReport: (id: string) => fetchText(`/reports/${id}/export`),
  deleteAccount: () => request<{ deleted: boolean }>("/me", { method: "DELETE" }),
  report: (id: string) => request<Report>(`/reports/${id}`),
  progress: () => request<ProgressOverview>("/progress/overview"),
  saveGoal: (payload: GoalInput) =>
    request("/progress/goals/current", { method: "PUT", body: JSON.stringify(payload) }),
  patchAction: (id: string, payload: ActionPatch) =>
    request(`/practice-actions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTest: (id: string) => request(`/tests/${id}`, { method: "DELETE" }),
};

export { ApiError, logout };
export type {
  ActionPatch,
  CriterionScore,
  DeviceCheckPayload,
  GoalInput,
  ProgressOverview,
  PronunciationPart,
  RealtimeSession,
  Report,
  TestListItem,
  TestSession,
  TestStatus,
  Turn,
  UploadCompletePayload,
  User,
} from "./types";
