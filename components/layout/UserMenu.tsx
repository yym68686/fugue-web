"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/client";
import Icon from "@/components/ui/Icon";
import { followsSubmenu, type Point } from "@/lib/ui/menu-intent";
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

type Section = "theme" | "locale";
const OPEN_DELAY = 160;
const CLOSE_DELAY = 240;

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

// The locale swap needs the browser to send the just-written fg_locale cookie
// on the next request. router.refresh() re-runs the server render (which reads
// the cookie) — but only if the Set-Cookie response has already committed.
// Firing the POST and the refresh in the same tick races them: the refresh's
// request usually leaves before the cookie lands, so the first click re-renders
// with the *old* locale and only a later click (after the earlier POST settled)
// appears to work. Awaiting the write first removes the race entirely.

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
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const popoverId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const [submenu, setSubmenu] = useState<Section | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(themePreference);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const submenuPanel = useRef<HTMLDivElement>(null);
  const timers = useRef<{ open?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }>({});
  const corridor = useRef<{ origin: Point; until: number } | null>(null);
  const pending = useRef<Section | null>(null);

  function stopTimer(key: "open" | "close") {
    clearTimeout(timers.current[key]);
    delete timers.current[key];
  }

  const clearIntent = useCallback(() => {
    const state = timers.current;
    clearTimeout(state.open);
    clearTimeout(state.close);
    timers.current = {};
    corridor.current = null;
    pending.current = null;
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    clearIntent();
    setSubmenu(null);
    setOpenPath(null);
    if (restoreFocus) trigger.current?.focus();
  }, [clearIntent]);

  useEffect(() => {
    if (!open) {
      clearIntent();
      return;
    }
    function onDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (submenu && submenuPanel.current?.contains(document.activeElement)) {
        event.preventDefault();
        clearIntent();
        ref.current?.querySelector<HTMLButtonElement>(`[data-submenu-trigger="${submenu}"]`)?.focus();
        setSubmenu(null);
        return;
      }
      event.preventDefault();
      closeMenu(true);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, submenu, closeMenu, clearIntent]);

  useEffect(() => clearIntent, [clearIntent]);

  function inCorridor(event: ReactPointerEvent) {
    const intent = corridor.current;
    return intent && intent.until > performance.now() && submenuPanel.current
      && followsSubmenu({ x: event.clientX, y: event.clientY }, intent.origin, submenuPanel.current.getBoundingClientRect());
  }

  function queueOpen(section: Section) {
    if (timers.current.open && pending.current === section) return;
    stopTimer("open");
    pending.current = section;
    timers.current.open = setTimeout(() => {
      clearIntent();
      setSubmenu(section);
    }, OPEN_DELAY);
  }

  function queueClose(origin?: Point) {
    stopTimer("close");
    corridor.current = origin ? { origin, until: performance.now() + CLOSE_DELAY } : null;
    timers.current.close = setTimeout(() => {
      corridor.current = null;
      if (pending.current) {
        const next = pending.current;
        clearIntent();
        setSubmenu(next);
      } else if (!submenuPanel.current?.contains(document.activeElement)) {
        setSubmenu(null);
      }
    }, CLOSE_DELAY);
  }

  function renderSection(section: Section, label: string, activeLabel: string, children: React.ReactNode) {
    const expanded = submenu === section;
    const sectionId = `${popoverId}-${section}`;
    return (
      <div className="account-section">
        <button
          type="button"
          className="usermenu-item"
          data-submenu-trigger={section}
          aria-expanded={expanded}
          aria-controls={sectionId}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            if (expanded) clearIntent();
            else if (inCorridor(event)) pending.current = section;
            else queueOpen(section);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse" && !expanded && !inCorridor(event)) queueOpen(section);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            if (pending.current === section) {
              pending.current = null;
              stopTimer("open");
            }
            if (expanded) queueClose({ x: event.clientX, y: event.clientY });
          }}
          onClick={(event) => {
            clearIntent();
            setSubmenu(expanded ? null : section);
            if (!expanded && event.detail === 0) {
              requestAnimationFrame(() => submenuPanel.current?.querySelector("button")?.focus());
            }
          }}
        >
          <span>{label}</span>
          <span className="account-current">{activeLabel}</span>
          <Icon name="ChevronRight" />
        </button>
        {expanded && (
          <div
            id={sectionId}
            ref={submenuPanel}
            className="account-submenu"
            role="group"
            aria-label={label}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") clearIntent(); }}
            onPointerLeave={(event) => { if (event.pointerType === "mouse") queueClose(); }}
          >{children}</div>
        )}
      </div>
    );
  }

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
    void persistPreference({ theme: next });
  }

  async function chooseLocale(next: LocalePreference) {
    if (next === localePreference) {
      closeMenu(true);
      return;
    }
    // Persist the cookie FIRST, then refresh so the server render reads the new
    // fg_locale. Doing these in parallel races the Set-Cookie against the
    // refresh request (see persistPreference).
    await persistPreference({ locale: next });
    router.refresh();
    closeMenu(true);
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
        ref={trigger}
        type="button"
        className="avatar"
        aria-label={locale === "zh-CN" ? "账户菜单" : "Account menu"}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={(event) => {
          if (open) closeMenu();
          else {
            clearIntent();
            setSubmenu(null);
            setOpenPath(pathname);
            if (event.detail === 0) requestAnimationFrame(() => panel.current?.querySelector("button")?.focus());
          }
        }}
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
        <div
          id={popoverId}
          ref={panel}
          className="usermenu-pop"
          onBlur={(event) => {
            if (event.relatedTarget && !ref.current?.contains(event.relatedTarget)) closeMenu();
          }}
        >
          <div className="usermenu-id">
            <div className="usermenu-nm">{name || email.split("@")[0]}</div>
            <div className="usermenu-em">{email}</div>
          </div>

          {renderSection("theme", t("Theme"), themeLabels[theme],
            <>
              {THEME_PREFERENCE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="usermenu-item"
                  aria-pressed={theme === value}
                  onClick={() => chooseTheme(value)}
                >
                  {themeLabels[value]}
                  {theme === value && <Icon name="Check" />}
                </button>
              ))}
            </>
          )}

          {renderSection("locale", t("Language"), localeLabels[localePreference],
            <>
              {localeOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="usermenu-item"
                  aria-pressed={localePreference === value}
                  onClick={() => chooseLocale(value)}
                >
                  <span>{localeLabels[value]}</span>
                  {localePreference === value && <Icon name="Check" />}
                </button>
              ))}
            </>
          )}

          <Link href="/profile" className="usermenu-item" onClick={() => closeMenu()}>
            <Icon name="Profile" />
            {t("Profile")}
          </Link>

          <button
            type="button"
            className="usermenu-item danger"
            onClick={signOut}
            disabled={signingOut}
          >
            <Icon name="SignOut" />
            {signingOut ? t("Signing out…") : t("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}
