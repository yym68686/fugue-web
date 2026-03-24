# Fugue v8 Minimal Component Specs

## Scope

This minimal system only includes patterns that are already stable in `v8` and are safe to reuse across marketing, auth, docs, and console.

Included:

- `Button`
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

Primary and secondary CTA with the nested icon island pattern preserved from `v8`.

### Variants

| Variant | Class | Use |
| --- | --- | --- |
| primary | `.fg-button--primary` | Main action in a section |
| ghost | `.fg-button--ghost` | Secondary action on dark surfaces |
| compact | `.fg-button--compact` | Header or tighter utility action |

### Anatomy

```html
<a class="fg-button fg-button--primary" href="#">
  <span>Inspect quickstart</span>
  <span class="fg-button__icon" aria-hidden="true">-&gt;</span>
</a>
```

### States

| State | Treatment |
| --- | --- |
| default | Solid or ghost surface with pill shape |
| hover | `translateY(-2px)` on button, slight icon drift |
| focus-visible | Accent outline with 3px offset |
| active | Return to neutral Y position |
| disabled | `opacity: 0.5`, no pointer events |

### Notes

- Keep the icon island. Do not collapse it into plain text.
- Avoid adding boolean prop combinations later like `primary + compact + quiet + iconOnly`; prefer explicit variants or composition.

## PillNav

### Purpose

Detached floating navigation container.

### Anatomy

```html
<nav class="fg-pill-nav" aria-label="Primary">
  <a href="#route">Route</a>
  <a href="#surface">Surface</a>
  <a href="#proof">Proof</a>
</nav>
```

### Notes

- Use for top-level nav or small sub-nav clusters.
- Not for dense app sidebars.

## SectionLabel

### Purpose

Mono overline for chapter labels, object names, or system metadata.

### Anatomy

```html
<p class="fg-label">Current boundary</p>
```

### Notes

- Always uppercase.
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

Specialized bezel shell for command blocks and API proof.

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
