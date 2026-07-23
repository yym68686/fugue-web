"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/client";
import {
  SUPPORTED_LOCALES,
  type Locale,
  type LocalePreference,
} from "@/lib/i18n/core";
import {
  THEME_PREFERENCE_VALUES,
  type ThemePreference,
} from "@/lib/theme";

type UserMenuProps = {
  name: string | null;
  email: string;
  pictureUrl: string | null;
  themePreference: ThemePreference;
  localePreference: LocalePreference;
};

function initials(name: string | null, email: string): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "·";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

async function persistPreference(body: { theme?: string; locale?: string }) {
  try {
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Non-fatal: the visual change already applied; cookie persistence retries
    // on next toggle.
  }
}

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = pref;
  if (pref === "light" || pref === "dark") {
    root.dataset.theme = pref;
    root.style.colorScheme = pref;
  } else {
    delete root.dataset.theme;
    root.style.colorScheme = "light dark";
  }
}

export default function UserMenu({
  name,
  email,
  pictureUrl,
  themePreference,
  localePreference,
}: UserMenuProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(themePreference);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
    void persistPreference({ theme: next });
  }

  function chooseLocale(next: LocalePreference) {
    void persistPreference({ locale: next });
    // Locale is resolved server-side on render; refresh to re-render with the
    // new language.
    router.refresh();
    setOpen(false);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // ignore; redirect regardless
    }
    window.location.href = "/auth/sign-in";
  }

  const themeLabels: Record<ThemePreference, string> = {
    auto: t("Auto"),
    light: t("Light"),
    dark: t("Dark"),
  };
  const localeLabels: Record<LocalePreference, string> = {
    auto: t("Follow system"),
    en: t("English"),
    "zh-CN": t("Simplified Chinese"),
  };
  const localeOptions: LocalePreference[] = ["auto", ...SUPPORTED_LOCALES];

  return (
    <div className="usermenu" ref={ref}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={name || email}
      >
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictureUrl} alt="" className="avatar-img" />
        ) : (
          initials(name, email)
        )}
      </button>

      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="usermenu-id">
            <div className="usermenu-nm">{name || email.split("@")[0]}</div>
            <div className="usermenu-em">{email}</div>
          </div>

          <div className="usermenu-sec">
            <div className="usermenu-lbl">{t("Theme")}</div>
            <div className="seg">
              {THEME_PREFERENCE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`seg-btn${theme === value ? " active" : ""}`}
                  onClick={() => chooseTheme(value)}
                >
                  {themeLabels[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="usermenu-sec">
            <div className="usermenu-lbl">{t("Language")}</div>
            <div className="usermenu-list">
              {localeOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`usermenu-item${localePreference === value ? " active" : ""}`}
                  onClick={() => chooseLocale(value)}
                >
                  <span>{localeLabels[value]}</span>
                  {localePreference === value && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="usermenu-div" />

          <Link href="/profile" className="usermenu-item" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
            </svg>
            {t("Profile")}
          </Link>

          <button
            type="button"
            className="usermenu-item danger"
            onClick={signOut}
            disabled={signingOut}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {signingOut ? t("Signing out…") : t("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}
