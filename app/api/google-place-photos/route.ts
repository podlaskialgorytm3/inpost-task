import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PlacePhoto = {
  photo_reference: string;
  width: number;
  height: number;
  html_attributions?: string[];
};

type PlaceCandidate = {
  place_id?: string;
  photos?: PlacePhoto[];
};

type FindPlaceResponse = {
  status?: string;
  candidates?: PlaceCandidate[];
  error_message?: string;
};

type PlaceDetailsResponse = {
  status?: string;
  result?: {
    photos?: PlacePhoto[];
  };
  error_message?: string;
};

const toTrimmed = (value: string | null) => value?.trim() ?? "";

export async function GET(request: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({
      enabled: false,
      photos: [],
      error: "GOOGLE_MAPS_API_KEY is not configured.",
    });
  }

  const { searchParams } = new URL(request.url);
  const name = toTrimmed(searchParams.get("name"));
  const lat = toTrimmed(searchParams.get("lat"));
  const lon = toTrimmed(searchParams.get("lon"));
  const address = toTrimmed(searchParams.get("address"));
  const max = Math.min(Math.max(Number(searchParams.get("max") ?? "6"), 1), 10);

  if (!name && !address) {
    return NextResponse.json(
      { enabled: true, photos: [], error: "Missing name or address." },
      { status: 400 },
    );
  }

  const input = [name, address].filter(Boolean).join(", ");
  const findUrl = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
  );
  findUrl.searchParams.set("input", input);
  findUrl.searchParams.set("inputtype", "textquery");
  findUrl.searchParams.set("fields", "place_id,photos");
  if (lat && lon) {
    findUrl.searchParams.set("locationbias", `point:${lat},${lon}`);
  }
  findUrl.searchParams.set("key", key);

  const findResponse = await fetch(findUrl.toString(), { cache: "no-store" });
  if (!findResponse.ok) {
    return NextResponse.json(
      { enabled: true, photos: [], error: "Google Places lookup failed." },
      { status: 502 },
    );
  }

  const findData = (await findResponse.json()) as FindPlaceResponse;
  const candidate = findData.candidates?.[0];
  if (!candidate) {
    return NextResponse.json({ enabled: true, photos: [] });
  }

  let photos = candidate.photos ?? [];
  if (photos.length === 0 && candidate.place_id) {
    const detailsUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json",
    );
    detailsUrl.searchParams.set("place_id", candidate.place_id);
    detailsUrl.searchParams.set("fields", "photos");
    detailsUrl.searchParams.set("key", key);

    const detailsResponse = await fetch(detailsUrl.toString(), {
      cache: "no-store",
    });

    if (detailsResponse.ok) {
      const detailsData =
        (await detailsResponse.json()) as PlaceDetailsResponse;
      photos = detailsData.result?.photos ?? [];
    }
  }

  return NextResponse.json({
    enabled: true,
    photos: photos.slice(0, max).map((photo) => ({
      ref: photo.photo_reference,
      width: photo.width,
      height: photo.height,
      attributions: photo.html_attributions ?? [],
    })),
  });
}
