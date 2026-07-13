# ADR 0002: Preserve application Vary fields in Next App Router responses

- Status: Accepted as a temporary pinned dependency patch
- Date: 2026-07-12
- Affected dependency: `next@16.2.10`
- Upstream regressions: [vercel/next.js#85852](https://github.com/vercel/next.js/issues/85852), [vercel/next.js#85999](https://github.com/vercel/next.js/issues/85999)

## Context

Fugue Web renders locale- and cookie-dependent documents. Those documents are
already `private, no-store`, and their response contract also declares
`Vary: Accept-Language, Cookie` while retaining the App Router RSC fields.

Next 16.2.10's generated App Page handler calls `setHeader("Vary", ...)` after
middleware and configured response headers have run. This overwrites the two
application fields. The behavior reproduces with both `next start` and the
standalone production server and is tracked upstream as an open regression.

## Decision

The root Bun workspace pins `next@16.2.10` and applies
`patches/next@16.2.10.patch`. The patch changes only the Node App Page build
template: it merges the existing and framework-required Vary fields by
case-insensitive name, preserves the first-party values, and emits each field
once. Both CommonJS and ESM template copies are patched.

The application still owns its policy in `apps/web/proxy.ts` and
`apps/web/lib/site/page-response-policy.ts`. The dependency patch changes no
caching decision, route behavior, request body, authentication, or response
body.

## Verification

- `bun install --frozen-lockfile` must apply the pinned patch from a clean cache.
- `next-vary-patch-contract.test.mjs` locks the package mapping, upstream issue,
  Docker build input, and deduplicating patch body.
- Browser E2E verifies the real built document response contains
  `Accept-Language`, `Cookie`, all required Next router fields, and
  `Accept-Encoding` without duplicates.
- The production container job repeats the check against the standalone server.

## Removal condition

Remove the patch only after a pinned Next release closes or supersedes both
upstream regressions and a clean build proves that middleware/configured Vary
fields survive without it. The removal PR must delete the patch mapping and
file, run the complete browser/container matrix, and retain the same response
contract. A version bump alone is not evidence that the regression is fixed.
