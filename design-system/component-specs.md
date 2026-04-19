# Fugue Minimal Component Specs

## Scope

This minimal system only includes patterns that are already stable in the current Fugue product baseline and are safe to reuse across marketing, auth, docs, and console.

Included:

- `Button`
- `ConfirmDialog`
- `ScrollableControlStrip`
- `SegmentedControl`
- `DisplayHeading`
- `UiHeading`
- `PillNav`
- `SectionLabel`
- `RouteNote`
- `BezelShell`
- `ProofShell`
- `ObjectBelt`
- `RouteSignal`
- `LayoutShell`

Not included yet:

- `Input`
- `FormField`
- `Badge`
- `Alert`
- `Dialog`
- `Table`

Those should be added after auth and console requirements are real, not guessed early.

## Typography Roles

### `DisplayHeading`

Purpose:

- Branded or atmospheric display copy for landing and stage areas.

Class:

- `.fg-display-heading`
- `.fg-heading` remains a legacy alias for display usage

Notes:

- Uses `Syne`.
- Safe for marketing hero copy and auth stage display copy.
- Do not use for panel, modal, or dense product UI titles.

### `UiHeading`

Purpose:

- Readable, serious headings for product surfaces.

Class:

- `.fg-ui-heading`

Notes:

- Uses `Manrope`-based UI typography.
- Default for panel titles, modal titles, console page intros, dense docs sections, and empty-state titles.
- Prefer this whenever the heading needs fast scanning over editorial character.

## Button

### Purpose

Shared action system for route-level actions, product submits, quiet utilities, and destructive workbench controls.

### Variants

| Variant | Class | Use |
| --- | --- | --- |
| route | `.fg-button--route` | Topbar or route-level action |
| primary | `.fg-button--primary` | Main action in a product section or form |
| secondary | `.fg-button--secondary` | Default utility action with readable resting chrome |
| ghost | `.fg-button--ghost` | Tertiary or dismissive action with quiet outline |
| danger | `.fg-button--danger` | Destructive action |
| compact | `.fg-button--compact` | Standard compact control-rail or header action |
| tight | `.fg-button--tight` | Dense row or list action |
| inline | `.fg-button--inline` | Mono row action for tables and key lists |
| full-width | `.fg-button--full-width` | Stretch to container width |

### Anatomy

```html
<a class="fg-button fg-button--route" href="#">
  <span class="fg-button__label">Inspect quickstart</span>
  <span class="fg-button__icon is-island" aria-hidden="true">-&gt;</span>
</a>
```

```html
<button class="fg-button fg-button--primary" type="button">
  <span class="fg-button__label">Create project</span>
</button>
```

```html
<button class="fg-button fg-button--secondary fg-button--inline fg-button--tight" type="button">
  <span class="fg-button__label">Refresh keys</span>
</button>
```

```html
<button class="fg-button fg-button--primary" data-loading="true" aria-busy="true" disabled type="button">
  <span class="fg-button__status" aria-hidden="true"></span>
  <span class="fg-button__label">Saving...</span>
</button>
```

### States

| State | Treatment |
| --- | --- |
| default | Route / product / ghost / danger surface according to role; resting state stays legible before hover |
| hover | `translateY(-1px)` plus border and surface lift |
| focus-visible | Accent outline with 3px offset |
| active | Return to neutral Y position with a light press scale |
| loading | Keep the button legible, show a status spinner or pulse, disable repeat click |
| disabled | Muted surface, muted text, no pointer events |

### Notes

- Only `route` keeps the icon island by default.
- `primary`, `secondary`, `ghost`, and `danger` are product actions. Do not force the island into dense auth / docs / console surfaces.
- `secondary` is the default non-primary button on dark product surfaces. It should remain clearly visible in its resting state.
- `ghost` is reserved for tertiary or dismissive actions. Do not use it as the default page-intro or modal-cancel button in product UI.
- When buttons share a rail with segmented controls, keep them on the same compact height.
- Row-level list and table actions should prefer `inline + tight`.
- Avoid adding boolean prop combinations later like `primary + compact + quiet + iconOnly`; prefer explicit variants or composition.

