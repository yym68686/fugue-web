# Fugue Product Design System Specs

## Scope

This spec reflects the current production baseline across marketing, docs, auth, deploy flows, and the console. It is intentionally product-shaped: the shared system captures patterns that are already reused in real routes and leaves page-specific choreography outside the design system.

Included today:

- Typography roles: `DisplayHeading`, `UiHeading`, `SectionLabel`, `Copy`
- Actions: `Button`
- Navigation and selection: `ScrollableControlStrip`, `SegmentedControl`, `PillNav`, `ConsolePillSwitch`, `UtilityMenu`, `LocaleMenuButton`
- Surfaces: `BezelShell`, `Panel`, `ProofShell`, `ConsoleDisclosure`, `LayoutShell`
- Forms and feedback: `FormField`, `Input`, `SelectField`, `SteppedSlider`, `HintTooltip`, `InlineAlert`, `ConfirmDialog`
- Product semantics: `RouteNote`, `StatusBadge`, `ConsolePageIntro`, `ConsoleEmptyState`, `UploadSource`, `ObjectBelt`, `RouteSignal`, `CodeTextarea`

Still outside the shared baseline:

- full table system and dense data-view rules
- page-specific topbar chips and profile surfaces
- landing scene choreography and route-level atmospheric composition
- one-off galleries, wizard layouts, and marketing-specific storytelling shells

## System Rules

- `Route is the product.` Shared primitives should reinforce route, object, and control-plane meaning instead of becoming generic SaaS decoration.
- `Display is not UI heading.` `Syne` is reserved for authored display moments. Serious product headings use the `UiHeading` role.
- `Shells are single-layer now.` The historical `fg-bezel` class name remains, but the current visual language is a single hairline inner shell with depth from gradient and shadow, not a nested double bezel.
- `Selection reads as one lens system.` Segmented controls, pill nav, and small active chips should all reuse the same raised active-state language.
- `Shared controls ship complete states.` Focus-visible, disabled, loading, empty, error, and reduced-motion behavior are part of the component, not optional polish.

## Typography Roles

### `DisplayHeading`

Purpose:

- Brand, hero, and authored stage copy.

Class:

- `.fg-display-heading`
- `.fg-heading` remains the legacy alias

Notes:

- Uses `Syne`.
- Safe for landing hero copy and auth stage display copy.
- Do not use for panel titles, docs section heads, table objects, or console readouts.

### `UiHeading`

Purpose:

- Serious product titles that need fast scanning and low reading friction.

Class:

- `.fg-ui-heading`

Notes:

- Uses the `Manrope`-based UI-heading role.
- Default for panel titles, modal titles, docs section heads, page intros, and empty states.

### `SectionLabel`

Purpose:

- Mono overline for chapter labels, object names, and technical metadata.

Class:

- `.fg-label`

Notes:

- Use sentence case or title case.
- Do not force full-uppercase labels with `text-transform`.

### `Copy`

Purpose:

- Long-form supporting body copy with controlled width and quieter contrast.

Class:

- `.fg-copy`

Notes:

- Prefer this over ad hoc paragraph styling when the text is part of the shared visual rhythm.

## Actions

### `Button`

Purpose:

- Shared action system for route-level actions, product submits, quiet utilities, and destructive workbench controls.

Variants:

| Variant | Class | Use |
| --- | --- | --- |
| route | `.fg-button--route` | topbar or route-level CTA |
| primary | `.fg-button--primary` | main action inside a product section or form |
| secondary | `.fg-button--secondary` | default visible utility action |
| ghost | `.fg-button--ghost` | tertiary or dismissive action |
| danger | `.fg-button--danger` | destructive action |

Size modifiers:

| Size | Class | Use |
| --- | --- | --- |
| default | none | standard form and panel actions |
| compact | `.fg-button--compact` | rails, topbars, and dense control zones |
| tight | `.fg-button--tight` | dense row actions |

Additional modifiers:

| Modifier | Class | Use |
| --- | --- | --- |
| inline | `.fg-button--inline` | mono row action for lists and key-value rows |
| full width | `.fg-button--full-width` | stretch to container width |

Anatomy:

```html
<a class="fg-button fg-button--route" href="#">
  <span class="fg-button__label">Inspect quickstart</span>
  <span class="fg-button__icon is-island" aria-hidden="true">-&gt;</span>
</a>
```

Notes:

