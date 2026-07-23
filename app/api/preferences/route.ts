import { NextResponse } from "next/server";

import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  parseLocalePreference,
} from "@/lib/i18n/core";
import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  parseThemePreference,
} from "@/lib/theme";

type PreferencesPayload = {
  theme?: string;
  locale?: string;
};

/**
 * Persist UI preferences (theme + locale) as long-lived cookies. Both are
 * non-sensitive display preferences, so no auth is required — the cookies are
 * read by the root layout (theme bootstrap) and the i18n server helper.
 */
export async function POST(request: Request) {
  let payload: PreferencesPayload;
  try {
    payload = (await request.json()) as PreferencesPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  if (typeof payload.theme === "string") {
    response.cookies.set({
      name: THEME_COOKIE_NAME,
      value: parseThemePreference(payload.theme),
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }

  if (typeof payload.locale === "string") {
    response.cookies.set({
      name: LOCALE_COOKIE_NAME,
      value: parseLocalePreference(payload.locale),
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }

  return response;
}
