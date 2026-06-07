# Frontend Detail Optimization System

This document defines the repeatable loop for finding and fixing Fugue frontend detail issues without relying on one-off manual observations.

## Goal

Continuously discover, document, prioritize, fix, and re-check frontend details until the current audit system can no longer find actionable issues.

For detail cycles, completion can require a stated minimum number of verified
atomic detail optimizations. A broad system-level CSS or component fix can
count more than once only when the affected detail is concrete, inspectable,
and separately verifiable across one of these axes:

- component instance
- route
- viewport
- UI state
- visual property
- DOM layer
- language/theme variant

The count must be recorded in the optimization backlog. Do not count vague
"polish" or an unverified intention.

The quality target is the current Fugue platform design direction:

- Cloudflare-like product UI density and restraint.
- Fugue wordmark remains in the original logo font.
- Console/admin/deploy/auth/docs surfaces use platform primitives where possible.
- Product UI uses unframed sections, compact controls, 1px hairlines, Cloudflare-blue primary actions, and solid neutral surfaces.
- Marketing can keep atmospheric direction, but product controls must stay system-aligned.

## Sources Used

- `/Users/yanyuming/Downloads/GitHub/web-design/AGENTS.md`
- `frontend-design`
- `audit`
- `normalize`
- `polish`
- `harden`
- `adapt`
- `webapp-testing`
- `web-design-guidelines`
- `critique`
- `typeset`
- `arrange`
- `distill`
- `redesign-existing-projects`
- `high-end-visual-design`
- `ckm:design-system`
- `design-system/component-specs.md`
- `design-system/README.md`

## Audit Layers

### 1. Static Code Scan

Run:

```bash
npm run frontend:details:audit
```

This catches mechanical issues:

- `transition: all`
- `outline: none` without a clear replacement
- clickable `div`/`span`
- nested interactive elements in `summary`
- paste blocking
- unreviewed `autoFocus`
- image alt/dimension/loading omissions
- product gradient candidates

Static findings are candidates. They must be classified before fixing because source compatibility CSS can be overridden at runtime.

### 2. Rendered DOM Scan

Use Chrome MCP or Playwright against real routes and computed styles.

Route matrix:

