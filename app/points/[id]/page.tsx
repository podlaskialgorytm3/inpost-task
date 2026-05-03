"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Point } from "@/lib/types";
import { useAppSettings } from "@/app/providers";
import styles from "./page.module.css";

const decodePointPayload = (raw: string | null): Point | null => {
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const binary = atob(decoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Point;
  } catch {
    return null;
  }
};

const formatBool = (
  value: boolean | null,
  yes: string,
  no: string,
  unknown: string,
) => {
  if (value === null) {
    return unknown;
  }

  return value ? yes : no;
};

export default function PointDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { messages: m } = useAppSettings();

  const point = useMemo(
    () => decodePointPayload(searchParams.get("data")),
    [searchParams],
  );
  const googleMapsEmbedUrl = useMemo(() => {
    if (!point) {
      return null;
    }

    const lat = point.location.latitude;
    const lon = point.location.longitude;
    if (lat !== null && lon !== null) {
      return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,0,0,0,0&output=svembed`;
    }

    const address = [
      point.name,
      point.address.line1,
      point.address.line2,
      point.addressDetails.postCode,
      point.addressDetails.city,
      point.addressDetails.province,
      point.country,
    ]
      .filter(Boolean)
      .join(", ");

    if (!address) {
      return null;
    }

    return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed`;
  }, [point]);
  const [photos, setPhotos] = useState<
    { ref: string; width: number; height: number; attributions: string[] }[]
  >([]);
  const [photosEnabled, setPhotosEnabled] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);

  useEffect(() => {
    if (!point) {
      return;
    }

    const latitude = point.location.latitude;
    const longitude = point.location.longitude;
    const address = [
      point.address.line1,
      point.address.line2,
      point.addressDetails.postCode,
      point.addressDetails.city,
      point.addressDetails.province,
    ]
      .filter(Boolean)
      .join(", ");

    const params = new URLSearchParams({
      name: point.name,
      address,
      max: "6",
    });
    if (latitude !== null && longitude !== null) {
      params.set("lat", String(latitude));
      params.set("lon", String(longitude));
    }

    const controller = new AbortController();
    const run = async () => {
      setPhotosLoading(true);
      setPhotosError(null);

      try {
        const response = await fetch(`/api/google-place-photos?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          enabled?: boolean;
          photos?: {
            ref: string;
            width: number;
            height: number;
            attributions?: string[];
          }[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Nie udało się pobrać zdjęć.");
        }

        setPhotosEnabled(payload.enabled !== false);
        setPhotos(
          (payload.photos ?? []).map((item) => ({
            ref: item.ref,
            width: item.width,
            height: item.height,
            attributions: item.attributions ?? [],
          })),
        );
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        ) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Błąd pobierania zdjęć.";
        setPhotosError(message);
      } finally {
        setPhotosLoading(false);
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [point]);

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/">
        ← {m.btnReset}
      </Link>
      <section className={styles.card}>
        <header>
          <h1 className={styles.title}>{point?.name ?? params.id}</h1>
          <p className={styles.subtitle}>{point?.status ?? m.cardUnknown}</p>
        </header>

        {!point ? (
          <p>{m.errUnexpectedResponse}</p>
        ) : (
          <>
            <div className={styles.grid}>
              <div className={styles.cell}>
                <span className={styles.label}>ID</span>
                <span className={styles.value}>{point.id}</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.label}>{m.cardOpen}</span>
                <span className={styles.value}>
                  {point.openingHours ?? m.cardUnknown}
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.label}>{m.cardSlots}</span>
                <span className={styles.value}>
                  {point.availableCompartments ?? m.cardUnknown}
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.label}>{m.cardPayment}</span>
                <span className={styles.value}>
                  {formatBool(
                    point.paymentAvailable,
                    m.cardPaymentYes,
                    m.cardPaymentNo,
                    m.cardPaymentUnknown,
                  )}
                </span>
              </div>
            </div>

            <div className={styles.cell}>
              <span className={styles.label}>Adres</span>
              <p className={styles.line}>{point.address.line1 ?? "-"}</p>
              <p className={styles.line}>{point.address.line2 ?? "-"}</p>
              <p className={styles.line}>
                {point.addressDetails.postCode ?? "-"}{" "}
                {point.addressDetails.city ?? "-"}
              </p>
              <p className={styles.line}>{point.addressDetails.province ?? "-"}</p>
            </div>

            <div className={styles.grid}>
              <div className={styles.cell}>
                <span className={styles.label}>Latitude</span>
                <span className={styles.value}>
                  {point.location.latitude ?? m.cardCoordsUnavailable}
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.label}>Longitude</span>
                <span className={styles.value}>
                  {point.location.longitude ?? m.cardCoordsUnavailable}
                </span>
              </div>
            </div>

            <div className={styles.cell}>
              <span className={styles.label}>Funkcje</span>
              <div className={styles.list}>
                {point.functions.length === 0 ? (
                  <span className={styles.value}>-</span>
                ) : (
                  point.functions.map((item) => (
                    <span key={item} className={styles.tag}>
                      {item}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className={styles.cell}>
              <span className={styles.label}>Zdjęcia z Google Maps</span>
              {photosLoading ? (
                <p className={styles.line}>Ładowanie zdjęć…</p>
              ) : null}
              {!photosLoading && photosError ? (
                <p className={styles.photoError}>{photosError}</p>
              ) : null}
              {!photosLoading && !photosError && !photosEnabled ? (
                <p className={styles.line}>
                  Dodaj `GOOGLE_MAPS_API_KEY`, aby wyświetlać zdjęcia miejsca.
                </p>
              ) : null}
              {!photosLoading &&
              !photosError &&
              photosEnabled &&
              photos.length === 0 ? (
                <p className={styles.line}>Brak zdjęć dla tego miejsca.</p>
              ) : null}
              {photos.length > 0 ? (
                <div className={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <Image
                      key={`${photo.ref}-${index}`}
                      className={styles.photo}
                      src={`/api/google-place-photo?ref=${encodeURIComponent(photo.ref)}&maxwidth=1200`}
                      alt={`${point.name} - zdjęcie ${index + 1}`}
                      width={photo.width || 1200}
                      height={photo.height || 800}
                      loading="lazy"
                      unoptimized
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {googleMapsEmbedUrl ? (
              <div className={styles.cell}>
                <span className={styles.label}>Google Maps</span>
                <div className={styles.mapFrameWrap}>
                  <iframe
                    title={`Google Maps: ${point.name}`}
                    src={googleMapsEmbedUrl}
                    className={styles.mapFrame}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
