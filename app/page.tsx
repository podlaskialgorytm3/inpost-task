"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import type { Point, PointsResponse } from "@/lib/types";
import { interpolate, LOCALES, type Locale } from "@/lib/i18n";
import { useAppSettings } from "./providers";

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
  maxPages: string;
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
  maxPages: "",
};

const FUNCTION_OPTION_VALUES = [
  "",
  "parcel_send",
  "parcel_collect",
  "parcel",
  "allegro_parcel_send",
  "allegro_parcel_collect",
  "standard_courier_send",
  "standard_courier_reverse_return_send",
] as const;

const STATUS_OPTION_VALUES = [
  "",
  "Operating",
  "Temporarily unavailable",
  "Out of order",
] as const;

const AVAILABILITY_OPTION_VALUES = [
  "",
  "AVAILABLE",
  "NOT_AVAILABLE",
  "NO_DATA",
] as const;

const SORT_BY_VALUES = ["availability", "distance", "name"] as const;
const SORT_DIR_VALUES = ["desc", "asc"] as const;

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

  const maxPagesParam = toNumericParam(filters.maxPages);
  if (maxPagesParam) {
    params.set("maxPages", maxPagesParam);
  }

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

const encodePointPayload = (point: Point) => {
  const bytes = new TextEncoder().encode(JSON.stringify(point));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return encodeURIComponent(btoa(binary));
};