- Only `route` keeps the icon island by default.
- `ghost` is not the default page-intro secondary action inside product UI; use `secondary` unless the action is intentionally quieter.
- `inline + tight` is the default row-action treatment.
- Loading state should keep label legibility and disable repeat clicks.

## Navigation And Selection

### `ScrollableControlStrip`

Purpose:

- Shared outer shell for compact rails that should hug their content in roomy layouts and scroll horizontally when space gets tight.

Classes:

- `.fg-control-strip-shell`
- `.fg-control-strip__viewport`

Notes:

- Use this as a wrapper around `PillNav` or `SegmentedControl`, not as a standalone control.
- Let the shell hug content when possible.
- When content overflows, keep the shell fixed and move the content inside the viewport instead of wrapping or hiding items in a `More` menu.

### `SegmentedControl`

Purpose:

- Shared local view switch for mutually exclusive states such as `Environment / Files / Logs` or `Build / Runtime`.

Anatomy:

```html
<div class="fg-control-strip-shell fg-control-strip-shell--segmented">
  <div class="fg-control-strip__viewport">
    <div class="fg-segmented" aria-label="Workbench views" role="group">
      <button class="fg-segmented__item is-active" aria-pressed="true" type="button">
        <span class="fg-segmented__label">Environment</span>
      </button>
      <button class="fg-segmented__item" aria-pressed="false" type="button">
        <span class="fg-segmented__label">Logs</span>
      </button>
    </div>
  </div>
</div>
```

Notes:

- Use this for local mode switches, not submit actions.
- The active state must be visible without hover.
- Segmented items should share the same active lens language as current pill-nav items and other small selected chips.
- `variant` is explicit. Never rely on a default visual fallback.
- Inside `components/console/` and `components/admin/`, prefer `ConsolePillSwitch` instead of wiring raw `SegmentedControl` with console nav classes by hand.

### `PillNav`

Purpose:

- Detached navigation container for top-level marketing/docs rails or small sub-nav clusters.

Classes:

- `.fg-pill-nav`
- `.fg-pill-nav__button`
- `.fg-pill-nav__label`

Notes:

- Mark the current route with `aria-current="page"` or `aria-pressed="true"`.
- Not for dense app sidebars.

### `ConsolePillSwitch`

Purpose:

- Console/admin wrapper that keeps local segmented controls on the same pill-nav language as topbar navigation and project-detail panel switches.

React wrapper:

- `components/console/console-pill-switch.tsx`

Notes:

- Console segmented controls must use the same pill-nav language as topbar navigation.
- Use this inside `components/console/` and `components/admin/` instead of raw `SegmentedControl`.
- This is the required pattern for project detail panels, runtime access rows, cluster policy controls, and similar console-local switches.
- Do not hand-write the `variant="pill" + fg-console-nav + fg-console-nav__link + fg-console-nav__title` combination at call sites.

### `UtilityMenu`

Purpose:

- Shared small utility disclosure used by theme and locale controls.

Variants:

| Variant | Class | Use |
| --- | --- | --- |
| underline utility | `.fg-locale-utility` | landing and docs mastheads |
| compact menu button | `.fg-locale-menu` | auth and tighter product chrome |

Anatomy:

```html
<details class="fg-locale-utility" open>
  <summary class="fg-locale-utility__trigger">
    <span class="fg-locale-utility__value">English</span>
    <span class="fg-locale-utility__chevron" aria-hidden="true">...</span>
  </summary>
  <div class="fg-locale-utility__panel">
    <ul class="fg-locale-utility__list">
      <li class="fg-locale-utility__list-item">
        <button class="fg-locale-utility__option is-active" aria-pressed="true" type="button">
          <span class="fg-locale-utility__option-label">English</span>
          <span class="fg-locale-utility__option-mark" aria-hidden="true"></span>
        </button>
      </li>
    </ul>
  </div>
</details>
```

Notes:

- Locale and theme share the same shell language even when their content differs.
- Utility menus should read like quiet masthead tools, not product-primary buttons.
- The compact `fg-locale-menu` variant reuses the button system and is preferred in auth and constrained topbars.

## Surfaces

### `BezelShell`

Purpose:

- Shared shell surface for panels, proofs, and other high-trust content blocks.

Classes:

- `.fg-bezel`
- `.fg-bezel__inner`

Notes:

- `fg-bezel` is the historical class name. The current shell is a single inner hairline surface.
- Use it when a surface needs stronger separation than a plain section, not for every list row.

### `Panel`

