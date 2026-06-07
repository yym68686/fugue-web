# Fugue Platform Component Specs

## Scope

This spec defines the new `fp-*` platform UI layer. It is intentionally dense, neutral, and operational. It should be used for console, admin, control-plane, billing, onboarding, resource-management, and docs-adjacent product surfaces.

The old `fg-*` layer remains available as compatibility, but new shared console components should prefer `fp-*` when the goal is a Cloudflare-like platform UI.

## System Rules

- Use `Inter`/system UI for every product surface. Do not use display fonts in console UI.
- Use 8px as the default control radius and 6px for menu/segment inner items.
- Use unframed product sections by default. Put 1px hairlines on controls, menus, tables, and true resource rows instead of wrapping whole areas in rounded frames.
- Default controls are 36px high. Compact icon buttons are 32px.
- Sidebar nav rows are 34px high and use 13px text.
- Resource rows are 53-72px high, clickable, and table/list-like rather than framed as standalone cards.
- Popovers and menus are solid raised panels with 6px inner padding.
- Primary actions use Cloudflare blue. Secondary actions are neutral raised controls. Ghost is only for low-priority utilities.
- Every shared control needs hover, focus-visible, disabled, loading or empty/error treatment where applicable.
- Keep examples platform-neutral. Never embed third-party logos, user account names, domains, secrets, or resource names from sampled dashboards.

## Tokens

### Primitive

- Neutrals: `--fp-neutral-50` through `--fp-neutral-1000`.
- Accent: `--fp-blue-600`.
- Status: `--fp-green-*`, `--fp-amber-*`, `--fp-red-*`, `--fp-teal-*`, `--fp-purple-*`.
- Typography: `--fp-font-ui`, `--fp-font-mono`, `--fp-type-*`, `--fp-line-*`.
- Spacing: `--fp-space-*`.
- Shape: `--fp-radius-xs` through `--fp-radius-xl`.

### Semantic

- Surfaces: `--fp-surface-canvas`, `--fp-surface-sidebar`, `--fp-surface-topbar`, `--fp-surface-panel`, `--fp-surface-control`, `--fp-surface-overlay`.
- Text: `--fp-text-primary`, `--fp-text-secondary`, `--fp-text-tertiary`, `--fp-text-muted`, `--fp-text-disabled`.
- Borders: `--fp-border-subtle`, `--fp-border-default`, `--fp-border-strong`.
- Feedback: `--fp-success`, `--fp-warning`, `--fp-danger`, `--fp-info`.

### Component

- Shell: `--fp-sidebar-width`, `--fp-topbar-height`.
- Controls: `--fp-control-height-sm`, `--fp-control-height-md`, `--fp-control-height-lg`.
- Cards: `--fp-card-padding`, `--fp-card-radius`, `--fp-card-gap`; default product sections have no frame.
- Rows: `--fp-row-height`, `--fp-row-padding`.
- Menus: `--fp-menu-padding`, `--fp-menu-item-height`, `--fp-menu-item-radius`.

## Components

## React Implementation Layer

Shared product surfaces should use the React wrappers in `components/platform/`
before adding new page-local markup. The wrappers are intentionally thin: they
bind semantic structure and state to `fp-*` classes, while `platform.css`
remains the visual source of truth.

Current wrapper files:

- `components/platform/platform-actions.tsx`: `PlatformButton`,
  `PlatformButtonLink`, `PlatformButtonAnchor`, `PlatformIconButton`,
  `PlatformButtonGroup`.
- `components/platform/platform-data.tsx`: `PlatformCard`,
  `PlatformMetric`, `PlatformMetricGrid`, `PlatformResourceList`,
  `PlatformResourceRow`, `PlatformResourceLink`, `PlatformBadge`,
  `PlatformStatus`, `PlatformTable`, `PlatformKeyValueList`.
- `components/platform/platform-feedback.tsx`: `PlatformAlert`,
  `PlatformEmptyState`, `PlatformErrorState`, `PlatformLoadingState`,
  `PlatformSkeleton`, `PlatformModal`, `PlatformDrawer`.
- `components/platform/platform-form.tsx`: `PlatformField`,
  `PlatformInput`, `PlatformTextarea`, `PlatformSelect`,
  `PlatformToolbar`, `PlatformSearchField`, `PlatformSegmentedControl`.
