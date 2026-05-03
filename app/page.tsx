"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";
import type { Point, PointsResponse } from "@/lib/types";

type Filters = {
  query: string;
  city: string;
  province: string;
  country: string;
  function: string;
  status: string;
  availability: string;
  open24: boolean;
  perPage: number;
  maxPages: number;
};

const DEFAULT_FILTERS: Filters = {
  query: "",
  city: "",
  province: "",
  country: "PL",
  function: "",
  status: "",
  availability: "",
  open24: false,
  perPage: 50,
  maxPages: 3,
};

const FUNCTION_OPTIONS = [
  { value: "", label: "Any function" },
  { value: "parcel_send", label: "Parcel send" },
  { value: "parcel_collect", label: "Parcel collect" },
  { value: "parcel", label: "Parcel" },
  { value: "allegro_parcel_send", label: "Allegro parcel send" },
  { value: "allegro_parcel_collect", label: "Allegro parcel collect" },
  { value: "standard_courier_send", label: "Standard courier send" },
  { value: "standard_courier_reverse_return_send", label: "Courier returns" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "Operating", label: "Operating" },
  { value: "Temporarily unavailable", label: "Temporarily unavailable" },
  { value: "Out of order", label: "Out of order" },
];

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Any availability" },
  { value: "AVAILABLE", label: "Available" },
  { value: "NOT_AVAILABLE", label: "Not available" },
  { value: "NO_DATA", label: "No data" },
];

const buildQuery = (filters: Filters) => {
  const params = new URLSearchParams();

  if (filters.query) params.set("query", filters.query);
  if (filters.city) params.set("city", filters.city);
  if (filters.province) params.set("province", filters.province);
  if (filters.country) params.set("country", filters.country);
  if (filters.function) params.set("function", filters.function);
  if (filters.status) params.set("status", filters.status);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.open24) params.set("open24", "true");

  params.set("perPage", String(filters.perPage));
  params.set("maxPages", String(filters.maxPages));

  return params.toString();
};

const getAvailabilityClass = (status: string | null) => {
  const normalized = status?.toUpperCase();
  if (normalized === "AVAILABLE") {
    return styles.availabilityGood;
  }
  if (normalized === "NOT_AVAILABLE") {
    return styles.availabilityBad;
  }
  return styles.availabilityNeutral;
};

const formatFunctionLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const buildMapUrl = (point: Point) => {
  const { latitude, longitude } = point.location;
  if (latitude === null || longitude === null) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${latitude},${longitude}`,
  )}`;
};

