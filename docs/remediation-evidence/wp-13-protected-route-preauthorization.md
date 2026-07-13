# WP-13 protected-route preauthorization follow-up

Status: implementation and CI follow-up fixes verified locally; PR #13 required
checks and production redeploy evidence pending.

## Production observation

The first remediation release, merge commit
`3637670c38ca5fddc2e21e08868e51e5932e0f76`, was healthy and redirected an
unauthenticated browser from `/app` to `/auth/sign-in?returnTo=%2Fapp`.
However, a direct inspection of the first response found HTTP 200 plus a
stream-encoded redirect. The response also contained the Console loading
fallback and child-page composition before the browser completed the redirect.
No authenticated workspace or project data was present, but returning product
markup before active-session authorization did not satisfy the release plan's
server-boundary invariant.

## Root cause

Next.js App Router can execute layouts and pages concurrently. The root
`app/loading.tsx` Suspense boundary wrapped the protected `/app` layout and
committed its fallback before the layout finished cookie, database user-status,
and session-version checks. Once streaming began, `redirect()` could only encode
the redirect into the React Server Component stream; it could no longer replace
the response with an HTTP redirect.

## Remediation

- Removed the root loading boundary. Auth and onboarding keep their scoped
  loading boundaries, and the Console loading boundary remains inside its
  authorized layout.
- Added an explicit `/app/:path*` Proxy matcher. Missing, tampered, expired,
  legacy, or malformed session claims receive a canonical-origin 307 before App
  Router rendering. Proxy performs no database lookup.
- Extracted one shared session-claim verifier with runtime validation for token
  type, email, provider, verification state, positive session version, auth
  method, and optional strings.
- Added a request-cached active-session result for the authoritative database
  user-status and session-version check.
- Proxy overwrites a private request header with the canonical protected path
  and product query after removing the internal `_rsc` transport parameter.
  Layout and page guards therefore use the same exact deep-link return path;
  client-supplied copies of the header cannot win.
- Required every Console page, admin page, layout, and not-found surface to pass
  the authoritative active-session guard before reading page data or returning
  product markup.
- Kept all API and mutation authorization independent from Proxy so an open
  page cannot retain authority after a session is revoked. Admin Route Handlers
  consume the active session once instead of relying on React render-cache
  behavior for duplicate user lookups.

The redirect origin is derived from the configured canonical application origin,
not request Host or forwarded Host headers. The return path continues through
the existing same-origin sanitizer.

## Regression coverage

The production standalone build is exercised with redirects disabled so the
first response is inspected directly.

| Boundary | Coverage | Result |
| --- | --- | --- |
| Missing session | HTML, RSC/prefetch, and HEAD across every `/app` entry, unknown routes, query strings, trailing slash, and dotted dynamic IDs | Pass; 307 to same-origin sign-in, or framework 308 canonicalization for `/app/`; no private marker |
| Invalid claim | Bad signature, expiry, token type, email/boolean/version/auth-method and optional-field shapes | Pass; fail closed |
| Revoked active state | Blocked, deleted, and stale-version cookies across HTML, Flight/RSC, prefetch, and HEAD | Pass; HTML/HEAD return 307, Flight uses its expected 200 redirect digest, prefetch contains no protected page marker, and every path preserves the exact deep-link return target |
| Page coverage | All ordinary, admin, redirect-only, dynamic, and not-found Console pages | Pass; the static source contract requires preauthorization to be the first awaited operation in every page |
| Browser behavior | Chromium desktop/mobile, Firefox desktop, WebKit desktop/mobile | 107 passed, 98 expected capability skips, 0 failed |
| Accessibility | Eight critical axe scenarios | 8 passed, 0 Critical/Serious violations |
| Database integration | Auth concurrency/replay/revocation and bounded pagination | 13 passed |
| Build and release artifacts | Production build, 19-route bundle budgets, real non-root container | Pass |
| Other quality gates | Format, lint, typecheck, 33 isolated unit files, style, dependency audit, license/provenance/SBOM | Pass |

The E2E matrix increased from 200 to 205 project cases because the new raw
server invariant runs once and is explicitly skipped in the four redundant
browser projects.

## PR #13 first CI follow-up

The first [`frontend-quality` run
29241356425](https://github.com/yym68686/fugue-web/actions/runs/29241356425)
passed every required job except E2E. Chromium reproduced a real cold-font Docs
CLS of `0.5973580610487197` in all three attempts. Its retained trace showed the
PageHeader action wrapping below the title under the fallback font and moving
back to the right after Inter loaded. The shared title/action row now has a
deterministic two-column grid and a one-column responsive breakpoint. The
performance smoke deliberately delays Inter by 300 ms, records shift sources,
uses the Web Vitals session-window algorithm, and passed 3/3 focused reruns at
CLS `0.0001807850996653239` without changing the `0.1` threshold.

The same CI run's WebKit Drawer test failed its first immediate JavaScript focus
sample and passed on retry. The Base UI focus guards can briefly own focus before
the modal trap redirects it into the dialog. The test now uses Playwright's
auto-retrying `:focus` locator after every Tab; the product focus trap, Escape
close, inert background, and trigger restoration are unchanged. A clean
production build passed this WebKit scenario 10/10.

One earlier combined local repetition surfaced a cancelled prefetched Auth
chunk while two developer builds overlapped the same `.next` output. The trace
showed the static directory was replaced after that request began. Serialized
fresh-port production builds reproduced neither the response nor any console
error in the 10 focus and 3 cold-font repetitions above. It is therefore not
suppressed by the browser failure monitor and is not classified as an
application runtime defect.

## Release and rollback

This is a normal forward fix through the focused
[`fugue-web#13`](https://github.com/yym68686/fugue-web/pull/13) branch, required
GitHub Actions checks, merge to `main`, and Fugue's automatic import/build/deploy
path. No SSH change, manual Deployment patch, service restart, or image sync was
performed.

Rollback does not mean restoring the streaming exposure. If the forward release
fails, the safe response is to keep protected routes unavailable, retain the API
authorization boundaries, and ship another reviewed forward fix. Final live SHA,
Fugue operation IDs, production raw-response proof, and observation-window
results belong in the release closeout evidence after deployment.