Purpose:

- Default structured product surface for forms, settings groups, and inline modules.

Classes:

- `.fg-panel`
- `.fg-panel__section`
- `.fg-panel__eyebrow`
- `.fg-panel__title`
- `.fg-panel__copy`
- `.fg-panel__divider`

Anatomy:

```html
<section class="fg-bezel fg-panel">
  <div class="fg-bezel__inner">
    <div class="fg-panel__section">
      <p class="fg-label fg-panel__eyebrow">Workspace route</p>
      <h2 class="fg-panel__title fg-ui-heading">Create a route from source.</h2>
      <p class="fg-panel__copy">Source import and runtime choice stay in the same shared shell.</p>
    </div>
  </div>
</section>
```

Notes:

- Prefer dividers and section rhythm over nested shell-within-shell chrome.
- Auth pages may locally flatten panel internals for composition, but they still inherit the same shared typography and section grammar.

### `ProofShell`

Purpose:

- Specialized shell for command blocks and control-plane proof.

Classes:

- `.fg-proof-shell`
- `.fg-proof-shell__ribbon`
- `.fg-proof-shell__empty`

Notes:

- Prefer this over a naked `pre`.
- Ribbon items should carry real environment or object metadata, not decorative tags.

### `ConsoleDisclosure`

Purpose:

- Shared reveal surface for secondary product details that should stay in-band with the surrounding shell language.

Classes:

- `.fg-console-disclosure`
- `.fg-console-disclosure--section`
- `.fg-console-disclosure__summary-*`
- `.fg-console-disclosure__panel`

Notes:

- Use the `--section` variant for product settings and expandable details inside console surfaces.
- The summary icon should reuse the same active lens language when open.
- On narrow screens, label and value rows stack instead of forcing right-aligned compression.

### `LayoutShell`

Purpose:

- Shared width control for full-bleed and content-width sections.

Classes:

| Class | Width |
| --- | --- |
| `.fg-shell` | `1400px` max |
| `.fg-content-shell` | `1180px` max |

## Forms And Feedback

### `FormField`

Purpose:

- Shared label, optional meta, tooltip, control, and error stack.

Classes:

- `.fg-field-stack`
- `.fg-field-label`
- `.fg-field-label__main`
- `.fg-field-label__text`
- `.fg-field-label__meta`
- `.fg-field-control`
- `.fg-field-error`

Notes:

- Labels sit above the control.
- Helper text belongs in tooltips or nearby copy, not inside placeholders.
- Error state belongs on both the control and the field copy.

### `Input`

Purpose:

- Shared text input surface for auth, deploy, and console forms.

Class:

- `.fg-input`

Notes:

- Use the field shell for most one-line inputs.
- Hover and focus lift the surface slightly; focus-visible uses the shared accent outline.

### `SelectField`

Purpose:

- Shared select control with floating chip chevron.

Classes:

- `.fg-select`
- `.fg-select__control`
- `.fg-select__icon`

Notes:

- The chevron lives inside its own small raised chip, matching the broader hardware language.

### `SteppedSlider`

Purpose:

- Shared numeric slider surface with a readable current-value pill.

Classes:

- `.fg-stepped-slider`
- `.fg-stepped-slider__value-pill`
- `.fg-stepped-slider__input`
- `.fg-stepped-slider__bounds`

Notes:

- Use for bounded numeric choices with a small number of meaningful steps.
- Keep the value pill visible; do not rely on thumb position alone.

### `HintTooltip`

Purpose:

- Quiet inline help for labels and secondary explanatory details.

Classes:

- `.fg-hint-tooltip`
- `.fg-hint-tooltip__trigger`
- `.fg-hint-tooltip__bubble`
- `.fg-hint-inline`

Notes:

- Use for targeted clarification, not long-form documentation.
- Tooltip copy should stay short, concrete, and task-relevant.

### `InlineAlert`

Purpose:

- Shared in-band feedback block for info, warning, success, and error states.

Classes:

- `.fg-inline-alert`
- `.fg-inline-alert--info`
- `.fg-inline-alert--warning`
- `.fg-inline-alert--success`
- `.fg-inline-alert--error`

Notes:

- Error alerts should name the real failure and the next useful action.
- Do not use inline alerts as decorative highlight cards.

### `ConfirmDialog`

Purpose:

- Shared confirmation surface for destructive or high-impact actions.

Classes:

- `.fg-confirm-dialog-*`

Notes:

