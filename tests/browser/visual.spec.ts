import { test, expect, type Page } from "@playwright/test";
import { signToken } from "../../lib/auth/token";

const widths = [320, 390, 768, 1024, 1440];
const url = process.env.FUGUE_VISUAL_URL || "http://127.0.0.1:3318";
const fixtureOrigin = new URL(url);
const hasFixture = Boolean(process.env.FUGUE_VISUAL_FIXTURE && ["127.0.0.1", "localhost"].includes(fixtureOrigin.hostname));

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => {
    const view = [...document.querySelectorAll(".main")].find((node) => node.getClientRects().length) ?? document.documentElement;
    return view.scrollWidth - view.clientWidth;
  })).toBeLessThanOrEqual(1);
}

async function signIn(page: Page, admin: boolean, locale: "en" | "zh-CN", theme: "light" | "dark") {
  const email = admin ? "operator-with-a-long-display-identifier@example.invalid" : "member@example.invalid";
  await page.context().addCookies([
    { url, name: "fugue_session", value: signToken({ type: "session", email, provider: "email", verified: true, sessionVersion: 1 }, 300) },
    { url, name: "fg_locale", value: locale },
    { url, name: "fg_theme", value: theme },
  ]);
}

test("members can save a storage cap only for their own workspace", async ({ page, browser }) => {
  test.skip(!hasFixture || process.env.FUGUE_TEST_BILLING_WRITE !== "1", "Requires the local mutable billing fixture");
  const headers = { origin: fixtureOrigin.origin, "sec-fetch-site": "same-origin" };
  const cap = { cpuMillicores: 550, memoryMebibytes: 1600, storageGibibytes: 256 };
  const path = "/api/console/billing";
  expect((await page.request.patch(path, { data: cap, headers })).status()).toBe(401);
  await signIn(page, false, "en", "light");
  expect((await page.request.patch(path, {
    data: cap, headers: { origin: "https://other.invalid", "sec-fetch-site": "same-site" },
  })).status()).toBe(403);
  expect((await page.request.patch(path, { data: { ...cap, tenantId: "fixture-tenant-0" }, headers })).status()).toBe(400);
  expect((await page.request.patch(path, { data: { ...cap, storageGibibytes: 4 }, headers })).status()).toBe(409);

  await page.goto("/billing");
  await expect(page.getByLabel("CPU (cores)")).toHaveValue("0.55");
  await expect(page.getByLabel("Memory (GiB)")).toHaveValue("1.5625");
  const storage = page.getByLabel("Storage (GiB)");
  await expect(storage).toHaveValue("5");
  const save = page.getByRole("button", { name: "Save caps" });
  const capEvents = page.getByText("Cap change", { exact: true });
  const eventCount = await capEvents.count();
  await expect(save).toBeDisabled();
  await storage.fill("");
  await expect(save).toBeDisabled();
  await storage.fill("256");
  try {
    await save.click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await expect(page.locator(".kpi-row").getByText("$2.66", { exact: true })).toBeVisible();
    await expect(capEvents).toHaveCount(eventCount + 1);
    expect((await page.request.patch(path, { data: cap, headers })).status()).toBe(200);
    await page.reload();
    await expect(storage).toHaveValue("256");
    await expect(capEvents).toHaveCount(eventCount + 1);
    const memberBilling = await (await page.request.get(path)).json();
    expect(memberBilling.result.managed_cap).toEqual({
      cpu_millicores: 550, memory_mebibytes: 1600, storage_gibibytes: 256,
    });

    const other = await browser.newPage({ baseURL: url });
    try {
      await signIn(other, true, "en", "light");
      const otherBilling = await (await other.request.get(path)).json();
      expect(otherBilling.result.managed_cap.storage_gibibytes).toBe(20);
    } finally {
      await other.close();
    }
  } finally {
    await page.request.patch(path, { data: { ...cap, storageGibibytes: 5 }, headers });
  }
});

