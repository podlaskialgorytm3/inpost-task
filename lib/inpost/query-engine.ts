import type { Point, PointsQuery } from "@/lib/types";
import { EARTH_RADIUS_KM } from "./constants";

const degreesToRadians = (value: number) => (value * Math.PI) / 180;

/**
 * Calculate the Haversine distance between two coordinates in kilometres.
 *
 * Pure and unit-testable. Suitable for ranking and radius filters, not surveying.
 *
 * @param latA - latitude of first point (degrees)
 * @param lonA - longitude of first point (degrees)
 * @param latB - latitude of second point (degrees)
 * @param lonB - longitude of second point (degrees)
 * @returns distance in kilometres
 */
export const calculateDistanceKm = (
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
) => {
  const dLat = degreesToRadians(latB - latA);
  const dLon = degreesToRadians(lonB - lonA);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(latA)) *
      Math.cos(degreesToRadians(latB)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

/**
 * Parse a HH:MM time string into minutes since midnight.
 * Returns null for invalid input.
 */
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

/**
 * Whether `openingHours` indicates the point is open at `time` (HH:MM).
 * Supports simple ranges like "08:00-20:00" and the literal "24/7".
 */
export const isOpenAtTime = (openingHours: string | null, time: string) => {
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

const normalizePostalCode = (value: string | null | undefined) =>
  value ? value.replace(/\s+/g, "").toLowerCase() : "";

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

export const sortPoints = (points: Point[], query: PointsQuery) => {
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

export const applyFilters = (points: Point[], query: PointsQuery) => {
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
