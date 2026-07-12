import { describe, expect, test } from "bun:test";
import {
  createAuthFinalizeMessages,
  createAuthPanelMessages,
} from "../../lib/auth/ui-messages";
import {
  createAccessKeysStateMessages,
  createAdminAppsStateMessages,
  createAdminClusterStateMessages,
  createAdminUsersStateMessages,
  createBillingStateMessages,
  createDnsStateMessages,
  createProjectGalleryStateMessages,
  createProjectWorkbenchStateMessages,
  createServersStateMessages,
} from "../../lib/i18n/console-messages";
import {
  createTranslator,
  formatDateTime,
  formatNumber,
  getDocumentLocaleAttributes,
  hasMessage,
  negotiateLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  translate,
} from "../../lib/i18n/core";
import {
  createClientUiMessages,
  createNewProjectFormMessages,
  createProfileFormMessages,
  createShellMessages,
} from "../../lib/i18n/ui-messages";

const consoleMessageFactories = [
  createAccessKeysStateMessages,
  createAdminAppsStateMessages,
  createAdminClusterStateMessages,
  createAdminUsersStateMessages,
  createBillingStateMessages,
  createDnsStateMessages,
  createProjectGalleryStateMessages,
  createProjectWorkbenchStateMessages,
  createServersStateMessages,
] as const;

function collectMessageValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectMessageValues);
}

describe("locale negotiation", () => {
  test("resolves Chinese scripts and regions consistently", () => {
    expect(resolveLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(resolveLocale("zh-Hant-TW")).toBe("zh-TW");
    expect(resolveLocale("zh-HK")).toBe("zh-TW");
    expect(resolveLocale("en-GB")).toBe("en");
  });

  test("skips unsupported higher-priority languages and q=0 entries", () => {
    expect(negotiateLocale("fr-FR, zh-Hant;q=0.9, en;q=0.8")).toBe("zh-TW");
    expect(negotiateLocale("zh-CN;q=0, en-US;q=0.8")).toBe("en");
    expect(negotiateLocale("fr-FR, de;q=0.8")).toBe("en");
  });
});

describe("locale messages and formatters", () => {
  test("maps every supported locale to the document language snapshot", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getDocumentLocaleAttributes(locale, locale)).toEqual({
        "data-locale": locale,
        "data-locale-preference": locale,
        dir: "ltr",
        lang: locale,
      });
    }

    expect(getDocumentLocaleAttributes("zh-CN", "auto")).toMatchObject({
      "data-locale-preference": "auto",
      lang: "zh-CN",
    });
  });

  test("public messages are complete and never expose an internal key", () => {
    const key = "Open console";
    expect(hasMessage("zh-CN", key)).toBe(true);
    expect(hasMessage("zh-TW", key)).toBe(true);
    expect(translate("zh-CN", key)).toBe("打开控制台");
    expect(translate("zh-TW", key)).toBe("開啟主控台");
  });

  test("formats the same snapshot with locale-specific output", () => {
    const timestamp = new Date("2026-07-12T12:00:00.000Z");

    for (const locale of SUPPORTED_LOCALES) {
      expect(formatNumber(locale, 1234.5)).toBe(
        new Intl.NumberFormat(locale).format(1234.5),
      );
      expect(
        formatNumber(locale, 1234.5, {
          currency: "USD",
          style: "currency",
        }),
      ).toBe(
        new Intl.NumberFormat(locale, {
          currency: "USD",
          style: "currency",
        }).format(1234.5),
      );
      expect(
        formatDateTime(locale, timestamp, {
          formatOptions: { dateStyle: "medium", timeZone: "UTC" },
        }),
      ).toBe(
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(timestamp),
      );
    }
  });

  test("serializes complete shared client messages for every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const messages = createClientUiMessages(createTranslator(locale));

      expect(Object.values(messages).every((value) => value.trim().length > 0)).toBe(
        true,
      );
      expect(messages.showingOf).toContain("{visible}");
      expect(messages.showingOf).toContain("{total}");
    }

    expect(
      createClientUiMessages(createTranslator("zh-CN")).pageRenderFailedTitle,
    ).not.toBe(createClientUiMessages(createTranslator("en")).pageRenderFailedTitle);
  });

  test("serializes complete page-scoped state, Auth, and validation messages", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslator(locale);
      const snapshots = [
        createShellMessages(t),
        createClientUiMessages(t),
        createAuthPanelMessages(t),
        createAuthFinalizeMessages(t),
        createProfileFormMessages(t),
        createNewProjectFormMessages(t),
        ...consoleMessageFactories.map((factory) => factory(t)),
      ];

      expect(
        snapshots
          .flatMap(collectMessageValues)
          .every((message) => message.trim().length > 0),
      ).toBe(true);
    }
  });

  test("keeps the typed zh-TW surface free of simplified-only glyphs", () => {
    const t = createTranslator("zh-TW");
    const snapshots = [
      createShellMessages(t),
      createClientUiMessages(t),
      createAuthPanelMessages(t),
      createAuthFinalizeMessages(t),
      createProfileFormMessages(t),
      createNewProjectFormMessages(t),
      ...consoleMessageFactories.map((factory) => factory(t)),
    ];
    const simplifiedOnlyGlyph =
      /[这现载变环线录户页时显启过从个为发务无里后项与将应称须还没暂]/u;
    const violations = snapshots
      .flatMap(collectMessageValues)
      .filter((message) => simplifiedOnlyGlyph.test(message));

    expect(violations).toEqual([]);
  });
});
