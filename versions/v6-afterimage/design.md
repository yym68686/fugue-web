# Fugue Landing Page v6

## Working name

`Afterimage`

## Intent

v6 keeps only one thing from v5:

- the cathode-screen hero mechanism
- the watery CRT signal scene
- the dark top-radial and bottom-fade stage logic

Everything else is redesigned.

The goal is not “make v5 cleaner.”

The goal is:

**turn Fugue into a shock-first product premiere page that feels more like a launch film poster than a SaaS homepage.**

## Why v5 was not enough

v5 proved the reference mechanism could be carried over, but it still inherited too much of the reference page’s pacing and copy placement.

That made the hero less powerful for Fugue because:

- too much text sat in front of the spectacle
- the page still read as a themed landing page instead of a new product statement
- the visual surprise was concentrated in the background, not in the composition itself

## New direction

### Core idea

The page should feel like:

- a black-stage product premiere
- a tilted cathode monolith on the right
- a brutally short message on the left
- a runway of route logic below

So the memorable thing is not just “that cool background.”

It becomes:

**the angled signal slab, the oversized typography, and the sense that Fugue is announcing a route, not a feature list.**

### Design lane

- asymmetrical split hero
- giant compressed headline
- very low text count above the fold
- thin rules instead of stacked cards
- one technical wonder in the hero, then ruthless editorial restraint

## Visual system

### Typography

- Display: `Syne`
- Body: `Manrope`
- Technical labels: `IBM Plex Mono`

The display font is heavier, stranger, and more forceful than v5. It is meant to create impact quickly without adding more copy.

### Palette

- Base: near-black blue charcoal
- Text: warm paper white
- Accent: cold steel blue

The accent exists to sharpen the route and the labels, not to color the entire page.

### Material strategy

- hero stage uses nested shell + frame architecture
- copy and sections stay mostly open, with line-based structure
- only the hero slab and proof terminal get strong enclosure treatment

This follows a “one monolith, not many cards” rule.

## Motion strategy

### Signature motion

The one heroic motion moment remains the cathode scene.

v6 adds only two supporting layers:

- subtle perspective tilt on pointer for the hero monolith
- staggered entrance and section reveal choreography

That keeps the page intense without becoming noisy.

### Reduced motion

If `prefers-reduced-motion` is enabled:

- the Unicorn scene is not initialized
- the hero falls back to a static atmospheric stage
- tilt and long transitions collapse

## Information architecture

The page is intentionally lean:

1. Hero statement
2. Route thesis
3. Current boundary
4. Quickstart proof
5. Auth handoff

The primary conversion path remains:

- understand the route in seconds
- inspect the live API surface
- accept auth as the next real layer

## Skill-driven decisions

This version follows several local frontend skills directly:

- `design-taste-frontend`: avoid generic SaaS layouts and push asymmetry + scale
- `high-end-visual-design`: use nested hero hardware, stronger typography, and cinematic spacing
- `bolder`: make one hero moment much more forceful instead of sprinkling many small tricks
- `distill`: cut above-the-fold copy aggressively so the stage stays visible
- `animate`: keep motion concentrated in one memorable moment
- `page-cro`: keep one clear primary CTA and preserve proof near the fold

## Success criteria

If v6 works, the user should remember:

- the tilted cathode slab
- the huge “Start shared. Leave clean.” statement
- the feeling that Fugue has a sharper point of view than a typical deploy tool
