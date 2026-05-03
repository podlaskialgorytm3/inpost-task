"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Point } from "@/lib/types";
import { LOCALES, type Locale, useAppSettings } from "@/app/providers";
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

const formatApiEnumLabel = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export default function PointDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { locale, setLocale, theme, toggleTheme, messages: m } = useAppSettings();

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

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <label htmlFor="locale-select-details" className={styles.srOnly}>
          {m.toolbarLanguage}
        </label>
        <select
          id="locale-select-details"
          className={styles.localeSelect}
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          {LOCALES.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? m.toolbarThemeLight : m.toolbarThemeDark}
        </button>
      </div>
      <Link className={styles.back} href="/finder">
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
              <div className={styles.cell}>
                <span className={styles.label}>{m.cardType}</span>
                <span className={styles.value}>
                  {point.type.length > 0
                    ? point.type
                        .map(
                          (type) =>
                            m.options.types[type] ?? formatApiEnumLabel(type),
                        )
                        .join(", ")
                    : "-"}
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
                      {m.options.functions[item] ?? item}
                    </span>
                  ))
                )}
              </div>
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