for (const width of widths) {
  test(`public pages reflow at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 500 ? 568 : 900 });
    await page.emulateMedia({ colorScheme: width === 390 || width === 1024 ? "dark" : "light" });
    for (const route of ["/", "/auth/sign-in", "/pricing", "/docs", "/terms#refunds", "/support"]) {
      expect((await page.goto(route))?.ok()).toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await noPageOverflow(page);
      await page.screenshot({ path: info.outputPath(`public-${route.replace(/[^a-z]+/g, "-")}.png`) });
    }
    await page.goto("/docs");
    const code = page.locator(".doc-code").first();
    await expect(code).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy", exact: true }).first()).toBeVisible();
    if (width <= 390) expect(await code.evaluate((node) => node.scrollWidth)).toBeGreaterThan(await code.evaluate((node) => node.clientWidth));
  });

  test(`console and admin reflow at ${width}px`, async ({ page }, info) => {
    test.skip(!hasFixture, "Requires the local visual fixture");
    await page.setViewportSize({ width, height: width < 500 ? 568 : 900 });
    const useChinese = [390, 768].includes(width);
    const locale = useChinese ? "zh-CN" : "en";
    const theme = [768, 1024].includes(width) ? "dark" : "light";
    await signIn(page, true, locale, theme);
    for (const route of ["/projects", "/projects/new", "/projects/fixture-project?service=fixture-app", "/keys", "/billing", "/profile", "/servers", "/storage", "/admin/cluster", "/admin/services", "/admin/users", "/admin/storage"]) {
      expect((await page.goto(route))?.ok()).toBe(true);
      await expect(page.locator(".app:visible")).toHaveCount(1);
      await expect(page.locator(".page-skeleton:visible")).toHaveCount(0);
      if (route === "/storage") await expect(page.locator(".storage-list button").first()).toBeVisible();
      if (route === "/admin/cluster") await expect(page.locator(".tbl-cluster tbody .node-nm").first()).toBeVisible();
      if (route === "/admin/services") await expect(page.locator(".tbl-services tbody .node-nm").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await test.step(`Check overflow at ${route}`, () => noPageOverflow(page));
      await page.screenshot({ path: info.outputPath(`console-${route.replace(/[^a-z]+/g, "-")}.png`) });
    }
  });
}

test("mobile disclosure, focus-safe modal and member roles", async ({ page, browser }, info) => {
  test.skip(!hasFixture, "Requires the local visual fixture");
  await page.setViewportSize({ width: 320, height: 568 });
  await signIn(page, false, "en", "light");
  await page.goto("/keys");
  const menu = page.getByRole("button", { name: "Main navigation" });
  await menu.focus();
  await page.keyboard.press("Enter");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Access keys" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Cluster" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  const more = page.getByLabel("More actions");
  await more.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit API key" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("320-key-modal.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
  const touch = await browser.newPage({ baseURL: url, viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true });
  try {
    await signIn(touch, true, "en", "light");
    await touch.goto("/projects");
    await touch.getByRole("button", { name: "Account menu" }).tap();
    await touch.getByRole("button", { name: /^Theme/ }).tap();
    await expect(touch.getByRole("group", { name: "Theme" })).toBeVisible();
    await touch.getByRole("button", { name: "Dark", exact: true }).tap();
    await expect(touch.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    await touch.close();
  }
});

test("account submenus retain pointer intent and keyboard escape", async ({ page }, info) => {
  test.skip(!hasFixture, "Requires the local visual fixture");
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, true, "en", "light");
  await page.goto("/projects");
  const trigger = page.getByRole("button", { name: "Account menu" });
  await trigger.click();
  const theme = page.getByRole("button", { name: /^Theme/ });
  await theme.hover();
  const items = page.getByRole("group", { name: "Theme" });
  await expect(items).toBeVisible();
  const a = (await theme.boundingBox())!;
  const b = (await items.boundingBox())!;
  await page.mouse.move(a.x + 36, a.y + a.height / 2);
  await page.mouse.move(b.x + b.width - 16, b.y + b.height - 20, { steps: 14 });
  await expect(items).toBeVisible();
  await page.screenshot({ path: info.outputPath("1440-account-desktop.png") });
  await items.getByRole("button", { name: "Dark", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(theme).toBeFocused();
  await expect(items).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("mobile service routes, secrets and files reflow with real content", async ({ page }, info) => {
  test.skip(!hasFixture, "Requires the local visual fixture");
  await page.setViewportSize({ width: 390, height: 740 });
  await signIn(page, true, "en", "light");
  await page.goto("/projects/fixture-project?service=fixture-app");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("verify-this-long-domain-for-visual-regression.example.invalid", { exact: true })).toBeVisible();
  await panel.getByText("DNS TXT", { exact: true }).click();
  await expect(panel.getByText("synthetic-txt-value", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("More actions")).toBeInViewport();
  await panel.getByLabel("More actions").click();
  await expect(panel.getByRole("button", { name: "Verify", exact: true })).toBeInViewport();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath("390-service-route.png") });

  await page.getByRole("tab", { name: "Environment variables" }).click();
  const env = panel.locator('input[type="password"]').first();
  await expect(env).toBeVisible();
  await expect(panel.locator('input[value="DEMO_CREDENTIAL"]')).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath("390-service-env.png") });

  await page.getByRole("tab", { name: "Logs", exact: true }).click();
  await expect(panel.getByText(/Synthetic runtime log/)).toBeVisible();
  await noPageOverflow(page);

  await page.getByRole("tab", { name: "Files", exact: true }).click();
  await panel.getByRole("treeitem", { name: /config.toml/ }).click();
  await expect(panel.getByRole("button", { name: "Back to files" })).toBeVisible();
  await expect(panel.locator("textarea")).toHaveValue(/visual-fixture/);
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath("390-service-files.png") });
  await panel.locator("textarea").fill("name = \"not-saved\"");
  await panel.getByRole("button", { name: "Back to files" }).click();
  const warning = page.getByRole("dialog", { name: "Discard unsaved edits?" });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Cancel" }).click();
  await expect(panel.locator("textarea")).toHaveValue(/not-saved/);
  await panel.getByRole("button", { name: "Back to files" }).click();
  await warning.getByRole("button", { name: "Discard edits" }).click();
  await expect(panel.getByRole("treeitem", { name: /config.toml/ })).toBeVisible();

  await page.getByRole("tab", { name: "Images", exact: true }).click();
  await expect(panel.getByText("Current", { exact: true }).first()).toBeVisible();
  await noPageOverflow(page);

  await page.getByRole("tab", { name: "Observability", exact: true }).click();
  await expect(panel.getByRole("button", { name: "24 hours" })).toBeVisible();
  await expect(panel.getByText("/long-audit-route/isolated-browser-fixture", { exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath("390-service-observability.png") });
});

for (const theme of ["light", "dark"] as const) {
  test(`status colors remain distinct and readable in ${theme} mode`, async ({ page }, info) => {
    test.skip(!hasFixture, "Requires the local visual fixture");
    await page.setViewportSize({ width: theme === "light" ? 390 : 1440, height: 900 });
    // Use the opposite OS preference to verify that the explicit theme wins.
    await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light" });
    await signIn(page, true, "en", theme);
    await page.goto("/admin/cluster");
    const table = page.locator(".tbl-cluster");
    const colors: Record<string, string> = {};
    for (const [label, tone] of [["Ready", "ok"], ["Draining", "warn"], ["NotReady", "err"]]) {
      const chip = table.getByText(label, { exact: true });
      await expect(chip).toBeVisible();
      await expect(chip).toHaveClass(new RegExp(`\\b${tone}\\b`));
      const result = await chip.evaluate((element) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const style = getComputedStyle(element);
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const background = ctx.getImageData(0, 0, 1, 1).data;
        ctx.fillStyle = style.color;
        ctx.fillRect(0, 0, 1, 1);
        const foreground = ctx.getImageData(0, 0, 1, 1).data;
        const luminance = (rgba: Uint8ClampedArray) => Array.from(rgba.slice(0, 3))
          .map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
        const levels = [luminance(background), luminance(foreground)].sort((a, b) => a - b);
        return { color: style.color, contrast: (levels[1] + 0.05) / (levels[0] + 0.05) };
      });
      expect(result.contrast).toBeGreaterThanOrEqual(4.5);
      colors[tone] = result.color;
    }
    expect(new Set(Object.values(colors)).size).toBe(3);
    if (theme === "light") {
      const toggle = table.getByRole("button", { name: /Expand: node-abcdefghij/ });
      const nameCell = table.getByText(/node-abcdefghij/).locator("..");
      const before = await nameCell.evaluate(element => element.getBoundingClientRect().width);
      expect(before).toBeGreaterThan(180);
      await page.screenshot({ path: info.outputPath("status-light-collapsed.png") });
      await toggle.click();
      await expect(table.locator(".row-detail")).toBeVisible();
      expect(await nameCell.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(before, 0);
    }
    await expect(table.locator(".bar-wide > i.hot:visible").first()).toHaveCSS("background-color", colors.warn);
    await expect(table.locator(".bar-wide > i.crit:visible").first()).toHaveCSS("background-color", colors.err);
    await noPageOverflow(page);
    await page.screenshot({ path: info.outputPath(`status-${theme}.png`) });

    await page.goto("/projects/fixture-project?service=fixture-app&tab=Images");
    const error = page.getByRole("tabpanel").locator(".wb-alert.err").first();
    await expect(error).toBeVisible();
    await expect(error).toHaveCSS("color", colors.err);

    if (theme === "light") {
      await page.goto("/admin/services");
      const services = page.locator(".tbl-services");
      const service = services.getByText("release-verification-console-worker-with-a-very-long-service-name", { exact: true }).locator("..");
      await expect(service).toBeVisible();
      const before = await service.evaluate(element => element.getBoundingClientRect().width);
      await services.getByRole("button", { name: /^Expand:/ }).first().click();
      await expect(services.locator(".row-detail")).toBeVisible();
      expect(await service.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(before, 0);
      await noPageOverflow(page);
    }
  });
}
