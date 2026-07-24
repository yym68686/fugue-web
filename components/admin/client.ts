/* Client for platform-admin mutation routes (browser → /api/admin/*). Mirrors
 * callConsole but targets the admin surface, which is guarded by an is-admin
 * check rather than a tenant workspace key. */

export type AdminApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

/** Call an admin mutation route. Returns the parsed `result` or throws. */
export async function callAdmin<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method: init?.method ?? "POST",
    headers:
      init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const data = text
    ? (JSON.parse(text) as AdminApiResult<T> & { error?: string })
    : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return (data as { result: T }).result;
}
