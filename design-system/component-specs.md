# Morlane Component Specs

## Scope

The active component language is Morlane. Existing Fugue components may keep
their React APIs and historical class names for behavior, but visual output must
resolve to Morlane tokens, density, surfaces, and layout patterns.

## System Rules

- Use Inter for product UI. Use IBM Plex Mono only for code, commands,
  environment keys, IDs, URLs, and technical labels.
- Keep the original Syne font only for the `Fugue` wordmark in top-left or
  sidebar brand positions.
- Keep controls compact: 30px small, 36px default, 40px large.
- Use 6px as the default radius and 8px only for larger panels or dialogs.
- Prefer white cards, pale gray page canvas, thin borders, row dividers, and
  light shadows.
- Primary actions use the Morlane primary treatment; secondary actions are
  neutral; danger actions use muted red surfaces.
- Every shared control needs hover, focus-visible, disabled, loading, empty,
  error, and validation treatment where applicable.
- Do not reintroduce old dark cinematic surfaces, glow, scanline, glass,
  route-signal, proof-shell, or object-belt visuals.

## Tokens

### Primitive

- Canvas: `--ml-bg`
- Surface: `--ml-surface`
- Secondary surface: `--ml-surface-2`
- Text: `--ml-text`
- Muted text: `--ml-muted`
- Border: `--ml-border`
- Strong border: `--ml-border-strong`
- Status: `--ml-success`, `--ml-warning`, `--ml-danger`, `--ml-info`
- Shape: `--ml-radius`
- Shadow: `--ml-shadow`

### Semantic

Historical `--fugue-*` and `--fp-*` tokens are mapped to these Morlane tokens in
`morlane.css`. Do not add new old-style token values to deprecated files.

## Components

### App Shell

- Sidebar width: 248px desktop.
- Topbar height: 48px.
- Page content uses a constrained workspace with compact gutters.
- Navigation items are small, left aligned, and use a raised active state.

### Cards And Panels

- Use `ml-card` or Morlane-mapped shared panels.
- Cards have a white background, 1px border, 6px radius, and light shadow.
- Use dividers, tables, and rows for dense information instead of nested cards.

### Buttons

- Primary: strong filled treatment for the main page action.
- Secondary: white or neutral raised treatment.
- Danger: muted red surface and red text/border.
- Ghost: only for tertiary utilities and dismissive actions.

### Forms

- Stacked labels with optional helper text.
- Inputs and selects use 36px minimum height, white surface, border, and clear
  focus ring.
- Errors must appear near the field and use the danger token family.

### Tables And Lists

- Tables are compact, high readability, and rely on row dividers.
- Resource rows expose primary object name, secondary metadata, status, and
  actions without extra decorative shells.
- Empty states are concise and use the same card language as populated states.

### Auth

- Auth pages use a centered `ml-auth-panel`.
- The first viewport prioritizes the form, provider actions, validation, and
  recovery links.

### Docs

- Docs pages use `ml-docs-shell`: left nav, readable content column, notes,
  tables, and code blocks.
- Docs should not use marketing animation or console-only navigation chrome.

### Marketing

- Marketing uses Morlane's split hero, compact nav, product panel, and terminal
  preview patterns.
- Do not add extra sections or claims beyond the current page information.

## Verification

For broad frontend changes, run:

```text
npm run typecheck
npm run build
```

Then inspect representative routes in the browser at desktop and mobile widths:

- `/`
- `/docs`
- `/auth/sign-in`
- `/auth/sign-up`
- `/new/repository`
- `/app`
