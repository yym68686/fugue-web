"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  DEFAULT_THEME,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  parseTheme,
  parseThemePreference,
  resolveThemePreference,
  type ThemePreference,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: Theme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): Theme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return DEFAULT_THEME;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyThemePreference(preference: ThemePreference): Theme {
  const resolvedTheme = resolveThemePreference(preference, readSystemTheme());
  const root = document.documentElement;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  const body = document.body;

  if (body) {
    body.classList.remove("fg-theme-dark", "fg-theme-light");
    body.classList.add(
      resolvedTheme === "light" ? "fg-theme-light" : "fg-theme-dark",
    );
  }

  return resolvedTheme;
}

function writeThemePreference(preference: ThemePreference) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(preference)}; Max-Age=${THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function ThemeProvider({
  children,
  initialPreference,
  initialTheme,
}: {
  children: ReactNode;
  initialPreference: ThemePreference;
  initialTheme: Theme;
}) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") {
      return initialTheme;
    }

    return parseTheme(document.documentElement.dataset.theme) ?? initialTheme;
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const nextPreference = parseThemePreference(
      root.dataset.themePreference || initialPreference,
    );
    const nextTheme =
      parseTheme(root.dataset.theme) ??
      resolveThemePreference(nextPreference, readSystemTheme());

    setPreferenceState(nextPreference);
    setResolvedTheme(nextTheme);

    const body = document.body;

    if (body) {
      body.classList.remove("fg-theme-dark", "fg-theme-light");
      body.classList.add(
        nextTheme === "light" ? "fg-theme-light" : "fg-theme-dark",
      );
    }
  }, [initialPreference, initialTheme]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      preference !== "auto" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      setResolvedTheme(applyThemePreference("auto"));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [preference]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference(nextPreference) {
          writeThemePreference(nextPreference);
          setPreferenceState(nextPreference);
          setResolvedTheme(applyThemePreference(nextPreference));
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
