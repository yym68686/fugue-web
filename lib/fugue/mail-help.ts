import type { AppMailDNSObservation, AppMailResponse } from "./console";

export function mailSetupMessage(code: string | undefined): string | null {
  switch (code) {
    case "ready": return "Mail DNS and sending authorization are verified.";
    case "dns_pending": return "Mail DNS is being published and checked automatically. Refresh later; do not enable mail again.";
    case "provider_pending": return "Mail DNS matches. Waiting for the sending provider to verify the domain.";
    case "provider_credentials_required": return "The platform mail provider needs a domain-management credential. Your application key does not need more permissions.";
    case "provider_key_restricted": return "The platform mail provider key cannot manage domains. The platform operator must replace it.";
    case "provider_unavailable": return "The mail provider is unavailable or rejected setup. Automatic retries are backed off; existing mail is retained.";
    case "provider_limit": return "The platform mail provider reached a quota or rate limit. Setup will retry without creating duplicate domains.";
    default: return null;
  }
}

/** Never turn an arbitrary provider string into a clickable login/API URL. */
export function mailServiceOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" ? url.origin : null;
  } catch { return null; }
}

export function mailDNSBelongsToBinding(dns: AppMailDNSObservation | null, binding: AppMailResponse["binding"]): boolean {
  return !!dns && dns.app_id === binding.app_id && dns.generation === binding.generation && dns.hostname === binding.hostname && binding.state === "active";
}

export function mailAPIExample(origin: string, mailbox: { id: string; address: string }): string {
  return [
    '// Create once for each new message. Reuse the SAME key for its retries.',
    'const requestKey = crypto.randomUUID();',
    `const response = await fetch(${JSON.stringify(origin + "/api/v1/send")}, {`,
    '  method: "POST",',
    '  headers: { "Content-Type": "application/json",',
    '    Authorization: "Bearer YOUR_MAILBOX_KEY",',
    '    "Idempotency-Key": requestKey },',
    '  body: JSON.stringify(' + JSON.stringify({ mailboxId: mailbox.id, from: mailbox.address, to: ["recipient@example.test"], subject: "Hello", text: "Hello" }, null, 2).split('\n').join('\n  ') + ')',
    '});',
    '// Check the HTTP status and messageId. An uncertain response is not a new message.'
  ].join('\n');
}
