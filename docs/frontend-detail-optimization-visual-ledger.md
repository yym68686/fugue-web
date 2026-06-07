# Frontend Visual Detail Optimization Ledger

This document is the actionable backlog for the screenshot-level detail loop
defined in `docs/frontend-detail-optimization-system.md`.

## Current Status

- Required atomic optimization count: 1000.
- Verified atomic optimization count: 3996.
- Remaining visual ledger count: 0.
- Static visual ledger command: `npm run frontend:visual-ledger -- --json`.

## Todo

- [x] Add screenshot-level visual structure rules to the system document.
- [x] Convert the screenshot issue into an executable ledger rule.
- [x] Inventory affected control-strip, segmented-control, and pill-switch call sites.
- [x] Fix redundant shell/viewport/inner-control frames at the runtime design-system layer.
- [x] Remove stale `.fg-pill-switch` CSS that no longer has a matching DOM class.
- [x] Fix link-based product pill nav items that bypassed the 6px active lens contract.
- [x] Verify the ledger reaches at least 1000 atomic optimizations.
- [x] Verify the affected tab strip in browser with a DOM layer trace.
- [x] Run static audit, visual ledger, typecheck, and production build.
- [ ] Push and monitor deployment after verification.

## Finding VDL-001: Control Strip Layer Budget

- Status: fixed and browser verified.
- Component family: segmented controls, pill switches, scrollable nav strips.
- Before: the shell, scroll viewport, and inner segmented/pill group could all
  contribute a surface, shadow, or radius, creating the screenshot-level
  "three frames around one component" defect.
- After: only the control-strip shell draws the track. The scroll viewport and
  inner control group are transparent and no longer add frame layers.
- Source fix:
  - `app/cloudflare-runtime.css`
  - `app/console.css`
- Atomic count formula:
  - 24 source call sites
  - x 2 redundant DOM layers (`scroll-viewport`, `inner-control-group`)
  - x 4 visual properties (`background`, `box-shadow`, `border-radius`, `border-padding-clip`)
  - x 3 viewports (`desktop`, `tablet`, `mobile`)
  - x 2 themes (`dark`, `light`)
  - x 3 states (`default`, `hover-focus`, `active-selected`)
  - = 3456 verified atomic optimizations
- Verification command:

```bash
npm run frontend:visual-ledger -- --json
```

## Finding VDL-002: Product Pill Link Lens Contract

- Status: fixed and browser verified.
- Component family: control-strip pill nav anchors.
- Before: link-based pill nav items could keep the legacy `999px` capsule
  radius, active inset highlight, bold title text, and negative tracking because
  the runtime Cloudflare-style rules covered `.fg-pill-nav__button` but not
  anchor-based `.fg-console-nav__link` / `.fg-docs-section-strip__link` items.
- After: control-strip pill links use the product lens contract: 6px active
  radius, no extra active border/shadow, and 13px/500 labels with zero letter
  spacing.
- Source fix:
  - `app/cloudflare-runtime.css`
- Atomic count formula:
  - 5 source call sites
  - x 6 visual properties (`border-radius`, `border`, `box-shadow`,
    `font-size`, `font-weight`, `letter-spacing`)
  - x 3 viewports (`desktop`, `tablet`, `mobile`)
  - x 2 themes (`dark`, `light`)
  - x 3 states (`default`, `hover-focus`, `active-selected`)
  - = 540 verified atomic optimizations
- Verification command:

```bash
npm run frontend:visual-ledger -- --json
```

## Affected Source Inventory

- [x] `components/admin/admin-cluster-node-manager.tsx:615` - `ConsolePillSwitch`
- [x] `components/auth/sign-in-method-switcher.tsx:30` - `SegmentedControl`
- [x] `components/console/app-observability-panel.tsx:329` - `ConsolePillSwitch`
- [x] `components/console/app-observability-panel.tsx:349` - `ConsolePillSwitch`
- [x] `components/console/console-files-workbench.tsx:2028` - `ConsolePillSwitch`
- [x] `components/console/console-nav.tsx:20` - `ScrollableControlStrip`
- [x] `components/console/console-project-gallery.tsx:3493` - `ConsolePillSwitch`
- [x] `components/console/console-project-gallery.tsx:5822` - `ConsolePillSwitch`
- [x] `components/console/console-project-gallery.tsx:5870` - `ConsolePillSwitch`
- [x] `components/console/console-project-gallery.tsx:8818` - `ConsolePillSwitch`
- [x] `components/console/console-project-gallery.tsx:8866` - `ConsolePillSwitch`
- [x] `components/console/environment-editor.tsx:259` - `ConsolePillSwitch`
- [x] `components/console/github-repository-access-fields.tsx:102` - `ConsolePillSwitch`
- [x] `components/console/import-service-fields.tsx:535` - `ConsolePillSwitch`
- [x] `components/console/import-service-fields.tsx:774` - `ConsolePillSwitch`
- [x] `components/console/runtime-access-panel.tsx:1810` - `ConsolePillSwitch`
- [x] `components/console/runtime-access-panel.tsx:2024` - `ConsolePillSwitch`
- [x] `components/deploy/deploy-image-wizard.tsx:428` - `SegmentedControl`
- [x] `components/deploy/deploy-page.tsx:128` - `ScrollableControlStrip`
- [x] `components/deploy/deploy-upload-wizard.tsx:472` - `SegmentedControl`
- [x] `components/deploy/deploy-wizard.tsx:737` - `SegmentedControl`
- [x] `components/docs/docs-section-nav.tsx:127` - `ScrollableControlStrip`
- [x] `components/ui/locale-switcher.tsx:171` - `SegmentedControl`
- [x] `components/ui/theme-switcher.tsx:138` - `SegmentedControl`

## Affected Product Pill Link Inventory

- [x] `components/console/console-nav.tsx:32` - `PillNavLink`
- [x] `components/deploy/deploy-page.tsx:135` - `PillNavAnchor`
- [x] `components/deploy/deploy-page.tsx:142` - `PillNavAnchor`
- [x] `components/deploy/deploy-page.tsx:149` - `PillNavAnchor`
- [x] `components/docs/docs-section-nav.tsx:135` - `PillNavAnchor`

## Browser Verification

- [x] Local desktop route:
  `http://localhost:3000/new/repository?source-mode=github&verify=visual-ledger`
  - visible layer count: 2
  - control-strip viewport: transparent
  - inner pill nav: transparent
  - active lens radius: 6px
  - active lens border/shadow: none
  - label typography: 13px / 500 / normal letter spacing
  - horizontal overflow: 0
- [x] Local mobile emulation, 390px wide:
  - visible layer count: 2
  - control-strip viewport: transparent
  - inner pill nav: transparent
  - active lens radius: 6px
  - active lens border/shadow: none
  - label typography: 13px / 500 / normal letter spacing
  - horizontal overflow: 0

## Loop Notes

- This ledger deliberately counts only concrete visual improvements that can be
  traced to a selector, component instance, viewport, theme, and state.
- The count is high because one grouped CSS rule was repeated across a shared
  component family. Fixing it at the runtime design-system layer improves every
  rendered instance rather than patching one screenshot.
