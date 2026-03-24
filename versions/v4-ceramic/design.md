# Landing Page Design v4

## Concept

This version takes Fugue away from flat SaaS tropes and into a tactile, restrained skeuomorphic direction:

- Working name: `Ceramic Control Deck`
- Tone: calm, premium, precise, physical
- Goal: make the product story feel inspectable, not decorative

The page should read like a machined instrument panel made from mineral ceramic, brushed stone, and soft metal. It should not look playful, nostalgic, or toy-like.

## Why this direction

The earlier variants had structure, but not enough material identity. They felt like layout systems with styling layered on top. This version changes the design center of gravity:

- Material comes first
- Light source stays consistent
- Surfaces feel raised or recessed on purpose
- The route story becomes the hero object
- The page stays honest about the current product boundary

## Visual system

### Palette

- Base: warm mineral neutrals
- Surface: porcelain / ceramic highlights
- Shadow: warm taupe, never flat black
- Accent: muted copper

The page keeps one accent color and lets depth, shadow, and texture do most of the work.

### Typography

- Display: `Sora`
- Body: `Plus Jakarta Sans`
- Technical labels: `IBM Plex Mono`

The typography stays modern and controlled. No editorial serif, no terminal cosplay, no generic Inter.

### Material language

- Major containers use a double-bezel shell
- Interactive wells are recessed, not flat cards
- Buttons feel machined and pressable
- Hover states lift slightly
- Active states press inward
- Cursor movement softly shifts a highlight across selected surfaces

## Page architecture

### 1. Hero

- Left: direct value proposition
- Right: tactile route console
- The console visualizes the three product states:
  - GitHub intake
  - Shared runtime
  - Attached VPS

### 2. Route deck

- Three asymmetrical tactile panels
- Hovering or focusing any stage highlights the same stage across the page
- The layout avoids equal-width feature cards

### 3. Object board

- Five core nouns:
  - workspace
  - project
  - app
  - runtime
  - operation

This section establishes the product model that later landing, auth, docs, and console layers can share.

### 4. Quickstart + product boundary

- Quickstart command is real and copyable
- Current surface and current boundary are explicit
- Auth is acknowledged, but no modal blocks the hero

### 5. Answers

- Vertical tab rail rather than generic accordion
- Keeps objections readable without flattening the page into FAQ sludge

### 6. Launch tray

- Final note explains the next layer:
  - `/auth/sign-in`
  - Google sign-in
  - email signup

## Motion rules

- Entrance motion: soft fade-up with blur resolve
- Hover motion: shallow lift only
- Press motion: slight inward push
- Surface glints: subtle pointer-tracked highlight
- Reduced motion: all animations collapse to near-static

No bounce, no neon glow, no decorative movement that competes with the message.

## Implementation notes

- Static HTML/CSS/JS only
- Uses CSS variables as design tokens
- Keeps old variants accessible:
  - `editorial v1`
  - `tactical v2`
  - `swiss v3`

## Success criteria

The page should feel:

- more tactile than trendy
- more premium than playful
- more specific than generic SaaS
- more honest than conversion theater
