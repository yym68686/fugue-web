import { expect, type Locator, type Page, test } from "@playwright/test";

import { PUBLIC_SERVER_ERROR } from "../../lib/security/public-error.mjs";

import {
  CONSOLE_ADMIN_USER,
  hasConsoleDatabaseFixture,
  signInWithPassword,
} from "./console-fixture";

type Theme = "dark" | "light";

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.themePreference = nextTheme;
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function readTextContrast(locator: Locator) {
  return locator.evaluate((element) => {
    type Rgba = { a: number; b: number; g: number; r: number };
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { colorSpace: "srgb" });

    if (!context) throw new Error("Canvas 2D is required for contrast sampling.");

    const parseColor = (value: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
      return { a: alpha / 255, b: b / 255, g: g / 255, r: r / 255 };
    };
    const composite = (foreground: Rgba, background: Rgba): Rgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { a: 0, b: 0, g: 0, r: 0 };
      return {
        a: alpha,
        b:
          (foreground.b * foreground.a +
            background.b * background.a * (1 - foreground.a)) /
          alpha,
        g:
          (foreground.g * foreground.a +
            background.g * background.a * (1 - foreground.a)) /
          alpha,
        r:
          (foreground.r * foreground.a +
            background.r * background.a * (1 - foreground.a)) /
          alpha,
      };
    };
    const resolvedBackground = (target: Element | null) => {
      const layers: Rgba[] = [];
      for (let node = target; node; node = node.parentElement) {
        layers.push(parseColor(getComputedStyle(node).backgroundColor));
      }

      return layers
        .reverse()
        .reduce((background, layer) => composite(layer, background), {
          a: 1,
          b: 1,
          g: 1,
          r: 1,
        });
    };
    const linearChannel = (channel: number) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    const luminance = (color: Rgba) =>
      0.2126 * linearChannel(color.r) +
      0.7152 * linearChannel(color.g) +
      0.0722 * linearChannel(color.b);
    const ratio = (first: Rgba, second: Rgba) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    const background = resolvedBackground(element);
    const computedColor = getComputedStyle(element).color;
    const foreground = composite(parseColor(computedColor), background);

    return {
      background,
      computedColor,
      ratio: ratio(foreground, background),
    };
  });
}

async function expectSmallTextContrast(locator: Locator, label: string) {
  const sample = await readTextContrast(locator);
  expect(sample.ratio, `${label}: ${JSON.stringify(sample)}`).toBeGreaterThanOrEqual(
    4.5,
  );
}

async function readFocusIndicatorContrast(locator: Locator) {
  const unfocusedShadow = await locator.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.evaluate(
    () => new Promise<void>((resolve) => window.setTimeout(resolve, 250)),
  );

  return locator.evaluate((element, before) => {
    type Rgba = { a: number; b: number; g: number; r: number };
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { colorSpace: "srgb" });

    if (!context) throw new Error("Canvas 2D is required for contrast sampling.");

    const parseColor = (value: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
      return { a: alpha / 255, b: b / 255, g: g / 255, r: r / 255 };
    };
    const composite = (foreground: Rgba, background: Rgba): Rgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { a: 0, b: 0, g: 0, r: 0 };
      return {
        a: alpha,
        b:
          (foreground.b * foreground.a +
            background.b * background.a * (1 - foreground.a)) /
          alpha,
        g:
          (foreground.g * foreground.a +
            background.g * background.a * (1 - foreground.a)) /
          alpha,
        r:
          (foreground.r * foreground.a +
            background.r * background.a * (1 - foreground.a)) /
          alpha,
      };
    };
    const resolvedBackground = (target: Element | null) => {
      const layers: Rgba[] = [];
      for (let node = target; node; node = node.parentElement) {
        layers.push(parseColor(getComputedStyle(node).backgroundColor));
      }
      return layers
        .reverse()
        .reduce((background, layer) => composite(layer, background), {
          a: 1,
          b: 1,
          g: 1,
          r: 1,
        });
    };
    const linearChannel = (channel: number) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    const luminance = (color: Rgba) =>
      0.2126 * linearChannel(color.r) +
      0.7152 * linearChannel(color.g) +
      0.0722 * linearChannel(color.b);
    const ratio = (first: Rgba, second: Rgba) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };
    const colorPattern =
      /(?:rgba?|hsla?|lab|lch|oklab|oklch|color)\([^)]*\)|#[\da-f]{3,8}/gi;
    const style = getComputedStyle(element);
    const adjacentBackground = resolvedBackground(element.parentElement);
    const indicatorColors = [
      ...(style.boxShadow.match(colorPattern) ?? []),
      ...(style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0
        ? [style.outlineColor]
        : []),
    ];
    const contrasts = indicatorColors.map((color) =>
      ratio(composite(parseColor(color), adjacentBackground), adjacentBackground),
    );

    return {
      after: style.boxShadow,
      before,
      indicatorColors,
      ratio: Math.max(0, ...contrasts),
    };
  }, unfocusedShadow);
}