## ConfirmDialog

### Purpose

Shared confirmation surface for destructive or high-impact product actions such as deleting services, revoking credentials, or promoting a workspace member to admin.

### Anatomy

```html
<div class="fg-confirm-dialog-backdrop">
  <div aria-modal="true" class="fg-confirm-dialog-shell" role="alertdialog">
    <section class="fg-bezel fg-panel fg-confirm-dialog-panel">
      <div class="fg-panel__section fg-confirm-dialog__section">
        <p class="fg-label fg-panel__eyebrow fg-confirm-dialog__eyebrow is-danger">
          Destructive action
        </p>
        <h2 class="fg-panel__title fg-ui-heading fg-confirm-dialog__title">Delete service?</h2>
        <p class="fg-panel__copy fg-confirm-dialog__copy">
          This queues removal and the route will stop serving once the operation completes.
        </p>
        <div class="fg-field-stack fg-confirm-dialog__field">
          <span class="fg-field-label">
            <span class="fg-field-label__main">
              <label class="fg-field-label__text" for="service-name-confirm">Service name</label>
              <span class="fg-hint-tooltip">
                <button
                  aria-describedby="confirm-service-hint"
                  aria-label="Service name"
                  class="fg-hint-tooltip__trigger"
                  type="button"
                >
                  i
                </button>
                <span class="fg-hint-tooltip__bubble" id="confirm-service-hint" role="tooltip">
                  Type the service name exactly as shown to enable deletion.
                </span>
              </span>
            </span>
          </span>
          <span class="fg-field-control">
            <input class="fg-input" id="service-name-confirm" name="confirmation" type="text" />
          </span>
        </div>
      </div>
      <div class="fg-panel__section fg-confirm-dialog__actions">
        <button class="fg-button fg-button--secondary" type="button">Cancel</button>
        <button class="fg-button fg-button--danger" type="button">Delete service</button>
      </div>
    </section>
  </div>
</div>
```

### States

| State | Treatment |
| --- | --- |
| default | Centered bezel shell with dimmed backdrop and explicit cancel + confirm actions |
| focus-visible | Both actions keep the shared product focus ring; initial focus defaults to the cancel action |
| danger | Danger eyebrow plus danger confirm button; copy explains the irreversible effect clearly |
| dismiss | Escape, backdrop click, and cancel button all close the dialog without side effects |
| text confirmation | For irreversible object deletes, show a labeled input and keep the danger action disabled until the typed value exactly matches the named object |

### Notes

- Use `alertdialog` for destructive actions and `dialog` for neutral confirmations.
- Default the initial focus to the least destructive option.
- Dialog copy must name the object being changed and describe the real effect; do not rely on generic `Are you sure?`.
- Action rails should stay on the same proof-shell inner surface as the dialog body; use the section divider for structure instead of a darker footer tray.
- For high-risk product deletes such as removing a service, require exact-text confirmation with a visible label, helper copy in the shared tooltip trigger, and inline mismatch feedback.
- Keep confirm labels action-specific: `Delete service`, `Revoke key`, `Make admin`.
- Backdrop blur is functional context dismissal, not decorative chrome.

## ScrollableControlStrip

### Purpose

Shared outer shell for local navigation rails that should hug their content in roomy layouts and switch to internal horizontal scrolling when the available slot gets tighter.

### Anatomy

```html
<div
  class="fg-control-strip-shell fg-control-strip-shell--segmented"
  data-overflow="true"
  data-scroll-start="true"
  data-scroll-end="false"
>
  <div class="fg-control-strip__viewport">
    <!-- fg-segmented or fg-pill-nav -->
  </div>
</div>
```

### Notes

