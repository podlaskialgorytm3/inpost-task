# InPost Smart Finder

**Demo:** https://inpost-task.vercel.app/

## O projekcie

InPost Smart Finder to aplikacja w Next.js, ktora pozwala szybko wyszukiwac paczkomaty i punkty InPost na podstawie realnych potrzeb: lokalizacji, godzin otwarcia, dostepnosci, funkcji punktu i zapytania tekstowego. Zamiast przegladania setek stron danych, dostajesz od razu najbardziej sensowne wyniki.

### Co znajdzie uzytkownik

- Wyszukiwarke punktow InPost z filtrowaniem po kraju, miescie, kodzie, promieniu i funkcjach.
- Sortowanie po dostepnosci, odleglosci albo nazwie.
- Mape z podgladem wynikow i linkami do Google Maps.
- Eksport wynikow do CSV i GeoJSON.
- Szczegoly pojedynczego punktu wraz z adresem i danymi operacyjnymi.

## Najwazniejsze funkcje

- Integracja z publicznym InPost Points API (bez klucza API).
- Wysoka wydajnosc: paginacja, ponowienia, cache w pamieci.
- Filtrowanie i sortowanie wynikow po stronie serwera.
- Podglad mapy (Leaflet z CDN).

## Jak uruchomic lokalnie

Wymagania:

- Node.js 20 LTS
- npm 10+

Instalacja i start:

```bash
npm install
npm run dev
```

Otworz: http://localhost:3000

Build produkcyjny:

```bash
npm run build
npm start
```

## Przykladowe uzycie API

```bash
curl "http://localhost:3000/api/points?country=PL&city=Warszawa&limit=10&sortBy=name&sortDir=asc"
```

```bash
curl "http://localhost:3000/api/points?country=PL&lat=52.2297&lon=21.0122&radiusKm=5&sortBy=distance"
```

## Struktura projektu (skrot)

```text
app/          # UI i routing (App Router)
app/api/      # Endpointy API
lib/inpost/   # Logika pobierania, cache, filtrowania
tests/        # Testy
```

## Deployment

Projekt jest gotowy do wdrozenia na Vercel. Domyslne komendy:

- Build: `npm run build`
- Start: `npm start`

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