- Use `alertdialog` for destructive confirmation, `dialog` for neutral confirmation.
- Initial focus should land on the least destructive action.
- For irreversible deletes, require exact-text confirmation when the product risk is high.

## Product Semantics

### `RouteNote`

Purpose:

- Right-rail route card language used across landing, docs side notes, and console summaries.

Class:

- `.fg-route-note`

Notes:

- This is route and object language, not a generic marketing feature card.

### `StatusBadge`

Purpose:

- Compact mono status pill for live state, health, and operational tone.

Classes:

- `.fg-status-badge`
- `.fg-status-badge--positive`
- `.fg-status-badge--warning`
- `.fg-status-badge--danger`
- `.fg-status-badge--info`
- `.fg-status-badge--neutral`
- `.fg-status-badge--live`

Notes:

- Use `live` only when the breathing dot has real meaning.
- Keep labels short enough to fit inline with other controls.

### `ConsolePageIntro`

Purpose:

- Standard page-intro block for console and admin routes.

Classes:

- `.fg-console-page-intro`
- `.fg-console-page-intro__copy`
- `.fg-console-page-intro__actions`

Notes:

- Intro copy stays left-aligned; action rail sits to the right on wide screens and drops below on narrow screens.

### `ConsoleEmptyState`

Purpose:

- Shared empty-state language for console and admin panels.

Classes:

- `.fg-console-empty-state`
- `.fg-console-empty-state__actions`

Notes:

- Empty states should explain why the surface is empty and offer the next useful route when one exists.

### `UploadSource`

Purpose:

- Shared upload dropzone pattern for deploy and import flows.

Classes:

- `.fg-upload-source`
- `.fg-upload-source__dropzone`
- `.fg-upload-source__head`
- `.fg-upload-source__meter`
- `.fg-upload-source__chip`
- `.fg-upload-source__list`

Notes:

- This is the shared dropzone shell, not a generic marketing card.
- Drag-active state should lift slightly and keep the copy readable.

### `ObjectBelt`

Purpose:

- Compact object-model strip for core product nouns.

Class:

- `.fg-object-belt`

Notes:

- Use this as a semantic map, not a tag cloud.

### `RouteSignal`

Purpose:

- Visual route path for process, migration, and topology.

Class:

- `.fg-route-signal`

Notes:

- Keep it meaningful. It should map to a real product transition or information path.
- Hide it when it stops being legible on narrow screens.

### `CodeTextarea`

Purpose:

- Syntax-highlighted textarea layer for file editors and technical composition surfaces.

Classes:

- `.fg-code-textarea`
- `.fg-code-textarea__highlight`
- `.fg-code-textarea__input`

Notes:

- The component owns the syntax overlay behavior and token colors.
- The surrounding editor shell should own padding, border, background, and overall height.

## React Wrappers

Current React wrappers live in:

| Pattern | Path |
| --- | --- |
| Button | `components/ui/button.tsx` |
| ScrollableControlStrip | `components/ui/scrollable-control-strip.tsx` |
| SegmentedControl | `components/ui/segmented-control.tsx` |
| PillNav | `components/ui/pill-nav.tsx` |
| ConsolePillSwitch | `components/console/console-pill-switch.tsx` |
| Panel | `components/ui/panel.tsx` |
| ProofShell | `components/ui/proof-shell.tsx` |
| FormField | `components/ui/form-field.tsx` |
| SelectField | `components/ui/select-field.tsx` |
| SteppedSlider | `components/ui/stepped-slider-field.tsx` |
| HintTooltip | `components/ui/hint-tooltip.tsx` |
| InlineAlert | `components/ui/inline-alert.tsx` |
| ConfirmDialog | `components/ui/confirm-dialog.tsx` |
| UtilityMenu | `components/ui/locale-switcher.tsx`, `components/ui/theme-switcher.tsx` |
| StatusBadge | `components/console/status-badge.tsx` |
| ConsolePageIntro | `components/console/console-page-intro.tsx` |
| ConsoleEmptyState | `components/console/console-empty-state.tsx` |
| ConsoleDisclosure | `components/console/console-disclosure-section.tsx` |
| CodeTextarea | `components/ui/code-textarea.tsx` |

## Change Rule

When the visual baseline moves, update all four layers together:

1. `tokens.css`
2. `components.css`
3. `component-specs.md`
4. `preview.html`

If a pattern only exists in one route or one experiment, keep it out of the design system until it proves reusable.
