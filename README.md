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
- Optional **Max API pages** in the UI (same as `maxPages` query param) to sample data without loading a full country.
- Filters: keyword, city, province, postal code, country, function, status, availability, 24/7, open-at time, radius + lat/lon.
- Sort by availability heuristics, distance (Haversine), or name.
- Map preview (Leaflet via CDN), Google Maps deep links, GeoJSON/CSV export.
- Graceful handling of partial failures (e.g. one page fails while others succeed) with human-readable error messages.

## 5. Tech stack

Dependencies and versions live in **`package.json`** / **`package-lock.json`**. The repo is already wired for this stack; no extra stack narrative here.

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

Dependencies are listed in **`package.json`** (runtime: `next`, `react`, `react-dom`; dev: TypeScript, ESLint, Vitest, types). After install, the production bundle is created with:

```bash
npm install
npm run build
```

No database or extra services are required.

## 8. Run instructions

**Development** (hot reload):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI loads default filters and fetches points automatically.

**Production-style** (matches typical deploy steps):

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000) (default port **3000**).

---

## Prerequisites & setup (technical checklist)

### Prerequisites

- **Node.js** 20.9+ (see `engines` in `package.json`; use current 20 LTS if the build complains about engine warnings).
- **npm** 10+ (comes with Node), or another client compatible with `package-lock.json`.
- **Git** (to clone the repo).

No global installs of Next.js or TypeScript are assumed—everything comes from `npm install`.

### Step-by-step: clone, install, run

1. **Clone and enter the project**

   ```bash
   git clone https://github.com/<your-username>/inpost-task.git
   cd inpost-task
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment (optional)**  
   The InPost points API used here is public and needs **no API key**. If you add local overrides later, copy the template:

   ```bash
   # macOS / Linux
   cp .env.example .env

   # Windows (PowerShell / cmd)
   copy .env.example .env
   ```

4. **Run** — choose one:

   - Development: `npm run dev` → http://localhost:3000  
   - Production locally: `npm run build` then `npm start` → http://localhost:3000  

### Verify installation

After `npm run dev` (or `npm start`):

- The home page loads without a blank screen.
- A table of points appears after the first request (may take a while on a full-country fetch).
- Optional: open http://localhost:3000/api/points?country=PL&limit=5 — you should see JSON with `items` and `meta`.

**Quick API smoke test (Windows PowerShell)** — uses `maxPages=1` so the server does not paginate the whole country:

```powershell
$uri = "http://localhost:3000/api/points?country=PL&limit=5&maxPages=1"

# Raw HTTP check (status + start of body)
$response = Invoke-WebRequest -Uri $uri -UseBasicParsing
$response.StatusCode   # expect 200
$response.Content.Substring(0, [Math]::Min(400, $response.Content.Length))

