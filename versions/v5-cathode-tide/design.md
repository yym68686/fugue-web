# Fugue Landing Page v5

## Working name

`Cathode Tide`

## Why this rewrite exists

The previous v5 took the reference as a mood board and then rebuilt the hero with a custom canvas effect.

That was the wrong translation.

The user supplied the reference source in `source.html`, and the source makes the real mechanism explicit:

- a full-screen black stage
- a Unicorn Studio scene mounted in the center
- a radial dark overlay on top
- a bottom fade-to-black overlay on top

So the new v5 stops approximating that system and uses the same stage logic directly.

## What changed

### 1. The hero is now source-led

The hero is no longer “inspired by” the reference.

It now uses:

- the same `UnicornStudio` runtime
- the same `data-us-project="giF47RGc5eVb7myHhJ4n"` scene hook
- the same stage stack:
  - live scene
  - radial darkening
  - bottom black gradient

This is the core visual correction.

### 2. The page moved from dashboard theater to dark editorial landing

The rest of the page is no longer a large route-board console.

Instead it follows a closer editorial grammar:

- large serif hero headline
- restrained monochrome palette
- thin dividing rules instead of chunky cards
- bottom-weighted hero composition
- quieter section layouts with long-form product language

### 3. Fugue translation stays product-specific

The reference is an atmosphere and staging reference, not a copy target.

So the content still belongs to Fugue:

- GitHub import
- shared runtime first
- attached VPS later
- auth as the next layer at `/auth/sign-in`

## Visual system

### Palette

- Base: `#020202`
- Text: warm white and soft gray
- Accent: bone-tinted neutrals instead of bright SaaS color

### Typography

- Display: `Instrument Serif`
- Body: `Instrument Sans`
- Technical labels: `IBM Plex Mono`

### Material

- glassy nav and buttons with restrained blur
- line-based section separation
- low-contrast atmospheric overlays
- no neon hacker styling
- no ceramic skeuomorphism from v4

## Motion system

### Signature motion

The signature motion is now the actual source scene in the hero.

The landing page itself only adds:

- fade-up hero choreography
- section reveal on scroll
- lightweight button and copy feedback

### Reduced motion

If `prefers-reduced-motion` is enabled:

- the Unicorn scene is not initialized
- the hero falls back to a static atmospheric background
- transitions collapse to near-instant

## Information architecture

This page keeps a simple landing-page sequence:

1. Hero stage
2. Route argument
3. Current surface vs next shell
4. Quickstart proof
5. Launch edge / auth handoff

That keeps the page aligned with marketing intent without turning it into a fake app UI.

## Success criteria

If this rewrite works, the page should read as:

- visibly descended from the Every reference page
- centered on a live visual stage, not a generic SaaS hero
- still clearly about Fugue’s real product route
