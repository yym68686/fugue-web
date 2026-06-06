# Cloudflare Console Design DNA Extraction

This file summarizes the visual system observed from the logged-in dashboard session and converts it into a platform-neutral design system. It intentionally avoids copying third-party logos, brand names, private account data, domains, secrets, or resource names.

## Sampled Surfaces

- Account overview dashboard.
- Add menu popover.
- Workers and Pages resource list.
- Worker creation fullscreen flow.

## Design System

### Color

- Dominant dark canvas: pure black to near-black.
- Main dark neutrals observed around `oklch(10% 0 0)`, `oklch(12% 0 0)`, `oklch(14.5% 0 0)`, `oklch(17% 0 0)`, `oklch(20.5% 0 0)`, `oklch(26.9% 0 0)`.
- Primary action blue: `oklch(57.72% 0.2324 260)`.
- Text uses neutral white/gray rather than warm ivory.
- Status colors are vivid but contained: green for positive deltas, red for negative deltas, amber for warnings.
- Most separation is 1px neutral rings, not shadows.

### Typography

- UI font: Inter Variable / system sans.
- Page title: 30px, 600 weight, 36px line-height.
- Section/card title: 16px, 600 weight.
- Controls: 14px, 500 weight for buttons; 14px regular for inputs/selects.
- Sidebar nav: 13px, 500 weight, 34px row height.
- Metadata: 12-13px, muted neutral, often tabular numeric.
- Letter spacing stays normal.

### Layout

- Desktop sidebar: 260px.
- Topbar: 58px, sticky, solid black/white, 1px bottom border.
- Main page: roughly 1172px content width with 40px side gutters in the sampled viewport.
- Overview metrics: 3-column card grid.
- Resource list: large clickable rows instead of a dense data grid for primary objects.
- Creation flow: fullscreen modal canvas, topbar, centered wizard, optional left rail title.

### Shape And Elevation

- Default radius: 8px.
- Menu item radius: 6px.
- Choice-card radius: 10px.
- Cards use single 1px rings; shadows are minimal and mostly on overlays.
- Overlays are solid surfaces, not glass.

### Motion

- Micro-interactions are short and functional.
- Hover changes are subtle surface lifts.
- Menu/dialog opening uses fade/scale/slide behavior, but no decorative choreography.
- Reduced-motion should collapse transitions and shimmer.

## Design Style

- Mood: operational, neutral, exact, efficient.
- Composition: dense left navigation, utility topbar, spacious but not theatrical content canvas.
- Component voice: labels are concrete and short; descriptions are useful but secondary.
- Information hierarchy: title -> direct actions -> filters -> resource rows -> secondary cards.
- Ornamentation: almost none. Icons clarify navigation and action type, but surfaces carry the system.

## Visual Effects

- No WebGL/canvas hero effect.
- No ambient gradients in product UI.
- Charts/sparklines are data effects, not decoration.
- Loading uses skeleton shimmer.
- Focus rings are visible and practical.

## Implemented Translation

The extraction is implemented as:

- `platform.css`: `fp-*` tokens and components.
- `preview.html`: visual inspection of shell, navigation, controls, metrics, lists, forms, menus, tables, feedback, wizard, and modal.
- `component-specs.md`: usage rules and anatomy.

The result is Cloudflare-inspired in density, token choices, and component behavior, but platform-neutral for Fugue.