export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<PointsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (nextFilters: Filters) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/points?${buildQuery(nextFilters)}`);
      if (!response.ok) {
        throw new Error("Unable to load points. Please try again.");
      }

      const payload = (await response.json()) as PointsResponse;
      setData(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Unexpected error while loading points.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void handleSearch(DEFAULT_FILTERS);
  }, [handleSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSearch(filters);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    void handleSearch(DEFAULT_FILTERS);
  };

  const results = data?.items ?? [];
  const hasData = data !== null;
  const pagesFetched = data?.meta.pagesFetched ?? 0;
  const totalFetched = data?.meta.totalFetched ?? 0;
  const totalFiltered = data?.meta.totalFiltered ?? 0;
  const totalPages = data?.meta.totalPages ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>Smart Finder</span>
          <span className={styles.badgeAlt}>Live InPost API</span>
        </div>
        <h1 className={styles.heroTitle}>InPost Locker Finder</h1>
        <p className={styles.heroCopy}>
          Filter parcel lockers by city, functions, availability, and 24/7
          access. The app fetches live data from the official InPost points API
          and keeps the results responsive by sampling multiple pages.
        </p>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Sample size</span>
            <span className={styles.statValue}>
              {hasData ? totalFetched : "--"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Filtered</span>
            <span className={styles.statValue}>
              {hasData ? totalFiltered : "--"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Pages fetched</span>
            <span className={styles.statValue}>
              {hasData
                ? totalPages
                  ? `${pagesFetched} / ${totalPages}`
                  : pagesFetched
                : "--"}
            </span>
          </div>
        </div>
      </header>

      <section className={styles.panel}>
        <div>
          <h2 className={styles.sectionTitle}>Search Filters</h2>
          <p className={styles.sectionCopy}>
            Combine multiple filters to narrow results. For performance, the API
            request samples up to the max pages configured below.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="query">
              Keyword
            </label>
            <input
              id="query"
              className={styles.input}
              placeholder="Locker name, street, or district"
              value={filters.query}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, query: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="city">
              City
            </label>
            <input
              id="city"
              className={styles.input}
              placeholder="Warsaw"
              value={filters.city}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, city: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="province">
              Province
            </label>
            <input
              id="province"
              className={styles.input}
              placeholder="mazowieckie"
              value={filters.province}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  province: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="country">
              Country
            </label>
            <input
              id="country"
              className={styles.input}
              placeholder="PL"
              value={filters.country}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, country: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="function">
              Function
            </label>
            <select
              id="function"
              className={styles.select}
              value={filters.function}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  function: event.target.value,
                }))
              }
            >
              {FUNCTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className={styles.select}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="availability">
              Availability
            </label>
            <select
              id="availability"
              className={styles.select}
              value={filters.availability}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  availability: event.target.value,
                }))
              }
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="perPage">
              Points per page
            </label>
            <input
              id="perPage"
              className={styles.input}
              type="number"
              min={1}
              max={100}
              value={filters.perPage}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  perPage: Number(event.target.value) || prev.perPage,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="maxPages">
              Max pages
            </label>
            <input
              id="maxPages"
              className={styles.input}
              type="number"
              min={1}
              max={10}
              value={filters.maxPages}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  maxPages: Number(event.target.value) || prev.maxPages,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.toggle} htmlFor="open24">
              <input
                id="open24"
                className={styles.checkbox}
                type="checkbox"
                checked={filters.open24}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    open24: event.target.checked,
                  }))
                }
              />
              <span>Open 24/7</span>
            </label>
            <span className={styles.hint}>
              Matches points with 24/7 opening hours.
            </span>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Searching..." : "Search lockers"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleReset}
              disabled={loading}
            >
              Reset filters
            </button>
          </div>
        </form>
      </section>

      <section className={styles.results}>
        <div className={styles.resultsHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Results</h2>
            <p className={styles.sectionCopy}>
              {loading
                ? "Loading live data from InPost..."
                : `Showing ${totalFiltered} of ${totalFetched} points sampled.`}
            </p>
          </div>
          <div className={styles.metaStack}>
            <span>Fetched at {data?.meta.fetchedAt ?? "--"}</span>
            <span>Country: {filters.country || "--"}</span>
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {data?.errors?.length ? (
          <div className={styles.errorSub}>
            {data.errors.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}

        {!loading && results.length === 0 && !error && (
          <div className={styles.emptyState}>
            No points match the current filters. Try reducing the filters or
            increasing the max pages.
          </div>
        )}

        <div className={styles.cards}>
          {results.map((point, index) => {
            const availabilityClass = getAvailabilityClass(
              point.lockerAvailability?.status ?? null,
            );
            const mapUrl = buildMapUrl(point);
            const functionList = point.functions.slice(0, 5);
            const remaining = point.functions.length - functionList.length;
            const addressLine = [
              point.address.line1,
              point.address.line2,
              [point.addressDetails.postCode, point.addressDetails.city]
                .filter(Boolean)
                .join(" "),
              point.addressDetails.province,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <article
                key={point.id}
                className={styles.card}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>{point.name}</h3>
                    <p className={styles.cardSubtitle}>{point.status}</p>
                  </div>
                  <span className={`${styles.statusPill} ${availabilityClass}`}>
                    {point.lockerAvailability?.status ?? "UNKNOWN"}
                  </span>
                </div>

                <p className={styles.address}>
                  {addressLine || "Address unavailable"}
                </p>
                {point.locationDescription && (
                  <p className={styles.description}>
                    {point.locationDescription}
                  </p>
                )}

                <div className={styles.cardMeta}>
                  <span>Open: {point.openingHours ?? "Unknown"}</span>
                  <span>Type: {point.type.join(", ") || "-"}</span>
                  <span>
                    Payment:{" "}
                    {point.paymentAvailable === null
                      ? "Unknown"
                      : point.paymentAvailable
                        ? "Yes"
                        : "No"}
                  </span>
                </div>

                <div className={styles.tagList}>
                  {functionList.map((item) => (
                    <span key={item} className={styles.tag}>
                      {formatFunctionLabel(item)}
                    </span>
                  ))}
                  {remaining > 0 && (
                    <span className={styles.tagMuted}>+{remaining} more</span>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.coords}>
                    {point.location.latitude !== null &&
                    point.location.longitude !== null
                      ? `${point.location.latitude.toFixed(4)}, ${point.location.longitude.toFixed(4)}`
                      : "Coords unavailable"}
                  </span>
                  {mapUrl && (
                    <a
                      className={styles.mapLink}
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
