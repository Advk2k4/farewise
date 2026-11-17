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

### Coverage

Transit depends on what Transitous has data for. In testing (November 2026) it returned routes in New York, London, Berlin, Tokyo, São Paulo, Bangalore and Sydney, and **nothing** in Mumbai, Delhi or Dubai. When there's no transit, Farewise says so and links to Google Maps transit for that trip. Walking, cycling and driving work everywhere OpenStreetMap has roads.

## 2. The options

| Option | Shown when | Time | Price |
|---|---|---|---|
| **Walk** | Under ~8 km straight-line and 100 min | OSRM foot | Free |
| **Cycle** | You have a bike (Settings) and it's under ~30 km | OSRM bike + 2 min | Free |
| **Transit** | Transitous finds itineraries (up to 4 distinct ones) | Real schedule. Door-to-door time includes waiting for the first departure. | One fare per ride, at most two |
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

Farewise picks the country from the first place you search. If a trip is in a different country, it offers to switch. You can override every number in **Settings → Prices**.

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