- Use this as a wrapper around `PillNav` or `SegmentedControl`, not as a standalone control.
- Wide layouts should let the shell collapse to content width. Do not force full-width trays unless the surrounding layout genuinely needs them.
- When the rail overflows, keep the outer shell fixed and move the contents inside the viewport. Do not wrap onto multiple rows and do not hide options behind a `More` menu by default.
- Edge fades are an overflow affordance, not decoration. They should appear only when content extends past the current scroll position.
- React implementation: `components/ui/scrollable-control-strip.tsx`.

## SegmentedControl

### Purpose

Shared local view switch for mutually exclusive app states such as `Environment / Files / Logs`, `Variables / Raw`, or `Build / Runtime`.

### Anatomy

```html
<div class="fg-control-strip-shell fg-control-strip-shell--segmented">
  <div class="fg-control-strip__viewport">
    <div class="fg-segmented" aria-label="Workbench views" role="group">
      <button class="fg-segmented__item is-active" type="button" aria-pressed="true">
        <span class="fg-segmented__label">Environment</span>
      </button>
      <button class="fg-segmented__item" type="button" aria-pressed="false">
        <span class="fg-segmented__label">Files</span>
      </button>
      <button class="fg-segmented__item" type="button" aria-pressed="false">
        <span class="fg-segmented__label">Logs</span>
      </button>
    </div>
  </div>
</div>
```

### States

| State | Treatment |
| --- | --- |
| default | Shared tray plus readable inactive labels |
| hover | Quiet hover fill and stronger text |
| active | Raised active lens, stronger border, full text contrast |
| focus-visible | Accent outline with 3px offset |
| disabled | Reduced opacity, no interaction |

### Notes

- Use this for local view switching, not for destructive or submit actions.
- If clicking an option swaps a panel, picker, or content mode, prefer `SegmentedControl` over `Button`.
- Keep all options in one shared rail so users read them as one mutually exclusive set.
- The selected state must be visible without hover.
- Let the tray hug content when space is available. If the rail becomes wider than its slot, keep the outer shell fixed and let the inner viewport scroll horizontally instead of switching to a dropdown or wrapping into multiple rows.
- Segmented items, stateful pill-nav links, and file pills should reuse the same raised selection lens. Only the tray density and padding should change by context.
- In mixed control rails, align the segmented outer height with adjacent compact buttons.
- React implementation: `components/ui/segmented-control.tsx` composes `components/ui/scrollable-control-strip.tsx` so detail-page `Panels`, environment format switches, and similar rails all inherit the same overflow behavior.

## PillNav

### Purpose

Detached floating navigation container.

### Anatomy

```html
<div class="fg-control-strip-shell fg-control-strip-shell--pill">
  <div class="fg-control-strip__viewport">
    <nav class="fg-pill-nav" aria-label="Primary">
      <a href="#route" aria-current="page">Route</a>
      <a href="#surface">Surface</a>
      <a href="#proof">Proof</a>
    </nav>
  </div>
</div>
```

### States

| State | Treatment |
| --- | --- |
| default | Detached tray with readable resting labels |
| hover | Quiet lens, stronger text |
| current | Raised active lens, stronger border, full text contrast |
| focus-visible | Accent outline with 3px offset |

### Notes

- Use for top-level nav or small sub-nav clusters.
- When one link represents the current page or current shell view, mark it with `aria-current="page"` and reuse the same active lens as segmented controls. Do not rely on text color alone.
- Use the same fixed-shell, inner-scroll pattern when labels may overflow. The navigation tray should not grow a wide empty gutter just because the container has more room.
- Not for dense app sidebars.
- React wrapper: `components/ui/pill-nav.tsx` with `PillNav`, `PillNavLink`, and `PillNavAnchor`; compose it with `components/ui/scrollable-control-strip.tsx` when overflow safety matters.

## SectionLabel

### Purpose

Mono overline for chapter labels, object names, or system metadata.

