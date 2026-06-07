# Frontend Detail Optimization System

This document defines the repeatable loop for finding and fixing Fugue frontend detail issues without relying on one-off manual observations.

## Goal

Continuously discover, document, prioritize, fix, and re-check frontend details until the current audit system can no longer find actionable issues.

The quality target is the current Fugue platform design direction:

- Cloudflare-like product UI density and restraint.
- Fugue wordmark remains in the original logo font.
- Console/admin/deploy/auth/docs surfaces use platform primitives where possible.
- Product UI uses unframed sections, compact controls, 1px hairlines, Cloudflare-blue primary actions, and solid neutral surfaces.
- Marketing can keep atmospheric direction, but product controls must stay system-aligned.

## Sources Used

- `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md`
- `frontend-design`
- `audit`
- `normalize`
- `polish`
- `harden`
- `adapt`
- `webapp-testing`
- `web-design-guidelines`
- `ckm:design-system`
- `design-system/component-specs.md`
- `design-system/README.md`

## Audit Layers

### 1. Static Code Scan

Run:

```bash
npm run frontend:details:audit
```

This catches mechanical issues:

- `transition: all`
- `outline: none` without a clear replacement
- clickable `div`/`span`
- nested interactive elements in `summary`
- paste blocking
- unreviewed `autoFocus`
- image alt/dimension/loading omissions
- product gradient candidates

Static findings are candidates. They must be classified before fixing because source compatibility CSS can be overridden at runtime.

### 2. Rendered DOM Scan

Use Chrome MCP or Playwright against real routes and computed styles.

Route matrix:

- `/`
- `/docs`
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/finalize`
- `/app`
- `/app/apps`
- `/app/api-keys`
- `/app/billing`
- `/app/cluster`
- `/app/cluster-nodes`
- `/app/settings/profile`
- `/app/users`
- `/new/repository`

Viewport matrix:

- Desktop: `1440x1000`
- Tablet: `900x1100`
- Mobile: `390x844`

Rendered scan checks:

- old rounded frame remnants
- forbidden product gradients
- illegal shadows/glows
- text overflow and horizontal scroll
- controls below minimum touch size
- missing visible focus
- console errors and network errors
- nested interactive browser issues

Rendered measurements use a 2px DOMRect tolerance. The browser can report
fractional dimensions below computed CSS values when a local viewport override,
font metric, or device scaling is active. A control is actionable only when the
computed style and measured rectangle both miss the target after that tolerance.

Control size targets:

- Desktop and tablet product density: 32px minimum for compact controls.
- Mobile: 44px minimum for real controls.
- Inline prose links are excluded unless they are styled as buttons, tabs,
  pills, summaries, icon buttons, or other discrete controls.
- Scrollable tables and horizontal strips are valid when the scroll container is
  contained inside the viewport.

Authenticated console routes need a working local session and database. If the
local database is unavailable, rendered checks still cover public pages, auth,
deploy entry, redirects, static console source, and auth-required surfaces; a
full logged-in console pass must be repeated in an environment with a working
session.

### 3. Human Polish Pass

Use screenshots and interaction:

- Compare density, rhythm, and hierarchy against the design system.
- Check hover/focus/disabled/loading/empty/error states.
- Inspect long text, CJK, narrow screens, and low-data states.
- Prefer system-level fixes over one-off component patches.

## Severity Rules

- Critical: broken functionality, inaccessible interaction, console/runtime error, blocking layout failure.
- High: visible product style split, broken focus/keyboard behavior, invalid semantics, mobile overflow.
- Medium: inconsistent spacing/type/icon sizing, unreviewed autofocus, questionable gradients, missing loading policy.
- Low: cleanup, documentation, non-blocking polish.

## Loop Protocol

1. Run static scan.
2. Run rendered DOM scan across the route/viewport matrix.
3. Write all actionable findings to `docs/frontend-detail-optimization-backlog.md`.
4. Fix only items listed in the backlog.
5. Check off each item immediately after the fix is implemented and verified.
6. Run `npm run typecheck` and `npm run build`.
7. Re-run static and rendered scans.
8. If new actionable findings appear, append them to the backlog and repeat.
9. Stop only when the current audit system returns no actionable issues.

## Todo

- [x] Define the multi-layer audit system.
- [x] Define route and viewport matrices.
- [x] Define severity rules.
- [x] Add a static audit command.
- [x] Run the first complete audit pass.
- [x] Create the first actionable backlog.
- [x] Fix all first-pass backlog items.
- [x] Re-run the complete audit pass.
- [x] Repeat until no actionable findings remain.

## Current Loop Result

- Static audit: passed with 0 issues.
- Rendered audit: passed with 0 actionable issues after applying the measurement
  tolerance above.
- TypeScript and segmented-control guard: passed.