function adminApp(id: string, phase: string, phaseTone: string) {
  return {
    canRebuild: true,
    createdExact: "July 12, 2026 at 12:00 AM",
    createdLabel: "just now",
    id,
    name: `Badge ${phase}`,
    ownerLabel: "contrast@example.test",
    phase,
    phaseTone,
    projectLabel: "Contrast project",
    resourceUsage: [],
    routeHref: null,
    routeLabel: "No route",
    serverLabel: "runtime-contrast",
    sourceHref: null,
    sourceLabel: "GitHub",
    stack: [],
  };
}

test.describe("rendered Console contrast", () => {
  test.skip(
    !hasConsoleDatabaseFixture(),
    "Rendered Console contrast requires an isolated PostgreSQL test database.",
  );

  test("Badge and Alert variants plus keyboard focus meet WCAG in light and dark", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Computed rendered colors are sampled once in desktop Chromium.",
    );

    const apps = [
      adminApp("badge-default", "default", "neutral"),
      adminApp("badge-success", "success", "positive"),
      adminApp("badge-warning", "warning", "warning"),
      adminApp("badge-destructive", "destructive", "danger"),
      adminApp("badge-info", "info", "info"),
    ];
    await page.route("**/api/fugue/admin/pages/apps**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          apps,
          errors: ["Contrast warning fixture."],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            limit: 50,
            nextCursor: null,
            previousCursor: null,
            sort: "created_at_desc",
            totalItems: apps.length,
          },
          summary: {
            appCount: apps.length,
            latestUpdateLabel: "just now",
            routedCount: 0,
            tenantCount: 1,
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route("**/api/admin/apps/badge-default/rebuild", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "503 Contrast operation failed." }),
        contentType: "application/json",
        status: 503,
      });
    });
    await page.route("**/api/fugue/console/runtime-targets**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          runtimeTargetInventoryError: null,
          runtimeTargets: [],
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    const service = {
      buildLogsOperationId: null,
      currentRuntimeId: "runtime-contrast",
      id: "app-contrast",
      kind: "app",
      locationLabel: "Contrast runtime",
      name: "contrast-web",
      networkMode: "default",
      persistentStorageMounts: [],
      phase: "running",
      phaseTone: "positive",
      preferredLogsMode: "runtime",
      primaryBadge: {
        id: "app-contrast:badge",
        kind: "runtime",
        label: "contrast-web",
        meta: "Contrast fixture",
      },
      replicaCount: 1,
      routeBaseDomain: "example.test",
      routeHref: "https://contrast.example.test",
      routeHostname: "contrast.example.test",
      routeInternalUrl: "http://contrast-web.internal:3000",
      routeLabel: "port 3000",
      routePathPrefix: "/",
      routePublicUrl: "https://contrast.example.test",
      runtimeId: "runtime-contrast",
      serviceBadges: [],
      serviceRole: "running",
    };
    await page.route(
      "**/api/fugue/console/projects/project-contrast",
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            initialDomains: {
              appId: service.id,
              data: null,
              error: "Contrast domains warning.",
            },
            project: {
              appCount: 1,
              defaultRuntimeId: "runtime-contrast",
              id: "project-contrast",
              name: "Contrast project",
              resourceUsage: [],
              resourceUsageSnapshot: {
                cpuMillicores: 10,
                ephemeralStorageBytes: 1024,
                memoryBytes: 2048,
              },
              serviceBadges: [],
              serviceCount: 1,
              services: [service],
            },
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );
    await page.route("**/api/fugue/apps/app-contrast/restart", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ operation: null, restartToken: "contrast" }),
        contentType: "application/json",
        status: 200,
      });
    });

    expect((await signInWithPassword(page, CONSOLE_ADMIN_USER)).status()).toBe(200);

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/app/apps");
      await setTheme(page, theme);
      for (const variant of ["default", "success", "warning", "destructive", "info"]) {
        await expectSmallTextContrast(
          page.locator('[data-slot="badge"]').filter({ hasText: variant }).first(),
          `${theme} Badge ${variant}`,
        );
      }

      const warning = page
        .locator('[data-slot="alert"]')
        .filter({ hasText: "Contrast warning fixture." });
      await expectSmallTextContrast(
        warning.locator('[data-slot="alert-title"]'),
        `${theme} warning Alert title`,
      );
      await expectSmallTextContrast(
        warning.locator('[data-slot="alert-description"]'),
        `${theme} warning Alert description`,
      );

      const refresh = page.getByRole("button", { name: "Refresh", exact: true });
      const focusSample = await readFocusIndicatorContrast(refresh);
      expect(focusSample.after).not.toBe(focusSample.before);
      expect(focusSample.indicatorColors.length).toBeGreaterThan(0);
      expect(
        focusSample.ratio,
        `${theme} focus indicator: ${JSON.stringify(focusSample)}`,
      ).toBeGreaterThanOrEqual(3);

      await page.getByRole("button", { name: "Rebuild", exact: true }).first().click();
      const dialog = page.getByRole("alertdialog", { name: "Rebuild Badge default" });
      await dialog.getByRole("button", { name: "Rebuild", exact: true }).click();
      const error = page
        .locator('[data-slot="alert"]')
        .filter({ hasText: PUBLIC_SERVER_ERROR });
      await expect(error).not.toContainText("503 Contrast operation failed.");
      await expectSmallTextContrast(
        error.locator('[data-slot="alert-title"]'),
        `${theme} error Alert title`,
      );
      await expectSmallTextContrast(
        error.locator('[data-slot="alert-description"]'),
        `${theme} error Alert description`,
      );

      await page.goto("/new/template/contrast-alert");
      await setTheme(page, theme);
      const info = page.locator('[data-slot="alert"]').filter({
        hasText: "Template: contrast-alert",
      });
      await expectSmallTextContrast(
        info.locator('[data-slot="alert-title"]'),
        `${theme} info Alert title`,
      );
      await expectSmallTextContrast(
        info.locator('[data-slot="alert-description"]'),
        `${theme} info Alert description`,
      );

      await page.goto("/app/projects/project-contrast");
      await setTheme(page, theme);
      const domainWarning = page
        .locator('[data-slot="alert"]')
        .filter({ hasText: "Contrast domains warning." });
      await expect(domainWarning).toBeVisible();
      const restart = page.getByRole("button", { name: "Restart", exact: true });
      await restart.click();
      await page
        .getByRole("alertdialog", { name: "Restart app" })
        .getByRole("button", { name: "Restart", exact: true })
        .click();
      const success = page
        .locator('[data-slot="alert"]')
        .filter({ hasText: "Restart requested" });
      await expectSmallTextContrast(
        success.locator('[data-slot="alert-title"]'),
        `${theme} success Alert title`,
      );
      await expectSmallTextContrast(
        success.locator('[data-slot="alert-description"]'),
        `${theme} success Alert description`,
      );
    }
  });
});
