import type { Point, PointsQuery, PointsResponse } from "./types";

const BASE_URL = "https://api-global-points.easypack24.net/v1/points";
const DEFAULT_TIMEOUT_MS = 10000;
const REVALIDATE_SECONDS = 300;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_CONCURRENCY = 6;

type ApiResponse = {
  items?: unknown;
  total_pages?: unknown;
  meta?: {
    total_pages?: unknown;
  };
};

type CacheEntry = {
  items: Point[];
  pagesFetched: number;
  totalFetched: number;
  totalPages: number | null;
  fetchedAt: number;
};

const pointsCache = new Map<string, CacheEntry>();

const AVAILABLE_DETAIL_VALUES = new Set(["AVAILABLE", "EMPTY", "FREE", "OK"]);
const UNKNOWN_DETAIL_VALUES = new Set(["NO_DATA", "UNKNOWN", "NONE"]);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const normalizePostalCode = (value: string | null | undefined) =>
  value ? value.replace(/\s+/g, "").toLowerCase() : "";

const degreesToRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
) => {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(latB - latA);
  const dLon = degreesToRadians(lonB - lonA);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(latA)) *
      Math.cos(degreesToRadians(latB)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const parseTimeToMinutes = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const extractTimeRanges = (value: string) => {
  const ranges: Array<[number, number]> = [];
  const regex = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
  let match: RegExpExecArray | null = regex.exec(value);

  while (match) {
    const start = parseTimeToMinutes(match[1]);
    const end = parseTimeToMinutes(match[2]);
    if (start !== null && end !== null) {
      ranges.push([start, end]);
    }
    match = regex.exec(value);
  }

  return ranges;
};

const isOpenAtTime = (openingHours: string | null, time: string) => {
  if (!openingHours) {
    return false;
  }

  const normalized = openingHours.trim().toLowerCase();
  if (normalized === "24/7") {
    return true;
  }

  const target = parseTimeToMinutes(time);
  if (target === null) {
    return false;
  }

  const ranges = extractTimeRanges(openingHours);
  if (ranges.length === 0) {
    return false;
  }

  return ranges.some(([start, end]) => {
    if (end < start) {
      return target >= start || target <= end;
    }
    return target >= start && target <= end;
  });
};

const countAvailableCompartments = (details: Record<string, string> | null) => {
  if (!details) {
    return null;
  }

  const values = Object.values(details);
  if (values.length === 0) {
    return null;
  }

  const normalized = values.map((value) => value.toUpperCase());
  const hasKnown = normalized.some(
    (value) => !UNKNOWN_DETAIL_VALUES.has(value),
  );
  if (!hasKnown) {
    return null;
  }

  return normalized.filter((value) => AVAILABLE_DETAIL_VALUES.has(value))
    .length;
};

const buildSearchBlob = (point: Point): string => {
  const parts = [
    point.name,
    point.address.line1,
    point.address.line2,
    point.addressDetails.city,
    point.addressDetails.province,
    point.addressDetails.postCode,
    point.addressDetails.street,
  ].filter(Boolean);

  return parts.join(" ").toLowerCase();
};

const buildCacheKey = (country?: string) => (country ?? "all").toLowerCase();

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRetryAfterSeconds = (value: string | null) => {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const seconds = (date.getTime() - Date.now()) / 1000;
  return seconds > 0 ? seconds : 0;
};

const shouldRetryStatus = (status: number) =>
  status === 429 || (status >= 500 && status < 600);

const getRetryDelayMs = (attempt: number, retryAfterHeader: string | null) => {
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader);
  if (retryAfterSeconds !== null) {
    return Math.max(retryAfterSeconds * 1000, RETRY_BASE_DELAY_MS);
  }

  const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(backoff, 8000);
};

