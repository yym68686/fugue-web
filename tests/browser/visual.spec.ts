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
  await panel.getByRole("button", { name: "Back to files" }).click();
  await expect(panel.getByRole("treeitem", { name: /config.toml/ })).toBeVisible();

  await page.getByRole("tab", { name: "Images", exact: true }).click();
  await expect(panel.getByText("Current", { exact: true }).first()).toBeVisible();
  await noPageOverflow(page);

  await page.getByRole("tab", { name: "Observability", exact: true }).click();
  await expect(panel.getByText("/long-audit-route/isolated-browser-fixture", { exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath("390-service-observability.png") });
});
