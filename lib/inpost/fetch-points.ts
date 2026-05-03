import type { Point, PointsQuery, PointsResponse } from "@/lib/types";
import {
  buildCacheKey,
  getCachedPoints,
  setCachedPoints,
  type CacheEntry,
} from "./cache";
import { CACHE_TTL_MS } from "./constants";
import { fetchAllPoints } from "./api-client";
import { applyFilters, sortPoints } from "./query-engine";

/**
 * Load InPost points for the given query: optional full-country fetch with TTL cache,
 * then in-memory filter, sort, and limit. Partial page failures are surfaced in
 * `errors` when some pages could not be loaded.
 *
 * @param query - Search filters, pagination hints, and sort preferences
 * @returns Normalized points plus metadata (cache vs live, truncation, optional errors)
 */
export const fetchPoints = async (
  query: PointsQuery,
): Promise<PointsResponse> => {
  const perPage = Math.min(Math.max(query.perPage, 1), 100);
  const maxPages =
    query.maxPages !== undefined
      ? Math.min(Math.max(query.maxPages, 1), 5000)
      : undefined;
  const limit = query.limit ? Math.min(Math.max(query.limit, 1), 1000) : 200;
  const cacheKey = buildCacheKey(query.country);
  const now = Date.now();
  let source: "cache" | "live" = "live";
  let cacheAgeSeconds: number | undefined;

  const cached = getCachedPoints(cacheKey);
  let cacheEntry: CacheEntry | null = null;

  if (!maxPages && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    cacheEntry = cached;
    source = "cache";
    cacheAgeSeconds = Math.floor((now - cached.fetchedAt) / 1000);
  }

  const errors: string[] = [];
  let items: Point[] = [];
  let pagesFetched = 0;
  let totalFetched = 0;
  let totalPages: number | null = null;
  let fetchedAt = new Date().toISOString();

  if (cacheEntry) {
    items = cacheEntry.items;
    pagesFetched = cacheEntry.pagesFetched;
    totalFetched = cacheEntry.totalFetched;
    totalPages = cacheEntry.totalPages;
    fetchedAt = new Date(cacheEntry.fetchedAt).toISOString();
  } else {
    const result = await fetchAllPoints(perPage, query.country, maxPages);
    items = result.items;
    pagesFetched = result.pagesFetched;
    totalFetched = result.totalFetched;
    totalPages = result.totalPages;
    errors.push(...result.errors);

    if (!maxPages) {
      setCachedPoints(cacheKey, {
        items,
        pagesFetched,
        totalFetched,
        totalPages,
        fetchedAt: now,
      });
    }
  }

  const filtered = applyFilters(items, query);
  const sorted = sortPoints(filtered, query);
  const limited = limit ? sorted.slice(0, limit) : sorted;
  const truncated = limited.length < sorted.length;

  return {
    query,
    meta: {
      pagesFetched,
      totalFetched,
      totalFiltered: filtered.length,
      totalPages,
      fetchedAt,
      source,
      cacheAgeSeconds,
      fetchMode: maxPages ? "sample" : "all",
      truncated,
    },
    items: limited,
    errors: errors.length > 0 ? errors : undefined,
  };
};
