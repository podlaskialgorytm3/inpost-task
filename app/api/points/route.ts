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

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query: PointsQuery = {
    query: toOptionalString(searchParams.get("query")),
    city: toOptionalString(searchParams.get("city")),
    province: toOptionalString(searchParams.get("province")),
    country: toOptionalString(searchParams.get("country")) ?? "PL",
    function: toOptionalString(searchParams.get("function")),
    status: toOptionalString(searchParams.get("status")),
    availability: toOptionalString(searchParams.get("availability")),
    open24: searchParams.get("open24") === "true",
    perPage: toNumber(searchParams.get("perPage"), 50, 1, 100),
    maxPages: toNumber(searchParams.get("maxPages"), 3, 1, 10),
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
