import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, onConsentRequired, request } from "./client";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("request", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unwraps the data envelope and sends credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "u1" } }));
    await expect(request<{ id: string }>("/me")).resolves.toEqual({ id: "u1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/me$/);
    expect(init.credentials).toBe("include");
  });

  it("turns network failures into a friendly NETWORK error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(request("/auth/login", { method: "POST" })).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("rejects non-JSON bodies instead of exposing server internals", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }),
    );
    const error = (await request("/auth/login", { method: "POST" }).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.message).not.toMatch(/Bad Gateway/);
  });

  it("surfaces the server error code and message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: { code: "RATE_LIMITED", message: "Too many requests" } }));
    await expect(request("/auth/login", { method: "POST" })).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("broadcasts CONSENT_REQUIRED so the app can show the consent dialog", async () => {
    const listener = vi.fn();
    const unsubscribe = onConsentRequired(listener);
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: { code: "CONSENT_REQUIRED", message: "Accept the policies" } }));
    await expect(request("/tests", { method: "POST" })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("retries once through the refresh endpoint after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "expired" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // POST /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));
    await expect(request("/me")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/refresh$/);
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(request("/tests/t1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
