# Fugue v8 Minimal Component Specs

## Scope

This minimal system only includes patterns that are already stable in `v8` and are safe to reuse across marketing, auth, docs, and console.

Included:

- `Button`
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

## SegmentedControl

### Purpose

Shared local view switch for mutually exclusive app states such as `Environment / Files / Logs`, `Variables / Raw`, or `Build / Runtime`.

### Anatomy

```html
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
- Segmented items, stateful pill-nav links, and file pills should reuse the same raised selection lens. Only the tray density and padding should change by context.
- In mixed control rails, align the segmented outer height with adjacent compact buttons.

## PillNav

### Purpose

Detached floating navigation container.

### Anatomy

```html
<nav class="fg-pill-nav" aria-label="Primary">
  <a href="#route" aria-current="page">Route</a>
  <a href="#surface">Surface</a>
  <a href="#proof">Proof</a>
</nav>
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
- Not for dense app sidebars.

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

The right-rail route card language extracted from `v8`.

### Anatomy

```html
<article class="fg-route-note">
  <span class="fg-route-note__index">01</span>
  <strong class="fg-route-note__title">GitHub intake</strong>
  <span class="fg-route-note__meta">repo_url / branch / builder</span>
</article>
```

### Notes

- Safe for onboarding steps, integration summaries, migration notices.
- Do not turn it into a generic marketing feature card.

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
      <span>public repos only</span>
      <span>runtime_managed_shared</span>
    </div>
    <pre><code>curl -sS "${FUGUE_BASE_URL}/healthz"</code></pre>
  </div>
</section>
```

### Notes

- Prefer this over a naked `pre`.
- Use the ribbon for environment or object metadata, not decorative tags.

## ObjectBelt

### Purpose

Compact object model strip for product nouns.

### Anatomy

```html
<div class="fg-object-belt" aria-label="Core objects">
  <span>workspace</span>
  <span>project</span>
  <span>app</span>
  <span>runtime</span>
  <span>operation</span>
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

When this system moves into React or Next.js:

- Keep tokens in a global design-token file.
- Port visual primitives first: `Button`, `Panel`, `ProofShell`, `ObjectBelt`.
- Prefer compound composition for structured components:
  - `ProofShell`
  - `ProofShell.Ribbon`
  - `ProofShell.Code`
- Avoid boolean prop explosion. If a pattern diverges materially, create a sibling component instead of more mode flags.
