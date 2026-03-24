# Versions

This directory keeps each Fugue landing page direction as a self-contained version package.

## Purpose

The goal is to avoid scattering HTML, CSS, JS, and design notes across the repo root.

Each version folder contains:

- `index.html`: the landing page entry for that version
- `styles.css`: version-specific styles
- `main.js`: version-specific interactions
- `design.md`: the design rationale and visual direction

## Structure

```text
versions/
├── README.md
├── v1-editorial/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── v2-tactical/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── v3-swiss/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── v4-ceramic/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── v5-cathode-tide/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   ├── source.html
│   └── styles.css
├── v6-afterimage/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── v7-open-current/
│   ├── design.md
│   ├── index.html
│   ├── main.js
│   └── styles.css
└── v8-unicorn-template/
    ├── design.md
    ├── index.html
    ├── main.js
    └── styles.css
```

## Version index

### `v1-editorial`

- Working direction: editorial infrastructure
- Core feel: warm, magazine-like, composed
- Best used when reviewing the earliest narrative and layout decisions

### `v2-tactical`

- Working direction: tactical telemetry
- Core feel: control plane, instrumentation, operational
- Best used when comparing the more technical and harder-edged interpretation

### `v3-swiss`

- Working direction: Swiss technical atlas
- Core feel: poster-like, industrial print, route-map first
- Best used when reviewing the route-line-heavy composition

### `v4-ceramic`

- Working direction: ceramic control deck
- Core feel: tactile, restrained skeuomorphic, machined
- Best used when reviewing the soft-material, mineral version

### `v5-cathode-tide`

- Working direction: cathode tide
- Core feel: reference-led dark editorial, CRT glow, watery signal distortion
- Best used when reviewing the closest direct translation of the Every reference

### `v6-afterimage`

- Working direction: afterimage
- Core feel: shock-first product premiere, tilted cathode monolith, huge asymmetrical typography

### `v7-open-current`

- Working direction: open current
- Core feel: full-bleed cathode tide, flooded hero field, floating route annotations
- Best used as the baseline before the Unicorn template swap

### `v8-unicorn-template`

- Working direction: open current with alternate Unicorn Studio scene
- Core feel: same full-bleed launch composition, new Unicorn template bound to project `9QSqoDWkMs8NffWH18AF`
- This is the current latest version

## Root behavior

The repo root entry page at `/index.html` is only a lightweight version switchboard.

- It links to all version folders
- It redirects to `versions/v8-unicorn-template/`
- It should stay thin and not become another full landing page implementation

## Local preview

From the repo root:

```bash
cd /Users/yanyuming/Downloads/GitHub/fugue-web
python3 -m http.server 4173
```

Then open:

- `/`
- `/versions/v1-editorial/`
- `/versions/v2-tactical/`
- `/versions/v3-swiss/`
- `/versions/v4-ceramic/`
- `/versions/v5-cathode-tide/`
- `/versions/v6-afterimage/`
- `/versions/v7-open-current/`
- `/versions/v8-unicorn-template/`

## Conventions

- New landing page experiments should be added as a new `vN-name/` directory
- Every version should keep its own `design.md`
- Version-specific assets should stay inside the same version folder whenever possible
- Cross-version compare links should target the folder path, not old flat filenames

## Current status

- `v1` to `v8` are isolated and previewable
- Root no longer stores version-specific landing assets
- Shared planning remains at `/frontend-website-plan.md`
