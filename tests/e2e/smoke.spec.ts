import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end smoke tests. Run against a local server (offline AI templates) or the
 * deployed app (E2E_BASE_URL). They never create paid AI calls unless E2E_ALLOW_AI=1.
 */

async function demoLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Explore the live demo/ }).click();
  await page.waitForURL("**/dashboard");
}

test("landing page renders and links to sign up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("actually did it");
  await expect(page.getByRole("link", { name: /Start your first goal/ })).toBeVisible();
});

test("health endpoint reports a working database", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.db).toBe("configured");
  expect(body.migrations).toContain("0001_init.sql");
});

test("app pages redirect to login when signed out", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("demo account: dashboard, today, analytics, goal pages all load", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demoLogin(page);
  await expect(page.getByText("Today's focus")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Land a PM internship" })).toBeVisible();

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByText("30-second check-in").or(page.getByText("Checked in today"))).toBeVisible();

  await page.goto("/analytics");
  await expect(page.getByText("Consistency heatmap")).toBeVisible();
  await expect(page.getByText("Weekly completion rate")).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Land a PM internship/ }).last().click();
  await expect(page.getByText("Roadmap").first()).toBeVisible();
  await expect(page.getByText("People who did it")).toBeVisible();

  await page.getByRole("link", { name: "Research" }).click();
  await expect(page.getByText("How this research was verified")).toBeVisible();
  await expect(page.locator('a[href^="https://internshala.com"]').first()).toBeVisible();

  await page.getByRole("link", { name: "Reviews" }).click();
  await expect(page.getByText("Focus next:").first()).toBeVisible();

  await page.getByRole("link", { name: "Coach" }).click();
  await expect(page.getByText("AimTrack Coach")).toBeVisible();
  expect(errors).toEqual([]);
});

test("completing a task updates progress", async ({ page }) => {
  await demoLogin(page);
  await page.goto("/today");
  const box = page.getByRole("button", { name: /^Mark ".*" as done$/ }).first();
  if ((await box.count()) === 0) test.skip(true, "no pending task today");
  const before = await page.locator(".tabular.font-mono.text-3xl").first().innerText();
  await box.click();
  await expect(page.locator(".tabular.font-mono.text-3xl").first()).not.toHaveText(before);
});

test("goal wizard end-to-end (offline templates unless E2E_ALLOW_AI=1)", async ({ page, request, baseURL }) => {
  const health = await (await request.get("/api/health")).json();
  const local = /localhost|127\.0\.0\.1/.test(baseURL ?? "");
  test.skip((!local || health.ai !== "offline-templates") && !process.env.E2E_ALLOW_AI, "skip paid AI calls / test accounts on live deployments");
  test.setTimeout(300_000);
  // Use a fresh local account so the shared demo stays clean.
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-42");
  await page.getByRole("button", { name: /Create account/ }).click();
  await page.waitForURL("**/dashboard**");
  await page.goto("/goals/new");
  await page.getByLabel("Your goal").fill("Learn to swim 1 km freestyle by March");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("A few quick questions")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: /Research this goal/ }).click();
  await expect(page.getByRole("button", { name: /Run reality check/ })).toBeEnabled({ timeout: 240_000 });
  await page.getByRole("button", { name: /Run reality check/ }).click();
  await expect(page.getByRole("heading", { name: "Reality check" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: /Build my plan/ }).click();
  await page.waitForURL(/\/goals\/[0-9a-f-]{36}\?created=1/, { timeout: 240_000 });
  await expect(page.getByText("Your roadmap is ready")).toBeVisible();
  await expect(page.getByText("Phase 1:").first()).toBeVisible();
});
