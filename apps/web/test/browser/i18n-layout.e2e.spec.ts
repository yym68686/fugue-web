import { expect, type Page, test } from "@playwright/test";

const localeCases = [
  {
    locale: "en",
    labels: { console: "Console", docs: "Docs", getStarted: "Get started" },
  },
  {
    locale: "zh-CN",
    labels: { console: "控制台", docs: "文档", getStarted: "开始使用" },
  },
  {
    locale: "zh-TW",
    labels: { console: "主控台", docs: "文件", getStarted: "開始使用" },
  },
] as const;

async function selectLocale(page: Page, locale: string) {
  const baseURL = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    {
      name: "fg_locale",
      value: locale,
      url: baseURL,
    },
  ]);
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function mockRuntimeTargets(page: Page) {
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
}

test.describe("localized layout resilience", () => {
  for (const localeCase of localeCases) {
    test(`${localeCase.locale} uses one document and shared chrome snapshot`, async ({
      page,
    }) => {
      await selectLocale(page, localeCase.locale);
      await page.setViewportSize({ height: 720, width: 320 });
      await page.goto("/");

      await expect(page.locator("html")).toHaveAttribute("lang", localeCase.locale);
      await expect(page.locator("html")).toHaveAttribute(
        "data-locale",
        localeCase.locale,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-locale-preference",
        localeCase.locale,
      );
      const header = page.locator(".coss-site-header");
      await expect(header.getByRole("navigation")).toBeVisible();
      await expect(
        header.getByRole("link", { name: localeCase.labels.docs }),
      ).toBeVisible();
      await expect(
        header.getByRole("link", { name: localeCase.labels.console }),
      ).toBeVisible();
      await expect(
        header.getByRole("link", { name: localeCase.labels.getStarted }),
      ).toBeVisible();
      await expectNoDocumentOverflow(page);
    });
  }

  test("30 percent expansion, CJK, and emoji keep the primary action visible", async ({
    page,
  }) => {
    await selectLocale(page, "zh-CN");
    await page.setViewportSize({ height: 720, width: 320 });
    await page.goto("/");

    const header = page.locator(".coss-site-header");
    const action = header.getByRole("link", { name: "开始使用" });
    const expanded = `开始使用 ${"延展".repeat(4)} 🚀`;
    expect(expanded.length).toBeGreaterThanOrEqual(
      Math.ceil("Get started".length * 1.3),
    );
    await action.evaluate((element, value) => {
      element.textContent = value;
    }, expanded);

    await expect(header.getByRole("link", { name: expanded })).toBeVisible();
    const box = await header.getByRole("link", { name: expanded }).boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(321);
    await expectNoDocumentOverflow(page);
  });

  test("long project identifiers and long request errors wrap without overflow", async ({
    page,
  }) => {
    await selectLocale(page, "zh-CN");
    await mockRuntimeTargets(page);
    await page.setViewportSize({ height: 900, width: 320 });

    const longIdentifier = `项目-🚀-${"跨区域运行时".repeat(14)}`;
    await page.goto(`/new/template/${encodeURIComponent(longIdentifier)}`);
    await expect(page.locator(".coss-page-title")).toContainText(longIdentifier);
    await expectNoDocumentOverflow(page);

    // A validation error remains public but is still bounded by the shared
    // error presenter. Keep it long enough to exercise wrapping without
    // expecting a 5xx response to echo an upstream body.
    const longError = `连接失败：${"请检查网络后重试。".repeat(18)} 🧭`;
    await page.route("**/api/fugue/projects/create-and-import", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: longError }),
        contentType: "application/json",
        status: 422,
      });
    });
    await page.goto("/new/repository");
    await page.getByLabel("Project name").fill(longIdentifier);
    await page
      .getByLabel("Repository")
      .fill("https://github.com/example/long-project-name");
    await page.getByRole("button", { name: "Deploy project" }).click();

    await expect(
      page.locator('[data-slot="alert"]').filter({ hasText: longError }),
    ).toContainText(longError);
    await expectNoDocumentOverflow(page);
  });
});
