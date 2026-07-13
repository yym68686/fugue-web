import { expect, type Page, test } from "@playwright/test";

async function mockEmptyRuntimeTargets(page: Page) {
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

type LinearRgb = { b: number; g: number; r: number };

function cssColorToLinearRgb(value: string): LinearRgb {
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)(?:\s+|,\s*)([\d.]+)(?:\s+|,\s*)([\d.]+)/i,
  );

  if (rgb) {
    const toLinear = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    return {
      b: toLinear(Number(rgb[3])),
      g: toLinear(Number(rgb[2])),
      r: toLinear(Number(rgb[1])),
    };
  }

  const lab = value.match(/^lab\(\s*([\d.]+)(%)?\s+([\d.+-]+)\s+([\d.+-]+)/i);

  if (lab) {
    const lightness = Number(lab[1]);
    const a = Number(lab[3]);
    const b = Number(lab[4]);
    const delta = 6 / 29;
    const inverseLab = (component: number) =>
      component > delta ? component ** 3 : 3 * delta ** 2 * (component - 4 / 29);
    const fY = (lightness + 16) / 116;
    const x50 = 0.96422 * inverseLab(fY + a / 500);
    const y50 = inverseLab(fY);
    const z50 = 0.82521 * inverseLab(fY - b / 200);
    const x65 = 0.9555766 * x50 - 0.0230393 * y50 + 0.0631636 * z50;
    const y65 = -0.0282895 * x50 + 1.0099416 * y50 + 0.0210077 * z50;
    const z65 = 0.0122982 * x50 - 0.020483 * y50 + 1.3299098 * z50;
    const clamp = (channel: number) => Math.max(0, Math.min(1, channel));

    return {
      b: clamp(0.0556434 * x65 - 0.2040259 * y65 + 1.0572252 * z65),
      g: clamp(-0.969266 * x65 + 1.8760108 * y65 + 0.041556 * z65),
      r: clamp(3.2404542 * x65 - 1.5371385 * y65 - 0.4985314 * z65),
    };
  }

  const oklch = value.match(/^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.+-]+)(?:deg)?/i);

  if (!oklch) {
    throw new Error(`Unsupported computed CSS color: ${value}`);
  }

  const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
  const chroma = Number(oklch[3]);
  const hue = (Number(oklch[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const clamp = (channel: number) => Math.max(0, Math.min(1, channel));

  return {
    b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
  };
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: LinearRgb) =>
    0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const foregroundLuminance = luminance(cssColorToLinearRgb(foreground));
  const backgroundLuminance = luminance(cssColorToLinearRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe("product workflow acceptance", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium-desktop",
      "These deterministic product workflow scenarios run once in desktop Chromium.",
    );
  });

  test("keyboard-only project configuration edits env rows and recovers from 429", async ({
    page,
  }) => {
    await mockEmptyRuntimeTargets(page);
    await page.route("**/app/projects/project-keyboard", async (route) => {
      await route.fulfill({
        body: "<!doctype html><title>Project accepted</title><main>Project accepted</main>",
        contentType: "text/html",
        status: 200,
      });
    });
    const submittedPayloads: Array<Record<string, unknown>> = [];
    let requestCount = 0;
    await page.route("**/api/fugue/projects/create-and-import", async (route) => {
      requestCount += 1;
      submittedPayloads.push(route.request().postDataJSON() as Record<string, unknown>);

      if (requestCount === 1) {
        await route.fulfill({
          body: JSON.stringify({
            error: "429 Import requests are throttled. Retry after one second.",
          }),
          contentType: "application/json",
          headers: { "Retry-After": "1" },
          status: 429,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          project: { id: "project-keyboard", name: "keyboard-project" },
          requestInProgress: false,
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/fugue/console/runtime-targets"),
    );
    await page.goto("/new/repository");
    await runtimeResponse;
    await expect(
      page.getByRole("button", { name: "Open runtime target picker" }),
    ).toContainText("Default placement");
    const projectName = page.getByLabel("Project name");
    await projectName.focus();
    await page.keyboard.type("keyboard-project");
    const appName = page.getByLabel("App name");
    await appName.focus();
    await page.keyboard.type("web");
    const repository = page.getByLabel("Repository");
    await repository.focus();
    await page.keyboard.type("https://github.com/cosscom/coss");

    const envTrigger = page.getByRole("button", {
      name: "Environment variables",
      exact: true,
    });
    await envTrigger.focus();
    await page.keyboard.press("Enter");
    const envDialog = page.getByRole("dialog", { name: "Environment variables" });
    await expect(envDialog).toBeVisible();

    const addVariable = envDialog.getByRole("button", { name: "Add variable" });
    await addVariable.focus();
    await page.keyboard.press("Enter");
    const firstKey = envDialog.getByLabel("Variable 1 key");
    await expect(firstKey).toBeFocused();
    await page.keyboard.type("API_URL");
    await page.keyboard.press("Tab");
    await expect(envDialog.getByLabel("Variable 1 value")).toBeFocused();
    await page.keyboard.type("https://api.example.test");

    await addVariable.focus();
    await page.keyboard.press("Enter");
    const secondKey = envDialog.getByLabel("Variable 2 key");
    await expect(secondKey).toBeFocused();
    await page.keyboard.type("API_URL");
    await expect(envDialog.locator('[data-slot="alert"]')).toContainText(
      "Duplicate key",
    );
    await expect(firstKey).toHaveAttribute("aria-invalid", "true");
    await expect(secondKey).toHaveAttribute("aria-invalid", "true");
    const firstDuplicateDescription = await firstKey.getAttribute("aria-describedby");
    const secondDuplicateDescription = await secondKey.getAttribute("aria-describedby");
    expect(firstDuplicateDescription).toBeTruthy();
    expect(secondDuplicateDescription).toBeTruthy();
    await expect(envDialog.locator(`#${firstDuplicateDescription}`)).toBeVisible();
    await expect(envDialog.locator(`#${secondDuplicateDescription}`)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(envDialog).toBeHidden();
    await expect(envTrigger).toBeFocused();

    const deploy = page.getByRole("button", { name: "Deploy project" });
    await deploy.focus();
    await page.keyboard.press("Enter");
    expect(requestCount).toBe(0);
    await expect(envDialog).toBeVisible();
    await expect(firstKey).toBeFocused();

    const deleteDuplicate = envDialog
      .getByRole("button", { name: "Delete API_URL" })
      .last();
    await deleteDuplicate.focus();
    await page.keyboard.press("Enter");
    await expect(firstKey).toBeFocused();
    await expect(envDialog.getByRole("alert")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(envDialog).toBeHidden();
    await expect(envTrigger).toBeFocused();

    await deploy.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "Deploy failed" }),
    ).toContainText("429 Import requests are throttled. Retry after one second.");

    await deploy.focus();
    const acceptedProject = page.waitForURL(/\/app\/projects\/project-keyboard$/);
    await page.keyboard.press("Enter");
    await acceptedProject;
    expect(requestCount).toBe(2);
    expect(submittedPayloads[1]).toMatchObject({
      env: { API_URL: "https://api.example.test" },
      name: "web",
      projectMode: "create",
      projectName: "keyboard-project",
      repoUrl: "https://github.com/cosscom/coss",
      sourceMode: "github",
    });
  });

  test("upload creation exposes 413 and remains retryable", async ({ page }) => {
    await mockEmptyRuntimeTargets(page);
    await page.route("**/app/projects/project-upload", async (route) => {
      await route.fulfill({
        body: "<!doctype html><title>Upload accepted</title><main>Upload accepted</main>",
        contentType: "text/html",
        status: 200,
      });
    });
    let requestCount = 0;
    await page.route(
      "**/api/fugue/projects/create-and-import-upload",
      async (route) => {
        requestCount += 1;

        if (requestCount === 1) {
          await route.fulfill({
            body: JSON.stringify({
              error: "413 Upload exceeds the configured request budget.",
            }),
            contentType: "application/json",
            status: 413,
          });
          return;
        }

        await route.fulfill({
          body: JSON.stringify({
            project: { id: "project-upload", name: "bounded-upload" },
            requestInProgress: false,
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/fugue/console/runtime-targets"),
    );
    await page.goto("/new/repository");
    await runtimeResponse;
    await expect(
      page.getByRole("button", { name: "Open runtime target picker" }),
    ).toContainText("Default placement");
    const uploadMode = page.getByRole("button", { name: "Upload", exact: true });
    await uploadMode.focus();
    await page.keyboard.press("Space");
    await expect(uploadMode).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Project name").fill("bounded-upload");
    await page.getByLabel("Choose source upload").setInputFiles({
      buffer: Buffer.from("FROM scratch\n"),
      mimeType: "text/plain",
      name: "Dockerfile",
    });

    const deploy = page.getByRole("button", { name: "Deploy project" });
    await deploy.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "Deploy failed" }),
    ).toContainText("413 Upload exceeds the configured request budget.");
    await deploy.focus();
    const acceptedUpload = page.waitForURL(/\/app\/projects\/project-upload$/);
    await page.keyboard.press("Enter");
    await acceptedUpload;
    expect(requestCount).toBe(2);
  });

  test("computed styles keep long template text wrapped with strong contrast", async ({
    page,
  }) => {
    await mockEmptyRuntimeTargets(page);
    await page.setViewportSize({ width: 320, height: 900 });
    const longSlug = `release-${"extraordinarily-long-segment-".repeat(6)}complete`;
    const runtimeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/fugue/console/runtime-targets"),
    );
    await page.goto(`/new/template/${longSlug}`);
    await runtimeResponse;

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText(longSlug);
    const computed = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      const bodyStyle = getComputedStyle(document.body);
      const rect = element.getBoundingClientRect();
      return {
        background: bodyStyle.backgroundColor,
        color: style.color,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        left: rect.left,
        overflowWrap: style.overflowWrap,
        right: rect.right,
      };
    });

    expect(computed.overflowWrap).toBe("anywhere");
    expect(computed.left).toBeGreaterThanOrEqual(-1);
    expect(computed.right).toBeLessThanOrEqual(computed.documentClientWidth + 1);
    expect(computed.documentScrollWidth).toBeLessThanOrEqual(
      computed.documentClientWidth + 1,
    );
    expect(contrastRatio(computed.color, computed.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
