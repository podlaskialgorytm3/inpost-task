"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";
import type { Point, PointsResponse } from "@/lib/types";

type Filters = {
  query: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  function: string;
  status: string;
  availability: string;
  open24: boolean;
  openAt: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  sortBy: "distance" | "availability" | "name";
  sortDir: "asc" | "desc";
  limit: number;
  perPage: number;
};

const DEFAULT_FILTERS: Filters = {
  query: "",
  city: "",
  province: "",
  postalCode: "",
  country: "PL",
  function: "",
  status: "",
  availability: "",
  open24: false,
  openAt: "",
  latitude: "",
  longitude: "",
  radiusKm: "",
  sortBy: "availability",
  sortDir: "desc",
  limit: 200,
  perPage: 100,
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

const SORT_BY_OPTIONS = [
  { value: "availability", label: "Availability" },
  { value: "distance", label: "Distance" },
  { value: "name", label: "Name" },
];

const SORT_DIR_OPTIONS = [
  { value: "desc", label: "Desc" },
  { value: "asc", label: "Asc" },
];

const buildQuery = (filters: Filters) => {
  const params = new URLSearchParams();
  const toNumericParam = (value: string) => {
    if (value.trim() === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : null;
  };

  if (filters.query) params.set("query", filters.query);
  if (filters.city) params.set("city", filters.city);
  if (filters.province) params.set("province", filters.province);
  if (filters.postalCode) params.set("postalCode", filters.postalCode);
  if (filters.country) params.set("country", filters.country);
  if (filters.function) params.set("function", filters.function);
  if (filters.status) params.set("status", filters.status);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.open24) params.set("open24", "true");
  if (filters.openAt) params.set("openAt", filters.openAt);

  const latitude = toNumericParam(filters.latitude);
  const longitude = toNumericParam(filters.longitude);
  const radiusKm = toNumericParam(filters.radiusKm);

  if (latitude) params.set("lat", latitude);
  if (longitude) params.set("lon", longitude);
  if (radiusKm) params.set("radiusKm", radiusKm);

  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);

  params.set("limit", String(filters.limit));
  params.set("perPage", String(filters.perPage));

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

const formatDistance = (distance: number | null | undefined) => {
  if (distance === null || distance === undefined) {
    return "Distance unavailable";
  }

  return `${distance.toFixed(2)} km away`;
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

  const exportGeoJSON = () => {
    if (!data) return;
    const geo = {
      type: "FeatureCollection",
      features: data.items
        .filter(
          (p) => p.location.latitude !== null && p.location.longitude !== null,
        )
        .map((p) => ({
          type: "Feature",
          properties: {
            id: p.id,
            name: p.name,
            address: p.addressDetails,
            openingHours: p.openingHours,
            availableCompartments: p.availableCompartments,
          },
          geometry: {
            type: "Point",
            coordinates: [p.location.longitude, p.location.latitude],
          },
        })),
    };

    const blob = new Blob([JSON.stringify(geo, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inpost-points.geojson";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [
        "id",
        "name",
        "country",
        "lat",
        "lon",
        "postCode",
        "city",
        "openingHours",
        "availableCompartments",
      ],
    ];

    for (const p of data.items) {
      rows.push([
        p.id,
        p.name,
        p.country,
        p.location.latitude ?? "",
        p.location.longitude ?? "",
        p.addressDetails.postCode ?? "",
        p.addressDetails.city ?? "",
        p.openingHours ?? "",
        p.availableCompartments === null ? "" : String(p.availableCompartments),
      ]);
    }

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inpost-points.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Map integration (Leaflet via CDN)
  const mapRef = useState<any>(null)[0];
  useEffect(() => {
    let mounted = true;
    const ensureLeaflet = async () => {
      if (!(window as any).L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.async = true;
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      if (!mounted) return;

      const L = (window as any).L;
      if (!L) return;

      // initialize map once
      const container = document.getElementById("inpost-map");
      if (!container) return;

      let map: any = (container as any)._leaflet_map;
      if (!map) {
        map = L.map(container).setView([52.2297, 21.0122], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        (container as any)._leaflet_map = map;
      }

      // clear existing markers
      if ((container as any)._markers) {
        for (const m of (container as any)._markers) {
          map.removeLayer(m);
        }
      }

      const markers: any[] = [];
      for (const p of data?.items ?? []) {
        if (p.location.latitude !== null && p.location.longitude !== null) {
          const marker = L.marker([p.location.latitude, p.location.longitude])
            .bindPopup(
              `<strong>${p.name}</strong><br/>${p.addressDetails.postCode ?? ""} ${p.addressDetails.city ?? ""}`,
            )
            .addTo(map);
          markers.push(marker);
        }
      }

      (container as any)._markers = markers;

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }
    };

    void ensureLeaflet();

    return () => {
      mounted = false;
    };
  }, [data]);

  const results = data?.items ?? [];
  const hasData = data !== null;
  const pagesFetched = data?.meta.pagesFetched ?? 0;
  const totalFetched = data?.meta.totalFetched ?? 0;
  const totalFiltered = data?.meta.totalFiltered ?? 0;
  const totalPages = data?.meta.totalPages ?? null;
  const source = data?.meta.source ?? "--";
  const cacheAgeSeconds = data?.meta.cacheAgeSeconds ?? null;
  const fetchMode = data?.meta.fetchMode ?? "all";
  const truncated = data?.meta.truncated ?? false;
  const sortByLabel =
    SORT_BY_OPTIONS.find((option) => option.value === filters.sortBy)?.label ??
    "Availability";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>Smart Finder</span>
          <span className={styles.badgeAlt}>Live InPost API</span>
        </div>
        <h1 className={styles.heroTitle}>InPost Locker Finder</h1>
        <p className={styles.heroCopy}>
          Filter parcel lockers by city, postal code, radius around coordinates,
          opening time, and availability. The app pulls the full InPost dataset
          (cached for speed) and ranks results by availability or distance.
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
            Combine multiple filters to narrow results. The API fetches the
            complete dataset and caches it briefly to keep repeat searches fast.
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
            <label className={styles.label} htmlFor="postalCode">
              Postal code
            </label>
            <input
              id="postalCode"
              className={styles.input}
              placeholder="00-000"
              value={filters.postalCode}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  postalCode: event.target.value,
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
            <label className={styles.label} htmlFor="latitude">
              Latitude
            </label>
            <input
              id="latitude"
              className={styles.input}
              type="number"
              step="0.0001"
              placeholder="52.2297"
              value={filters.latitude}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  latitude: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="longitude">
              Longitude
            </label>
            <input
              id="longitude"
              className={styles.input}
              type="number"
              step="0.0001"
              placeholder="21.0122"
              value={filters.longitude}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  longitude: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="radiusKm">
              Radius (km)
            </label>
            <input
              id="radiusKm"
              className={styles.input}
              type="number"
              step="0.1"
              placeholder="5"
              value={filters.radiusKm}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  radiusKm: event.target.value,
                }))
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
            <label className={styles.label} htmlFor="openAt">
              Open at (time)
            </label>
            <input
              id="openAt"
              className={styles.input}
              type="time"
              value={filters.openAt}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  openAt: event.target.value,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="perPage">
              API page size
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
            <label className={styles.label} htmlFor="limit">
              Max results
            </label>
            <input
              id="limit"
              className={styles.input}
              type="number"
              min={1}
              max={1000}
              value={filters.limit}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  limit: Number(event.target.value) || prev.limit,
                }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sortBy">
              Sort by
            </label>
            <select
              id="sortBy"
              className={styles.select}
              value={filters.sortBy}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  sortBy: event.target.value as Filters["sortBy"],
                }))
              }
            >
              {SORT_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sortDir">
              Sort direction
            </label>
            <select
              id="sortDir"
              className={styles.select}
              value={filters.sortDir}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  sortDir: event.target.value as Filters["sortDir"],
                }))
              }
            >
              {SORT_DIR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                : `Showing ${results.length} of ${totalFiltered} matches from ${totalFetched} points.`}
            </p>
          </div>
          <div className={styles.metaStack}>
            <span>Fetched at {data?.meta.fetchedAt ?? "--"}</span>
            <span>Source: {source}</span>
            {cacheAgeSeconds !== null && source === "cache" ? (
              <span>Cache age: {cacheAgeSeconds}s</span>
            ) : null}
            <span>Country: {filters.country || "--"}</span>
            <span>
              Sort: {sortByLabel} ({filters.sortDir})
            </span>
            <span>Fetch mode: {fetchMode}</span>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={exportGeoJSON}
              disabled={!data || results.length === 0}
            >
              Export GeoJSON
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={exportCSV}
              disabled={!data || results.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className={styles.mapContainer}>
          <div id="inpost-map" className={styles.mapInner} />
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

        {truncated && !loading ? (
          <div className={styles.notice}>
            Showing the first {results.length} results. Increase Max results to
            see more.
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
                  <span>
                    Available slots (by size):{" "}
                    {point.availableCompartments === null
                      ? "Unknown"
                      : point.availableCompartments}
                  </span>
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
                  <span className={styles.distance}>
                    {formatDistance(point.distanceKm)}
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
