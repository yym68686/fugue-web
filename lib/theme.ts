// Theme preference model shared by server (cookie read + bootstrap script) and
// client (the theme toggle in the user menu).

export const THEME_PREFERENCE_VALUES = ["auto", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCE_VALUES)[number];
export type Theme = Exclude<ThemePreference, "auto">;

export const THEME_COOKIE_NAME = "fg_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const THEME_PREFERENCE_SET = new Set<ThemePreference>(THEME_PREFERENCE_VALUES);

export function parseThemePreference(
  value: string | null | undefined,
): ThemePreference {
  return THEME_PREFERENCE_SET.has(value as ThemePreference)
    ? (value as ThemePreference)
    : "auto";
}

/**
 * Inline script injected into <head> before first paint. It applies the stored
 * preference to <html> so the correct palette is active immediately (no FOUC).
 * For "auto" we leave data-theme unset and let the prefers-color-scheme media
 * query in globals.css decide, while still recording the preference so the
 * client toggle can render the right state.
 */
export function buildThemeBootstrapScript(preference: ThemePreference): string {
  return `(() => {
  try {
    var pref = ${JSON.stringify(preference)};
    var root = document.documentElement;
    root.dataset.themePreference = pref;
    if (pref === "light" || pref === "dark") {
      root.dataset.theme = pref;
      root.style.colorScheme = pref;
    } else {
      delete root.dataset.theme;
      root.style.colorScheme = "light dark";
    }
  } catch (e) {}
})();`;
}