### Anatomy

```html
<p class="fg-label">Current boundary</p>
```

### Notes

- Use sentence case or title case. Do not force all-uppercase labels with `text-transform`.
- If a code literal must stay exact, keep it inside code or command content rather than UI copy.
- Use sparingly to anchor sections and technical semantics.

## RouteNote

### Purpose

The right-rail route card language used across the current landing and console surfaces.

### Anatomy

```html
<article class="fg-route-note">
  <span class="fg-route-note__index">01</span>
  <strong class="fg-route-note__title">GitHub intake</strong>
  <span class="fg-route-note__meta">Repository / Branch / Builder</span>
</article>
```

### Notes

- Safe for onboarding steps, integration summaries, migration notices.
- Do not turn it into a generic marketing feature card.
- React wrapper: `components/ui/route-note.tsx`.

## BezelShell

### Purpose

Double-layer hardware shell for premium containers.

### Anatomy

```html
<section class="fg-bezel">
  <div class="fg-bezel__inner">...</div>
</section>
```

### Notes

- Default container for auth panels, docs code areas, and high-trust console modules.
- The inner shell should carry the real content surface.

## ProofShell

### Purpose

Specialized bezel shell for command blocks and control-plane proof.

### Anatomy

```html
<section class="fg-bezel fg-proof-shell">
  <div class="fg-bezel__inner">
    <div class="fg-proof-shell__ribbon">
      <span>Public or private access</span>
      <span>Managed shared runtime</span>
    </div>
    <pre><code>curl -sS "${FUGUE_BASE_URL}/healthz"</code></pre>
  </div>
</section>
```

### Notes

- Prefer this over a naked `pre`.
- Use the ribbon for environment or object metadata, not decorative tags.
- React wrapper: `components/ui/proof-shell.tsx` with `ProofShell`, `ProofShellRibbon`, and `ProofShellEmpty`.

## ObjectBelt

### Purpose

Compact object model strip for product nouns.

### Anatomy

```html
<div class="fg-object-belt" aria-label="Core objects">
  <span>Workspace</span>
  <span>Project</span>
  <span>App</span>
  <span>Runtime</span>
  <span>Operation</span>
</div>
```

### Notes

- Reuse in docs, onboarding, and console section headers.
- This is a semantic map, not a tag cloud.

## RouteSignal

### Purpose

Visual route path for process, migration, and topology.

### Anatomy

```html
<svg class="fg-route-signal" viewBox="0 0 1200 170" aria-hidden="true">
  <path class="fg-route-signal__base" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
  <path class="fg-route-signal__active" d="M40 118 C232 26, 372 32, 538 96 S860 180, 1160 36" />
  <circle class="fg-route-signal__dot" cx="40" cy="118" r="7" />
  <circle class="fg-route-signal__dot" cx="538" cy="96" r="7" />
  <circle class="fg-route-signal__dot" cx="1160" cy="36" r="7" />
</svg>
```

### Notes

- Keep it meaningful. It should map to real product transitions or information structure.
- Hide it on narrow screens if it stops being legible.

## LayoutShell

### Purpose

Shared outer width control for full-bleed and content-width sections.

### Classes

| Class | Width |
| --- | --- |
| `.fg-shell` | `1400px` max |
| `.fg-content-shell` | `1180px` max |

### Notes

- Prefer shell primitives over ad hoc width math.

## React Port Guidance

As this system moves into React or Next.js:

- Keep tokens in a global design-token file.
- Port visual primitives first: `Button`, `Panel`, `ProofShell`, `ObjectBelt`.
- Keep stable shared wrappers in `components/ui/` and migrate page-level DOM to them before adding new surface-specific variants.
- Prefer explicit sibling wrappers for structured patterns, for example `ProofShell` + `ProofShellRibbon` + `ProofShellEmpty`.
- Avoid boolean prop explosion. If a pattern diverges materially, create a sibling component instead of more mode flags.
