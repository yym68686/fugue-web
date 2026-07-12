import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CONSOLE_ORDINARY_USER,
  hasConsoleDatabaseFixture,
  signInWithPassword,
} from "./console-fixture";

type AxeViolationSummary = {
  help: string;
  id: string;
  impact: string | null;
  targets: string[];
};

async function expectNoSeriousAxeViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations: AxeViolationSummary[] = results.violations
    .filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    )
    .map((violation) => ({
      help: violation.help,
      id: violation.id,
      impact: violation.impact ?? null,
      targets: violation.nodes.map((node) => JSON.stringify(node.target)),
    }));

  expect(violations, `${context} has Critical/Serious axe violations`).toEqual([]);
}

test.describe("critical route accessibility", () => {
  for (const route of ["/", "/docs", "/auth/sign-in", "/auth/sign-up"]) {
    test(`${route} has no Critical or Serious axe violations`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoSeriousAxeViolations(page, route);
    });
  }

  test("the protected route redirects to an accessible noindex auth surface", async ({
    page,
  }) => {
    await page.goto("/app");
    await page.waitForURL(/\/auth\/sign-in\?returnTo=%2Fapp$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex.*nofollow/,
    );
    await expectNoSeriousAxeViolations(page, "redirected /app");
  });

  test("the authenticated ordinary-user Console and open Select are accessible", async ({
    page,
  }) => {
    test.skip(
      !hasConsoleDatabaseFixture(),
      "Authenticated Console axe requires an isolated PostgreSQL test database.",
    );
    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });

    const signInResponse = await signInWithPassword(page, CONSOLE_ORDINARY_USER);
    expect(signInResponse.status()).toBe(200);
    await expect(page.locator(".coss-console-shell")).toBeVisible();
    await expect(page.getByText("No projects yet", { exact: true })).toBeVisible();
    await expect(
      page.locator(".coss-sidebar").getByRole("link", { name: "Apps" }),
    ).toHaveCount(0);
    await expectNoSeriousAxeViolations(page, "authenticated ordinary-user /app");

    const lifecycle = page.getByRole("combobox", { name: "Filter lifecycle" });
    await lifecycle.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expectNoSeriousAxeViolations(page, "authenticated /app lifecycle Select");
  });

  test("the Base UI drawer remains accessible while modal", async ({ page }) => {
    await page.route("**/api/fugue/console/runtime-targets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          runtimeTargetInventoryError: null,
          runtimeTargets: [],
        }),
      });
    });
    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/fugue/console/runtime-targets"),
    );
    await page.goto("/new/repository");
    await runtimeResponse;
    await page.getByRole("button", { name: "Open runtime target picker" }).click();
    await expect(page.getByRole("dialog", { name: "Runtime target" })).toBeVisible();
    await expectNoSeriousAxeViolations(page, "runtime target drawer");
  });

  test("Base UI Tabs, Dialog, and Table satisfy keyboard and axe contracts", async ({
    page,
  }) => {
    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "fugue-base-ui-contract-"),
    );
    const bundlePath = path.join(temporaryDirectory, "harness.js");
    const fixturePath = path.resolve(
      process.cwd(),
      "test/browser/fixtures/base-ui-contract-harness.tsx",
    );

    try {
      const build = spawnSync(
        "bun",
        [
          "build",
          fixturePath,
          "--outfile",
          bundlePath,
          "--target=browser",
          "--format=iife",
          "--minify",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: process.env,
        },
      );
      expect(
        build.status,
        `Base UI harness build failed: ${build.stderr || build.stdout}`,
      ).toBe(0);

      await page.setContent(`<!doctype html>
        <html lang="en">
          <head><title>Base UI contract harness</title></head>
          <body><div id="contract-root"></div></body>
        </html>`);
      await page.addScriptTag({ path: bundlePath });
      await expect(page.locator("body")).toHaveAttribute(
        "data-contract-harness",
        "ready",
      );

      const tablist = page.getByRole("tablist", { name: "Deployment views" });
      const overview = tablist.getByRole("tab", { name: "Overview" });
      const settings = tablist.getByRole("tab", { name: "Settings" });
      const history = tablist.getByRole("tab", { name: "History" });
      await expect(tablist.getByRole("tab")).toHaveCount(3);
      await expect(overview).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("table", { name: "Deployment inventory" }),
      ).toBeVisible();

      await overview.focus();
      await page.keyboard.press("ArrowRight");
      await expect(settings).toBeFocused();
      await expect(settings).toHaveAttribute("aria-selected", "false");
      await page.keyboard.press("Enter");
      await expect(settings).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel")).toContainText("Deployment settings");
      await page.keyboard.press("End");
      await expect(history).toBeFocused();
      await page.keyboard.press("Space");
      await expect(history).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Home");
      await expect(overview).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(overview).toHaveAttribute("aria-selected", "true");

      const trigger = page.getByRole("button", { name: "Open resource details" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Resource details" });
      await expect(dialog).toBeVisible();
      await expectNoSeriousAxeViolations(page, "Base UI contract harness dialog");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      await expectNoSeriousAxeViolations(page, "Base UI Tabs and Table harness");
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
