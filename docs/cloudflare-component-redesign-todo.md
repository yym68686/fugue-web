# Cloudflare component redesign todo

This checklist tracks every Fugue frontend component family that must visually align with the Cloudflare console reference. The target is the Cloudflare product UI language: flat black canvas, compact neutral controls, 8px default radii, no ornamental bevel shell, no ambient gradients in product surfaces, minimal hairline borders, restrained status color, and Inter-like product typography. The Fugue wordmark keeps its existing logo font.

## Component Inventory

### App routes

- `app/app/layout.tsx`
- `app/app/loading.tsx`
- `app/app/page.tsx`
- `app/app/api-keys/page.tsx`
- `app/app/apps/page.tsx`
- `app/app/billing/page.tsx`
- `app/app/cluster/page.tsx`
- `app/app/cluster-nodes/page.tsx`
- `app/app/projects/[projectId]/page.tsx`
- `app/app/settings/page.tsx`
- `app/app/settings/profile/page.tsx`
- `app/app/users/page.tsx`
- `app/auth/layout.tsx`
- `app/auth/sign-in/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/auth/finalize/page.tsx`
- `app/new/layout.tsx`
- `app/new/repository/page.tsx`
- `app/new/template/[slug]/page.tsx`

### Shared UI

- `components/ui/button.tsx`
- `components/ui/code-textarea.tsx`
- `components/ui/confirm-dialog.tsx`
- `components/ui/country-flag-label.tsx`
- `components/ui/form-field.tsx`
- `components/ui/hint-tooltip.tsx`
- `components/ui/inline-alert.tsx`
- `components/ui/locale-switcher.tsx`
- `components/ui/panel.tsx`
- `components/ui/pill-nav.tsx`
- `components/ui/proof-shell.tsx`
- `components/ui/route-note.tsx`
- `components/ui/scrollable-control-strip.tsx`
- `components/ui/segmented-control.tsx`
- `components/ui/select-field.tsx`
- `components/ui/stepped-slider-field.tsx`
- `components/ui/tech-stack-logo.tsx`
- `components/ui/theme-switcher.tsx`
- `components/ui/toast.tsx`
- `components/ui/toast-on-mount.tsx`

### Console

- `components/console/api-key-empty-state.tsx`
- `components/console/api-key-manager.tsx`
- `components/console/app-custom-domains-panel.tsx`
- `components/console/app-images-panel.tsx`
- `components/console/app-observability-panel.tsx`
- `components/console/app-route-panel.tsx`
- `components/console/app-settings-panel.tsx`
- `components/console/attached-server-overview.tsx`
- `components/console/backing-service-settings-panel.tsx`
- `components/console/billing-panel.tsx`
- `components/console/cluster-node-gallery.tsx`
- `components/console/compact-resource-meter.tsx`
- `components/console/console-api-keys-page-shell.tsx`
- `components/console/console-billing-page-shell.tsx`
- `components/console/console-cluster-nodes-page-shell.tsx`
- `components/console/console-disclosure-section.tsx`
- `components/console/console-empty-state.tsx`
- `components/console/console-files-workbench.tsx`
- `components/console/console-nav.tsx`
- `components/console/console-onboarding.tsx`
- `components/console/console-page-intro.tsx`
- `components/console/console-page-skeleton.tsx`
- `components/console/console-pill-switch.tsx`
- `components/console/console-primary-action.tsx`
- `components/console/console-profile-menu.tsx`
- `components/console/console-profile-settings-page-shell.tsx`
- `components/console/console-project-badge.tsx`
- `components/console/console-project-gallery.tsx`
- `components/console/console-project-gallery-shell.tsx`
- `components/console/console-route-transition.tsx`
- `components/console/console-shell.tsx`
- `components/console/console-sidebar.tsx`
- `components/console/console-summary-grid.tsx`
- `components/console/console-topbar.tsx`
- `components/console/deployment-target-field.tsx`
- `components/console/environment-editor.tsx`
- `components/console/github-repository-access-fields.tsx`
- `components/console/import-service-fields.tsx`
- `components/console/local-upload-source-field.tsx`
- `components/console/node-key-manager.tsx`
- `components/console/offline-server-overview.tsx`
- `components/console/persistent-storage-editor.tsx`
- `components/console/project-image-tracking-panel.tsx`
- `components/console/runtime-access-panel.tsx`
- `components/console/status-badge.tsx`

### Admin

- `components/admin/admin-app-manager.tsx`
- `components/admin/admin-apps-page-shell.tsx`
- `components/admin/admin-cluster-node-manager.tsx`
- `components/admin/admin-cluster-overview.tsx`
- `components/admin/admin-cluster-page-shell.tsx`
- `components/admin/admin-control-plane-panel.tsx`
- `components/admin/admin-platform-node-enrollment-panel.tsx`
- `components/admin/admin-summary-grid.tsx`
- `components/admin/admin-user-manager.tsx`
- `components/admin/admin-users-page-shell.tsx`

