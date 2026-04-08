import type { AuthMethodKind } from "@/lib/auth/methods";
import type { SessionAuthMethod, SessionUser } from "@/lib/auth/session";
import { translate, type Locale } from "@/lib/i18n/core";

type NamedSession = {
  email: string;
  name?: string | null;
};

export function readSessionLabel(session: NamedSession) {
  return session.name?.trim() || session.email.split("@")[0] || session.email;
}

export function readSessionMonogram(label: string) {
  const normalized = label.replace(/[^a-z0-9]+/gi, "");

  if (!normalized) {
    return "Fg";
  }

  const first = normalized[0] ?? "F";
  const second = normalized[1] ?? "g";
  return `${first.toUpperCase()}${second.toLowerCase()}`;
}

export function readProviderLabel(provider: SessionUser["provider"], locale: Locale = "en") {
  switch (provider) {
    case "google":
      return translate(locale, "Google");
    case "github":
      return translate(locale, "GitHub");
    case "email":
      return translate(locale, "Email");
    default:
      return provider;
  }
}

export function readAuthMethodLabel(
  method: AuthMethodKind | SessionAuthMethod | null | undefined,
  provider?: SessionUser["provider"],
  locale: Locale = "en",
) {
  switch (method) {
    case "email_link":
      return translate(locale, "Email link");
    case "password":
      return translate(locale, "Password");
    case "google":
      return translate(locale, "Google");
    case "github":
      return translate(locale, "GitHub");
    default:
      return provider ? readProviderLabel(provider, locale) : translate(locale, "Unknown");
  }
}

export function readVerificationLabel(verified: boolean, locale: Locale = "en") {
  return translate(locale, verified ? "Verified" : "Unverified");
}
