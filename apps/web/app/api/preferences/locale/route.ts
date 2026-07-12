import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AuthRequestMediaTypeError,
  AuthRequestTooLargeError,
  readLimitedJson,
} from "@/lib/auth/request";
import {
  isSecureRequest,
  normalizeAuthOrigin,
  readRequestOrigin,
} from "@/lib/auth/origin";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALE_SET,
  type Locale,
  type LocalePreference,
} from "@/lib/i18n/core";

const MAX_PREFERENCE_BODY_BYTES = 512;

function isLocalePreference(value: unknown): value is LocalePreference {
  return (
    value === "auto" ||
    (typeof value === "string" && SUPPORTED_LOCALE_SET.has(value as Locale))
  );
}

export async function POST(request: Request) {
  const requestOrigin = normalizeAuthOrigin(request.headers.get("origin"));
  const canonicalOrigin = readRequestOrigin(request);

  if (!requestOrigin || requestOrigin !== canonicalOrigin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const payload = await readLimitedJson<{ locale?: unknown }>(
      request,
      MAX_PREFERENCE_BODY_BYTES,
    );
    const preference = payload.locale;

    if (!isLocalePreference(preference)) {
      return NextResponse.json(
        { error: "Unsupported locale preference." },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    if (preference === "auto") {
      cookieStore.delete(LOCALE_COOKIE_NAME);
    } else {
      cookieStore.set(LOCALE_COOKIE_NAME, preference, {
        httpOnly: true,
        maxAge: LOCALE_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: isSecureRequest(request),
      });
    }

    return NextResponse.json(
      { locale: preference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthRequestTooLargeError) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    if (error instanceof AuthRequestMediaTypeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
    }
    throw error;
  }
}