### Auth

- `components/auth/auth-finalize-panel.tsx`
- `components/auth/auth-shell.tsx`
- `components/auth/email-auth-form.tsx`
- `components/auth/password-sign-in-form.tsx`
- `components/auth/provider-button.tsx`
- `components/auth/sign-in-method-switcher.tsx`

### Deploy

- `components/deploy/deploy-create-project-form.tsx`
- `components/deploy/deploy-image-wizard.tsx`
- `components/deploy/deploy-page.tsx`
- `components/deploy/deploy-repository-link-field.tsx`
- `components/deploy/deploy-upload-wizard.tsx`
- `components/deploy/deploy-wizard.tsx`

### Platform design system

- `components/platform/platform-actions.tsx`
- `components/platform/platform-data.tsx`
- `components/platform/platform-feedback.tsx`
- `components/platform/platform-form.tsx`
- `components/platform/platform-icon.tsx`
- `components/platform/platform-layout.tsx`
- `components/platform/platform-workflow.tsx`
- `design-system/tokens.css`
- `design-system/components.css`
- `design-system/platform.css`
- `design-system/component-specs.md`
- `design-system/preview.html`

## Redesign Todo

- [x] Shell, sidebar, topbar, breadcrumbs, command button, profile trigger: remove remaining old Fugue spacing/surface cues and keep Cloudflare's compact 260px sidebar, 58px topbar, flat black rails.
- [x] Buttons and icon buttons: replace pill/bevel/route-icon-island language with Cloudflare compact rectangular controls, 8px radius, Cloudflare-blue primary, flat hover and disabled states.
- [x] Inputs, textareas, selects, search fields, route composer, code textarea: remove rounded 1rem shells and inner glow; align to Cloudflare 36px controls, neutral fill, 8px radius, 1px hairline shadow.
- [x] Segmented controls, pill nav, scrollable control strips, tab-like switches: remove pill container and active bevel; align to compact Cloudflare segmented control with 2px padding and 6px active lens.
- [x] Panels, proof shell, bezel shell, cards, metrics: remove the visible outer rounded frame; use flat neutral sections, row/list grouping, and only local dividers where Cloudflare uses them.
- [x] Disclosure sections and accordions: remove large bordered accordion boxes and circular icons; align to Cloudflare row disclosure with subtle separator and square 32px control.
- [x] Dialogs and confirm modals: remove glass blur/bezel frame; align to Cloudflare modal surface, 8px radius, flat overlay, compact footer/header dividers.
- [x] Project gallery, resource rows, app/user/api-key lists, tables: flatten old card/list mix into Cloudflare resource rows and tables, with 53-72px rows and low-contrast borders only where needed.
- [x] Cluster cards and compact resource meters: remove nested cardlets, gradient meters, and pill metrics; align to Cloudflare compact usage rows and neutral progress tracks.
- [x] Billing surfaces, top-up presets, sliders, ledger rows: remove old large metric cards and rounded nested controls; align to Cloudflare flat billing form/table components.
- [x] Route/settings/domain/image/observability panels: remove legacy workbench, route block, proof-shell, and pill status styling; align to flat Cloudflare form sections and resource tables.
- [x] Status badges, project badges, alerts, toasts: remove halo, gradients, mono all-caps feel, and pill-heavy badges; align to Cloudflare compact status treatments.
- [x] Empty states, loading skeletons, onboarding: remove old centered framed empty cards and theatrical skeletons; align to Cloudflare quiet blank states and rectangular skeletons.
- [x] Auth pages and auth provider controls: keep Fugue logo font but align form controls, provider buttons, method switcher, finalization states, and footer links to Cloudflare product UI.
- [x] Deploy/new project wizard and repository/template flows: remove deploy-specific gradient variable cards and old disclosure shells; align to Cloudflare form wizard and resource chooser style.
- [x] Admin pages and platform primitives: ensure admin apps/users/cluster/control-plane/enrollment use the same Cloudflare row, table, card, button, and form primitives as the console.
- [x] Design system docs and preview: update component specs/preview so the design system no longer documents old Fugue bevel/pill patterns as valid product UI.
- [x] Local verification: run typecheck/build and inspect the redesigned components in browser for console errors, network failures, responsive overflow, and old rounded-framed components. Local protected pages require Postgres, so protected console verification continues on the deployed app.
- [ ] Push and deployment verification: push to `main`, trigger Fugue build, monitor app status, and repeat browser comparison until no unintended old component styling remains.
