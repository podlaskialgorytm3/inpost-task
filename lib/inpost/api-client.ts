import {
  DEFAULT_TIMEOUT_MS,
  INPOST_POINTS_BASE_URL,
  MAX_CONCURRENCY,
  MAX_RETRIES,
  RETRY_BACKOFF_MAX_MS,
  RETRY_BASE_DELAY_MS,
  REVALIDATE_SECONDS,
} from "./constants";
import type { Point } from "@/lib/types";
import { mapItems } from "./transform";
import { toNumber } from "./parsing";

type ApiResponse = {
  items?: unknown;
  total_pages?: unknown;
  meta?: {
    total_pages?: unknown;
  };
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRetryAfterSeconds = (value: string | null) => {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const seconds = (date.getTime() - Date.now()) / 1000;
  return seconds > 0 ? seconds : 0;
};

const shouldRetryStatus = (status: number) =>
  status === 429 || (status >= 500 && status < 600);

const getRetryDelayMs = (attempt: number, retryAfterHeader: string | null) => {
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader);
  if (retryAfterSeconds !== null) {
    return Math.max(retryAfterSeconds * 1000, RETRY_BASE_DELAY_MS);
  }

  const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(backoff, RETRY_BACKOFF_MAX_MS);
};

/** User-facing errors we rethrow without wrapping (NFR6 — meaningful messages). */
class InPostClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InPostClientError";
  }
}

const userFacingHttpError = (status: number, statusText: string) => {
  if (status === 429) {
    return new InPostClientError(
      "The InPost API rate limit was reached. Please wait a moment and try again.",
    );
  }
  if (status === 503 || status === 502) {
    return new InPostClientError(
      "The InPost service is temporarily unavailable. Please try again later.",
    );
  }
  if (status >= 500) {
    return new InPostClientError(
      "The InPost service returned a server error. Please try again later.",
    );
  }
  return new InPostClientError(
    `Could not load points from InPost (${status}${statusText ? ` ${statusText}` : ""}).`,
  );
};

const userFacingNetworkError = (error: unknown): InPostClientError => {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new InPostClientError(
        "The request to InPost timed out. Check your connection and try again.",
      );
    }
    if (
      error.message.includes("fetch failed") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      return new InPostClientError(
        "Could not reach the InPost points service. Check your internet connection and try again.",
      );
    }
  }
  return new InPostClientError(
    "Could not reach the InPost points service. Check your internet connection and try again.",
  );
};

const fetchPage = async (page: number, perPage: number, country?: string) => {
  const url = new URL(INPOST_POINTS_BASE_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  if (country) {
    url.searchParams.set("country", country);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
        next: {
          revalidate: REVALIDATE_SECONDS,
        },
      });

      if (!response.ok) {
        if (shouldRetryStatus(response.status) && attempt < MAX_RETRIES) {
          const delay = getRetryDelayMs(
            attempt,
            response.headers.get("retry-after"),
          );
          await sleep(delay);
          continue;
        }

        throw userFacingHttpError(response.status, response.statusText);
      }

      let body: ApiResponse;
      try {
        body = (await response.json()) as ApiResponse;
      } catch {
        throw new InPostClientError(
          "InPost returned data we could not read. The service may be updating — try again shortly.",
        );
      }

      return body;
    } catch (error) {
      lastError = error;

      if (error instanceof InPostClientError) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelayMs(attempt, null);
        await sleep(delay);
        continue;
      }

      throw userFacingNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof InPostClientError
    ? lastError
    : userFacingNetworkError(lastError);
};

export type FetchAllPointsResult = {
  items: Point[];
  pagesFetched: number;
  totalFetched: number;
  totalPages: number;
  errors: string[];
};

/**
 * Load points from the InPost API with pagination. Fails fast on the first page;
 * later page failures are collected in `errors` so callers can still use partial data.
 */
export const fetchAllPoints = async (
  perPage: number,
  country?: string,
  maxPages?: number,
): Promise<FetchAllPointsResult> => {
  const errors: string[] = [];
  const firstPage = await fetchPage(1, perPage, country);
  const firstItems = Array.isArray(firstPage.items) ? firstPage.items : [];
  const mapped = mapItems(firstItems);
  let pagesFetched = 1;
  let totalFetched = firstItems.length;
  let totalPages =
    toNumber(firstPage.total_pages) ?? toNumber(firstPage.meta?.total_pages);

  if (!totalPages) {
    totalPages = 1;
  }

  const targetPages = maxPages ? Math.min(maxPages, totalPages) : totalPages;
  const remainingPages: number[] = [];

  for (let page = 2; page <= targetPages; page += 1) {
    remainingPages.push(page);
  }

  for (
    let index = 0;
    index < remainingPages.length;
    index += MAX_CONCURRENCY
  ) {
    const batch = remainingPages.slice(index, index + MAX_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (page) => {
        try {
          const data = await fetchPage(page, perPage, country);
          return { page, data };
        } catch (error) {
          return { page, error };
        }
      }),
    );

    for (const result of results) {
      if ("error" in result) {
        const message =
          result.error instanceof Error
            ? result.error.message
            : "Unknown error while fetching points.";
        errors.push(`Page ${result.page} failed: ${message}`);
        continue;
      }

      const items = Array.isArray(result.data.items) ? result.data.items : [];
      pagesFetched += 1;
      totalFetched += items.length;
      mapped.push(...mapItems(items));
    }
  }

  return {
    items: mapped,
    pagesFetched,
    totalFetched,
    totalPages,
    errors,
  };
};
