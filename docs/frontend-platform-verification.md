# Fugue Frontend Platform Verification

日期：2026-06-07

## Commands

- `npm run typecheck` passed after the platform shell, page migrations, docs hydration fix, and CSS cleanup.
- `npm run build` passed with Next.js 16.2.1 production optimization and 57 static pages generated.
- `npm run contract:check` passed. The OpenAPI snapshot and generated client are current, and the command's nested typecheck passed.

## Browser Checks

Local server:

```text
http://localhost:3000
```

Captured screenshots:

- `docs/frontend-platform-screenshots/landing-desktop.png`
- `docs/frontend-platform-screenshots/landing-mobile.png`
- `docs/frontend-platform-screenshots/docs-desktop.png`
- `docs/frontend-platform-screenshots/docs-mobile.png`
- `docs/frontend-platform-screenshots/console-desktop.png`
- `docs/frontend-platform-screenshots/console-mobile.png`
- `docs/frontend-platform-screenshots/design-system-preview.png`

Observed:

- Landing desktop and mobile render without horizontal overflow.
- Docs desktop and mobile render without horizontal overflow.
- Docs `DocsCodeBlock` no longer causes a hydration mismatch. The fix made `<pre>` emit the same `language-*` class and `tabIndex` attributes that Prism expects.
- `/app` redirects to `/auth/sign-in?error=auth-required` without a local session, so the captured console screenshot documents signed-out auth handoff.

## Navigation Verification

Regular console navigation groups:

- Work: `/app`
- Runtime: `/app/cluster-nodes`
- Access: `/app/api-keys`
- Commercial: `/app/billing`
- Settings: `/app/settings/profile`

Admin navigation adds:

- Admin: `/app/cluster`, `/app/apps`, `/app/users`

Every admin nav item carries `permission: "admin"` in `lib/console/nav.ts`.

## Known Local Verification Boundary

The local browser session does not have a Fugue app session cookie, so authenticated console data pages were validated through:

- React/typecheck coverage.
- `lib/console/nav.ts` source verification for regular/admin navigation.
- platform shell/page component integration.
- signed-out auth handoff screenshot.
