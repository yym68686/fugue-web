import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import { PUBLIC_SERVER_ERROR } from "../../lib/security/public-error.mjs";

import {
  CONSOLE_ADMIN_USER,
  CONSOLE_BLOCK_TARGET_USER,
  CONSOLE_DELETE_TARGET_USER,
  CONSOLE_DEMOTE_TARGET_USER,
  CONSOLE_ORDINARY_USER,
  type ConsoleFixtureUser,
  hasConsoleDatabaseFixture,
  signInWithPassword,
} from "./console-fixture";

type ProjectResponseMode = "error" | "loading" | "ready";

async function installProjectBffFixture(page: Page) {
  let mode: ProjectResponseMode = "loading";
  let releaseLoading: (() => void) | undefined;
  const loadingGate = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });

  await page.route("**/api/fugue/console/projects", async (route) => {
    if (mode === "loading") {
      await loadingGate;
    }

    if (mode === "error") {
      await route.fulfill({
        body: JSON.stringify({ error: "Test control plane unavailable." }),
        contentType: "application/json",
        status: 503,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ errors: [], projects: [] }),
      contentType: "application/json",
      status: 200,
    });
  });

  return {
    failNextRequest() {
      mode = "error";
    },
    releaseEmptyResponse() {
      mode = "ready";
      releaseLoading?.();
    },
  };
}

function expectNoAdminNavigationPayload(payload: string) {
  expect(payload).not.toContain('href="/app/apps"');
  expect(payload).not.toContain('href="/app/users"');
  expect(payload).not.toContain('href="/app/cluster"');
  expect(payload).not.toContain('"/app/apps"');
  expect(payload).not.toContain('"/app/users"');
  expect(payload).not.toContain('"/app/cluster"');
  expect(payload).not.toContain('"admin":"Admin"');
  expect(payload).not.toContain('\\"admin\\":\\"Admin\\"');
}

async function focusWithKeyboard(page: Page, target: Locator, maxTabs = 40) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (
      await target
        .evaluate((element) => document.activeElement === element)
        .catch(() => false)
    ) {
      return;
    }

    await page.keyboard.press("Tab");
  }

  await expect(target).toBeFocused();
}

async function expectCurrentCookieValue(page: Page, expectedValue: string) {
  const current = (await page.context().cookies()).find(
    (cookie) => cookie.name === "fugue_session",
  );
  expect(current?.value).toBe(expectedValue);
}

async function readOldSessionCookie(page: Page, user: ConsoleFixtureUser) {
  const response = await signInWithPassword(page, user);
  expect(response.status()).toBe(200);
  const cookie = (await page.context().cookies()).find(
    (candidate) => candidate.name === "fugue_session",
  );
  expect(cookie?.value).toBeTruthy();
  return cookie?.value ?? "";
}

async function mockEmptyProjects(page: Page) {
  await page.route("**/api/fugue/console/projects", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ errors: [], projects: [] }),
      contentType: "application/json",
      status: 200,
    });
  });
}

async function openSessionRevocationFixture(input: {
  adminPage: Page;
  baseURL: string;
  browser: Browser;
  target: ConsoleFixtureUser;
}): Promise<{
  context: BrowserContext;
  oldCookie: string;
  targetPage: Page;
}> {
  await mockEmptyProjects(input.adminPage);
  expect((await signInWithPassword(input.adminPage, CONSOLE_ADMIN_USER)).status()).toBe(
    200,
  );

  const context = await input.browser.newContext({ baseURL: input.baseURL });
  const targetPage = await context.newPage();
  await mockEmptyProjects(targetPage);
  const oldCookie = await readOldSessionCookie(targetPage, input.target);
  return { context, oldCookie, targetPage };
}

type RenderedPanelSwitchMeasurement = {
  durationMs: number;
  endTime: number;
  startTime: number;
};

async function measureRenderedPanelSwitch(
  page: Page,
  {
    buttonName,
    cardTitle,
  }: {
    buttonName: string;
    cardTitle: string;
  },
) {
  const measurementKey = "__fugueRenderedPanelSwitchMeasurement";

  await page.evaluate(
    ({ buttonName: name, cardTitle: title, measurementKey: key }) => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent?.trim() === name,
      );
      if (!button) throw new Error(`Unable to instrument the ${name} panel trigger.`);

      const measurement = new Promise<RenderedPanelSwitchMeasurement>(
        (resolve, reject) => {
          let animationFrame = 0;
          let startedAt: number | undefined;
          const rejectMeasurement = (message: string) => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            reject(new Error(message));
          };
          const timeout = window.setTimeout(() => {
            rejectMeasurement(
              `The ${title} panel did not render within the measurement window.`,
            );
          }, 10_000);

          function checkNextRenderOpportunity(frameTime: number) {
            const titleIsRendered = [
              ...document.querySelectorAll<HTMLElement>('[data-slot="card-title"]'),
            ].some(
              (candidate) =>
                candidate.textContent?.trim() === title &&
                candidate.getClientRects().length > 0,
            );
            const switchStartedAt = startedAt;
            if (!titleIsRendered || switchStartedAt === undefined) {
              animationFrame = requestAnimationFrame(checkNextRenderOpportunity);
              return;
            }

            window.clearTimeout(timeout);
            resolve({
              durationMs: frameTime - switchStartedAt,
              endTime: frameTime,
              startTime: switchStartedAt,
            });
          }

          button.addEventListener(
            "click",
            (event) => {
              if (!event.isTrusted) {
                window.clearTimeout(timeout);
                rejectMeasurement("The panel performance gate requires trusted input.");
                return;
              }
              startedAt = performance.now();
              animationFrame = requestAnimationFrame(checkNextRenderOpportunity);
            },
            { capture: true, once: true },
          );
        },
      );

      Reflect.set(window, key, measurement);
    },
    { buttonName, cardTitle, measurementKey },
  );

  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const measurement = await page.evaluate(async (key) => {
    const pending = Reflect.get(window, key) as
      | Promise<RenderedPanelSwitchMeasurement>
      | undefined;
    if (!pending) throw new Error("The panel switch measurement was not installed.");
    try {
      return await pending;
    } finally {
      Reflect.deleteProperty(window, key);
    }
  }, measurementKey);

  return measurement;
}

