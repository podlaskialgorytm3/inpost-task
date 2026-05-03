# InPost Smart Finder

## 1. Project title & description

**InPost Smart Finder** is a small Next.js application that talks to the public InPost Global Points API and helps you find parcel lockers and points that match real-world constraints: location, opening hours, availability signals, supported functions, and free-text search.

I built it as a focused tool rather than a generic “data browser”: the interesting part is combining pagination, caching, filtering, and sorting so the UI stays responsive while the underlying dataset is huge.

## 2. Problem definition

The InPost API exposes a very large, paginated list of points across countries. A reviewer (or an end user) should not have to mentally paginate JSON or guess which locker fits “near me, open Saturday evening, accepts parcel_collect”. The problem is **discoverability and relevance**, not raw access to the API.

## 3. Solution overview

The app has three main pieces:

1. **Server route** (`app/api/points/route.ts`) validates query parameters and calls the data layer.
2. **Data + business logic** (under `lib/inpost/`) fetches pages from InPost with retries and backoff, keeps a short TTL in-memory cache per country, maps messy JSON into a stable `Point` model, then filters and sorts in memory.
3. **Client UI** (`app/page.tsx`) drives search, shows results, optional Leaflet map, and exports (GeoJSON / CSV).

I kept the stack boring on purpose: one framework, TypeScript, no database — so the story stays easy to follow and deploy.

## 4. Features

- Live integration with the public InPost points API (no API key).
- Pagination with bounded concurrency, retries on 429/5xx, timeout per request, and respect for `Retry-After` when present.
- In-memory cache (per country, TTL) to avoid hammering the API on repeated searches.
- Filters: keyword, city, province, postal code, country, function, status, availability, 24/7, open-at time, radius + lat/lon.
- Sort by availability heuristics, distance (Haversine), or name.
- Map preview (Leaflet via CDN), Google Maps deep links, GeoJSON/CSV export.
- Graceful handling of partial failures (e.g. one page fails while others succeed) with human-readable error messages.

## 5. Tech stack

| Layer        | Choice |
|-------------|--------|
| Framework   | Next.js 16 (App Router) |
| Language    | TypeScript |
| UI          | React 19 |
| HTTP        | `fetch` (Node runtime on the API route) |
| Tests       | Vitest |
| Lint        | ESLint (eslint-config-next) |
| Map         | Leaflet 1.9 (CDN) |

## 6. Architecture

Layers map cleanly to the non-functional “separation of concerns” checklist:

| Concern | Location |
|--------|----------|
| **API / HTTP** — retries, timeouts, JSON parsing, pagination | `lib/inpost/api-client.ts` |
| **Data** — cache, cache keys | `lib/inpost/cache.ts` |
| **Transform** — raw API → `Point` | `lib/inpost/transform.ts`, `lib/inpost/parsing.ts` |
| **Business logic** — filters, sort, distance, opening hours | `lib/inpost/query-engine.ts` |
| **Orchestration** — `fetchPoints` | `lib/inpost/fetch-points.ts` |
| **Public exports** | `lib/inpost/index.ts` |
| **Presentation / HTTP boundary** | `app/page.tsx`, `app/api/points/route.ts` |

**Why this structure?** A single 600-line module would work, but splitting by responsibility makes reviews faster and mirrors how I’d grow the project (swap cache to Redis, add a repository, etc.) without rewriting the UI.

**Deliberate trade-offs (YAGNI):** no ORM, no message queue, no generic plugin architecture — only what the task needs.

## 7. Build instructions

```bash
git clone <your-fork-or-copy>
cd inpost-task
npm install
npm run build
```

Requires Node.js compatible with Next.js 16 (see Next.js docs if your version is older).

## 8. Run instructions

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI loads default filters and fetches points automatically.

Production-style run:

```bash
npm run build
npm start
```

## 9. Usage examples

**From the UI:** set country (default `PL`), optional city/postal code, optional “open at” time, then Search. Use “Max pages” to sample data when you do not want a full country fetch.

**API (same logic as the UI):**

```bash
curl "http://localhost:3000/api/points?country=PL&city=Warszawa&limit=10&sortBy=name&sortDir=asc"
```

**With geo filter (Warsaw centre, 5 km):**

```bash
curl "http://localhost:3000/api/points?country=PL&lat=52.2297&lon=21.0122&radiusKm=5&sortBy=distance"
```

## 10. Screenshots / demo

There is no hosted demo in this repo. To verify quickly: run `npm run dev`, open the home page, run a search, and confirm the results table and optional map update. Export buttons produce downloadable GeoJSON/CSV for a quick sanity check.

## 11. Testing

Unit tests cover core helpers (distance + opening hours parsing):

```bash
npm test
```

Vitest resolves the `@/` alias via `vitest.config.ts`. Use `npm test -- --run` in CI for a non-watch run if needed.

## 12. Assumptions

- The Global Points API stays publicly reachable and keeps the current pagination shape (`items`, `total_pages` / `meta.total_pages`).
- Incomplete rows in JSON are normal; missing fields are normalized to `null` / safe defaults where appropriate.
- For demos, an in-memory cache is acceptable; traffic is low and the process is single-instance.

## 13. Limitations

- Cache is per-process and lost on restart.
- Full-country pulls are heavy; use `maxPages` + `limit` for experiments.
- Leaflet loads from a CDN in the client — ad blockers or offline runs can break the map while the table still works.
- Very large result sets are intentionally capped client-side via `limit` to protect the browser.

## 14. Future improvements

- Replace CDN Leaflet with a typed npm dependency (or `react-leaflet`) for stricter typing and SSR safety.
- External cache (Redis) + background refresh for production traffic.
- Cluster markers on the map for dense areas.
- Persist recent searches locally; optional favorites.

---

_This README follows the section checklist from the task specification (problem, solution, architecture, build/run, tests, assumptions, limits) so a reviewer can onboard without prior context._
