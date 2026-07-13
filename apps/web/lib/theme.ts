export const THEME_PREFERENCE_VALUES = ["auto", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCE_VALUES)[number];
export type Theme = Exclude<ThemePreference, "auto">;

export const THEME_COOKIE_NAME = "fg_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_THEME: Theme = "light";

const THEME_PREFERENCE_SET = new Set<ThemePreference>(THEME_PREFERENCE_VALUES);

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function parseTheme(value: string | null | undefined): Theme | null {
  return isTheme(value) ? value : null;
}

export function parseThemePreference(
  value: string | null | undefined,
): ThemePreference {
  return THEME_PREFERENCE_SET.has(value as ThemePreference)
    ? (value as ThemePreference)
    : "auto";
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: Theme = DEFAULT_THEME,
): Theme {
  return preference === "auto" ? systemTheme : preference;
}

export function buildThemeBootstrapScript(preference: ThemePreference): string {
  return `(() => {
    const preference = ${JSON.stringify(preference)};
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    if (preference === "auto") {
      delete root.dataset.theme;
      root.style.removeProperty("color-scheme");
      return;
    }
    root.dataset.theme = preference;
    root.style.removeProperty("color-scheme");
  })();`;
}
