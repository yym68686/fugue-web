# Frontend Detail Optimization Backlog

This file is generated and maintained from the loop in `docs/frontend-detail-optimization-system.md`.

## Current Status

- Pass: 2
- Static audit: passed with 0 issues.
- Rendered DOM audit: passed with 0 actionable issues.
- Typecheck: passed.
- Local logged-in console note: local password sign-in currently depends on a PostgreSQL instance at `127.0.0.1:5432`; without that database, protected console routes redirect to auth. Static scans still covered console source, and rendered scans covered public/auth/deploy/auth-required surfaces.

## Todo

- [x] Run first static detail audit.
- [x] Run first rendered route/viewport audit.
- [x] Classify actionable findings.
- [x] Fix all actionable findings.
- [x] Re-run full loop and confirm no actionable findings remain.

## Pass 1 Findings And Fixes

- [x] Add `npm run frontend:details:audit` to catch mechanical detail issues before manual review.
- [x] Add focus replacement for `fp-toolbar__search` so removed outlines still have an accessible focus state.
- [x] Add loading policy to `TechStackLogo` image.
- [x] Replace unguarded deploy repository autofocus with desktop-pointer-only focus.
- [x] Replace unguarded filesystem composer autofocus with desktop-pointer-only focus.
- [x] Fix password sign-in failure state so a server failure shows an alert and restores the submit button.
- [x] Catch password sign-in credential/user lookup failures and return the existing session-open-failed error instead of a raw 500.
- [x] Restore product segmented controls from the runtime 28px override to the Cloudflare-like 32px compact target.
- [x] Add mobile 44px touch targets for shared product controls, including buttons, inputs, locale triggers, segmented items, and hint tooltip triggers.
- [x] Hide locale/theme panels when their parent `details` element is closed.
- [x] Prevent locale/theme popover panels from escaping the viewport at tablet/mobile widths.
- [x] Increase toast dismiss/copy controls to reliable mobile touch targets.
- [x] Prevent docs proof-shell ribbon and note-card content from exceeding the framed surface on mobile.
- [x] Raise docs mobile section-strip links to the mobile touch target.
- [x] Add form-level error status styling for auth failures.

## Pass 2 Findings

- [x] Re-ran static audit: no issues.
- [x] Re-ran rendered route/viewport audit: no actionable issues after 2px DOMRect tolerance.
- [x] Re-ran typecheck: passed.

## Production Verification Findings

- [x] Increase platform breadcrumb links to a 24px minimum hit target after production console smoke testing found the topbar `Console` crumb rendered as a 20px-tall interactive link.
- [x] Disable global Manrope preload after production console smoke testing found a Next/font unused-preload warning on routes that now use the Cloudflare runtime UI font stack.

## Non-Actionable Notes

- DOMRect measurements can report 43.x px for controls with computed `44px` height under browser viewport overrides. This is not treated as a visual defect unless the measured size misses the target by more than 2px or the computed style also misses the target.
- Plain inline prose links are not treated as touch-target defects unless they are styled as discrete controls.
- Horizontal overflow inside an explicitly scrollable strip/table is acceptable when the scroll container itself stays inside the viewport.
