// Hostname normalization for the custom-domain forms. People paste what they
// have in the address bar ("https://App.Example.com/path"), but the console API
// wants the bare lowercase hostname, so clean it up before sending rather than
// bouncing the request back with a validation error.

/**
 * Reduce user input to a bare lowercase hostname: drops any scheme, userinfo,
 * port, path/query/fragment, the root-label trailing dot, and surrounding
 * whitespace. Returns "" when nothing usable is left.
 */
export function normalizeHostname(value: string) {
  let host = value.trim();

  if (!host) return "";

  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Strip path, query and fragment before userinfo, so a "@" or ":" that only
  // appears later in the URL cannot be mistaken for a credential or a port.
  // [\s\S] rather than a dotAll regex: tsconfig targets ES2017.
  host = host.replace(/[/?#][\s\S]*$/u, "");
  host = host.replace(/^[^@]*@/u, "");
  host = host.replace(/:\d*$/u, "");
  host = host.replace(/\.$/u, "");

  return host.toLowerCase();
}