- `/`
- `/docs`
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/finalize`
- `/app`
- `/app/apps`
- `/app/api-keys`
- `/app/billing`
- `/app/cluster`
- `/app/cluster-nodes`
- `/app/settings/profile`
- `/app/users`
- `/new/repository`

Viewport matrix:

- Desktop: `1440x1000`
- Tablet: `900x1100`
- Mobile: `390x844`

Rendered scan checks:

- old rounded frame remnants
- nested frame depth and repeated visual shells
- unnecessary borders, backgrounds, shadows, and inner frames
- shape/radius drift between shell, viewport, control, and active item
- typography tone drift between labels, selected states, and panel copy
- component-level color contrast and text color hierarchy
- forbidden product gradients
- illegal shadows/glows
- text overflow and horizontal scroll
- controls below minimum touch size
- missing visible focus
- console errors and network errors
- nested interactive browser issues

Rendered measurements use a 2px DOMRect tolerance. The browser can report
fractional dimensions below computed CSS values when a local viewport override,
font metric, or device scaling is active. A control is actionable only when the
computed style and measured rectangle both miss the target after that tolerance.

Control size targets:

- Desktop and tablet product density: 32px minimum for compact controls.
- Mobile: 44px minimum for real controls.
- Inline prose links are excluded unless they are styled as buttons, tabs,
  pills, summaries, icon buttons, or other discrete controls.
- Scrollable tables and horizontal strips are valid when the scroll container is
  contained inside the viewport.

Authenticated console routes need a working local session and database. If the
local database is unavailable, rendered checks still cover public pages, auth,
deploy entry, redirects, static console source, and auth-required surfaces; a
full logged-in console pass must be repeated in an environment with a working
session.

### 3. Screenshot-Level Visual Structure Scan

This layer exists for the class of problems a screenshot reveals immediately
but a basic static audit misses: "the component has three frames around it",
"the selected tab is the wrong shape", "the text tone feels disabled", or "the
border should not exist at this depth".

Every screenshot-level scan must record:

- **Target**: route, viewport, component, and the visible state being inspected.
- **DOM layer trace**: the ancestor chain from the visible component to the
  page section. For each ancestor, record class, rectangle, background, border,
  border radius, box shadow, and overflow.
- **Visual layer count**: count every ancestor that contributes a visible
  frame, fill, shadow, clipping radius, backdrop/filter, or divider.
- **Layer budget**:
  - Product panels: at most one section surface plus local dividers.
  - Segmented controls and tab groups: at most one outer track plus one active
    lens. The scroll viewport and inner button group must be transparent.
  - Nested panels inside a workbench: no outer bezel plus inner panel plus card
    stack. Use spacing and dividers instead.
  - Modal/dialog: overlay plus one dialog surface; no nested glass/bezel shell.
- **Shape contract**:
  - Product control track: 8px radius.
  - Active lens inside segmented/tab controls: 6px radius.
  - Panel/section surfaces: 0-8px radius depending on system component.
  - Pill radius is reserved for intentional marketing nav, compact badges, and
    legacy wordmark-adjacent CTAs. Product workbench tabs should not be pills.
- **Tone contract**:
  - Active tab/control text: primary text token.
  - Inactive tab/control text: secondary text token, not disabled/muted gray.
  - Panel copy: body/secondary text tokens, never an accidental disabled tone.
  - Technical metadata: mono/type-muted only when the information is genuinely
    metadata.
- **Border contract**:
  - A border must separate two meaningful layers. If two adjacent ancestors both
    have a 1px line, one is redundant.
  - Hairlines should be low contrast and singular. Repeated hairlines around the
    same control are counted as separate issues.
  - Active selection should not add another external border when fill is enough.
- **Font contract**:
  - Console/admin UI uses the product UI font stack, not display typography.
  - Tab labels use 13px/500 unless a component spec explicitly requires a
    different role.
  - Avoid bold tab labels unless the active state needs emphasis and the track
    remains visually quiet.

The scan must run both ways:

1. **Top-down**: pick a screenshot/component and trace every visible layer.
2. **Bottom-up**: run a DOM query for all components whose ancestor chain has
   more than the layer budget, then screenshot the worst cases.

### 4. Component Contract Matrix

Each repeated component family must have a contract that can be checked in DOM
and source. Minimum contracts:

| Family | Required Checks |
| --- | --- |
| Sidebar/nav | active state, label tone, icon alignment, hit target, no nested surface unless sticky/floating |
| Breadcrumb | 24px minimum hit target, muted parent/current contrast, no pill styling |
| Segmented/tabs/pill switch | one track, transparent viewport, transparent inner group, 6px active lens, 13px/500 labels |
| Panel/section/card | no nested framed cards, single surface, local dividers only where useful |
| Table/list/resource row | row height, divider weight, hover state, selected state, text truncation |
| Form/input/select/textarea | label linkage, 36px desktop height, 44px mobile hit target, focus state, error state |
| Dialog/modal | overlay, one surface, header/body/footer rhythm, focus trap, no double bezel |
| Alert/toast/badge | semantic tone, compact shape, readable copy, no glow/halo |
| Skeleton/loading/empty | matches final layout geometry, no theatrical or legacy skeleton styling |

The backlog must group findings by this matrix so a systemic bug is fixed at
the component/token layer, not repeated as one-off page patches.

### 5. Atomic Detail Count Rules

Use atomic counts to satisfy the 1000-detail requirement without inventing fake
work:

- One count is one verified improvement to one visible detail at one scope.
- A selector change can close many counts when it affects many rendered
  component instances or states; each count must be listed under a rule and be
  reproducible by route/viewport/state or by a static selector inventory.
- A "three nested frames" fix may count separately for each removed redundant
  frame layer, per affected component family, per verified viewport, and per
  affected route.
- Do not count the same DOM element and same visual property twice.
- Do not count documentation-only updates as visual optimization counts unless
  they add an executable audit rule or checklist item used by the loop.
- The ledger must include:
  - rule id
  - target component/family
  - affected routes or selector inventory
  - before condition
  - after condition
  - count
  - verification command or browser evidence

When the user sets a new numeric floor, create a new backlog document for that
cycle and keep its count separate from earlier completed ledgers. The loop is
not complete until the active optimization ledger reaches the requested count
and all listed todo items are checked.

### 6. Action Bar, Panel, And I18n Scan

This scan catches the class of defects where a screenshot looks wrong even
after tab controls are normalized: a toolbar label is drawn as a rounded badge,
an action cluster is inside a visual frame, a destructive action uses a loud
alert fill, a product panel is still a rounded card, or a visible string skips
the locale system.

Every product action / panel screenshot must be checked for:

- **Plain label contract**
  - Section, toolbar, panel, and action labels are text labels, not badges.
  - Product labels must not carry pill padding, rounded backgrounds, shadows,
    gradients, or mono styling unless the content is a true machine token.
  - Labels use product UI type: 13px / 500-600 / normal tracking.
- **Action bar contract**
  - An action group is layout, not a framed component.
  - The action group itself contributes no background, border, radius, shadow,
    or clipping layer.
  - Primary, secondary, and destructive actions must share height, radius,
    label weight, and focus behavior.
  - Button order must read primary -> secondary -> destructive; destructive
    actions must not become the visual primary by color weight.
- **Danger command contract**
  - Destructive commands are restrained command buttons, not alert panels.
  - Use danger text/ring only; avoid a filled red button except inside a modal
    confirmation where the user is already in a destructive flow.
  - Disabled/loading destructive buttons keep their footprint and text contrast
    without becoming red alerts.
- **Information panel contract**
  - Summary metadata, version cells, image sync summaries, and settings panes
    use rows, local dividers, or spacing instead of repeated rounded cards.
  - A workbench body should not contain a framed outer panel, inner panel,
    summary cards, and action card at the same time.
  - Product panels use at most one section surface plus local dividers.
- **Literal UI string contract**
  - Visible product UI strings inside client components must go through `t()`
    or an already-localized view model field.
  - Audit direct JSX text nodes in console/admin/auth/deploy surfaces, starting
    with action labels, panel labels, button labels, empty-state titles, error
    copy, and aria labels.
  - Count one visible literal per locale, viewport, and theme when the fix is
    verified by source inventory or browser text.
- **Dense screenshot pass**
  - For any screenshot with more than five visible component families, run a
    component-family inventory instead of fixing only the highlighted element.
  - In one pass, classify every visible detail into: label, action, panel,
    row, status, form, nav, tab, destructive, loading, empty, or copy.
  - If a defect appears in one family member, query for every same-family
    instance in source and DOM before writing the backlog item.

### 7. Human Polish Pass

Use screenshots and interaction:

- Compare density, rhythm, and hierarchy against the design system.
- Run the squint test: primary, secondary, and grouped elements must remain
  legible when details blur.
- Inspect the layer trace for every visibly framed component.
- Check hover/focus/disabled/loading/empty/error states.
- Inspect long text, CJK, narrow screens, and low-data states.
- Prefer system-level fixes over one-off component patches.

## Severity Rules

- Critical: broken functionality, inaccessible interaction, console/runtime error, blocking layout failure.
- High: visible product style split, broken focus/keyboard behavior, invalid semantics, mobile overflow.
- Medium: inconsistent spacing/type/icon sizing, unreviewed autofocus, questionable gradients, missing loading policy.
- Low: cleanup, documentation, non-blocking polish.

## Loop Protocol

1. Run static scan.
2. Run rendered DOM scan across the route/viewport matrix.
3. Run screenshot-level visual structure scan and component contract matrix scan.
4. Run action bar, panel, danger, and literal UI string scans.
5. Write all actionable findings to a dedicated backlog document.
6. Add atomic optimization counts for every finding group.
7. Fix only items listed in the backlog.
8. Check off each item immediately after the fix is implemented and verified.
9. Run `npm run typecheck` and `npm run build`.
10. Re-run static, rendered, visual-structure, action/panel, and contract scans.
11. If new actionable findings appear, append them to the backlog and repeat.
12. Stop only when the current audit system returns no actionable issues and the
    verified optimization ledger meets the active cycle's required count.

## Todo

- [x] Define the multi-layer audit system.
- [x] Define route and viewport matrices.
- [x] Define severity rules.
- [x] Add a static audit command.
- [x] Run the first complete audit pass.
- [x] Create the first actionable backlog.
- [x] Fix all first-pass backlog items.
- [x] Re-run the complete audit pass.
- [x] Repeat until no actionable findings remain.
- [x] Add screenshot-level visual structure audit rules.
- [x] Add component contract matrix.
- [x] Add atomic 1000-detail count rules.
- [x] Add action bar, panel, danger command, and literal UI string scan rules.

## Current Loop Result

- Static audit: passed with 0 issues.
- Rendered audit: passed with 0 actionable issues after applying the measurement
  tolerance above.
- TypeScript and segmented-control guard: passed.
