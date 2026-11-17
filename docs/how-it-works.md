# How Farewise works

Farewise has no backend and no API keys. When you plan a trip, your browser asks three free, open services for routes, combines the answers, adds a price estimate and ranks the options.

## 1. Data sources

| What | Service | Notes |
|---|---|---|
| Place search | [Photon](https://photon.komoot.io) by Komoot | Built on OpenStreetMap. Results are biased towards your last place or home. Searches start after 3 characters, 350 ms after you stop typing. |
| Walking, cycling, driving | [OSRM servers run by FOSSGIS](https://routing.openstreetmap.de/about.html) | Separate `foot`, `bike` and `car` profiles, worldwide. No live traffic. |
| Public transit | [Transitous](https://transitous.org) (MOTIS 2) | Community-run, worldwide where operators publish GTFS timetables. Real scheduled times, and live times where available. |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Leaflet | Standard OSM tiles; inverted in dark mode. |

All responses are cached in memory for the session, and transit lookups round the departure time to 5 minutes so repeated views reuse them. Farewise only calls the routing services once both ends of a trip are chosen; they're never called per keystroke.

### Coverage, and offline networks where live data is thin

Transit depends on what Transitous has data for. In testing (November 2026) it returned routes in New York, London, Berlin, Tokyo, São Paulo, Bangalore and Sydney, and **nothing** in Mumbai, Delhi or Dubai. When there's no transit, Farewise says so and links to Google Maps transit for that trip. Walking, cycling and driving work everywhere OpenStreetMap has roads.

**Offline metro and suburban-rail networks.** Some big cities have little or no open timetable data, India especially. In testing (November 2026), Transitous had no Delhi, Chennai or Kolkata transit, only long-distance trains in Mumbai, and only buses in Bengaluru. For these cities, Farewise ships the rail networks themselves:

- [`scripts/fetch-networks.mjs`](../scripts/fetch-networks.mjs) downloads the metro, monorail, RRTS and suburban ("local") train lines with their stations in order, from OpenStreetMap via the Overpass API, into `public/networks/*.json`. Cities: Delhi NCR, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad, Kochi, Jaipur, Lucknow and Nagpur.
- When both ends of a trip fall inside one of these cities, [`src/lib/offline.ts`](../src/lib/offline.ts) loads that city's file and builds a graph. Stations within 350 m of each other on different lines become interchanges. It then runs Dijkstra: you walk to a station within about 1 km, or take an auto or taxi to one further away, then ride, change and finish the same way.
- **Times are estimates.** There's no timetable, so the app assumes average speeds (metro 33 km/h, local train 38 km/h, stops included) plus a typical wait (5–6 min). These options carry an **Estimated** tag and a note.
- **Fares in India** use typical token-fare slabs: metro ₹10–60, suburban 2nd class ₹5–25.
- These options are added alongside any live Transitous results, and the same ranking decides between them.

## 2. The options

| Option | Shown when | Time | Price |
|---|---|---|---|
| **Walk** | Under ~8 km straight-line and 100 min | OSRM foot | Free |
| **Cycle** | You have a bike (Settings) and it's under ~30 km | OSRM bike + 2 min | Free |
| **Transit** | Transitous finds itineraries (up to 4 distinct ones) | Real schedule. Door-to-door time includes waiting for the first departure. | One fare per ride, at most two |
| **Auto rickshaw / tuk-tuk** | Countries where they're common (India, Pakistan, Bangladesh, Thailand), up to 25 km. Not offered where they aren't allowed, such as Mumbai south of Bandra/Sion. | OSRM car × traffic factor + 3 min | Flag fall for 1.5 km + per km, shown as a range |
| **Taxi / ride-hail** | Any trip over ~0.6 km | OSRM car × traffic factor + 5 min pickup | Flag fall + per km + per minute, shown as a range |
| **Drive** | You have a car (Settings) | OSRM car × traffic factor + parking time | Fuel only: km × L/100 km × fuel price |

**Traffic factor.** OSRM has no live traffic, so driving time is scaled by a typical-traffic multiplier for the hour:

| When | Factor |
|---|---|
| Weekday 7–10 and 16–19 | ×1.45 |
| Other weekday daytime | ×1.2 |
| Weekend 11–20 | ×1.15 |
| Other weekend hours | ×1.05 |
| Night (22–06) | ×1.0 |

## 3. Prices

[`src/lib/rates.ts`](../src/lib/rates.ts) holds ballpark big-city rates for 50 countries, in local currency:

- taxi flag fall, per km and per minute
- a typical single transit fare
- petrol per litre

**Prices follow the trip.** Each trip is priced in the country where it starts, in that country's currency: search Delhi and you see rupees, search London and you see pounds. You can override any country's rates in **Settings → Prices**; edits are kept per country.

**Spending has its own currency.** By default it's the country of the first place you search, and you can change it in Settings. Trips logged in another currency are listed but not added to the totals.

These are estimates for ranking options, not quotes:
- Transit passes, free transfers, zones and surge pricing aren't modelled.
- The taxi range runs from −15% to +20% of the estimate, or up to +50% in rush hour.

## 4. Ranking

Each option gets a score:

```
score = door-to-door minutes
      + λ × price             λ = K / (typical transit fare)
                               K = 25 (save money), 10 (balanced), 3 (save time)
      + 3 per change
      + walking beyond 15 min × 0.6   (× 0.4 for the Walk option itself)
      + cycling beyond 40 min × 0.5
```

Scaling by the local transit fare makes "balanced" mean the same thing everywhere: **one transit fare is worth about 10 minutes**, whether that's $2.90 in New York or ₹30 in Bangalore.

- The lowest score is **Recommended**, the lowest price is **Cheapest**, and the earliest arrival is **Fastest**.
- A transit option is dropped when another one arrives no later, with no more changes and about the same walking, and scores clearly better.

## 5. Day planner

Legs are worked out in order: each leg departs when you finish at the previous stop.

- If a stop has a **fixed time**, you wait until then. The stop is marked **On time** (5+ min spare), **Tight** or **Late**. When a faster option would fix a late arrival, Farewise offers to switch to it.
- **Best visit order** keeps fixed-time stops in time order. It inserts the other stops wherever they add the least straight-line distance, a cheapest-insertion heuristic.

## 6. Spending

Trips you log are saved by date.

- A **cycle** runs from your chosen start day (1–28) to the day before it next month.
- **Per day** = budget left ÷ days left that count (every day, Mon–Sat or Mon–Fri).
- **Cycle-end pace** = spent ÷ counted days so far × counted days in the cycle.
- Trips logged in another currency are listed but not added to the totals.
