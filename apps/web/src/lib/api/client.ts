const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";

export const API_BASE_URL = API_BASE;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ALLOWED_MIME_PREFIXES = ["audio/"];

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

export async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && !retried && canRefresh(path) && (await refreshSession())) {
    return request<T>(path, init, true);
  }
  if (response.headers.get("content-type")?.includes("text/html")) {
    return (await response.text()) as T;
  }
  const body = await response.json();
  if (!response.ok) {
    let errorMessage = body.error?.message ?? "Request failed";
    const code = body.error?.code ?? "ERROR";
    if (response.status === 401 && code !== "AUTH_REQUIRED") {
      errorMessage = "Session expired. Please sign in again.";
    }
    throw new ApiError(errorMessage, code);
  }
  return body.data as T;
}

export function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  const url = new URL(`${base}${path}`);
  return url.toString();
}

export async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });
  return response.text();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

export { ALLOWED_MIME_PREFIXES };
