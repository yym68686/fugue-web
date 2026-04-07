import type { AuthMethodKind } from "@/lib/auth/methods";
import type { SessionAuthMethod, SessionUser } from "@/lib/auth/session";

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

export function readProviderLabel(provider: SessionUser["provider"]) {
  switch (provider) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "email":
      return "Email";
    default:
      return provider;
  }
}

export function readAuthMethodLabel(
  method: AuthMethodKind | SessionAuthMethod | null | undefined,
  provider?: SessionUser["provider"],
) {
  switch (method) {
    case "email_link":
      return "Email link";
    case "password":
      return "Password";
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    default:
      return provider ? readProviderLabel(provider) : "Unknown";
  }
}

export function readVerificationLabel(verified: boolean) {
  return verified ? "Verified" : "Unverified";
}
