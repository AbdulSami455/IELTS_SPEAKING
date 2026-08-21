const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";
const TOKEN_KEY = "ielts_token";

export const API_BASE_URL = API_BASE;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init: RequestInit = {}, authed = true): Promise<T> {
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

export function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  const token = getToken();
  const url = new URL(`${base}${path}`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export async function fetchText(path: string): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.text();
}