- `components/platform/platform-icon.tsx`: centralized local icon layer.
- `components/platform/platform-layout.tsx`: `PlatformShell`,
  `PlatformSidebar`, `PlatformTopbar`, `PlatformBreadcrumbs`,
  `PlatformPage`, `PlatformPageHeader`, `PlatformSection`,
  `PlatformStack`, `PlatformGrid`.
- `components/platform/platform-workflow.tsx`: `PlatformWizard`,
  `PlatformStepList`, `PlatformStep`.

Adoption rules:

- Use `PlatformShell` for authenticated console/admin surfaces.
- Use `PlatformWizard` for deploy/create flows.
- Use `PlatformPage` and `PlatformPageHeader` before adding a new page-level
  layout wrapper.
- Use `PlatformResourceList` for primary object lists and `PlatformTable` for
  comparison/audit records.
- Use `PlatformEmptyState`, `PlatformErrorState`, and `PlatformLoadingState`
  for production states instead of blank panels or raw spinners.
- Do not add new `fg-*` product components. Existing `fg-*` code is a migration
  compatibility layer and must be visually normalized to the Cloudflare product
  UI when it appears in app/admin/auth/deploy surfaces.

Current surface mapping:

- Console/admin: `PlatformShell` + grouped sidebar + `PlatformPage`.
- Project detail: platform shell plus a scoped project workbench compatibility
  layer until every legacy panel is extracted.
- Deploy/new: `PlatformWizard` around the existing source/import forms.
- Auth: `fp-auth-page` scoped form-first shell.
- Docs: `fp-docs-page` scoped docs rail, section nav, tables, and code blocks.
- Landing: `fp-landing-page` scoped buttons, route notes, proof shell, and
  object belt while preserving the full-bleed atmospheric scene.

Compatibility classes that are intentionally still present are tracked in
`docs/frontend-platform-migration-inventory.md`.

### App Shell

Classes:

- `.fp-app-shell`
- `.fp-sidebar`
- `.fp-main`
- `.fp-topbar`
- `.fp-page`
- `.fp-page-header`

Rules:

- Desktop shell uses a 260px sidebar and sticky 58px topbar.
- Main page width defaults to `1172px`; use `.fp-page--wide` for `1400px`.
- Mobile collapses to a single column and hides the long sidebar nav in the preview pattern.

### Sidebar Navigation

Classes:

- `.fp-sidebar__brand`
- `.fp-command`
- `.fp-nav`
- `.fp-nav-section`
- `.fp-nav-item`

States:

- Default: transparent row, tertiary text.
- Hover/current: `--fp-surface-active`, primary text.
- Command search: 36px raised control with command key on the right.

### Topbar And Breadcrumb

Classes:

- `.fp-topbar`
- `.fp-breadcrumb`
- `.fp-topbar__actions`

Rules:

- Topbar is a solid surface with a bottom hairline.
- Breadcrumb is small, muted, and left-aligned.
- Right actions use small ghost or neutral raised buttons.

### Buttons

Classes:

- `.fp-button`
- `.fp-button--primary`
- `.fp-button--ghost`
- `.fp-button--danger`
- `.fp-button--sm`
- `.fp-button--lg`
- `.fp-icon-button`

States:

| Variant | Background | Text | Border/Ring | Use |
| --- | --- | --- | --- | --- |
| default | `--fp-surface-control` | primary | 1px default | secondary and filter controls |
| primary | `--fp-accent` | white | none | main submit/create action |
| ghost | transparent | primary | none | topbar and tertiary utilities |
| danger | danger muted | white | danger ring | destructive action |

### Sections And Cards

Classes:

- `.fp-card`
- `.fp-card--flush`
- `.fp-card--raised`
- `.fp-card__header`
- `.fp-card__body`
- `.fp-card__footer`

Rules:

- Default product sections are transparent and unframed.
- Use a 1px ring only for true repeated objects, menus, controls, modals, and empty states that need containment.
- Do not nest cards inside cards unless the inner object is a true repeated item.

### Metrics

Classes:

- `.fp-metric-grid`
- `.fp-metric`
- `.fp-metric__body`
- `.fp-metric__label`
- `.fp-metric__value`
- `.fp-metric__delta`
- `.fp-sparkline`

Rules:

