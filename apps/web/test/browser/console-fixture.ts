import type { Page } from "@playwright/test";

export const CONSOLE_ORDINARY_USER = {
  email: "playwright-member@example.test",
  name: "Playwright Member",
  password: "Fugue console member 2026!",
} as const;

export const CONSOLE_ADMIN_USER = {
  email: "playwright-admin@example.test",
  name: "Playwright Admin",
  password: "Fugue console admin 2026!",
} as const;

export const CONSOLE_BLOCK_TARGET_USER = {
  email: "playwright-block-target@example.test",
  name: "Playwright Block Target",
  password: "Fugue block target 2026!",
} as const;

export const CONSOLE_DELETE_TARGET_USER = {
  email: "playwright-delete-target@example.test",
  name: "Playwright Delete Target",
  password: "Fugue delete target 2026!",
} as const;

export const CONSOLE_DEMOTE_TARGET_USER = {
  email: "playwright-demote-target@example.test",
  name: "Playwright Demote Target",
  password: "Fugue demote target 2026!",
} as const;

export type ConsoleFixtureUser =
  | typeof CONSOLE_ADMIN_USER
  | typeof CONSOLE_BLOCK_TARGET_USER
  | typeof CONSOLE_DELETE_TARGET_USER
  | typeof CONSOLE_DEMOTE_TARGET_USER
  | typeof CONSOLE_ORDINARY_USER;

export function hasConsoleDatabaseFixture() {
  return Boolean(
    process.env.PLAYWRIGHT_DATABASE_URL?.trim() ||
      process.env.TEST_DATABASE_URL?.trim(),
  );
}

export async function signInWithPassword(page: Page, user: ConsoleFixtureUser) {
  await page.goto("/auth/sign-in?returnTo=%2Fapp");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/password/sign-in") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await responsePromise;
  await page.waitForURL(/\/app$/);

  return response;
}
