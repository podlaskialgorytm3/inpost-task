import type { Point, PointsQuery, PointsResponse } from "./types";

const BASE_URL = "https://api-global-points.easypack24.net/v1/points";
const DEFAULT_TIMEOUT_MS = 10000;
const REVALIDATE_SECONDS = 300;

type ApiResponse = {
  items?: unknown;
  total_pages?: unknown;
  meta?: {
    total_pages?: unknown;
  };
};

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

const matchesFilters = (point: Point, query: PointsQuery): boolean => {
  if (
    query.country &&
    point.country.toLowerCase() !== query.country.toLowerCase()
  ) {
    return false;
  }

  if (
    query.city &&
    point.addressDetails.city?.toLowerCase() !== query.city.toLowerCase()
  ) {
    return false;
  }

  if (
    query.province &&
    point.addressDetails.province?.toLowerCase() !==
      query.province.toLowerCase()
  ) {
    return false;
  }

  if (
    query.function &&
    !point.functions.some(
      (entry) => entry.toLowerCase() === query.function?.toLowerCase(),
    )
  ) {
    return false;
  }

  if (
    query.status &&
    point.status.toLowerCase() !== query.status.toLowerCase()
  ) {
    return false;
  }

  if (query.availability) {
    const availability = point.lockerAvailability?.status;
    if (
      !availability ||
      availability.toLowerCase() !== query.availability.toLowerCase()
    ) {
      return false;
    }
  }

  if (query.open24) {
    if ((point.openingHours ?? "").toLowerCase() !== "24/7") {
      return false;
    }
  }

  if (query.query) {
    const haystack = buildSearchBlob(point);
    if (!haystack.includes(query.query.toLowerCase())) {
      return false;
    }
  }

  return true;
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
  };
};

const fetchPage = async (page: number, perPage: number, country?: string) => {
  const url = new URL(BASE_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  if (country) {
    url.searchParams.set("country", country);
  }

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
      throw new Error(
        `InPost API error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as ApiResponse;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchPoints = async (
  query: PointsQuery,
): Promise<PointsResponse> => {
  const perPage = Math.min(Math.max(query.perPage, 1), 100);
  const maxPages = Math.min(Math.max(query.maxPages, 1), 10);
  const mapped: Point[] = [];
  const errors: string[] = [];
  let pagesFetched = 0;
  let totalFetched = 0;
  let totalPages: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const data = await fetchPage(page, perPage, query.country);
      const items = Array.isArray(data.items) ? data.items : [];

      pagesFetched += 1;
      totalFetched += items.length;

      const nextItems = items.map((item) => {
        if (item && typeof item === "object") {
          return mapPoint(item as Record<string, unknown>);
        }

        return mapPoint({});
      });

      mapped.push(...nextItems);

      if (totalPages === null) {
        totalPages =
          toNumber(data.total_pages) ?? toNumber(data.meta?.total_pages);
      }

      if (totalPages && page >= totalPages) {
        break;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while fetching points.";
      errors.push(message);
      break;
    }
  }

  const filtered = mapped.filter((point) => matchesFilters(point, query));

  return {
    query,
    meta: {
      pagesFetched,
      totalFetched,
      totalFiltered: filtered.length,
      totalPages,
      fetchedAt: new Date().toISOString(),
    },
    items: filtered,
    errors: errors.length > 0 ? errors : undefined,
  };
};
