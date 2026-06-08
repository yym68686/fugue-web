# Fugue Platform Design System

This directory now contains two layers:

- `tokens.css` and `components.css`: the existing Fugue compatibility layer used by the live app.
- `platform.css`: the new platform-neutral console design system distilled from the sampled Cloudflare dashboard UI.

`index.css` imports both layers. The old `fg-*` classes remain available so the product does not lose existing styles, while the new system uses the `fp-*` namespace.

## Files

- `index.css`: shared CSS entrypoint.
- `tokens.css`: existing Fugue token compatibility.
- `components.css`: existing Fugue component compatibility.
- `platform.css`: new dense platform UI tokens and components.
- `component-specs.md`: component rules, anatomy, variants, and states.
- `cloudflare-design-dna.md`: extraction notes from the sampled dashboard.
- `preview.html`: standalone inspection page for the new `fp-*` system.

## Design Direction

The new system is a platform UI, not a marketing theme. It uses:

- Inter-first typography with 13px navigation text, 14px controls, 30px page titles.
- Pure black and near-black surfaces in dark mode, clean neutrals in light mode.
- 8px control radius, 6px inner menu/segment radius, and unframed product sections by default.
- 32-40px controls, 34px sidebar nav items, 56px card headers, 72px resource rows.
- Sidebar command, nav labels, section gaps, and page gutters are tokenized; avoid one-off margins between adjacent components.
- Solid overlays and menus, not glass.
- 1px rings and hairlines instead of decorative shadows.
- Cloudflare-blue primary actions, neutral raised secondary controls, muted ghost utilities.
- Table/row dividers carry most separation; large rounded card frames are not a default product pattern.
- Compact 6px badges and low-saturation alert tints, without halo, glow, or gradient fills.

## Adoption

1. Import `design-system/index.css`.
2. Wrap new product surfaces with `.fp-design-system` or use the classes inside an existing root that already imports the CSS.
3. Prefer `fp-*` components for console/admin/platform surfaces.
4. Keep legacy `fg-*` only for existing screens until they are migrated.
5. Do not copy third-party logos, brand names, or account/resource data into Fugue UI. Use the extracted layout, density, token, and component rules.

## React Layer

The reusable implementation layer lives in:

```text
/Users/yanyuming/Downloads/GitHub/fugue-web/components/platform
```

Use these wrappers before adding page-local product UI:

- `platform-layout.tsx`: shell, sidebar, topbar, breadcrumbs, page, page header, section, grid, stack.
- `platform-actions.tsx`: buttons, links, icon buttons, button groups.
- `platform-data.tsx`: unframed sections, metrics, resource rows, badges, status, tables, key-value lists.
- `platform-form.tsx`: fields, inputs, selects, search, toolbar, segmented controls.
- `platform-feedback.tsx`: alerts, empty/error/loading states, modal, drawer.
- `platform-workflow.tsx`: wizard and step primitives.
- `platform-icon.tsx`: local platform icon layer.

Console/admin pages now enter through `PlatformShell`. Deploy/new uses `PlatformWizard`. Landing and docs keep their own page structures but are scoped with `.fp-landing-page` and `.fp-docs-page` so controls and panels inherit the platform rules without becoming console pages.

Migration status and compatibility boundaries are tracked in:

```text
/Users/yanyuming/Downloads/GitHub/fugue-web/docs/frontend-platform-migration-inventory.md
```

## Preview

Open:

```text
/Users/yanyuming/Downloads/GitHub/fugue-web/design-system/preview.html
```

The preview shows sidebar, topbar, metrics, lists, forms, menus, tables, empty/loading/error states, wizard, modal, code, tooltip, and toast examples.