const mapPoint = (raw: Record<string, unknown>): Point => {
  const address = raw.address as Record<string, unknown> | undefined;
  const addressDetails = raw.address_details as
    | Record<string, unknown>
    | undefined;
  const location = raw.location as Record<string, unknown> | undefined;
  const availabilityRaw = raw.locker_availability as
    | Record<string, unknown>
    | undefined;
  const availabilityStatus =
    toStringValue(availabilityRaw?.status) ?? "UNKNOWN";
  const availabilityDetails =
    availabilityRaw?.details &&
    typeof availabilityRaw.details === "object" &&
    !Array.isArray(availabilityRaw.details)
      ? (availabilityRaw.details as Record<string, string>)
      : null;

  return {
    id: toStringValue(raw.name) ?? "unknown",
    name: toStringValue(raw.name) ?? "Unknown",
    country: toStringValue(raw.country) ?? "Unknown",
    type: toStringArray(raw.type),
    status: toStringValue(raw.status) ?? "Unknown",
    location: {
      latitude: toNumber(location?.latitude),
      longitude: toNumber(location?.longitude),
    },
    address: {
      line1: toStringValue(address?.line1),
      line2: toStringValue(address?.line2),
    },
    addressDetails: {
      city: toStringValue(addressDetails?.city),
      province: toStringValue(addressDetails?.province),
      postCode: toStringValue(addressDetails?.post_code),
      street: toStringValue(addressDetails?.street),
      buildingNumber: toStringValue(addressDetails?.building_number),
    },
    openingHours: toStringValue(raw.opening_hours),
    functions: toStringArray(raw.functions),
    locationType: toStringValue(raw.location_type),
    locationDescription: toStringValue(raw.location_description),
    paymentAvailable:
      typeof raw.payment_available === "boolean" ? raw.payment_available : null,
    lockerAvailability: availabilityRaw
      ? {
          status: availabilityStatus,
          details: availabilityDetails,
        }
      : null,
    availableCompartments: countAvailableCompartments(availabilityDetails),
  };
};

const mapItems = (items: unknown[]) =>
  items.map((item) => {
    if (item && typeof item === "object") {
      return mapPoint(item as Record<string, unknown>);
    }

    return mapPoint({});
  });

