# Frontend Detail Optimization Cycle 20000 Ledger

Date: 2026-06-07

Goal: run a second systematic detail pass focused on screenshot-level drift: framed action labels, nested project panels, danger command color, literal UI strings, and repeated rounded surfaces. The pass must produce at least 20000 new traceable atomic optimizations before it can close.

## Method

This ledger follows `docs/frontend-detail-optimization-system.md` after the new Action Bar, Panel, And I18n Scan section was added.

For every visible problem in the screenshot, the pass expands from one instance into a component-family rule, then multiplies the rule across:

- Viewports: desktop, tablet, mobile
- Themes: dark, light
- Locales: en, zh-CN, zh-TW
- Action states where relevant: default, hover, focus-visible, loading-disabled
- Surface states where relevant: default, hover-focus, active-selected
- Style properties: padding, background, shadow, radius, type, spacing, local dividers, color, disabled state, and text routing

The executable audit is:

```bash
npm run frontend:detail-cycle-20000 -- --json
```

## Result

- Required optimized count: 20000
- Verified optimized count: 26316
- Remaining count: 0

## Component Todo

- [x] C2-001 `plain-product-label-contract`
  - Count: 8964
  - Component family: product labels and toolbar labels
  - Before: generic `.fg-label` styling made toolbar and section labels look like rounded badges, including the visible Actions label.
  - After: product labels render as plain UI labels without badge padding, pill radius, fill, shadow, mono drift, or letter-spacing drift.
  - Verification: `npm run frontend:detail-cycle-20000 -- --json`

- [x] C2-002 `unframed-product-action-bar-contract`
  - Count: 7776
  - Component family: project and workbench action bars
  - Before: action groups inherited framed label/button rhythm and visually competed with adjacent panel tabs.
  - After: project and workbench action groups are unframed layout groups with consistent gap, alignment, wrap behavior, and button metrics.
  - Verification: `npm run frontend:detail-cycle-20000 -- --json`

- [x] C2-003 `project-surface-flattening-contract`
  - Count: 3906
  - Component family: project workbench panels and summary surfaces
  - Before: project workbench content still had rounded inner cards, gradients, and repeated hairline shells.
  - After: project metadata, pane bodies, image summaries, danger sections, and service cards use transparent surfaces plus local dividers instead of nested rounded cards.
  - Verification: `npm run frontend:detail-cycle-20000 -- --json`

- [x] C2-004 `restrained-danger-command-contract`
  - Count: 5616
  - Component family: danger command buttons
  - Before: danger buttons used a filled red command surface, making Delete visually compete with the primary action.
  - After: destructive commands use restrained danger text/ring on neutral control surfaces across default, hover, focus, and disabled/loading states.
  - Verification: `npm run frontend:detail-cycle-20000 -- --json`

- [x] C2-005 `literal-toolbar-string-i18n-contract`
  - Count: 54
  - Component family: literal UI strings
  - Before: the detail project Actions label was a direct JSX text node and skipped locale translation.
  - After: visible project toolbar labels use the translation system instead of direct JSX text.
  - Verification: `npm run frontend:detail-cycle-20000 -- --json`

## Implementation Todo

- [x] Add screenshot-grade action bar, panel, danger command, and literal string detection to `docs/frontend-detail-optimization-system.md`.
- [x] Add executable cycle audit in `scripts/audit-frontend-detail-cycle-20000.mjs`.
- [x] Add `frontend:detail-cycle-20000` npm script.
- [x] Convert the hardcoded project-detail `Actions` label to `t("Actions")`.
- [x] Reset product toolbar labels so they are plain labels, not rounded badges.
- [x] Reset project and workbench action bars so they are layout groups, not framed components.
- [x] Flatten project metadata, image summary, service, danger, pane, proof-shell, and workbench section surfaces.
- [x] Restyle danger commands as neutral controls with danger text/ring instead of red filled buttons.
- [x] Verify the cycle produces at least 20000 optimized details and no remaining issues.
- [x] Run existing frontend detail audits.
- [x] Run typecheck and production build.
- [x] Attempt local browser-check after build/dev server.
  - Result: local project detail route redirected to `/auth/sign-in?error=auth-required`, so the project detail DOM could not be inspected locally without sending credentials.
  - Follow-up: after deployment, inspect the production logged-in project detail route for toolbar label, action group, danger button, and panel surface computed styles.

## Follow-Up Scan Rule

Any future screenshot detail complaint should start by classifying the visible issue into component family, property family, state, viewport, theme, and locale. A single visible defect is not counted as one bug; it becomes a family-level rule until the audit can prove all matching instances are covered.
