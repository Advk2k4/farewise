# Architecture

Farewise is a static, dependency-free web app: vanilla JavaScript, one CSS file, and Leaflet from a CDN for the map. There's no framework, no bundler and no `npm install`. The code is split into small classic scripts that share one global scope and load in a fixed order. `scripts/build.py` inlines them into a single `dist/index.html` for deployment.

## Layout

```
src/
├── index.html               Page shell, CDN links, script load order
├── styles/app.css           Design tokens (light + dark), layout, components, map styles
└── js/
    ├── core/helpers.js      Formatting (money via Intl, times, dates), haversine, polyline decoding
    ├── data/rates.js        Default taxi / transit / fuel prices for 50 countries
    ├── services/api.js      Photon search, OSRM car/bike/foot, Transitous transit + response cache
    ├── engine/options.js    Builds options from the three services, prices them, scores and tags them
    ├── state/
    │   ├── storage.js       App state `S`, localStorage persistence, recent places, backup codes
    │   └── budget.js        Spending cycles and trip logging
    └── ui/
        ├── components.js    Place field with live suggestions, route strip, steps, option card
        ├── map.js           One persistent Leaflet map moved between views
        ├── trip.js          Trip view, shareable links, examples
        ├── plan.js          Day planner (async leg chain, fixed-time checks, best order)
        ├── spending.js      Spending view and chart
        ├── settings.js      Settings view
        ├── sheet.js         Add-expense sheet
        └── app.js           Navigation, render loop, event delegation, boot
```

## Rendering and async work

- All state lives in one object, `S`. `render()` batches through `requestAnimationFrame` and rebuilds `<main>` from the active view's function, which returns an HTML string. Every interpolated value goes through `esc()`.
- **Async results without loops.**
  - The trip view computes a **key** (endpoints + time slot + preferences). It starts a lookup only when the key changes, and ignores responses whose key is stale.
  - The day planner does the same with a key over the whole plan.
  - Results come back into `S` and trigger a normal `render()`.
- **The map survives re-renders.** The Leaflet map lives in one detached `<div>`. After each render it's moved into the view's `#map-slot`, then resized, and redrawn only when what it shows has changed.
- **Typing survives re-renders.** If async results arrive while you're typing in a place field, `doRender()` restores that field's text, focus and cursor position.
- **Events are delegated:**
  - `data-act` → `ACT` (clicks)
  - `data-ch` → `CH` (change)
  - place fields use `focusin` / `input` / `mousedown` / `keydown` on `[data-pf]`, with arrow-key and Enter navigation through suggestions

## Storage

Everything is saved in the browser under `localStorage['farewise-v1']`:

```js
{ prefs: { home, country, rates:{cur, taxiBase, taxiKm, taxiMin, fare, fuel, lper100},
           priority, hasCar, hasBike, parkMin, budget, cycleDay, workdays, visit },
  days:  { 'YYYY-MM-DD': { trips: [{ id, t, from, to, mode, label, cost, cur, parts }] } },
  plans: { 'YYYY-MM-DD': { date, start, startTime, ret, stops:[{ place, meet, visit }], choice } },
  recent:[ place, … ] }
```

A **backup code** (`FW1.` + base64 JSON) copies this to another browser. Importing merges trips by id and never duplicates them.

## URLs

| URL | Opens |
|---|---|
| `#trip`, `#plan`, `#spending`, `#settings` | That tab |
| `?from=lat,lng&fn=Name&to=lat,lng&tn=Name&cc=GB` | A specific trip; the **Copy link to this trip** button makes these |
| `?example=plan` | The example London day |

## Deploying

`.github/workflows/pages.yml` runs `python3 scripts/build.py` on every push to `main` and publishes `dist/` to GitHub Pages. Any static host works the same way: upload `dist/index.html`, or serve `src/` as-is.