test.describe("authenticated Console contracts", () => {
  test.skip(
    !hasConsoleDatabaseFixture(),
    "Authenticated Console tests require an isolated PostgreSQL test database.",
  );

  test("ordinary session keeps a stable, permission-trimmed and resilient shell", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The authenticated Console vertical slice runs once in desktop Chromium.",
    );

    const projects = await installProjectBffFixture(page);
    await page.route("**/api/fugue/console/pages/billing**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "Test billing control plane unavailable." }),
        contentType: "application/json",
        status: 503,
      });
    });

    const signInResponse = await signInWithPassword(page, CONSOLE_ORDINARY_USER);
    expect(signInResponse.status()).toBe(200);
    await expect(page.locator(".coss-console-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    const sessionResponse = await page.request.get("/api/auth/session");
    expect(sessionResponse.status()).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      authenticated: true,
      user: {
        email: CONSOLE_ORDINARY_USER.email,
        verified: true,
      },
    });
    const sessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "fugue_session",
    );
    expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });

    const desktopSidebar = page.locator(".coss-sidebar");
    await expect(desktopSidebar.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(desktopSidebar.getByRole("link", { name: "Apps" })).toHaveCount(0);
    await expect(desktopSidebar.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(desktopSidebar.getByRole("link", { name: "Cluster" })).toHaveCount(0);

    const htmlResponse = await page.request.get("/app");
    expect(htmlResponse.status()).toBe(200);
    expectNoAdminNavigationPayload(await htmlResponse.text());
    const flightResponse = await page.request.get("/app", {
      headers: { RSC: "1" },
    });
    expect(flightResponse.status()).toBe(200);
    expectNoAdminNavigationPayload(await flightResponse.text());

    const forbiddenAdminPage = await page.request.get("/app/apps", {
      maxRedirects: 0,
    });
    const forbiddenAdminBody = await forbiddenAdminPage.text();
    expect(forbiddenAdminBody).not.toContain("Admin apps");
    if (forbiddenAdminPage.status() === 200) {
      expect(forbiddenAdminBody).toContain("NEXT_REDIRECT;replace;/app;307;");
      expect(forbiddenAdminBody).toContain("__next-page-redirect");
    } else {
      expect([303, 307, 308]).toContain(forbiddenAdminPage.status());
      expect(forbiddenAdminPage.headers().location).toBe("/app");
    }

    await expect(page.getByText("No projects yet", { exact: true })).toBeVisible();
    const projectRefresh = page.getByRole("button", { name: "Refresh" });
    await projectRefresh.click();
    await expect(projectRefresh).toHaveAttribute("data-loading", "");
    await expect(projectRefresh).toBeDisabled();
    projects.releaseEmptyResponse();
    await expect(page.getByText("No projects yet", { exact: true })).toBeVisible();

    const lifecycle = page.getByRole("combobox", { name: "Filter lifecycle" });
    await lifecycle.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(lifecycle).toContainText("Idle");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    projects.failNextRequest();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Projects unavailable" }),
    ).toContainText(PUBLIC_SERVER_ERROR);
    await expect(page.getByText("Test control plane unavailable.")).toHaveCount(0);

    await page.locator(".coss-console-shell").evaluate((element) => {
      element.setAttribute("data-playwright-shell-identity", "stable");
      const state = { value: 0 };
      Reflect.set(window, "__fugueConsoleCls", state);
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) state.value += shift.value ?? 0;
        }
      });
      observer.observe({ buffered: true, type: "layout-shift" });
    });

    await desktopSidebar.getByRole("link", { name: "Billing" }).click();
    await page.waitForURL(/\/app\/billing$/);
    await expect(page.locator(".coss-console-shell")).toHaveAttribute(
      "data-playwright-shell-identity",
      "stable",
    );
    await expect(page.locator(".coss-sidebar")).toBeVisible();
    await expect(page.locator(".coss-topbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    const routeCls = await page.evaluate(() => {
      const state = Reflect.get(window, "__fugueConsoleCls") as
        | { value: number }
        | undefined;
      return state?.value ?? 0;
    });
    expect(routeCls).toBeLessThanOrEqual(0.1);
  });

  test("workbench panel switches stay responsive under 4x CPU throttle", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Chromium CDP supplies the deterministic 4x CPU throttle smoke.",
    );

    const appService = {
      buildLogsOperationId: null,
      currentRuntimeId: "runtime-playwright",
      id: "app-playwright",
      kind: "app",
      locationLabel: "Playwright runtime",
      name: "web",
      networkMode: "default",
      persistentStorageMounts: [],
      phase: "running",
      phaseTone: "positive",
      preferredLogsMode: "runtime",
      primaryBadge: {
        id: "app-playwright:badge",
        kind: "runtime",
        label: "web",
        meta: "Playwright fixture",
      },
      replicaCount: 1,
      routeBaseDomain: "example.test",
      routeHref: "https://playwright.example.test",
      routeHostname: "playwright.example.test",
      routeInternalUrl: "http://web.internal:3000",
      routeLabel: "port 3000",
      routePathPrefix: "/",
      routePublicUrl: "https://playwright.example.test",
      runtimeId: "runtime-playwright",
      serviceBadges: [],
      serviceRole: "running",
    };
    const projectDetail = {
      project: {
        appCount: 1,
        defaultRuntimeId: "runtime-playwright",
        id: "project-playwright",
        name: "Playwright project",
        resourceUsage: [],
        resourceUsageSnapshot: {
          cpuMillicores: 25,
          ephemeralStorageBytes: 1024,
          memoryBytes: 1024,
        },
        serviceBadges: [],
        serviceCount: 1,
        services: [appService],
      },
    };

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route(
      "**/api/fugue/console/projects/project-playwright",
      async (route) => {
        await route.fulfill({
          body: JSON.stringify(projectDetail),
          contentType: "application/json",
          status: 200,
        });
      },
    );
    await page.route("**/api/fugue/apps/app-playwright/domains", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ domains: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route("**/api/fugue/apps/app-playwright/env", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ env: { NODE_ENV: "production" } }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route(
      "**/api/fugue/apps/app-playwright/runtime-logs**",
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({ logs: "ready on port 3000" }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    const signInResponse = await signInWithPassword(page, CONSOLE_ORDINARY_USER);
    expect(signInResponse.status()).toBe(200);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    try {
      await page.goto("/app/projects/project-playwright");
      await expect(page.getByText("Routes", { exact: true })).toBeVisible();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      await page.evaluate(() => {
        const state = {
          eventTimings: [] as Array<{
            duration: number;
            interactionId: number;
            name: string;
            startTime: number;
          }>,
          longTasks: [] as Array<{ duration: number; startTime: number }>,
          stop() {},
        };
        Reflect.set(window, "__fugueWorkbenchPerformance", state);
        const supportedEntryTypes = PerformanceObserver.supportedEntryTypes;
        if (
          !supportedEntryTypes.includes("event") ||
          !supportedEntryTypes.includes("longtask")
        ) {
          throw new Error(
            "Chromium must support Event Timing and Long Tasks for this gate.",
          );
        }

        const recordLongTasks = (entries: PerformanceEntry[]) => {
          state.longTasks.push(
            ...entries.map((entry) => ({
              duration: entry.duration,
              startTime: entry.startTime,
            })),
          );
        };
        const recordEventTimings = (entries: PerformanceEntry[]) => {
          state.eventTimings.push(
            ...entries.map((entry) => {
              const event = entry as PerformanceEntry & {
                interactionId?: number;
              };
              return {
                duration: event.duration,
                interactionId: event.interactionId ?? 0,
                name: event.name,
                startTime: event.startTime,
              };
            }),
          );
        };
        const longTaskObserver = new PerformanceObserver((list) => {
          recordLongTasks(list.getEntries());
        });
        const eventObserver = new PerformanceObserver((list) => {
          recordEventTimings(list.getEntries());
        });
        longTaskObserver.observe({ type: "longtask" });
        eventObserver.observe({
          durationThreshold: 16,
          type: "event",
        } as PerformanceObserverInit);
        state.stop = () => {
          recordLongTasks(longTaskObserver.takeRecords());
          recordEventTimings(eventObserver.takeRecords());
          longTaskObserver.disconnect();
          eventObserver.disconnect();
        };
      });

      const environmentSwitch = await measureRenderedPanelSwitch(page, {
        buttonName: "Environment",
        cardTitle: "Environment",
      });
      await expect(page.getByText("NODE_ENV", { exact: true })).toBeVisible();
      await expect(page.getByText("production", { exact: true })).toBeVisible();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );

      const logsSwitch = await measureRenderedPanelSwitch(page, {
        buttonName: "Logs",
        cardTitle: "Logs",
      });
      await expect(page.getByText("ready on port 3000")).toBeVisible();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );

      const interactionWindows = [environmentSwitch, logsSwitch];
      const metrics = await page.evaluate((windows) => {
        const state = Reflect.get(window, "__fugueWorkbenchPerformance") as {
          eventTimings: Array<{
            duration: number;
            interactionId: number;
            name: string;
            startTime: number;
          }>;
          longTasks: Array<{ duration: number; startTime: number }>;
          stop: () => void;
        };
        state.stop();

        const overlapsAWindow = (entry: { duration: number; startTime: number }) =>
          windows.some(
            (window) =>
              entry.startTime < window.endTime &&
              entry.startTime + entry.duration > window.startTime,
          );
        const relevantEvents = state.eventTimings.filter(overlapsAWindow);
        const relevantLongTasks = state.longTasks.filter(overlapsAWindow);
        const maxOrNull = (values: number[]) =>
          values.length > 0 ? Math.max(...values) : null;
        const totalBlockingTimeMs = relevantLongTasks.reduce(
          (total, task) =>
            total +
            windows.reduce(
              (windowTotal, window) =>
                windowTotal +
                Math.max(
                  0,
                  Math.min(task.startTime + task.duration, window.endTime) -
                    Math.max(task.startTime + 50, window.startTime),
                ),
              0,
            ),
          0,
        );

        return {
          eventTimingMaxMs: maxOrNull(relevantEvents.map((entry) => entry.duration)),
          interactionEventTimingMaxMs: maxOrNull(
            relevantEvents
              .filter((entry) => entry.interactionId > 0)
              .map((entry) => entry.duration),
          ),
          longTaskCount: relevantLongTasks.length,
          longTaskMaxMs: maxOrNull(relevantLongTasks.map((entry) => entry.duration)),
          totalBlockingTimeMs,
        };
      }, interactionWindows);
      const report = {
        browser: testInfo.project.name,
        capturedAt: new Date().toISOString(),
        cpuThrottleRate: 4,
        interactionWindows,
        mode: "trusted click dispatch-to-target next render opportunity; not field INP",
        panelSwitches: {
          environmentMs: environmentSwitch.durationMs,
          logsMs: logsSwitch.durationMs,
        },
        metrics,
        route: "/app/projects/project-playwright",
      };
      const outputDirectory = path.resolve(
        process.cwd(),
        "../../artifacts/performance",
      );
      await mkdir(outputDirectory, { recursive: true });
      const outputPath = path.join(outputDirectory, "console-workbench-4x-cpu.json");
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await testInfo.attach("console-workbench-4x-cpu.json", {
        contentType: "application/json",
        path: outputPath,
      });

      expect(environmentSwitch.durationMs).toBeLessThan(1_000);
      expect(logsSwitch.durationMs).toBeLessThan(1_000);
      expect(metrics.totalBlockingTimeMs).toBeLessThan(1_000);
    } finally {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
    }
  });

  test("late service responses and retry failures never contaminate the selected service", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The deferred endpoint race runs once in desktop Chromium.",
    );

    const createService = (id: string, name: string) => ({
      buildLogsOperationId: null,
      currentRuntimeId: "runtime-playwright",
      id,
      kind: "app" as const,
      locationLabel: "Playwright runtime",
      name,
      networkMode: "default",
      persistentStorageMounts: [],
      phase: "running",
      phaseTone: "positive",
      preferredLogsMode: "runtime",
      primaryBadge: {
        id: `${id}:badge`,
        kind: "runtime",
        label: name,
        meta: "Playwright fixture",
      },
      replicaCount: 1,
      routeBaseDomain: "example.test",
      routeHref: `https://${name}.example.test`,
      routeHostname: `${name}.example.test`,
      routeInternalUrl: `http://${name}.internal:3000`,
      routeLabel: "port 3000",
      routePathPrefix: "/",
      routePublicUrl: `https://${name}.example.test`,
      runtimeId: "runtime-playwright",
      serviceBadges: [],
      serviceRole: "running",
    });
    const services = [
      createService("app-deferred-a", "service-a"),
      createService("app-selected-b", "service-b"),
    ];
    const projectDetail = {
      project: {
        appCount: 2,
        defaultRuntimeId: "runtime-playwright",
        id: "project-race",
        name: "Endpoint race",
        resourceUsage: [],
        resourceUsageSnapshot: {
          cpuMillicores: 25,
          ephemeralStorageBytes: 1024,
          memoryBytes: 1024,
        },
        serviceBadges: [],
        serviceCount: 2,
        services,
      },
    };

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route("**/api/fugue/console/projects/project-race", async (route) => {
      await route.fulfill({
        body: JSON.stringify(projectDetail),
        contentType: "application/json",
        status: 200,
      });
    });

    let releaseDeferredA: (() => void) | undefined;
    const deferredA = new Promise<void>((resolve) => {
      releaseDeferredA = resolve;
    });
    await page.route("**/api/fugue/apps/app-deferred-a/domains", async (route) => {
      await deferredA;
      await route
        .fulfill({
          body: JSON.stringify({
            domains: [{ hostname: "stale-a.example.test", status: "verified" }],
          }),
          contentType: "application/json",
          status: 200,
        })
        .catch(() => undefined);
    });

    let selectedBRequest = 0;
    await page.route("**/api/fugue/apps/app-selected-b/domains", async (route) => {
      selectedBRequest += 1;

      if (selectedBRequest === 1) {
        await route.fulfill({
          body: JSON.stringify({ error: "403 B is temporarily forbidden." }),
          contentType: "application/json",
          status: 403,
        });
        return;
      }

      if (selectedBRequest === 2) {
        await route.fulfill({
          body: JSON.stringify({ error: "404 B route metadata is not ready." }),
          contentType: "application/json",
          status: 404,
        });
        return;
      }

      if (selectedBRequest === 3) {
        await route.abort("failed");
        return;
      }

      if (selectedBRequest === 4) {
        await route.fulfill({
          body: JSON.stringify({ error: "504 B route lookup timed out." }),
          contentType: "application/json",
          status: 504,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          domains: [{ hostname: "selected-b.example.test", status: "verified" }],
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    const signInResponse = await signInWithPassword(page, CONSOLE_ORDINARY_USER);
    expect(signInResponse.status()).toBe(200);
    await page.goto("/app/projects/project-race", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Select service service-a" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Select service service-b" }).click();

    const domainsCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Custom domains" });
    const retry = domainsCard.getByRole("button", { name: "Refresh" });
    await expect(domainsCard).toContainText("403 B is temporarily forbidden.");
    await retry.click();
    await expect(domainsCard).toContainText("404 B route metadata is not ready.");
    await retry.click();
    await expect(domainsCard).toContainText("Custom domains are unavailable.");
    await retry.click();
    await expect(domainsCard).toContainText(PUBLIC_SERVER_ERROR);
    await expect(domainsCard).not.toContainText("504 B route lookup timed out.");
    await retry.click();
    await expect(domainsCard).toContainText("selected-b.example.test");

    releaseDeferredA?.();
    await page.waitForTimeout(100);
    await expect(domainsCard).toContainText("selected-b.example.test");
    await expect(page.getByText("stale-a.example.test")).toHaveCount(0);
  });

  test("keyboard-only password sign-in reaches the protected Console", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The real keyboard-only password flow runs once in desktop Chromium.",
    );

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.goto("/auth/sign-in?returnTo=%2Fapp");

    const email = page.getByLabel("Email", { exact: true });
    await focusWithKeyboard(page, email);
    await page.keyboard.type(CONSOLE_ORDINARY_USER.email);

    const password = page.locator('input[name="password"]');
    await focusWithKeyboard(page, password);
    await page.keyboard.type(CONSOLE_ORDINARY_USER.password);

    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    await focusWithKeyboard(page, submit);
    const focusStyle = await submit.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(
      (focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth >= 2) ||
        focusStyle.boxShadow !== "none",
    ).toBe(true);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/password/sign-in") &&
        response.request().method() === "POST",
    );
    await page.keyboard.press("Enter");
    expect((await responsePromise).status()).toBe(200);
    await page.waitForURL(/\/app$/);
    await expect(page.locator(".coss-console-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("profile snapshot failure retries with a forced fresh request", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The profile snapshot recovery proof runs once in desktop Chromium.",
    );

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    let profileRequests = 0;
    await page.route("**/api/fugue/console/pages/settings/profile", async (route) => {
      profileRequests += 1;
      if (profileRequests === 1) {
        await route.fulfill({
          body: JSON.stringify({ error: "500 Profile snapshot unavailable." }),
          contentType: "application/json",
          status: 500,
        });
        return;
      }

      const timestamp = "2026-07-12T00:00:00.000Z";
      await route.fulfill({
        body: JSON.stringify({
          availableMethods: { github: true, google: true },
          methods: [
            {
              createdAt: timestamp,
              hasSecret: true,
              method: "password",
              providerId: null,
              providerLabel: null,
              updatedAt: timestamp,
            },
          ],
          session: {
            authMethod: "password",
            email: CONSOLE_ORDINARY_USER.email,
            name: CONSOLE_ORDINARY_USER.name,
            provider: "email",
            verified: true,
          },
          state: "ready",
          user: {
            createdAt: timestamp,
            email: CONSOLE_ORDINARY_USER.email,
            isAdmin: false,
            lastLoginAt: timestamp,
            name: CONSOLE_ORDINARY_USER.name,
            pictureUrl: null,
            provider: "email",
            providerId: null,
            sessionVersion: 1,
            status: "active",
            updatedAt: timestamp,
            verified: true,
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    expect((await signInWithPassword(page, CONSOLE_ORDINARY_USER)).status()).toBe(200);
    await page.goto("/app/settings/profile");
    const failure = page.getByRole("alert").filter({
      hasText: "Fugue could not load the profile settings right now.",
    });
    await expect(failure).toContainText(PUBLIC_SERVER_ERROR);
    await expect(failure).not.toContainText("500 Profile snapshot unavailable.");
    const retry = failure.getByRole("button", { name: "Retry" });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Display name")).toHaveValue(
      CONSOLE_ORDINARY_USER.name,
    );
    expect(profileRequests).toBe(2);
  });

  test("environment, domains, and files expose bounded failures and recover on retry", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The workbench recovery vertical slice runs once in desktop Chromium.",
    );

    const service = {
      buildLogsOperationId: null,
      currentRuntimeId: "runtime-recovery",
      id: "app-recovery",
      kind: "app",
      locationLabel: "Recovery runtime",
      name: "recovery-web",
      networkMode: "default",
      persistentStorageMounts: [],
      phase: "running",
      phaseTone: "positive",
      preferredLogsMode: "runtime",
      primaryBadge: {
        id: "app-recovery:badge",
        kind: "runtime",
        label: "recovery-web",
        meta: "Playwright fixture",
      },
      replicaCount: 1,
      routeBaseDomain: "example.test",
      routeHref: "https://recovery.example.test",
      routeHostname: "recovery.example.test",
      routeInternalUrl: "http://recovery-web.internal:3000",
      routeLabel: "port 3000",
      routePathPrefix: "/",
      routePublicUrl: "https://recovery.example.test",
      runtimeId: "runtime-recovery",
      serviceBadges: [],
      serviceRole: "running",
    };
    const secondaryService = {
      ...service,
      id: "app-recovery-secondary",
      name: "recovery-worker",
      primaryBadge: {
        ...service.primaryBadge,
        id: "app-recovery-secondary:badge",
        label: "recovery-worker",
      },
      routeHref: "https://worker.recovery.example.test",
      routeHostname: "worker.recovery.example.test",
      routeInternalUrl: "http://recovery-worker.internal:3000",
      routePublicUrl: "https://worker.recovery.example.test",
    };
    const projectDetail = {
      initialDomains: {
        appId: "app-recovery",
        data: {
          domains: [
            {
              dnsMode: "external",
              dnsRecordId: "dns-recovery-initial",
              hostname: "initial.recovery.example.test",
              status: "verified",
              tlsStatus: "ready",
            },
          ],
        },
        error: null,
      },
      project: {
        appCount: 2,
        defaultRuntimeId: "runtime-recovery",
        id: "project-recovery",
        name: "Recovery project",
        resourceUsage: [],
        resourceUsageSnapshot: {
          cpuMillicores: 20,
          ephemeralStorageBytes: 2_048,
          memoryBytes: 4_096,
        },
        serviceBadges: [],
        serviceCount: 2,
        services: [service, secondaryService],
      },
    };

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    let detailMode: "error" | "ready" = "error";
    let detailRequests = 0;
    await page.route(
      "**/api/fugue/console/projects/project-recovery",
      async (route) => {
        detailRequests += 1;
        if (detailMode === "error") {
          await route.fulfill({
            body: JSON.stringify({ error: "503 Project detail is unavailable." }),
            contentType: "application/json",
            status: 503,
          });
          return;
        }
        await route.fulfill({
          body: JSON.stringify(projectDetail),
          contentType: "application/json",
          status: 200,
        });
      },
    );
    let primaryDomainRequests = 0;
    await page.route("**/api/fugue/apps/app-recovery/domains", async (route) => {
      primaryDomainRequests += 1;
      await route.fulfill({
        body: JSON.stringify({
          domains: [
            {
              dnsMode: "external",
              dnsRecordId: "dns-recovery",
              hostname: "custom.recovery.example.test",
              status: "verified",
              tlsStatus: "ready",
            },
          ],
        }),
        contentType: "application/json",
        status: 200,
      });
    });
    let secondaryDomainRequests = 0;
    await page.route(
      "**/api/fugue/apps/app-recovery-secondary/domains",
      async (route) => {
        secondaryDomainRequests += 1;
        await route.fulfill({
          body: JSON.stringify({
            domains: [
              {
                dnsMode: "external",
                dnsRecordId: "dns-recovery-secondary",
                hostname: "secondary.recovery.example.test",
                status: "pending",
                tlsStatus: "pending",
              },
            ],
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    let restartRequests = 0;
    let releaseRestart: (() => void) | undefined;
    const restartGate = new Promise<void>((resolve) => {
      releaseRestart = resolve;
    });
    await page.route("**/api/fugue/apps/app-recovery/restart", async (route) => {
      restartRequests += 1;
      if (restartRequests === 1) {
        await restartGate;
        await route.fulfill({
          body: JSON.stringify({ error: "503 Restart is temporarily unavailable." }),
          contentType: "application/json",
          status: 503,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({ operation: null, restartToken: "accepted" }),
        contentType: "application/json",
        status: 200,
      });
    });

    let environmentMode: "error" | "ready" = "error";
    let environmentRequests = 0;
    await page.route("**/api/fugue/apps/app-recovery/env", async (route) => {
      environmentRequests += 1;
      await route.fulfill(
        environmentMode === "error"
          ? {
              body: JSON.stringify({
                error: "429 Environment requests are throttled. Retry shortly.",
              }),
              contentType: "application/json",
              headers: { "Retry-After": "1" },
              status: 429,
            }
          : {
              body: JSON.stringify({ env: { API_URL: "https://api.example.test" } }),
              contentType: "application/json",
              status: 200,
            },
      );
    });

    let filesystemMode: "error" | "ready" = "error";
    let filesystemRequests = 0;
    await page.route(
      "**/api/fugue/apps/app-recovery/filesystem/tree?depth=2",
      async (route) => {
        filesystemRequests += 1;
        await route.fulfill(
          filesystemMode === "error"
            ? {
                body: JSON.stringify({
                  error: "413 Filesystem response exceeded the safe display budget.",
                }),
                contentType: "application/json",
                status: 413,
              }
            : {
                body: JSON.stringify({
                  component: "app",
                  depth: 2,
                  entries: [
                    {
                      hasChildren: false,
                      kind: "file",
                      modifiedAt: "2026-07-12T00:00:00.000Z",
                      name: "health.txt",
                      path: "/workspace/health.txt",
                      size: 5,
                    },
                  ],
                  path: "/workspace",
                  pod: "recovery-web-0",
                  workspaceRoot: "/workspace",
                }),
                contentType: "application/json",
                status: 200,
              },
        );
      },
    );

    expect((await signInWithPassword(page, CONSOLE_ORDINARY_USER)).status()).toBe(200);
    await page.goto("/app/projects/project-recovery");
    const detailFailure = page
      .locator('[data-slot="alert"]')
      .filter({ hasText: PUBLIC_SERVER_ERROR });
    await expect(detailFailure).toBeVisible();
    await expect(detailFailure).not.toContainText("503 Project detail is unavailable.");
    detailMode = "ready";
    const detailRetry = page.getByRole("button", { name: "Retry" });
    await detailRetry.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("initial.recovery.example.test")).toBeVisible();
    expect(primaryDomainRequests).toBe(0);

    await page.getByRole("button", { name: "Select service recovery-worker" }).click();
    await expect(page.getByText("secondary.recovery.example.test")).toBeVisible();
    expect(secondaryDomainRequests).toBe(1);
    await page.getByRole("button", { name: "Select service recovery-web" }).click();
    await expect(page.getByText("custom.recovery.example.test")).toBeVisible();
    expect(primaryDomainRequests).toBe(1);

    const restart = page.getByRole("button", { name: "Restart", exact: true });
    await restart.focus();
    await page.keyboard.press("Enter");
    const restartDialog = page.getByRole("alertdialog", { name: "Restart app" });
    await expect(restartDialog).toBeVisible();
    const confirmRestart = restartDialog.getByRole("button", {
      name: "Restart",
      exact: true,
    });
    await focusWithKeyboard(page, confirmRestart, 8);
    await page.keyboard.press("Enter");
    await expect.poll(() => restartRequests).toBe(1);
    await page.keyboard.press("Enter");
    expect(restartRequests).toBe(1);
    releaseRestart?.();
    await expect(restartDialog).toContainText(PUBLIC_SERVER_ERROR);
    await expect(restartDialog).not.toContainText(
      "503 Restart is temporarily unavailable.",
    );
    await confirmRestart.focus();
    await page.keyboard.press("Enter");
    await expect(restartDialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Restart requested");
    expect(restartRequests).toBe(2);
    expect(detailRequests).toBeGreaterThanOrEqual(3);

    await page.getByRole("button", { name: "Environment", exact: true }).click();
    const environmentCard = page
      .locator('[data-slot="card-frame"], [data-slot="card"]')
      .filter({ hasText: "Live app environment from Fugue." });
    await expect(environmentCard).toContainText(
      "429 Environment requests are throttled. Retry shortly.",
    );
    environmentMode = "ready";
    await environmentCard.getByRole("button", { name: "Refresh" }).click();
    await expect(environmentCard).toContainText("API_URL");
    await expect(environmentCard).toContainText("https://api.example.test");

    await page.getByRole("button", { name: "Files", exact: true }).click();
    const filesCard = page
      .locator('[data-slot="card-frame"], [data-slot="card"]')
      .filter({ hasText: "Live filesystem tree" });
    await expect(filesCard).toContainText(
      "413 Filesystem response exceeded the safe display budget.",
    );
    filesystemMode = "ready";
    await filesCard.getByRole("button", { name: "Refresh" }).click();
    await expect(filesCard).toContainText("/workspace/health.txt");
    expect(environmentRequests).toBeGreaterThanOrEqual(2);
    expect(filesystemRequests).toBeGreaterThanOrEqual(2);
  });

  test("confirmation dialog closes, restores focus, and confirms by keyboard", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The destructive confirmation keyboard contract runs once in desktop Chromium.",
    );

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    await page.route("**/api/fugue/admin/pages/apps**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          apps: [
            {
              canRebuild: true,
              createdExact: "July 12, 2026 at 12:00 AM",
              createdLabel: "just now",
              id: "app-keyboard-confirm",
              name: "keyboard-confirm-app",
              ownerLabel: "owner@example.test",
              phase: "Running",
              phaseTone: "positive",
              projectLabel: "Keyboard project",
              resourceUsage: [],
              routeHref: "https://keyboard.example.test",
              routeLabel: "keyboard.example.test",
              serverLabel: "runtime-keyboard",
              sourceHref: null,
              sourceLabel: "GitHub",
              stack: [],
            },
          ],
          errors: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            limit: 50,
            nextCursor: null,
            previousCursor: null,
            sort: "created_at_desc",
            totalItems: 1,
          },
          summary: {
            appCount: 1,
            latestUpdateLabel: "just now",
            routedCount: 1,
            tenantCount: 1,
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    });
    let rebuildRequests = 0;
    await page.route(
      "**/api/admin/apps/app-keyboard-confirm/rebuild",
      async (route) => {
        rebuildRequests += 1;
        await route.fulfill({
          body: JSON.stringify({ queued: true }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    expect((await signInWithPassword(page, CONSOLE_ADMIN_USER)).status()).toBe(200);
    await page.goto("/app/apps");
    const details = page.getByRole("button", { name: "Details", exact: true });
    await expect(details).toBeVisible();
    await focusWithKeyboard(page, details);
    await page.keyboard.press("Enter");
    const detailsDrawer = page.getByRole("dialog", {
      name: "keyboard-confirm-app",
    });
    await expect(detailsDrawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailsDrawer).toBeHidden();
    await expect(details).toBeFocused();

    const rebuild = page.getByRole("button", { name: "Rebuild", exact: true });
    await expect(rebuild).toBeVisible();
    await focusWithKeyboard(page, rebuild);
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("alertdialog", {
      name: "Rebuild keyboard-confirm-app",
    });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(rebuild).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Rebuild", exact: true });
    await focusWithKeyboard(page, confirm, 8);
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    expect(rebuildRequests).toBe(1);
  });

  test("blocked users lose old-cookie authority on the next request", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The session-revocation route proof runs once against the isolated database.",
    );
    const fixture = await openSessionRevocationFixture({
      adminPage: page,
      baseURL: testInfo.project.use.baseURL as string,
      browser,
      target: CONSOLE_BLOCK_TARGET_USER,
    });

    try {
      const mutation = await page.request.post(
        `/api/admin/users/${encodeURIComponent(CONSOLE_BLOCK_TARGET_USER.email)}/block`,
      );
      expect(mutation.status()).toBe(200);
      await expectCurrentCookieValue(fixture.targetPage, fixture.oldCookie);

      const denied = await fixture.targetPage.request.patch(
        "/api/fugue/apps/app-old-cookie/env",
        { data: { delete: [], set: { SHOULD_NOT_WRITE: "1" } } },
      );
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toEqual({ error: "User account is blocked." });
      expect(
        await (await fixture.targetPage.request.get("/api/auth/session")).json(),
      ).toEqual({ authenticated: false, user: null });
      await fixture.targetPage.goto("/app");
      await fixture.targetPage.waitForURL(/error=account-blocked/);
      await expect(fixture.targetPage.locator(".coss-console-shell")).toHaveCount(0);
    } finally {
      await fixture.context.close();
    }
  });

  test("deleted users lose old-cookie authority on the next request", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The session-revocation route proof runs once against the isolated database.",
    );
    const fixture = await openSessionRevocationFixture({
      adminPage: page,
      baseURL: testInfo.project.use.baseURL as string,
      browser,
      target: CONSOLE_DELETE_TARGET_USER,
    });

    try {
      const mutation = await page.request.delete(
        `/api/admin/users/${encodeURIComponent(CONSOLE_DELETE_TARGET_USER.email)}`,
      );
      expect(mutation.status()).toBe(200);
      await expectCurrentCookieValue(fixture.targetPage, fixture.oldCookie);

      const denied = await fixture.targetPage.request.post(
        "/api/fugue/apps/app-old-cookie/restart",
      );
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toEqual({ error: "User account is deleted." });
      await fixture.targetPage.goto("/app");
      await fixture.targetPage.waitForURL(/error=account-deleted/);
      await expect(fixture.targetPage.locator(".coss-console-shell")).toHaveCount(0);
    } finally {
      await fixture.context.close();
    }
  });

  test("demoted users lose old admin authority and regain only ordinary access", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The session-revocation route proof runs once against the isolated database.",
    );
    const fixture = await openSessionRevocationFixture({
      adminPage: page,
      baseURL: testInfo.project.use.baseURL as string,
      browser,
      target: CONSOLE_DEMOTE_TARGET_USER,
    });

    try {
      const mutation = await page.request.delete(
        `/api/admin/users/${encodeURIComponent(CONSOLE_DEMOTE_TARGET_USER.email)}/admin`,
      );
      expect(mutation.status()).toBe(200);
      await expectCurrentCookieValue(fixture.targetPage, fixture.oldCookie);

      const denied = await fixture.targetPage.request.post(
        `/api/admin/users/${encodeURIComponent(CONSOLE_ORDINARY_USER.email)}/sessions`,
      );
      expect(denied.status()).toBe(401);
      expect(await denied.json()).toEqual({ error: "Sign in first." });
      await fixture.targetPage.goto("/app/apps");
      await fixture.targetPage.waitForURL(/\/auth\/sign-in\?error=session-expired/);
      await expect(fixture.targetPage.getByText("Admin apps")).toHaveCount(0);

      expect(
        (
          await signInWithPassword(fixture.targetPage, CONSOLE_DEMOTE_TARGET_USER)
        ).status(),
      ).toBe(200);
      await expect(
        fixture.targetPage.locator(".coss-sidebar").getByRole("link", { name: "Apps" }),
      ).toHaveCount(0);
      const freshRoleDenied = await fixture.targetPage.request.post(
        `/api/admin/users/${encodeURIComponent(CONSOLE_ORDINARY_USER.email)}/sessions`,
      );
      expect(freshRoleDenied.status()).toBe(403);
      expect(await freshRoleDenied.json()).toEqual({
        error: "Admin access required.",
      });
    } finally {
      await fixture.context.close();
    }
  });

  test("admin session receives admin navigation and passes the server guard", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The authenticated admin boundary runs once in desktop Chromium.",
    );

    await page.route("**/api/fugue/console/projects", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ errors: [], projects: [] }),
        contentType: "application/json",
        status: 200,
      });
    });
    const signInResponse = await signInWithPassword(page, CONSOLE_ADMIN_USER);
    expect(signInResponse.status()).toBe(200);

    const desktopSidebar = page.locator(".coss-sidebar");
    await expect(desktopSidebar.getByRole("link", { name: "Apps" })).toBeVisible();
    await expect(desktopSidebar.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(desktopSidebar.getByRole("link", { name: "Cluster" })).toBeVisible();

    const adminPage = await page.request.get("/app/apps");
    expect(adminPage.status()).toBe(200);
    expect(await adminPage.text()).toContain("Admin apps");
  });
});
