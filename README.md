# InPost Smart Finder

InPost Smart Finder is a Next.js app that queries the official InPost points API and helps users find parcel lockers by location, availability, and supported functions.

## Problem

The API exposes a massive dataset of parcel lockers across Europe, but it can be hard to quickly locate the best point for a specific need.

## Solution

Provide a focused UI that pulls live data from the InPost API, samples multiple pages for performance, and lets users filter by common criteria.

## Features

- Live API integration with pagination handling
- Filters for keyword, city, province, postal code, radius search, opening time, and 24/7 access
- Sorting by availability, distance, or name
- Availability status and available slot counts by size (when provided)
- Google Maps deep link for each point
- Google Maps deep link for each point
- Export current results as GeoJSON or CSV
- Simple interactive map (Leaflet via CDN) showing current results
- Graceful error handling and parsing of missing data

## Architecture

- `app/api/points` fetches and paginates the InPost API, then filters and normalizes results
- `lib/inpost.ts` maps raw API data into a stable, typed structure
- `app/page.tsx` renders the Smart Finder UI and calls the internal API

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open http://localhost:3000 to use the app.

## Notes

- The API fetches the full paginated dataset and keeps it in memory for a short time to speed up repeat searches.
- Distance sorting and radius filtering require latitude + longitude inputs.
- Results are capped in the UI (adjust with Max results) to keep the page responsive.
- The InPost API is public and does not require authentication.

## Assumptions

- The API remains available and follows the current pagination format.
- Point data can be incomplete, so missing fields are handled gracefully.

## Future Improvements

- Add map visualization and clustering
- Persist recent searches and favorites
- Add more advanced ranking and scoring of results
