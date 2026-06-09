# Fugue Morlane Design System

The active frontend design baseline is `/Users/yanyuming/Downloads/GitHub/morlane`.
This repository no longer treats its previous Fugue, Cloudflare-inspired, or
cinematic styles as visual references. Existing pages only contribute product
information, states, fields, actions, and routing behavior.

## Files

- `index.css`: shared CSS entrypoint. It imports `morlane.css`.
- `morlane.css`: active tokens, component styling, page shells, and compatibility mappings.
- `tokens.css`: deprecated path placeholder. Do not add new styles here.
- `components.css`: deprecated path placeholder. Do not add new styles here.
- `platform.css`: deprecated path placeholder. Do not add new styles here.
- `component-specs.md`: historical component notes; treat Morlane rules in this README and `morlane.css` as the current source of truth.

## Direction

The UI is a light-first product/admin system:

- Inter for product typography, IBM Plex Mono for commands, code, object IDs, and technical values.
- The `Fugue` wordmark keeps the original Syne brand font; no other product UI should use it.
- `#f6f7f8` canvas, white surfaces, pale gray secondary surfaces, crisp neutral text, and `#1463ff` primary actions.
- 6px control radius, compact cards, dense tables, explicit row dividers, and small status badges.
- Sidebar + topbar console structure, centered auth card, docs rail, and split marketing hero.
- Solid surfaces and light shadows, not glass, glow, CRT, noise, scanlines, or full-screen decorative effects.

## Adoption

1. Import `design-system/index.css`.
2. Use existing React components for behavior when useful, but keep their visual output aligned to Morlane tokens and components.
3. Prefer `ml-*` class names for new shared visual primitives.
4. Treat `fg-*` and `fp-*` as migration class names only. They may remain in DOM for compatibility, but their styles must map to Morlane.
5. Do not copy old Fugue visual motifs back into the app. When in doubt, inspect the Morlane repo and port that layout/component pattern.

## Shared Patterns

- `ml-app-shell`: sidebar, topbar, and page workspace.
- `ml-card`: compact panel or section container.
- `ml-table`: dense product table.
- `ml-button`: primary, secondary, danger, and ghost controls.
- `ml-segmented`: view switching.
- `ml-form`: stacked labels, helpers, validation, and disabled/loading states.
- `ml-auth-panel`: centered authentication surface.
- `ml-docs-shell`: docs navigation and readable content column.
- `ml-terminal`: small command/log preview panel.

When a new page or component cannot be composed from these patterns, add the
primitive to `morlane.css` first and then use it from the page-level component.
