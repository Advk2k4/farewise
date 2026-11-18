# Architecture

Farewise is a static single-page app: **React 19 + TypeScript**, built with **Vite**, styled with **Tailwind CSS v4** and **shadcn/ui** (Radix primitives). **Motion** handles animation and **Leaflet** the map. There's no backend. Routes come straight from free public services (see [how-it-works.md](how-it-works.md)), and your data is saved in the browser.

## Layout

```
src/
├── main.tsx                 Entry: mounts <App/>, follows the system light/dark setting
├── App.tsx                  Shell: header nav, tab routing (#hash), footer, mobile tab bar, toasts
├── index.css                Tailwind + design tokens (light & dark) from DESIGN.md
├── lib/                     Framework-free logic, fully typed
│   ├── format.ts            Time, date, money (Intl), distance, polyline decoding
│   ├── rates.ts             Default taxi / transit / fuel prices for 50 countries
│   ├── api.ts               Photon search, OSRM car/bike/foot, Transitous transit + response cache
│   ├── options.ts           Builds, prices, ranks and tags travel options for a trip
│   ├── offline.ts           Offline metro / local-train routing on bundled OSM networks (India etc.)
│   ├── feedback.ts          Light haptic tick on supporting phones
│   ├── theme.ts             Light / dark / match-device theme, saved per browser
│   ├── colour.ts            Keeps operator line colours visible on light and dark
│   ├── budget.ts            Spending cycles (any start day), pace and per-day maths
│   ├── store.ts             App data in localStorage + a tiny external store (useSyncExternalStore)
│   ├── utils.ts             shadcn's cn() helper
│   ├── celebrate.ts         Theme-coloured confetti burst from an element
│   └── logic.test.ts        Tests for budget cycles and undo (`npm test`, Node's built-in runner)
├── components/
│   ├── PlaceInput.tsx       Worldwide place search (Popover + cmdk), select-all on focus, clear, location, recents
│   ├── Segmented.tsx        Pill segmented control with a sliding thumb (Motion layoutId)
│   ├── ThemeToggle.tsx      Light / dark / match-device switch (header and Settings)
│   ├── FeedbackButton.tsx   Button that confirms itself ("Logged ✓", "Copied ✓")
│   ├── OptionCard.tsx       Option card, route strip, steps, tags
│   ├── RouteMap.tsx         Leaflet map with OSM tiles, monochrome markers, coloured transit lines
│   ├── AddExpenseDialog.tsx Manual expense form (shadcn Dialog)
│   ├── HowItWorks.tsx       From → modes → To diagram with animated beams (empty state)
│   ├── TimelineBeam.tsx     Scroll-linked beam down the Day plan timeline
│   ├── fx/                  React Bits effects: Threads (WebGL), RotatingText
│   └── ui/                  shadcn/ui primitives (restyled to DESIGN.md) + Magic UI NumberTicker, AnimatedBeam, BorderBeam, Marquee, AnimatedCircularProgressBar
└── views/
    ├── TripView.tsx         From → to, options, shareable URL state
    ├── PlanView.tsx         Multi-stop day planner (lazy-loaded)
    ├── SpendingView.tsx     Cycle summary, chart, breakdown, trip list (lazy-loaded)
    └── SettingsView.tsx     Home, prices, preferences, budget, backup codes (lazy-loaded)
```

Also: `public/networks/*.json` (rail networks per city, made by `scripts/fetch-networks.mjs`, data © OpenStreetMap contributors, ODbL).

## State and async work

- **Persistent data** lives in `lib/store.ts`: prefs, logged trips by date, saved day plans and recent places. `update(fn)` clones, mutates, publishes and saves (debounced) to `localStorage['farewise-v2']`. Components read it with `useData()`. Data from the earlier vanilla version (`farewise-v1`) is picked up automatically.
- **Trip lookups.** `TripView` builds a key from the endpoints, the time and the routing preferences, and calls `tripOptions()` only when that key changes. Responses for an outdated key are ignored. `lib/api.ts` caches every response in memory, and transit times round to 5 minutes, so switching back and forth costs nothing.
- **Day plans** chain legs in order, each departing when the previous stop ends. The same key-and-cache pattern applies.
- **URL state:**
  - the tab lives in `#trip`, `#plan`, `#spending` or `#settings`, and back/forward works
  - the current trip lives in `?from=lat,lng&fn=…&to=lat,lng&tn=…&cc=GB`, so every trip can be bookmarked and shared
  - `?example=plan` opens the example London day

## Design system

Tokens follow [`DESIGN.md`](../DESIGN.md), a black-and-white mobility system inspired by Uber's public design language:
- ink-black primary actions and canvas white, with greys `#efefef`, `#f3f3f3` and `#e2e2e2`
- pill controls and 16 px cards
- Geist at weight 700 for headings and 400/500 for body text

Colour appears only where it carries information:
- transit lines in their operators' own colours
- the status of a stop (on time, tight, late)

Dark mode is the same system with the polarity flipped. See [design.md](design.md) for how the design was set and audited.

## Building and deploying

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve dist/
```

`.github/workflows/pages.yml` runs `npm ci && npm run build` on every push to `main` and publishes `dist/` to GitHub Pages. Vite's `base` is `/farewise/` when building in GitHub Actions.

The main chunk (React, Motion, Radix, Leaflet) is about 185 kB gzipped. The Day plan, Spending and Settings views load on demand.
