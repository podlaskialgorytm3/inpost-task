"use client";

import Link from "next/link";
import { useMemo } from "react";
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
          </>
        )}
      </section>
    </main>
  );
}