- Metrics sit in an unframed grid with internal dividers.
- Values use 24-30px/600 with no negative tracking.
- Green/red deltas are text-first and compact.

### Toolbar, Inputs, Selects

Classes:

- `.fp-toolbar`
- `.fp-toolbar__search`
- `.fp-search-input`
- `.fp-input`
- `.fp-select`
- `.fp-textarea`
- `.fp-field`
- `.fp-label`
- `.fp-help`

Rules:

- Filters use 36px controls.
- Search shell contains icon + borderless input.
- Focus-visible is a blue 3px outer ring.

### Resource Rows

Classes:

- `.fp-resource-list`
- `.fp-row`
- `.fp-row__icon`
- `.fp-row__main`
- `.fp-row__title`
- `.fp-row__meta`
- `.fp-row__side`

Rules:

- Use table/list rows instead of heavy cards for primary resources.
- Row height defaults to 53-72px depending on density.
- Primary object, route/source metadata, timestamp, badges, and row menu sit in one scan line without nested cardlets.

### Tables

Classes:

- `.fp-table-wrap`
- `.fp-table`

Rules:

- Tables are for secondary details and audit-like records.
- Header background is transparent; row hover is subtle.
- Avoid large border grids.

### Menus

Classes:

- `.fp-menu`
- `.fp-menu__item`
- `.fp-menu__copy`
- `.fp-menu__title`
- `.fp-menu__description`

Rules:

- Menu panel uses solid `--fp-surface-overlay`, 8px radius, 6px padding.
- Items use 52px height, 6px radius, icon + two-line copy.
- Hover state is a slight surface lift, not a color wash.

### Badges And Status

Classes:

- `.fp-badge`
- `.fp-badge--info`
- `.fp-badge--success`
- `.fp-badge--warning`
- `.fp-badge--danger`
- `.fp-status`
- `.fp-status--success`
- `.fp-status--warning`
- `.fp-status--danger`

Rules:

- Badges are 20px compact labels with 6px radius and 12px text.
- Status rows use plain colored text or a tiny colored dot plus 13-14px text; no halo or animated badge glow.

### Segmented Controls And Tabs

Classes:

- `.fp-segmented`
- `.fp-segmented__item`
- `.fp-tabs`
- `.fp-tab`

Rules:

- Active state is a small raised lens within a neutral rail.
- Use for local mutually exclusive views, not submit actions.

### Choice Cards

Classes:

- `.fp-choice-grid`
- `.fp-choice`
- `.fp-choice__copy`
- `.fp-choice__title`
- `.fp-choice__description`

Rules:

- Choice cards are 56px high by default.
- Selected cards get an accent ring and faint outer halo.

### Feedback States

Classes:

- `.fp-alert`
- `.fp-alert--warning`
- `.fp-alert--danger`
- `.fp-empty`
- `.fp-loading-state`
- `.fp-error-state`
- `.fp-skeleton`
- `.fp-toast`
- `.fp-tooltip`

Rules:

- Alerts use tinted solid panels with a single semantic ring.
- Empty/loading/error blocks are quiet and unframed unless containment is required.
- Skeleton shimmer disables under reduced motion.

### Modal And Fullscreen Wizard

Classes:

- `.fp-modal-backdrop`
- `.fp-modal`
- `.fp-modal__header`
- `.fp-modal__body`
- `.fp-modal__footer`
- `.fp-fullscreen-dialog`
- `.fp-wizard`
- `.fp-wizard__rail-title`
- `.fp-wizard__eyebrow`

Rules:

- Fullscreen creation flows use the whole canvas with a 58px header.
- Wizard content is centered with an optional left rail title on desktop.
- Ordinary confirmation dialogs use solid overlays and compact footers.

## Accessibility

- Interactive controls must use native `button`, `a`, `input`, `select`, or ARIA roles only when native elements are not possible.
- Icon-only buttons need `aria-label`.
- Current nav items use `aria-current="page"`.
- Segmented items use `aria-pressed`; tabs use `role="tab"` and `aria-selected`.
- Choice cards use `aria-checked` when acting like radios.
- Focus-visible styles are required and are defined in `platform.css`.

## Responsive

- Under 1100px, the sidebar collapses into top shell behavior and long nav is hidden in the preview pattern.
- Under 760px, grids become single-column, page header stacks, metric charts move below content, and row side metadata hides.
