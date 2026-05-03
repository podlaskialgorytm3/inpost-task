import { NextResponse } from "next/server";
import { fetchPoints } from "@/lib/inpost";
import type { PointsQuery } from "@/lib/types";

export const runtime = "nodejs";

const toNumber = (
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
};

const toOptionalString = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalNumber = (value: string | null, min: number, max: number) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(parsed, min), max);
};

const toSortBy = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  if (value === "distance" || value === "availability" || value === "name") {
    return value;
  }

  return undefined;
};

const toSortDir = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  if (value === "asc" || value === "desc") {
    return value;
  }

  return undefined;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
};

const geocodeCityCenter = async (
  city: string,
  country?: string,
  province?: string,
) => {
  const q = [city, province, country].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "inpost-smart-finder/0.1 (geocoding radius helper)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as NominatimResult[];
  const first = payload[0];
  if (!first?.lat || !first?.lon) {
    return null;
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query: PointsQuery = {
    query: toOptionalString(searchParams.get("query")),
    city: toOptionalString(searchParams.get("city")),
    province: toOptionalString(searchParams.get("province")),
    country: toOptionalString(searchParams.get("country")) ?? "PL",
    postalCode: toOptionalString(searchParams.get("postalCode")),
    function: toOptionalString(searchParams.get("function")),
    status: toOptionalString(searchParams.get("status")),
    availability: toOptionalString(searchParams.get("availability")),
    open24: searchParams.get("open24") === "true",
    openAt: toOptionalString(searchParams.get("openAt")),
    latitude: toOptionalNumber(searchParams.get("lat"), -90, 90),
    longitude: toOptionalNumber(searchParams.get("lon"), -180, 180),
    radiusKm: toOptionalNumber(searchParams.get("radiusKm"), 0.1, 500),
    sortBy: toSortBy(searchParams.get("sortBy")),
    sortDir: toSortDir(searchParams.get("sortDir")),
    limit: toNumber(searchParams.get("limit"), 200, 1, 1000),
    perPage: toNumber(searchParams.get("perPage"), 100, 1, 100),
    maxPages: toOptionalNumber(searchParams.get("maxPages"), 1, 5000),
  };

  if (
    query.radiusKm !== undefined &&
    query.latitude === undefined &&
    query.longitude === undefined &&
    query.city
  ) {
    const center = await geocodeCityCenter(
      query.city,
      query.country,
      query.province,
    );

    if (center) {
      query.latitude = center.latitude;
      query.longitude = center.longitude;

      // When city is used as radius center, keep nearby points, not only exact city match.
      query.city = undefined;
    }
  }

  try {
    const data = await fetchPoints(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/points] InPost fetch failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "We could not load parcel points right now. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