# Parsed JSON — confirm `meta` / `items`
$json = Invoke-RestMethod -Uri $uri -Method Get
$json.meta
$json.items.Count
```

If `Invoke-WebRequest` fails with a connection error, the dev server is not running or is on another port.

Try in the UI:

1. Search with country **PL** and city **Warszawa** (or your own city).
2. Toggle a function filter (e.g. parcel collect) and confirm the list changes.
3. Use **Export** to download GeoJSON or CSV if results are present.

### Troubleshooting

**Port 3000 already in use**

- Windows (PowerShell): `Get-NetTCPConnection -LocalPort 3000` then stop the owning process, or run on another port: `npx next dev -p 3001`.

**`npm run build` fails on TypeScript or “Unsupported engine”**

- Upgrade to the latest **Node 20 LTS** and run `npm install` again.

**429 / rate limit from InPost**

- The app retries with backoff and caches full-country fetches briefly. For experiments, reduce load: use **Max pages** in the UI or `maxPages` in the API query, and avoid hammering the API in a tight loop.

**Map tiles or markers missing**

- Leaflet CSS/JS load from a CDN; disable strict blockers for `unpkg.com` and `openstreetmap.org`, or rely on the table and CSV/GeoJSON export.

### Repository layout

Expected shape (high level):

```text
├── README.md
├── LICENSE
├── package.json
├── package-lock.json
├── .gitignore
├── .env.example
├── app/                 # Next.js App Router (UI + API route)
├── lib/                 # Shared logic (InPost client, types)
├── docs/                # Testing notes, acceptance mapping, screenshot guides
├── tests/               # Vitest specs
├── vitest.config.ts
└── next.config.ts
```

**Note:** The repository must stay **public** and reachable for reviewers until the deadline stated in the task materials. Making it public is done in your Git host settings, not in this repo.

### Optional deployment

This repo is not tied to one host. Typical options for Next.js: **Vercel**, **Railway**, **Render**, or any Node-capable platform. Set the build command to `npm run build` and the start command to `npm start`. If you do not deploy, use local verification and screenshots as proof (see section 10).

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

### Example API response (illustrative)

Shape returned by `GET /api/points` (fields depend on InPost data; `items` is truncated here):

```json
{
  "query": { "country": "PL", "perPage": 100, "limit": 5 },
  "meta": {
    "pagesFetched": 1,
    "totalFetched": 100,
    "totalFiltered": 42,
    "totalPages": 120,
    "fetchedAt": "2026-05-03T12:00:00.000Z",
    "source": "live",
    "fetchMode": "sample",
    "truncated": true
  },
  "items": [
    {
      "id": "KRA010",
      "name": "KRA010",
      "country": "PL",
      "type": ["parcel_locker"],
      "status": "Operating",
      "location": { "latitude": 50.0614, "longitude": 19.9366 },
      "address": { "line1": "…", "line2": null },
      "addressDetails": {
        "city": "Kraków",
        "province": "małopolskie",
        "postCode": "30-001",
        "street": "…",
        "buildingNumber": null
      },
      "openingHours": "24/7",
      "functions": ["parcel_collect", "parcel_send"],
      "lockerAvailability": { "status": "AVAILABLE", "details": null },
      "availableCompartments": null,
      "distanceKm": 2.05
    }
  ]
}
```

## 10. Screenshots & demo

> **Before final submission:** replace the SVG placeholders below with your own **PNG/JPEG** captures from a running app — see [docs/screenshots/README.md](docs/screenshots/README.md).

| # | What to show |
|---|----------------|
| 1 | Search / filter UI |
| 2 | Results table + meta |
| 3 | Point detail (address, hours, availability) |
| 4 | Map with markers |
| 5 | GeoJSON/CSV export (or downloaded file) |

![Search and filters](docs/screenshots/01-search-filters.svg)

![Results table](docs/screenshots/02-results-table.svg)

![Point detail](docs/screenshots/03-point-detail.svg)

![Map view](docs/screenshots/04-map-view.svg)

![Exports](docs/screenshots/05-exports.svg)

**Demo video (optional):** add a link here (YouTube, Loom, etc.) after recording: search → results → map → export.

**Hosted demo:** none baked into the repo — add your deployment URL after publishing (e.g. Vercel).

## 11. Testing

Automated tests (core: distance + opening hours):

```bash
npm test
```

Single run (CI):

```bash
npm run test:run
```

**Manual scenarios & API smoke checks:** [docs/TESTING.md](docs/TESTING.md).

## 12. Assumptions

- The Global Points API stays publicly reachable and keeps the current pagination shape (`items`, `total_pages` / `meta.total_pages`).
- Incomplete rows in JSON are normal; missing fields are normalized to `null` / safe defaults where appropriate.
- For demos, an in-memory cache is acceptable; traffic is low and the process is single-instance.

## 13. Limitations

- Cache is per-process and lost on restart.
- Full-country pulls are heavy; use **Max API pages** in the UI (or `maxPages` in the API) plus `limit` for experiments.
- Leaflet loads from a CDN in the client — ad blockers or offline runs can break the map while the table still works.
- Very large result sets are intentionally capped client-side via `limit` to protect the browser.
- Distance is **straight-line (Haversine)**, not driving or walking time.

### Out of scope (explicit)

Not attempted in this repo (see functional spec options B/C and similar):

- Density analysis, “dead zones”, and regional coverage reports.
- Long-term availability monitoring, dashboards, or alerts.
- User accounts, ratings, or saved favourites (beyond possible future work).
- Multi-language UI.
- Routing providers (Google/HERE) for road distance.

For a mapping of **acceptance criteria (AC1–AC5)** from the task materials to this codebase, see [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## 14. Future improvements

- Replace CDN Leaflet with a typed npm dependency (or `react-leaflet`) for stricter typing and SSR safety.
- External cache (Redis) + background refresh for production traffic.
- Cluster markers on the map for dense areas.
- Persist recent searches locally; optional favorites.

## 15. License

**MIT** — see [LICENSE](LICENSE).

## 16. Pre-submission checklist

- [ ] Repository is **public**; link works in a private/incognito window.
- [ ] `npm install` → `npm run build` → `npm start` (or `npm run dev`) succeeds.
- [ ] README updated with **real screenshots** instead of SVG placeholders (recommended).
- [ ] Optional: screen recording link or deployment URL added above.
- [ ] Submit the GitHub URL and your details via the InPost application form when required.

---

This README matches the deliverables brief: problem, solution, features, architecture, build/run, examples, proof of functionality, testing, assumptions, and limitations.
