# Design

## Direction

Farewise v2 is designed as a calm, engineering-grade utility. The design came from three sources:

1. **[`DESIGN.md`](../DESIGN.md)**, from [VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design). Of the collection's systems, the Uber-inspired mobility system fits a transport app best: a black-and-white duet, pill-shaped controls, 16 px cards, bold sentence-case headings, one black primary action per screen, and the signature "request form" card for pickup and destination. Farewise borrows the *style* only, with its own name, logo, copy and layout.
2. **[Taste Skill](https://github.com/Leonxlnx/taste-skill)** (design-taste-frontend). It's written mainly for marketing sites, so only its app-relevant principles were applied:
   - one system: one button pair, one card style, one radius scale
   - plain, specific copy
   - an entrance on first load and quiet hover/press feedback
   - no scroll-triggered fades, no tilt, no stacked effects
   - no violet
   
   Its landing-page rules (one section per screen, photo-led sections) and its finish gate don't fit an app UI and weren't used.
3. **Restraint with effects.**
   - **Motion** is used for the hero entrance, the sliding nav pill, cards expanding and the results list arriving.
   - **One Magic UI component**, `NumberTicker`, animates the Spending total.
   - Everything respects `prefers-reduced-motion`, through `MotionConfig reducedMotion="user"` and a CSS rule.

## Interaction feedback

Every action answers the tap:

- **Buttons** spring down when pressed and lift slightly on hover (Motion `whileTap` / `whileHover`). Primary buttons also give a light haptic tick on phones that support vibration.
- **Segmented controls** (Leave now / Leave at / Arrive by, and the Settings choices) slide a thumb to the new option. The date and time fields slide in when you pick *Leave at* or *Arrive by*.
- **Swap** spins its arrows half a turn.
- **Log** and **Copy link** turn into a check mark with "Logged" or "Copied" for a moment, alongside a toast with **Undo**.
- **Adding a stop** slides the new card into the timeline with a brief outline, pops a numbered marker onto the map, and confirms with a toast. Moving or removing a stop animates the list, and removing offers Undo.
- **Option cards** press in slightly when tapped, and their details expand smoothly.

## Motion moments

The app was flat and quiet. Following the Taste Skill's rule of **one ambient effect and a few moments**, rather than effects everywhere:

| Where | Effect | Source | Why |
|---|---|---|---|
| Trip hero | Slow drifting threads behind the headline, masked at the edges | React Bits *Threads* (WebGL, pauses off-screen and when the tab is hidden) | The single ambient effect: it hints at routes without competing with content |
| Headline | "Every way from A to B, **priced. / by metro. / on foot. …**" | React Bits *Rotating Text* (`popLayout` so the pill never empties) | Says what the app does in one line |
| Empty state | From → five modes → To with pulses travelling along the beams | Magic UI *Animated Beam* (pulse reworked as a CSS dash: the original gradient sweep froze) | Shows how it works before anyone types |
| Empty state | Example trips in a slow marquee that pauses on hover | Magic UI *Marquee* | Invites a first tap |
| Search | Placeholder cycles real examples with a blur-slide | Idea from Aceternity *Placeholders and Vanish Input* | Teaches that any place works |
| Results | Recommended card gets a travelling amber border; minutes count up | Magic UI *Border Beam* and *Number Ticker* | Draws the eye to the best option once |
| Map | Routes draw in, the start marker pulses | Own CSS (stroke-dashoffset) | Connects the list to the map |
| Logging | Confetti from the button, in theme colours | canvas-confetti | A small reward for the main action |
| Day plan | A beam fills down the timeline as you scroll | Rewritten from Aceternity *Tracing Beam* (theme colours, live height) | Gives a long plan a sense of progress |
| Spending | Budget-used ring: ink, amber when the pace is over, red when over | Magic UI *Animated Circular Progress Bar* | Budget at a glance |

Amber (#f5c400) is the only accent and appears only in these moments. Every effect checks `prefers-reduced-motion` (Motion's `MotionConfig reducedMotion="user"` plus CSS media queries).

## Light and dark

The header has a three-way switch (Light, Dark, Match device), mirrored in Settings → Appearance. The choice is saved in `localStorage` and applied by a tiny inline script in `index.html` before first paint, so there's no flash of the wrong theme.

- **Dark mode is the same system with the polarity flipped:** ink `#fff` on canvas `#000`, cards `#141414`, greys `#282828` / `#3a3a3a`. The selected thumb in segmented controls (`--thumb`) is *lighter* than its track in dark mode, so the selection never reads backwards.
- **Inverted surfaces don't invert again.** The footer and the day-plan summary stay black in light mode and become bordered dark cards in dark mode, rather than glaring white slabs.
- **Operator colours stay visible.** Very dark line colours (e.g. London's black Northern line) get an outline on chips and are lightened on the map in dark mode; very light ones are darkened on light maps (`src/lib/colour.ts`).
- **The map follows the theme:** greyscale tiles in light mode, inverted greyscale in dark, and Leaflet's zoom buttons, attribution and tooltips use the theme tokens. Switching theme recolours the map without moving it.
- **Toasts follow the app's theme**, not just the device's.
- **Switching cross-fades** colours over 0.3 s (skipped with reduced motion).

Every visible text element on every tab was measured against its real background in both themes (an automated WCAG contrast pass) and meets AA.

## Colour rules

| Use | Token |
|---|---|
| Primary action, selected state, totals band | ink `#000` (white in dark mode) |
| Surfaces, inputs, chips | `#efefef` / `#f3f3f3` |
| Borders | `#e2e2e2` |
| Secondary text | `#5e5e5e` |
| Transit line chips and map lines | the operator's own `routeColor` from the timetable |
| Stop status | green (on time), amber (tight), red (late), always with a text label |

The map uses greyscale OpenStreetMap tiles so the route is the only colour on it.

## Audit

Before release the UI was audited against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). Fixes made:

- no `transition: all` in the shadcn primitives (properties listed explicitly)
- placeholders end in "…" and show an example; typographic apostrophes in copy
- `inputMode` on number fields, `name` on search fields, no `autoFocus` in the expense dialog
- `color-scheme` per theme, `theme-color` per scheme, `touch-action: manipulation`, tap highlight removed
- `preconnect` to the API and tile hosts
- `overscroll-behavior: contain` on popover lists and dialogs
- reduced motion honoured for Motion animations; `translate="no"` on the brand name
- trip state reflected in the URL; back/forward works between tabs

Waived on purpose: *"Title Case for headings/buttons"*. DESIGN.md's house style is sentence case.

## Browser testing

The finished site was tested in a real browser with [Playwright CLI](https://github.com/microsoft/playwright-cli):
- every view at 1440×900 and 390×844, in light and dark
- checks for horizontal overflow, clipped text and console errors (none found)
- an end-to-end flow: search, keyboard selection, route lookup, logging a trip, and checking Spending
