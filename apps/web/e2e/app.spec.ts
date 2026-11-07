import { expect, test, type Page, type Route } from "@playwright/test";
import * as fx from "./fixtures";

type MockState = { signedIn: boolean; consentRequired: boolean; deleted: boolean; calls: string[] };

/** Route every API call to an in-memory fake so the suite needs no backend. */
async function mockApi(page: Page, initial: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = { signedIn: false, consentRequired: false, deleted: false, calls: [], ...initial };
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const ok = (route: Route, data: unknown) => json(route, 200, { data });
  const error = (route: Route, status: number, code: string, message: string) => json(route, status, { error: { code, message } });
  const me = () => ({
    ...fx.user,
    consentRequired: state.consentRequired,
    consentVersion: state.consentRequired ? "2026-01-01" : fx.user.consentVersion,
  });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/v1/, "");
    const method = request.method();
    state.calls.push(`${method} ${path}`);

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/auth/refresh") return error(route, 400, "AUTH_REQUIRED", "No session");
    if (path === "/auth/login" && method === "POST") {
      const body = request.postDataJSON() as { email: string; password: string };
      if (body.password !== "Correct-horse-battery-9") return error(route, 400, "INVALID_CREDENTIALS", "Invalid email or password");
      state.signedIn = true;
      return ok(route, me());
    }
    if (path === "/auth/register" && method === "POST") {
      const body = request.postDataJSON() as { accept_terms?: boolean; acceptTerms?: boolean };
      if (!(body.accept_terms ?? body.acceptTerms)) return error(route, 400, "VALIDATION_FAILED", "Accept the terms to create an account");
      state.signedIn = true;
      state.consentRequired = false;
      return ok(route, me());
    }
    if (path === "/auth/logout") {
      state.signedIn = false;
      return ok(route, { deleted: true });
    }
    if (!state.signedIn || state.deleted) return error(route, 401, "AUTH_REQUIRED", "Authentication required");

    if (path === "/me" && method === "GET") return ok(route, me());
    if (path === "/me/consent" && method === "POST") {
      state.consentRequired = false;
      return ok(route, me());
    }
    if (path === "/me" && method === "DELETE") {
      state.deleted = true;
      state.signedIn = false;
      return ok(route, { deleted: true });
    }
    if (state.consentRequired && path.startsWith("/tests") && method === "POST")
      return error(route, 403, "CONSENT_REQUIRED", "Accept the policies first");
    if (path === "/tests" && method === "GET") return ok(route, fx.tests);
    if (path === "/tests" && method === "POST") return ok(route, { testId: "t-new", state: "CREATED" });
    if (path.startsWith("/tests/") && method === "DELETE") return route.fulfill({ status: 204 });
    if (path === "/progress/overview") return ok(route, fx.progress);
    if (path === "/progress/goals/current") return ok(route, { targetBand: 7, targetDate: new Date().toISOString(), focusSkills: [] });
    if (path.startsWith("/progress/actions/")) return ok(route, { ok: true });
    if (path === "/reports/fixture-report") return ok(route, fx.report);
    if (path === "/leaderboard") return ok(route, fx.leaderboard(url.searchParams.get("period") ?? "today"));
    return error(route, 404, "NOT_FOUND", `No mock for ${method} ${path}`);
  });
  return state;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(fx.user.email);
  await page.getByLabel("Password", { exact: true }).fill("Correct-horse-battery-9");
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("landing page is public and leads to sign-up", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your voice/i })).toBeVisible();
  await page.getByRole("link", { name: /find your starting point/i }).click();
  await expect(page).toHaveURL(/\/start/);
  await expect(page.getByText("11–14 minutes", { exact: true })).toBeVisible();
});

test("sign-up requires the consent checkbox", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/login?mode=register");
  await page.getByLabel("Name", { exact: true }).fill("New Learner");
  await page.getByLabel("Email", { exact: true }).fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct-horse-battery-9");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/agree|accept|consent/i).first()).toBeVisible();
  expect(state.calls).not.toContain("POST /auth/register");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  expect(state.calls).toContain("POST /auth/register");
});

test("wrong password shows the server message without leaking details", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(fx.user.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a policy update blocks practice until the learner re-consents", async ({ page }) => {
  const state = await mockApi(page, { consentRequired: true });
  await signIn(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/terms have been updated/i)).toBeVisible();
  const agree = dialog.getByRole("button", { name: /agree and continue/i });
  await expect(agree).toBeDisabled();
  for (const box of await dialog.getByRole("checkbox").all()) await box.click();
  await expect(agree).toBeEnabled();
  await agree.click();
  await expect(dialog).toBeHidden();
  expect(state.calls).toContain("POST /me/consent");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("dashboard shows stats, history and the resume path", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: /welcome back, shots/i })).toBeVisible();
  await expect(page.getByText("Latest band")).toBeVisible();
  await expect(page.getByText("6.5", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /resume practice/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /view report/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /completed/i }).click();
  await expect(page.getByText(/in progress/i)).toHaveCount(0);
});

test("report page renders every section and the section nav", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await page.goto("/reports/fixture-report");
  await expect(page.getByRole("heading", { name: /your speaking report/i })).toBeVisible();
  await expect(page.getByText(/overall band 6.5/i)).toBeVisible();
  const nav = page.getByRole("navigation", { name: /report sections/i });
  await expect(nav.getByRole("link", { name: /practice plan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /seven-day practice plan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /your conversation, in words/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /compared with your last test/i })).toBeVisible();
});

test("progress page draws the charts and keeps the goal form", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: /skill trends across tests/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /band scores across 4 tests/i })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(5); // header + 4 exams
  await expect(page.getByRole("button", { name: /update goal/i })).toBeVisible();
  await expect(page.getByText("1/2 done")).toBeVisible();
  await page.getByRole("button", { name: /mark done/i }).click();
  await expect.poll(() => page.url()).toContain("/progress");
});

test("leaderboard highlights the learner and switches periods", async ({ page }) => {
  const state = await mockApi(page);
  await signIn(page);
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: /top performers/i })).toBeVisible();
  await expect(page.getByText("#3 · Band 6.5")).toBeVisible();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /this week/i }).click();
  await expect.poll(() => state.calls.filter((c) => c.startsWith("GET /leaderboard")).length).toBeGreaterThanOrEqual(2);
});

test("deleting the account signs the learner out", async ({ page }) => {
  const state = await mockApi(page);
  await signIn(page);
  await page.getByRole("button", { name: /account & data settings/i }).click();
  await page.getByRole("button", { name: /delete account/i }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /delete everything/i }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(state.calls).toContain("DELETE /me");
});

test("a network outage shows a friendly error, not a crash", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await page.route("**/v1/progress/overview", (route) => route.abort("connectionrefused"));
  await page.goto("/progress");
  await expect(page.getByText(/couldn’t reach the server/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
});
