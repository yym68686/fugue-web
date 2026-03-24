# Fugue Landing Page v8

## Working name

`Open Current`

## Intent

v8 is a controlled branch from v7.

The composition, copy hierarchy, overlays, route rail, and proof structure remain the same.
The thing under test is narrower:

- keep the v7 page architecture
- replace the Unicorn background scene
- evaluate whether the newly found template carries the hero with more conviction

This version binds the opening field to:

- `data-us-project="9QSqoDWkMs8NffWH18AF"`

## Why make this a separate version

The Unicorn scene is not a cosmetic token.
It determines:

- how much of the viewport feels alive
- whether the hero reads as a flooded atmosphere or as a pasted embed
- whether the route notes on the right can sit inside the signal without fighting it

That is enough surface-area change to deserve a separate version folder, even when the HTML structure stays mostly stable.

## What stays constant from v7

- full-bleed hero composition
- lower-left headline block
- right-side route annotations
- runway logic under the fold
- same graceful fallback when Unicorn fails or motion is reduced

This keeps the comparison honest.
If the scene feels better, we will know it came from the scene swap rather than a rewritten page.

## Technical delta

Compared with v7, v8 changes:

1. the Unicorn Studio project id
2. the visible version labeling
3. the scene timeout window, so a heavier template has more time to hydrate before fallback activates

## Review focus

When reviewing v8, the right questions are:

- does the new Unicorn template actually fill the hero more elegantly
- do the route cards still stay legible against the new motion field
- does the background feel authored, not embedded
- does the page still hold up on fallback if the scene fails

## Skill-driven decisions

- `frontend-design`: keep the swap constrained so the page remains a deliberate composition instead of becoming effect-chasing
- `design-taste-frontend`: preserve the asymmetric v7 structure and avoid reintroducing boxed hero hardware
- `animate`: keep one hero motion moment as the signature, rather than adding extra moving parts
- `adapt`: avoid layout changes so the responsive behavior inherited from v7 stays stable
- `polish`: update version routing and docs so the repo reflects the new latest branch cleanly
