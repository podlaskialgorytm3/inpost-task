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

  try {
    const data = await fetchPoints(query);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch InPost points.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
