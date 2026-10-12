const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";

export const API_BASE_URL = API_BASE;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_MIME_PREFIXES = ["audio/"];
const CONSENT_EVENT = "ielts:consent-required";

/** Subscribe to CONSENT_REQUIRED responses (policy version changed mid-session). */
export function onConsentRequired(listener: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function canRefresh(path: string): boolean {
  return !path.startsWith("/auth/");
}

async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    // fetch only rejects for network-level failures (offline, DNS, CORS, aborted).
    throw new ApiError("We couldn’t reach the server. Check your connection and try again.", "NETWORK");
  }
}

export async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await safeFetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && !retried && canRefresh(path) && (await refreshSession())) {
    return request<T>(path, init, true);
  }
  if (response.status === 204) return undefined as T;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("The service is temporarily unavailable. Please try again.", "INVALID_RESPONSE", response.status);
  }
  let body: { data?: T; error?: { message?: string; code?: string } };
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The service returned an unreadable response. Please try again.", "INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    let errorMessage = body.error?.message ?? "Request failed";
    const code = body.error?.code ?? "ERROR";
    if (response.status === 401 && code !== "AUTH_REQUIRED") {
      errorMessage = "Session expired. Please sign in again.";
    }
    if (code === "CONSENT_REQUIRED") window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
    throw new ApiError(errorMessage, code, response.status);
  }
  return body.data as T;
}

export function wsUrl(path: string): string {
  // API_BASE may be absolute (dev) or a same-origin path such as "/v1" (production).
  const base = new URL(API_BASE, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  return base.toString();
}

export async function fetchText(path: string): Promise<string> {
  let response = await safeFetch(`${API_BASE}${path}`, { credentials: "include" });
  if (response.status === 401 && (await refreshSession())) {
    response = await safeFetch(`${API_BASE}${path}`, { credentials: "include" });
  }
  if (!response.ok) throw new ApiError("Could not download the report. Please try again.", "EXPORT_FAILED", response.status);
  return response.text();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

export { ALLOWED_MIME_PREFIXES };
