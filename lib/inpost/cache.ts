import type { Point } from "@/lib/types";

export type CacheEntry = {
  items: Point[];
  pagesFetched: number;
  totalFetched: number;
  totalPages: number | null;
  fetchedAt: number;
};

const pointsCache = new Map<string, CacheEntry>();

export const getCachedPoints = (key: string) => pointsCache.get(key);

export const setCachedPoints = (key: string, entry: CacheEntry) => {
  pointsCache.set(key, entry);
};

/** One cache bucket per country code (or all countries when omitted). */
export const buildCacheKey = (country?: string) =>
  (country ?? "all").toLowerCase();