export default function Home() {
  const { locale, setLocale, theme, toggleTheme, messages: m } = useAppSettings();

  const functionOptions = useMemo(
    () =>
      FUNCTION_OPTION_VALUES.map((value) => ({
        value,
        label: m.options.functions[value] ?? value,
      })),
    [m],
  );

  const statusOptions = useMemo(
    () =>
      STATUS_OPTION_VALUES.map((value) => ({
        value,
        label: m.options.status[value] ?? value,
      })),
    [m],
  );

  const availabilityOptions = useMemo(
    () =>
      AVAILABILITY_OPTION_VALUES.map((value) => ({
        value,
        label: m.options.availability[value] ?? value,
      })),
    [m],
  );

  const sortByOptions = useMemo(
    () =>
      SORT_BY_VALUES.map((value) => ({
        value,
        label: m.options.sortBy[value],
      })),
    [m],
  );

  const sortDirOptions = useMemo(
    () =>
      SORT_DIR_VALUES.map((value) => ({
        value,
        label: m.options.sortDir[value],
      })),
    [m],
  );

  const formatDistanceKm = (distance: number | null | undefined) => {
    if (distance === null || distance === undefined) {
      return m.distanceUnavailable;
    }
    return interpolate(m.distanceKmAway, { n: distance.toFixed(2) });
  };

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<PointsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  const scrollToResults = useCallback(() => {
    resultsRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  const handleSearch = useCallback(
    async (nextFilters: Filters) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/points?${buildQuery(nextFilters)}`);
        let payloadUnknown: unknown;
        try {
          payloadUnknown = await response.json();
        } catch {
          throw new Error(m.errUnexpectedResponse);
        }

        if (!response.ok) {
          const fromApi =
            payloadUnknown &&
            typeof payloadUnknown === "object" &&
            "error" in payloadUnknown &&
            typeof (payloadUnknown as { error: unknown }).error === "string"
              ? (payloadUnknown as { error: string }).error
              : null;
          throw new Error(fromApi ?? m.errLoadPoints);
        }

        setData(payloadUnknown as PointsResponse);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : m.errUnexpected;
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [m],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void handleSearch(DEFAULT_FILTERS);
    }, 0);
    return () => window.clearTimeout(id);
  }, [handleSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    scrollToResults();
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
        p.location.latitude === null ? "" : String(p.location.latitude),
        p.location.longitude === null ? "" : String(p.location.longitude),
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

  useEffect(() => {
    let mounted = true;
    const ensureLeaflet = async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any -- Leaflet global from script tag */
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

      if ((container as any)._markers) {
        for (const marker of (container as any)._markers) {
          map.removeLayer(marker);
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
      /* eslint-enable @typescript-eslint/no-explicit-any */
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
  const sortByLabel = m.options.sortBy[filters.sortBy];
  const fetchModeLabel =
    fetchMode === "sample" ? m.fetchModeSample : m.fetchModeAll;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroBadges}>
            <span className={styles.badge}>{m.badgeSmartFinder}</span>
            <span className={styles.badgeAlt}>{m.badgeLiveApi}</span>
          </div>
          <div className={styles.toolbar}>
            <label htmlFor="locale-select" className={styles.srOnly}>
              {m.toolbarLanguage}
            </label>
            <select
              id="locale-select"
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
        </div>
        <h1 className={styles.heroTitle}>{m.heroTitle}</h1>
        <p className={styles.heroCopy}>{m.heroCopy}</p>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{m.statSampleSize}</span>
            <span className={styles.statValue}>
              {hasData ? totalFetched : "--"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{m.statFiltered}</span>
            <span className={styles.statValue}>
              {hasData ? totalFiltered : "--"}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{m.statPagesFetched}</span>
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
          <h2 className={styles.sectionTitle}>{m.searchFiltersTitle}</h2>
          <p className={styles.sectionCopy}>{m.searchFiltersCopy}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="query">
              {m.labelKeyword}
            </label>
            <input
              id="query"
              className={styles.input}
              placeholder={m.phKeyword}
              value={filters.query}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, query: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="city">
              {m.labelCity}
            </label>
            <input
              id="city"
              className={styles.input}
              placeholder={m.phCity}
              value={filters.city}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, city: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="province">
              {m.labelProvince}
            </label>
            <input
              id="province"
              className={styles.input}
              placeholder={m.phProvince}
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
              {m.labelPostalCode}
            </label>
            <input
              id="postalCode"
              className={styles.input}
              placeholder={m.phPostal}
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
              {m.labelCountry}
            </label>
            <input
              id="country"
              className={styles.input}
              placeholder={m.phCountry}
              value={filters.country}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, country: event.target.value }))
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="latitude">
              {m.labelLatitude}
            </label>
            <input
              id="latitude"
              className={styles.input}
              type="number"
              step="0.0001"
              placeholder={m.phLat}
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
              {m.labelLongitude}
            </label>
            <input
              id="longitude"
              className={styles.input}
              type="number"
              step="0.0001"
              placeholder={m.phLon}
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
              {m.labelRadiusKm}
            </label>
            <input
              id="radiusKm"
              className={styles.input}
              type="number"
              step="0.1"
              placeholder={m.phRadius}
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
              {m.labelFunction}
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
              {functionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="status">
              {m.labelStatus}
            </label>
            <select
              id="status"
              className={styles.select}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="availability">
              {m.labelAvailability}
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
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="openAt">
              {m.labelOpenAt}
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
              {m.labelApiPageSize}
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
              {m.labelMaxApiPages}
            </label>
            <input
              id="maxPages"
              className={styles.input}
              type="number"
              min={1}
              max={5000}
              placeholder={m.phMaxPagesAll}
              value={filters.maxPages}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  maxPages: event.target.value,
                }))
              }
            />
            <span className={styles.hint}>{m.hintMaxApiPages}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="limit">
              {m.labelMaxResults}
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
              {m.labelSortBy}
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
              {sortByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sortDir">
              {m.labelSortDir}
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
              {sortDirOptions.map((option) => (
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
              <span>{m.labelOpen24}</span>
            </label>
            <span className={styles.hint}>{m.hintOpen24}</span>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={loading}
            >
              {loading ? m.btnSearching : m.btnSearch}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleReset}
              disabled={loading}
            >
              {m.btnReset}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.results} ref={resultsRef}>
        <div className={styles.resultsHeader}>
          <div>
            <h2 className={styles.sectionTitle}>{m.resultsTitle}</h2>
            <p className={styles.sectionCopy}>
              {loading
                ? m.resultsLoading
                : interpolate(m.resultsShowing, {
                    n: results.length,
                    f: totalFiltered,
                    t: totalFetched,
                  })}
            </p>
          </div>
          <div className={styles.metaStack}>
            <span>
              {m.metaFetchedAt} {data?.meta.fetchedAt ?? "--"}
            </span>
            <span>
              {m.metaSource}: {source}
            </span>
            {cacheAgeSeconds !== null && source === "cache" ? (
              <span>
                {interpolate(m.metaCacheAge, { n: cacheAgeSeconds })}
              </span>
            ) : null}
            <span>
              {m.metaCountry}: {filters.country || "--"}
            </span>
            <span>
              {m.metaSort}: {sortByLabel} ({filters.sortDir})
            </span>
            <span>
              {m.metaFetchMode}: {fetchModeLabel}
            </span>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={exportGeoJSON}
              disabled={!data || results.length === 0}
            >
              {m.btnExportGeo}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={exportCSV}
              disabled={!data || results.length === 0}
            >
              {m.btnExportCsv}
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
            {interpolate(m.noticeTruncated, { n: results.length })}
          </div>
        ) : null}

        {!loading && results.length === 0 && !error && (
          <div className={styles.emptyState}>{m.emptyState}</div>
        )}

        <div className={styles.cards}>
          {results.map((point, index) => {
            const availabilityClass = getAvailabilityClass(
              point.lockerAvailability?.status ?? null,
            );
            const mapUrl = buildMapUrl(point);
            const detailsHref = `/points/${encodeURIComponent(point.id)}?data=${encodePointPayload(point)}`;
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
                  {addressLine || m.cardAddressUnavailable}
                </p>
                {point.locationDescription && (
                  <p className={styles.description}>
                    {point.locationDescription}
                  </p>
                )}

                <div className={styles.cardMeta}>
                  <span>
                    {m.cardOpen}: {point.openingHours ?? m.cardUnknown}
                  </span>
                  <span>
                    {m.cardSlots}:{" "}
                    {point.availableCompartments === null
                      ? m.cardUnknown
                      : point.availableCompartments}
                  </span>
                  <span>
                    {m.cardType}: {point.type.join(", ") || "-"}
                  </span>
                  <span>
                    {m.cardPayment}:{" "}
                    {point.paymentAvailable === null
                      ? m.cardPaymentUnknown
                      : point.paymentAvailable
                        ? m.cardPaymentYes
                        : m.cardPaymentNo}
                  </span>
                </div>

                <div className={styles.tagList}>
                  {functionList.map((item) => (
                    <span key={item} className={styles.tag}>
                      {formatFunctionLabel(item)}
                    </span>
                  ))}
                  {remaining > 0 && (
                    <span className={styles.tagMuted}>
                      {interpolate(m.cardMoreFunctions, { n: remaining })}
                    </span>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.coords}>
                    {point.location.latitude !== null &&
                    point.location.longitude !== null
                      ? `${point.location.latitude.toFixed(4)}, ${point.location.longitude.toFixed(4)}`
                      : m.cardCoordsUnavailable}
                  </span>
                  <span className={styles.distance}>
                    {formatDistanceKm(point.distanceKm)}
                  </span>
                  {mapUrl && (
                    <a
                      className={styles.mapLink}
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.cardOpenMaps}
                    </a>
                  )}
                  <Link
                    className={styles.mapLink}
                    href={detailsHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.cardOpenDetails}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
