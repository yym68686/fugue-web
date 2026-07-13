import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type PerformanceSmokeState = {
  cls: number;
  eventTimings: Array<{
    duration: number;
    interactionId: number;
    name: string;
    startTime: number;
  }>;
  lcp: number;
  longTasks: number[];
};

test("records local navigation, web-vital, long-task, and interaction smoke", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The deterministic local performance smoke runs once in desktop Chromium.",
  );

  await page.addInitScript(() => {
    const state: PerformanceSmokeState = {
      cls: 0,
      eventTimings: [],
      lcp: 0,
      longTasks: [],
    };
    Reflect.set(window, "__fuguePerformanceSmoke", state);

    const observe = (
      type: string,
      callback: (entries: PerformanceEntry[]) => void,
      options: PerformanceObserverInit = { buffered: true, type },
    ) => {
      try {
        const observer = new PerformanceObserver((list) => {
          callback(list.getEntries());
        });
        observer.observe(options);
      } catch {
        // Unsupported entry types stay empty and are recorded explicitly below.
      }
    };

    observe("largest-contentful-paint", (entries) => {
      const latest = entries.at(-1);
      if (latest) state.lcp = latest.startTime;
    });
    observe("layout-shift", (entries) => {
      for (const entry of entries) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) state.cls += shift.value ?? 0;
      }
    });
    observe("longtask", (entries) => {
      state.longTasks.push(...entries.map((entry) => entry.duration));
    });
    observe(
      "event",
      (entries) => {
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
      },
      {
        buffered: true,
        durationThreshold: 16,
        type: "event",
      } as PerformanceObserverInit,
    );
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });

  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_000);

  await page.evaluate(() => {
    const measurement = new Promise<number>((resolve) => {
      document.addEventListener(
        "click",
        (event) => {
          const startedAt = event.timeStamp;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(performance.now() - startedAt)),
          );
        },
        { capture: true, once: true },
      );
    });
    Reflect.set(window, "__fugueInteractionMeasurement", measurement);
  });
  await page.getByRole("button", { name: "Copy command" }).first().click();
  const interactionApproximation = await page.evaluate(
    async () => await Reflect.get(window, "__fugueInteractionMeasurement"),
  );
  await page.waitForTimeout(200);

  const browserMetrics = await page.evaluate(() => {
    const state = Reflect.get(
      window,
      "__fuguePerformanceSmoke",
    ) as PerformanceSmokeState;
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const totalBlockingTime = state.longTasks.reduce(
      (total, duration) => total + Math.max(0, duration - 50),
      0,
    );

    return {
      cls: state.cls,
      eventTiming: state.eventTimings,
      eventTimingMax: Math.max(0, ...state.eventTimings.map((entry) => entry.duration)),
      interactionEventTimingMax: Math.max(
        0,
        ...state.eventTimings
          .filter((entry) => entry.interactionId > 0)
          .map((entry) => entry.duration),
      ),
      lcpMs: state.lcp,
      longTaskCount: state.longTasks.length,
      navigation: {
        domCompleteMs: navigation.domComplete,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        durationMs: navigation.duration,
        loadEventEndMs: navigation.loadEventEnd,
        requestStartMs: navigation.requestStart,
        responseEndMs: navigation.responseEnd,
        responseStartMs: navigation.responseStart,
        transferSize: navigation.transferSize,
        type: navigation.type,
      },
      totalBlockingTimeMs: totalBlockingTime,
    };
  });
  const report = {
    capturedAt: new Date().toISOString(),
    mode: "local Playwright smoke; synthetic lab signal, not field telemetry",
    route: "/docs",
    browser: testInfo.project.name,
    viewport: page.viewportSize(),
    metrics: {
      ...browserMetrics,
      interactionToNextPaintApproximationMs: interactionApproximation,
    },
  };
  const reportBody = `${JSON.stringify(report, null, 2)}\n`;
  const outputDirectory = path.resolve(process.cwd(), "../../artifacts/performance");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "local-browser-smoke.json"),
    reportBody,
    "utf8",
  );
  await testInfo.attach("local-browser-performance-smoke.json", {
    body: Buffer.from(reportBody),
    contentType: "application/json",
  });

  expect(browserMetrics.navigation.responseEndMs).toBeGreaterThan(0);
  expect(browserMetrics.lcpMs).toBeGreaterThan(0);
  expect(browserMetrics.cls).toBeLessThanOrEqual(0.1);
  expect(browserMetrics.totalBlockingTimeMs).toBeLessThan(1_000);
  expect(interactionApproximation).toBeLessThan(1_000);
});

test("records semantic accessibility trees as a screen-reader smoke", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "One Chromium accessibility tree is the deterministic screen-reader smoke.",
  );

  const snapshots: string[] = [];
  for (const route of ["/", "/docs", "/auth/sign-in"]) {
    await page.goto(route);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    const snapshot = await main.ariaSnapshot();
    expect(snapshot).toContain("heading");
    snapshots.push(`# ${route}\n\n${snapshot}`);
  }

  const reportBody = `${snapshots.join("\n\n---\n\n")}\n`;
  const outputDirectory = path.resolve(process.cwd(), "../../artifacts/accessibility");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "screen-reader-smoke.aria.yml"),
    reportBody,
    "utf8",
  );
  await testInfo.attach("screen-reader-smoke.aria.yml", {
    body: Buffer.from(reportBody),
    contentType: "text/yaml",
  });
});
