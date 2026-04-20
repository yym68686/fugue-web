# Fugue Design System Baseline

This directory is the shared UI baseline for the current Fugue website and product shell. It is no longer a deliberately tiny seed. It now mirrors the visual language that is already live across marketing, docs, auth, deploy flows, and console surfaces.

## Files

- `index.css`
  - single entrypoint for CSS consumers
- `tokens.css`
  - `primitive -> semantic -> component` tokens for both dark and light themes
- `components.css`
  - shared class implementations for current Fugue primitives and product controls
- `component-specs.md`
  - usage rules, anatomy, and extraction boundary for the current baseline
- `preview.html`
  - theme-toggleable inspection page for the shared system

## What the baseline owns now

- three-layer tokens for canvas, typography roles, shell surfaces, selection lenses, fields, alerts, status tones, and console surfaces
- layout primitives for `fg-shell`, `fg-content-shell`, display copy, ui headings, mono labels, and restrained body copy
- shared controls for buttons, segmented rails, pill nav, utility menus, compact menu buttons, form fields, selects, stepped sliders, hint tooltips, and inline alerts
- shared surfaces for shell containers, panels, proof shells, route notes, upload surfaces, confirm dialogs, console disclosures, page intros, empty states, and status badges
- route-language primitives for object belts, route signals, and proof-oriented command blocks
- a preview page that exercises these patterns under both dark and light tokens

## What stays route-specific

- landing hero scene composition, canvas/WebGL layers, and chapter choreography
- docs information architecture and longform reading layout
- auth stage composition and route-specific copy layout
- page-specific workbenches, galleries, tables, and wizard sequencing

## Current design rules

- `route is the product`: route, shell, and object transitions should stay legible and product-shaped.
- `Syne` is for display moments only. Product titles use the quieter UI-heading role built on `Manrope`.
- Shells now read as single hairline surfaces with depth from gradient and shadow, not the older double-bezel story.
- Selected states across pill nav, segmented controls, file pills, and small utilities reuse the same raised lens language.
- Product feedback must ship with loading, empty, error, disabled, and focus-visible states.

## Adoption

1. Import `design-system/index.css`.
2. Set `data-theme="dark"` or `data-theme="light"` on the root element.
3. Use `.fg-shell` or `.fg-content-shell` for width control.
4. Build from shared roles and primitives before inventing page-local variants.
5. Keep page choreography in route CSS, but keep reusable shell, control, and form patterns here.
6. When a stable new pattern lands, update `tokens.css`, `components.css`, `component-specs.md`, and `preview.html` together.

## Current extraction boundary

Good candidates for the next pass:

- shared table density rules
- checklist and stat-list primitives
- compact topbar chips and profile triggers
- richer docs-specific content blocks if they become reusable outside docs

Bad candidates for extraction:

- one-off hero experiments
- page-specific metric layouts
- temporary onboarding copy shells
- speculative variants that are not reused yet
