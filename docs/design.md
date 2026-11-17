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
