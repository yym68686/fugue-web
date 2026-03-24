# Fugue Minimal Design System Seed

This directory is the first extraction of the `v8` landing page into reusable design-system assets.

It is intentionally small. The goal is not to freeze every possible component now. The goal is to capture the parts of `v8` that are already stable enough to become shared UI for auth, docs, and the future console.

## Files

- `index.css`
  - single entrypoint for CSS consumers
- `tokens.css`
  - `primitive -> semantic -> component` token layers
- `components.css`
  - reusable class-based implementations of the stable `v8` patterns
- `component-specs.md`
  - usage rules, anatomy, and state guidance
- `preview.html`
  - visual inspection page for the extracted system

## What this seed includes

- off-black canvas and warm-ivory text palette
- `Syne + Manrope + IBM Plex Mono` typography pairing
- split typography roles: `Syne` for display moments, `Manrope`-based UI headings for serious product surfaces
- pill CTA with nested icon island
- detached pill navigation
- route-note card language
- double-bezel proof shell
- object belt
- route signal SVG treatment
- shell width primitives

## What this seed does not include

- Unicorn scene integration
- full landing-page hero layout
- ghost wordmark
- runway strip section
- form fields and auth-specific controls

Those remain outside the minimal system until they are needed by real product routes.

## Design rules carried from v8

- Use near-black, not pure black.
- Use warm ivory text, not cold white.
- Keep one restrained accent color.
- Prefer edge light, border, and gradient depth over obvious glow.
- Preserve the button-in-button icon island.
- Keep route metaphors tied to real product structure.
- Outside marketing, background effects should stay static or low-frequency.

## Suggested adoption order

1. Import Google fonts or self-host the three font families.
2. Import `design-system/index.css`.
3. Wrap the page with `.fg-theme-dark`.
4. Use `.fg-shell` or `.fg-content-shell` for width control.
5. Build sections from `fg-label`, `fg-display-heading`, `fg-ui-heading`, `fg-copy`, `fg-button`, `fg-route-note`, and `fg-bezel`.

## Next recommended additions

- `Input`
- `FormField`
- `AuthPanel`
- `StatusBadge`
- `Alert`
- `DataPanel`

Those should be extracted from real auth and console implementations, not invented in advance.
