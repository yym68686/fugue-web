# Frontend remediation Phase 0 baseline

Captured on 2026-07-12 (Asia/Shanghai) before remediation code changes. This file is the reproducibility record for WP-00; secrets and environment values are intentionally excluded.

## Source state

| Repository | Branch | Commit | Working tree before remediation |
| --- | --- | --- | --- |
| `fugue-web` | `main` tracking `origin/main` | `70625c7f4d18b0a4ede0767c38d5bb09696b15cd` | User-owned `.gitignore` modification; remediation plan untracked |
| `fugue` | `main` tracking `origin/main` | `a29aa4b719f36b2ad03f2df8ce1aabccfe6f3812` | User-owned `docs/self-organization-recovery-resilience-upgrade-plan.md` modification and `docs/oom-right-sizing-durable-signal-safe-rollout-plan.md` untracked |
| `cosscom/coss` read-only reference | `main` | `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4` | clean |

The existing `.gitignore` change is not part of remediation and must not be rewritten, staged, or reverted. The two existing `fugue` documentation changes have the same protection.

Local toolchain at capture time:

- Node.js `v24.13.0`
- npm `11.8.0`
- Bun absent from `PATH`
- Next.js `16.2.1`

## Reproduction commands and results

Run from the `fugue-web` repository at the source commit:

| Command | Baseline result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; 59 static pages reported by Next.js |
| `npm run contract:check` | FAIL; `openapi/fugue.yaml` drifted from the authoritative backend contract |
| `npm audit --omit=dev --json` | FAIL; 1 High and 1 Moderate production vulnerability, both reached through Next.js 16.2.1/PostCSS |

The authoritative backend verification was then run without changing its generated artifacts:

| Command in `fugue` | Result |
| --- | --- |
| `make generate-openapi` | PASS; no generated diff |
| `make test` | PASS; generated drift check, shell safety suites and `go test ./...` all passed |

The frontend snapshot was repaired only after this red baseline was recorded. `npm run openapi:sync`, `npm run openapi:generate`, and `npm run contract:check` then passed, producing only generated contract diffs.

## Route JavaScript baseline

The production build contained a largest application chunk of 436,412 bytes raw (129,076 bytes gzip). The initial route totals captured by the review were:

| Route | Initial JavaScript (gzip) |
| --- | ---: |
| `/` | approximately 198 KiB |
| `/docs` | approximately 332 KiB |
| `/auth/sign-in` | approximately 332 KiB |
| `/auth/sign-up` | approximately 332 KiB |
| `/app` | approximately 340 KiB |

These figures are the before values for the committed bundle-budget runner. The runner, route manifest and final measurements replace manual estimates after WP-13A/WP-08.

## Visual baseline

Desktop viewport: 1440 × 1000. Mobile viewport: 390 × 844. Files are stored under `docs/remediation-evidence/baseline-screenshots/`:

- `marketing-desktop.png`, `marketing-mobile.png`
- `docs-desktop.png`, `docs-mobile.png`
- `auth-sign-in-desktop.png`, `auth-sign-in-mobile.png`
- `auth-sign-up-desktop.png`, `auth-sign-up-mobile.png`
- `app-desktop.png`, `app-mobile.png`

The screenshots cover public marketing, docs, auth and the unauthenticated console path. The latter confirms the baseline defect: `/app` returned console HTML with HTTP 200 and only subsequently received a 401 from `/api/fugue/console/projects`.

## Keyboard, semantics, forced-colors and zoom issue baseline

The implementation review and DOM/browser pass established these pre-remediation issues:

- Auth controls were not consistently contained in a native `<form>` and therefore did not provide reliable Enter-submit behavior.
- Auth fields lacked a complete `name`/`type`/`autocomplete` contract and some visible labels were not programmatically associated.
- The sign-up Password tab rendered the email-link flow instead of a password flow.
- `/app` exposed protected shell/content before server-side authorization completed.
- Large client-owned page shells made focus restoration, loading announcements and route failure handling inconsistent.
- Current focus, forced-colors and 200% zoom behavior had no automated regression runner; this absence is itself a release-gate defect.
- Loading, empty, error, disabled and rate-limited states were not uniformly announced with live-region semantics.

The final Playwright/axe suite must convert each item into an executable assertion and save post-remediation desktop/mobile evidence.

## Isolated test resources

- Database integration tests use a dedicated PostgreSQL database configured through `TEST_DATABASE_URL`; they must refuse a non-test database name and reset only their own schema.
- Email tests use an in-process fake provider; they never call Resend or expose `RESEND_API_KEY`.
- OAuth tests use synthetic Google/GitHub provider fixtures and loopback callback origins; no production OAuth app is used.
- Upload tests use request-scoped directories below the OS temporary directory and assert cleanup. Test fixtures remain well below the production 128 MiB ceiling.
- Browser tests use a locally started production server and isolated browser contexts.

## Delivery mapping

The user requested one complete push rather than separate remote PRs. To preserve rollback granularity, delivery is divided into single-responsibility commits and each commit message names its WP/risk IDs. Critical/High work must include an automated regression test before its commit is considered complete.

| Workstream | Owner | Delivery unit | Evidence |
| --- | --- | --- | --- |
| WP-01/WP-02 | security/session stream | dedicated security commit | DB/session integration tests and mutation-route guard scan |
| WP-03 | auth-hardening stream | dedicated auth commit | redirect/OAuth/rate-limit/email/concurrency tests |
| WP-04/M-10 | upload/cache stream | dedicated resource-safety commit | bounded upload and cache-generation race tests |
| WP-05/WP-06/WP-13A | root | supply-chain/contract/CI commits | audit, backend test, contract, clean install and CI |
| WP-07 through WP-18 | root, split by vertical slice | workspace/UI/product commits | unit, integration, E2E, axe, style, bundle and visual evidence |

No non-remediation feature work is introduced before the Critical/High gates close.
