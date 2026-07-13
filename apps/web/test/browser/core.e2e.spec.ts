import { expect, type Page, test } from "@playwright/test";

type BrowserFailure = {
  kind: "console" | "page";
  message: string;
};

const PRIVATE_CONSOLE_ROUTES = [
  {
    path: "/app",
    forbidden: ["Track project lifecycle", '"projects":[]'],
  },
  {
    path: "/app/api-keys",
    forbidden: ["Workspace API keys and node enrollment keys"],
  },
  {
    path: "/app/apps",
    forbidden: ["Cluster-wide applications, owners"],
  },
  {
    path: "/app/billing",
    forbidden: ["Prepaid balance, managed capacity envelope"],
  },
  {
    path: "/app/cluster-nodes",
    forbidden: ["Runtime servers, heartbeat, roles"],
  },
  {
    path: "/app/cluster",
    forbidden: ["Control plane status, runtime nodes"],
  },
  {
    path: "/app/dns",
    forbidden: ["Tenant DNS zones, records"],
  },
  {
    path: "/app/projects/private-project-marker",
    forbidden: ["Routes, environment, logs, files, images"],
  },
  {
    path: "/app/projects/dotted.project?tab=logs",
    forbidden: ["Routes, environment, logs, files, images"],
  },
  {
    path: "/app/",
    canonicalTo: "/app",
    forbidden: ["Track project lifecycle", '"projects":[]'],
  },
  {
    path: "/app/settings",
    forbidden: ["Profile and security", "Display name, account email"],
  },
  {
    path: "/app/settings/profile",
    forbidden: ["Display name, account email"],
  },
  {
    path: "/app/users",
    forbidden: ["User directory, account status"],
  },
  {
    path: "/app/does-not-exist",
    forbidden: ["Console page not found", "requested workspace page"],
  },
] as const;

function monitorBrowserFailures(page: Page) {
  const failures: BrowserFailure[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    failures.push({ kind: "page", message: error.message });
  });

  return failures;
}

