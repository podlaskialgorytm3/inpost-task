/** InPost Global Points API base URL (public, no API key). */
export const INPOST_POINTS_BASE_URL =
  "https://api-global-points.easypack24.net/v1/points";

/** Request timeout for a single HTTP call. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Next.js fetch cache revalidation window (seconds). */
export const REVALIDATE_SECONDS = 300;

/** In-memory cache TTL for full country fetches. */
export const CACHE_TTL_MS = 10 * 60 * 1000;

export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 500;
/** Cap for exponential backoff between retries. */
export const RETRY_BACKOFF_MAX_MS = 8000;

/** Parallel page fetches when loading remaining pages. */
export const MAX_CONCURRENCY = 6;

/** Earth radius for Haversine distance (km). */
export const EARTH_RADIUS_KM = 6371;
