import type { AppMailDNSObservation, AppMailResponse } from "./console";

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
