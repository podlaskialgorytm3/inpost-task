import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.trim();
  const maxWidth = Math.min(
    Math.max(Number(searchParams.get("maxwidth") ?? "1200"), 1),
    1600,
  );

  if (!ref) {
    return NextResponse.json(
      { error: "Missing photo reference." },
      { status: 400 },
    );
  }

  const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
  photoUrl.searchParams.set("photo_reference", ref);
  photoUrl.searchParams.set("maxwidth", String(maxWidth));
  photoUrl.searchParams.set("key", key);

  const googleResponse = await fetch(photoUrl.toString(), {
    redirect: "follow",
    cache: "no-store",
  });

  if (!googleResponse.ok) {
    return NextResponse.json(
      { error: "Failed to fetch photo from Google Places." },
      { status: 502 },
    );
  }

  const contentType = googleResponse.headers.get("content-type");
  if (!contentType?.startsWith("image/")) {
    return NextResponse.json(
      { error: "Google did not return an image." },
      { status: 502 },
    );
  }

  const body = await googleResponse.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
