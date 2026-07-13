import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, type Page, test, type TestInfo } from "@playwright/test";

import {
  CONSOLE_ORDINARY_USER,
  hasConsoleDatabaseFixture,
  signInWithPassword,
} from "./console-fixture";

const releaseEvidenceDirectory = path.resolve(
  process.cwd(),
  "../../artifacts/visual/post-remediation",
);

async function captureReleaseEvidence(page: Page, testInfo: TestInfo, label: string) {
  const screenshotPath = path.join(
    releaseEvidenceDirectory,
    `${label}-${testInfo.project.name}.png`,
  );
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach(`${label}-${testInfo.project.name}`, {
    path: screenshotPath,
    contentType: "image/png",
  });
}

test("captures post-remediation desktop and mobile release evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "chromium-mobile"].includes(testInfo.project.name),
    "One deterministic desktop and mobile engine supplies the screenshot evidence.",
  );

  await mkdir(releaseEvidenceDirectory, { recursive: true });

  for (const [label, route] of [
    ["marketing", "/"],
    ["docs", "/docs"],
    ["auth-sign-in", "/auth/sign-in"],
    ["auth-sign-up", "/auth/sign-up"],
  ] as const) {
    await page.goto(route);
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await captureReleaseEvidence(page, testInfo, label);
  }
});

test("captures authenticated Console desktop and mobile release evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "chromium-mobile"].includes(testInfo.project.name),
    "One deterministic desktop and mobile engine supplies the screenshot evidence.",
  );
  test.skip(
    !hasConsoleDatabaseFixture(),
    "Authenticated Console evidence requires the isolated PostgreSQL fixture.",
  );

  await page.route("**/api/fugue/console/projects**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ errors: [], projects: [] }),
      contentType: "application/json",
      status: 200,
    });
  });

  await mkdir(releaseEvidenceDirectory, { recursive: true });
  const response = await signInWithPassword(page, CONSOLE_ORDINARY_USER);
  expect(response.status()).toBe(200);
  await expect(page.locator(".coss-console-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const refreshedProjects = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/api/fugue/console/projects") &&
      candidate.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  expect((await refreshedProjects).status()).toBe(200);
  await expect(page.getByText("0 projects shown")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Inventory partially loaded" }),
  ).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await captureReleaseEvidence(page, testInfo, "console");
});

test("mobile public header keeps a 30% expanded localized CTA visible", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "The narrow Chromium project supplies the deterministic expansion layout gate.",
  );

  await page.setViewportSize({ height: 800, width: 320 });
  await page.goto("/");
  await page.context().addCookies([
    {
      name: "fg_locale",
      url: page.url(),
      value: "zh-CN",
    },
  ]);
  await page.reload();

  const header = page.locator(".coss-site-header");
  const primaryCta = header.getByRole("link", { name: "开始使用" });
  await expect(primaryCta).toBeVisible();

  await header.locator("a, button, select").evaluateAll((controls) => {
    for (const control of controls) {
      if (control instanceof HTMLSelectElement) continue;
      const text = control.textContent?.trim() ?? "";
      if (!text) continue;
      control.textContent = `${text} ${"扩".repeat(Math.max(1, Math.ceil(text.length * 0.3)))}`;
    }
  });

  const layout = await header.evaluate((element) => {
    const cta = Array.from(element.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("开始使用"),
    );
    const ctaRect = cta?.getBoundingClientRect();

    return {
      ctaLeft: ctaRect?.left ?? -1,
      ctaRight: ctaRect?.right ?? Number.POSITIVE_INFINITY,
      headerClientWidth: element.clientWidth,
      headerScrollWidth: element.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.headerScrollWidth).toBeLessThanOrEqual(layout.headerClientWidth);
  expect(layout.ctaLeft).toBeGreaterThanOrEqual(0);
  expect(layout.ctaRight).toBeLessThanOrEqual(layout.viewportWidth);
});