async function mockRuntimeTargets(page: Page) {
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
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("public, auth, and private route boundaries", () => {
  test("unauthenticated console documents redirect before emitting private HTML or RSC", async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The raw server response invariant is independent of the browser engine.",
    );

    const baseURL = testInfo.project.use.baseURL as string;
    const expectedOrigin = new URL(baseURL).origin;

    for (const routeCase of PRIVATE_CONSOLE_ROUTES) {
      for (const representation of ["document", "rsc", "prefetch", "head"] as const) {
        await test.step(`${representation} ${routeCase.path}`, async () => {
          const requestUrl = new URL(routeCase.path, baseURL);
          if (
            (representation === "rsc" || representation === "prefetch") &&
            !("canonicalTo" in routeCase)
          ) {
            requestUrl.searchParams.set("_rsc", "missing-session-proof");
          }
          const response = await request.fetch(
            `${requestUrl.pathname}${requestUrl.search}`,
            {
              failOnStatusCode: false,
              headers:
                representation === "rsc" || representation === "prefetch"
                  ? {
                      Accept: "text/x-component",
                      ...(representation === "prefetch"
                        ? { "Next-Router-Prefetch": "1" }
                        : {}),
                      RSC: "1",
                    }
                  : {
                      Accept:
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                      "Sec-Fetch-Dest": "document",
                      "Sec-Fetch-Mode": "navigate",
                    },
              maxRedirects: 0,
              method: representation === "head" ? "HEAD" : "GET",
            },
          );

          const location = response.headers().location;
          expect(location).toBeTruthy();

          const redirectUrl = new URL(location as string, baseURL);
          if ("canonicalTo" in routeCase) {
            expect(response.status()).toBe(308);
            expect(redirectUrl.origin).toBe(expectedOrigin);
            expect(redirectUrl.pathname).toBe(routeCase.canonicalTo);
            expect(redirectUrl.search).toBe("");
          } else {
            expect(response.status()).toBe(307);
            expect(redirectUrl.origin).toBe(expectedOrigin);
            expect(redirectUrl.pathname).toBe("/auth/sign-in");
            expect(redirectUrl.searchParams.get("returnTo")).toBe(routeCase.path);
            expect([...redirectUrl.searchParams.keys()]).toEqual(["returnTo"]);

            const cacheControl = response.headers()["cache-control"] ?? "";
            expect(cacheControl).toContain("private");
            expect(cacheControl).toContain("no-store");
          }
          expect(response.headers()["set-cookie"] ?? "").not.toContain(
            "fugue_session=",
          );

          const body = await response.text();
          for (const forbidden of [
            "coss-console-shell",
            "coss-sidebar",
            ...routeCase.forbidden,
          ]) {
            expect(
              body,
              `${representation} ${routeCase.path} leaked ${forbidden}`,
            ).not.toContain(forbidden);
          }
        });
      }
    }

    const alternateHostResponse = await request.get("/docs?source=alternate", {
      failOnStatusCode: false,
      headers: { Host: "web.fugue.example" },
      maxRedirects: 0,
    });
    expect(alternateHostResponse.status()).toBe(308);
    const canonicalRedirect = new URL(
      alternateHostResponse.headers().location as string,
      baseURL,
    );
    expect(canonicalRedirect.origin).toBe(expectedOrigin);
    expect(canonicalRedirect.pathname).toBe("/docs");
    expect(canonicalRedirect.search).toBe("?source=alternate");

    const malformedCookieResponse = await request.get("/app", {
      failOnStatusCode: false,
      headers: {
        Accept: "text/html",
        Cookie: "fugue_session=malformed-signed-session",
        "X-Forwarded-Host": "forwarded-untrusted.example",
        "X-Forwarded-Proto": "http",
      },
      maxRedirects: 0,
    });
    expect(malformedCookieResponse.status()).toBe(307);
    const malformedRedirect = new URL(
      malformedCookieResponse.headers().location as string,
      baseURL,
    );
    expect(malformedRedirect.origin).toBe(expectedOrigin);
    expect(malformedRedirect.pathname).toBe("/auth/sign-in");
    expect(malformedRedirect.searchParams.get("returnTo")).toBe("/app");
    expect(await malformedCookieResponse.text()).not.toContain(
      "Track project lifecycle",
    );
  });

  test("marketing and docs expose semantic public pages with canonical metadata", async ({
    browserName,
    page,
  }) => {
    const failures = monitorBrowserFailures(page);
    const origin = new URL(test.info().project.use.baseURL as string).origin;

    const marketingResponse = await page.goto("/");
    expect(marketingResponse?.headers()["cache-control"]).toContain("private");
    expect(marketingResponse?.headers()["cache-control"]).toContain("no-store");
    const documentVary = marketingResponse?.headers().vary?.toLowerCase() ?? "";
    for (const field of [
      "rsc",
      "next-router-state-tree",
      "next-router-prefetch",
      "next-router-segment-prefetch",
      "accept-encoding",
      "accept-language",
      "cookie",
    ]) {
      expect(documentVary).toContain(field);
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /index, follow/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    // Let App Router link prefetches settle before replacing the document.
    // Concurrent WebKit contexts otherwise surface expected cancellations as
    // an access-control pageerror, obscuring real browser errors.
    if (browserName === "webkit") {
      await page.waitForLoadState("networkidle");
    }

    const docsResponse = await page.goto("/docs");
    expect(docsResponse?.headers()["cache-control"]).toContain("private");
    expect(docsResponse?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${origin}/docs`,
    );
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    if (browserName === "webkit") {
      await page.waitForLoadState("networkidle");
    }
    expect(failures).toEqual([]);
  });

  test("private console content is never exposed before server authorization", async ({
    page,
  }) => {
    const response = await page.goto("/app");
    await page.waitForURL(/\/auth\/sign-in\?returnTo=%2Fapp$/);
    await page.waitForLoadState("networkidle");
    // Firefox reports an expected, browser-generated font cancellation while
    // the protected route redirects. Monitor the final document strictly.
    const failures = monitorBrowserFailures(page);

    await expect(page.locator(".coss-console-shell")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sign in to Fugue" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex.*nofollow/,
    );
    expect(response?.headers()["cache-control"]).toContain("private");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(failures).toEqual([]);
  });

  test("docs deep links follow hash history and restore the current section", async ({
    page,
  }) => {
    const failures = monitorBrowserFailures(page);

    await page.goto("/docs#topology");
    const topologyLink = page.locator(
      'nav[aria-label="On this page"] a[href="#topology"]',
    );
    await expect(topologyLink).toHaveAttribute("aria-current", "location");
    await expect(page.locator("#topology")).toBeInViewport();

    const diagnosisLink = page.locator(
      'nav[aria-label="On this page"] a[href="#diagnose"]',
    );
    await diagnosisLink.click();
    await expect(page).toHaveURL(/\/docs#diagnose$/);
    await expect(diagnosisLink).toHaveAttribute("aria-current", "location");
    await expect(page.locator("#diagnose")).toBeInViewport();

    await page.goBack();
    await expect(page).toHaveURL(/\/docs#topology$/);
    await expect(topologyLink).toHaveAttribute("aria-current", "location");
    await expect(page.locator("#topology")).toBeInViewport();
    expect(failures).toEqual([]);
  });

  test("unsafe returnTo inputs are reduced to the trusted console path", async ({
    page,
  }) => {
    const failures = monitorBrowserFailures(page);
    const submittedReturnPaths: string[] = [];

    await page.route("**/api/auth/password/sign-in", async (route) => {
      const payload = route.request().postDataJSON() as { returnTo?: unknown };
      submittedReturnPaths.push(String(payload.returnTo ?? ""));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "Safe test response." }),
      });
    });

    const unsafeValues = [
      "https://outside.example/path",
      "//outside.example/path",
      "/%5coutside.example/path",
      "/%252f%252foutside.example/path",
      "/app%0d%0aLocation:https://outside.example",
    ];

    for (const unsafeValue of unsafeValues) {
      await page.goto(`/auth/sign-in?returnTo=${encodeURIComponent(unsafeValue)}`);
      await page.getByLabel("Email", { exact: true }).fill("user@example.test");
      await page.locator('input[name="password"]').fill("test-password-123");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect.poll(() => submittedReturnPaths.length).toBeGreaterThan(0);
      expect(submittedReturnPaths.at(-1)).toBe("/app");
      expect(new URL(page.url()).origin).toBe(
        new URL(test.info().project.use.baseURL as string).origin,
      );
    }

    expect(failures).toEqual([]);
  });

  test("safe returnTo keeps its path, query, and fragment", async ({ page }) => {
    const failures = monitorBrowserFailures(page);
    let submittedReturnPath = "";

    await page.route("**/api/auth/password/sign-in", async (route) => {
      const payload = route.request().postDataJSON() as { returnTo?: unknown };
      submittedReturnPath = String(payload.returnTo ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "Safe test response." }),
      });
    });

    const returnTo = "/app/projects/project-1?tab=logs#tail";
    await page.goto(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByLabel("Email", { exact: true }).fill("user@example.test");
    await page.locator('input[name="password"]').fill("test-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect.poll(() => submittedReturnPath).toBe(returnTo);
    expect(failures).toEqual([]);
  });

  test("OAuth starts preserve sign-in and sign-up intent", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The client-to-start-route mode contract only needs one browser engine.",
    );

    let requestedUrl = "";
    await page.route(/\/api\/auth\/(?:google|github)\/start(?:\?|$)/, async (route) => {
      requestedUrl = route.request().url();
      await route.fulfill({
        body: "<!doctype html><title>OAuth start captured</title>",
        contentType: "text/html",
        status: 200,
      });
    });

    const returnTo = "/app/projects/auth-mode?tab=logs#tail";
    for (const authMode of ["sign-in", "sign-up"] as const) {
      for (const provider of ["Google", "GitHub"] as const) {
        requestedUrl = "";
        await page.goto(`/auth/${authMode}?returnTo=${encodeURIComponent(returnTo)}`);
        await page.getByRole("button", { name: new RegExp(provider, "i") }).click();
        await expect.poll(() => requestedUrl).not.toBe("");

        const startUrl = new URL(requestedUrl);
        expect(startUrl.pathname).toBe(`/api/auth/${provider.toLowerCase()}/start`);
        expect(startUrl.searchParams.get("mode")).toBe(
          authMode === "sign-up" ? "signup" : "signin",
        );
        expect(startUrl.searchParams.get("returnTo")).toBe(returnTo);
      }
    }
  });
});

test.describe("keyboard and interaction contracts", () => {
  test("skip link is first, visibly focused, and moves focus to main", async ({
    browserName,
    page,
  }) => {
    const failures = monitorBrowserFailures(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    // WebKit follows macOS Safari's default keyboard model, where Option+Tab
    // includes links in sequential focus navigation. Other engines use Tab.
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    expect(
      await skipLink.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).outlineWidth),
      ),
    ).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeFocused();
    expect(failures).toEqual([]);
  });

  test("auth method radios expose a named group and native arrow-key selection", async ({
    page,
  }) => {
    const failures = monitorBrowserFailures(page);

    await page.goto("/auth/sign-in");
    const group = page.getByRole("group", { name: "Authentication method" });
    const radios = group.getByRole("radio", { includeHidden: true });
    const passwordRadio = group.getByRole("radio", { name: "Password" });
    const emailRadio = group.getByRole("radio", { name: "Email link" });

    await expect(group).toBeVisible();
    await expect(radios).toHaveCount(2);
    await expect(passwordRadio).toBeChecked();
    await passwordRadio.focus();
    await page.keyboard.press("ArrowRight");
    await expect(emailRadio).toBeFocused();
    await expect(emailRadio).toBeChecked();
    await expect(page.getByText("Email link mode")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(passwordRadio).toBeFocused();
    await expect(passwordRadio).toBeChecked();
    expect(failures).toEqual([]);
  });

  test("drawer traps focus, closes with Escape, and restores its trigger", async ({
    page,
  }) => {
    const failures = monitorBrowserFailures(page);
    await mockRuntimeTargets(page);

    // The response is initiated by the client effect, so awaiting it also
    // proves that the server-rendered controls have hydrated before the click.
    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/fugue/console/runtime-targets"),
    );
    await page.goto("/new/repository");
    await runtimeResponse;
    const trigger = page.getByRole("button", {
      name: "Open runtime target picker",
    });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Runtime target" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Runtime target" })).toBeVisible();
    expect(
      await page
        .locator(".coss-root")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(true);

    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("Tab");
      await expect(dialog.locator(":focus")).toHaveCount(1);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(
      await page
        .locator(".coss-root")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    expect(failures).toEqual([]);
  });

  test("Docs directory and copy action work from the keyboard", async ({ page }) => {
    const failures = monitorBrowserFailures(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            Reflect.set(window, "__playwrightCopiedText", value);
          },
        },
      });
    });

    await page.goto("/docs");
    const directory = page.locator("details.coss-docs-directory");
    await expect(directory).toHaveAttribute("open", "");
    const firstDirectoryLink = directory.getByRole("link").first();
    await firstDirectoryLink.focus();
    await page.keyboard.press("Enter");
    await expect(firstDirectoryLink).toHaveAttribute("aria-current", "location");
    await expect(page).toHaveURL(/#[a-z0-9-]+$/);

    const copyButton = page.getByRole("button", { name: "Copy command" }).first();
    await copyButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").first()).toHaveText("Copied to clipboard.");
    expect(
      await page.evaluate(() =>
        String(Reflect.get(window, "__playwrightCopiedText") ?? ""),
      ),
    ).toContain("fugue");
    expect(failures).toEqual([]);
  });

  test("clipboard rejection announces failure without a false success", async ({
    page,
  }) => {
    const failures = monitorBrowserFailures(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Clipboard denied", "NotAllowedError");
          },
        },
      });
      document.execCommand = () => false;
    });

    await page.goto("/docs");
    await page.getByRole("button", { name: "Copy command" }).first().click();
    const status = page.getByRole("status").first();
    await expect(status).toHaveText("Could not copy to clipboard.");
    await expect(status).not.toHaveText("Copied to clipboard.");
    expect(failures).toEqual([]);
  });
});

test.describe("locale and resilient layout", () => {
  test("locale negotiation, secure preference cookie, and refresh stay aligned", async ({
    browser,
  }) => {
    const project = test.info().project;
    const mobile = project.name.includes("mobile");
    const context = await browser.newContext({
      baseURL: project.use.baseURL as string,
      locale: "zh-CN",
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const navigationRequest = page.waitForRequest(
      (request) =>
        request.isNavigationRequest() && new URL(request.url()).pathname === "/",
    );
    await page.goto("/");
    expect((await navigationRequest).headers()["accept-language"]).toContain("zh-CN");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fugue");

    const localeSelect = page.getByRole("combobox", { name: "界面语言" });
    const preferenceResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/preferences/locale") &&
        response.request().method() === "POST",
    );
    await localeSelect.selectOption("zh-TW");
    await preferenceResponse;
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");

    const localeCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "fg_locale",
    );
    expect(localeCookie).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      value: "zh-TW",
    });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    await expect(page.getByRole("combobox", { name: "介面語言" })).toHaveValue("zh-TW");
    await page.waitForLoadState("networkidle");
    // WebKit reports intentionally cancelled RSC prefetches while a full
    // locale reload replaces the document. Monitor the settled document.
    const settledFailures = monitorBrowserFailures(page);
    await page.waitForTimeout(100);
    expect(settledFailures).toEqual([]);
    await context.close();
  });

  test("320, 390, 768, and 1280px layouts retain content without page overflow", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "The explicit viewport matrix runs once; every behavior test still runs in all browser projects.",
    );
    const failures = monitorBrowserFailures(page);

    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/docs", "/auth/sign-up"]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        await expectNoDocumentOverflow(page);
      }
    }

    expect(failures).toEqual([]);
  });

  test("200% effective zoom retains controls and avoids document overflow", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "The effective zoom viewport is checked once in Chromium.",
    );
    const failures = monitorBrowserFailures(page);
    // 640 CSS pixels is the reflow area of a 1280px browser at 200% zoom.
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/docs");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy command" }).first(),
    ).toBeVisible();
    await expectNoDocumentOverflow(page);
    expect(failures).toEqual([]);
  });

  test("forced-colors and reduced-motion preserve visible boundaries", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium-desktop",
      "Media emulation is run once in Chromium; cross-browser behavior is covered separately.",
    );
    const failures = monitorBrowserFailures(page);
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.goto("/");

    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
    expect(
      await card.evaluate((element) => getComputedStyle(element).borderTopStyle),
    ).not.toBe("none");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await skipLink.focus();
    const motionStyle = await skipLink.evaluate((element) => ({
      animationDuration: getComputedStyle(element).animationDuration,
      outlineStyle: getComputedStyle(element).outlineStyle,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
    const seconds = (value: string) =>
      value.endsWith("ms")
        ? Number.parseFloat(value) / 1_000
        : Number.parseFloat(value);
    expect(motionStyle.outlineStyle).toBe("solid");
    expect(seconds(motionStyle.animationDuration)).toBeLessThanOrEqual(0.000_001);
    expect(seconds(motionStyle.transitionDuration)).toBeLessThanOrEqual(0.000_001);
    expect(failures).toEqual([]);
  });
});