const fetchPage = async (page: number, perPage: number, country?: string) => {
  const url = new URL(BASE_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  if (country) {
    url.searchParams.set("country", country);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
        next: {
          revalidate: REVALIDATE_SECONDS,
        },
      });

      if (!response.ok) {
        if (shouldRetryStatus(response.status) && attempt < MAX_RETRIES) {
          const delay = getRetryDelayMs(
            attempt,
            response.headers.get("retry-after"),
          );
          await sleep(delay);
          continue;
        }

        throw new Error(
          `InPost API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as ApiResponse;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelayMs(attempt, null);
        await sleep(delay);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Unknown error while fetching points.");
};

const fetchAllPoints = async (
  perPage: number,
  country?: string,
  maxPages?: number,
) => {
  const errors: string[] = [];
  const firstPage = await fetchPage(1, perPage, country);
  const firstItems = Array.isArray(firstPage.items) ? firstPage.items : [];
  const mapped: Point[] = mapItems(firstItems);
  let pagesFetched = 1;
  let totalFetched = firstItems.length;
  let totalPages =
    toNumber(firstPage.total_pages) ?? toNumber(firstPage.meta?.total_pages);

  if (!totalPages) {
    totalPages = 1;
  }

  const targetPages = maxPages ? Math.min(maxPages, totalPages) : totalPages;
  const remainingPages = [] as number[];

  for (let page = 2; page <= targetPages; page += 1) {
    remainingPages.push(page);
  }

  for (let index = 0; index < remainingPages.length; index += MAX_CONCURRENCY) {
    const batch = remainingPages.slice(index, index + MAX_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (page) => {
        try {
          const data = await fetchPage(page, perPage, country);
          return { page, data };
        } catch (error) {
          return { page, error };
        }
      }),
    );

    for (const result of results) {
      if ("error" in result) {
        const message =
          result.error instanceof Error
            ? result.error.message
            : "Unknown error while fetching points.";
        errors.push(`Page ${result.page} failed: ${message}`);
        continue;
      }

      const items = Array.isArray(result.data.items) ? result.data.items : [];
      pagesFetched += 1;
      totalFetched += items.length;
      mapped.push(...mapItems(items));
    }
  }

  return {
    items: mapped,
    pagesFetched,
    totalFetched,
    totalPages,
    errors,
  };
};

const getAvailabilityScore = (point: Point) => {
  if (point.availableCompartments !== null) {
    return point.availableCompartments;
  }

  const status = point.lockerAvailability?.status?.toUpperCase() ?? "UNKNOWN";
  if (status === "AVAILABLE") {
    return 1;
  }

  if (status === "NOT_AVAILABLE") {
    return 0;
  }

  return -1;
};

const sortPoints = (points: Point[], query: PointsQuery) => {
  const hasCoordinates =
    query.latitude !== undefined && query.longitude !== undefined;
  const sortBy = query.sortBy ?? (hasCoordinates ? "distance" : "availability");
  const sortDir = query.sortDir ?? (sortBy === "distance" ? "asc" : "desc");
  const direction = sortDir === "asc" ? 1 : -1;

  const sorted = [...points].sort((a, b) => {
    if (sortBy === "distance") {
      const aValue =
        a.distanceKm ??
        (sortDir === "asc"
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY);
      const bValue =
        b.distanceKm ??
        (sortDir === "asc"
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY);

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === "name") {
      return a.name.localeCompare(b.name) * direction;
    }

    const aScore = getAvailabilityScore(a);
    const bScore = getAvailabilityScore(b);

    if (aScore < bScore) return -1 * direction;
    if (aScore > bScore) return 1 * direction;
    return a.name.localeCompare(b.name);
  });

  return sorted;
};

const applyFilters = (points: Point[], query: PointsQuery) => {
  const results: Point[] = [];
  const normalizedQuery = query.query?.toLowerCase();
  const normalizedPostalCode = normalizePostalCode(query.postalCode);

  for (const point of points) {
    if (
      query.country &&
      point.country.toLowerCase() !== query.country.toLowerCase()
    ) {
      continue;
    }

    if (
      query.city &&
      point.addressDetails.city?.toLowerCase() !== query.city.toLowerCase()
    ) {
      continue;
    }

    if (
      query.province &&
      point.addressDetails.province?.toLowerCase() !==
        query.province.toLowerCase()
    ) {
      continue;
    }

    if (normalizedPostalCode) {
      const pointPostal = normalizePostalCode(point.addressDetails.postCode);
      if (!pointPostal || pointPostal !== normalizedPostalCode) {
        continue;
      }
    }

    if (
      query.function &&
      !point.functions.some(
        (entry) => entry.toLowerCase() === query.function?.toLowerCase(),
      )
    ) {
      continue;
    }

    if (
      query.status &&
      point.status.toLowerCase() !== query.status.toLowerCase()
    ) {
      continue;
    }

    if (query.availability) {
      const availability = point.lockerAvailability?.status;
      if (
        !availability ||
        availability.toLowerCase() !== query.availability.toLowerCase()
      ) {
        continue;
      }
    }

    if (query.open24) {
      if ((point.openingHours ?? "").toLowerCase() !== "24/7") {
        continue;
      }
    }

    if (query.openAt && !isOpenAtTime(point.openingHours, query.openAt)) {
      continue;
    }

    if (normalizedQuery) {
      const haystack = buildSearchBlob(point);
      if (!haystack.includes(normalizedQuery)) {
        continue;
      }
    }

    let distanceKm: number | null = null;
    if (
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      point.location.latitude !== null &&
      point.location.longitude !== null
    ) {
      distanceKm = calculateDistanceKm(
        query.latitude,
        query.longitude,
        point.location.latitude,
        point.location.longitude,
      );
    }

    if (query.radiusKm !== undefined) {
      if (distanceKm === null || distanceKm > query.radiusKm) {
        continue;
      }
    }

    results.push({ ...point, distanceKm });
  }

  return results;
};

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

  const cached = pointsCache.get(cacheKey);
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
      pointsCache.set(cacheKey, {
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
