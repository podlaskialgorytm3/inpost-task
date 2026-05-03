# InPost Smart Finder

InPost Smart Finder is a Next.js app that queries the official InPost points API and helps users find parcel lockers by location, availability, and supported functions.

## Problem

The API exposes a massive dataset of parcel lockers across Europe, but it can be hard to quickly locate the best point for a specific need.

## Solution

Provide a focused UI that pulls live data from the InPost API, samples multiple pages for performance, and lets users filter by common criteria.

## Features

- Live API integration with pagination handling
- Filters for keyword, city, province, country, functions, status, and 24/7 opening hours
- Availability status and locker metadata displayed per result
- Google Maps deep link for each point
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

- The UI samples a limited number of API pages (configurable with the Max pages field) for performance.
- The InPost API is public and does not require authentication.

## Assumptions

- The API remains available and follows the current pagination format.
- Point data can be incomplete, so missing fields are handled gracefully.

## Future Improvements

- Add map visualization and clustering
- Persist recent searches and favorites
- Add more advanced ranking and scoring of results
