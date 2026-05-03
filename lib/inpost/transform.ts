import type { Point } from "@/lib/types";
import { toNumber, toStringArray, toStringValue } from "./parsing";

const AVAILABLE_DETAIL_VALUES = new Set(["AVAILABLE", "EMPTY", "FREE", "OK"]);
const UNKNOWN_DETAIL_VALUES = new Set(["NO_DATA", "UNKNOWN", "NONE"]);

/**
 * Heuristically count compartments marked as available in the details map.
 * Returns null when unavailable/unknown.
 */
const countAvailableCompartments = (details: Record<string, string> | null) => {
  if (!details) {
    return null;
  }

  const values = Object.values(details);
  if (values.length === 0) {
    return null;
  }

  const normalized = values.map((value) => value.toUpperCase());
  const hasKnown = normalized.some(
    (value) => !UNKNOWN_DETAIL_VALUES.has(value),
  );
  if (!hasKnown) {
    return null;
  }

  return normalized.filter((value) => AVAILABLE_DETAIL_VALUES.has(value))
    .length;
};

export const mapPoint = (raw: Record<string, unknown>): Point => {
  const address = raw.address as Record<string, unknown> | undefined;
  const addressDetails = raw.address_details as
    | Record<string, unknown>
    | undefined;
  const location = raw.location as Record<string, unknown> | undefined;
  const availabilityRaw = raw.locker_availability as
    | Record<string, unknown>
    | undefined;
  const availabilityStatus =
    toStringValue(availabilityRaw?.status) ?? "UNKNOWN";
  const availabilityDetails =
    availabilityRaw?.details &&
    typeof availabilityRaw.details === "object" &&
    !Array.isArray(availabilityRaw.details)
      ? (availabilityRaw.details as Record<string, string>)
      : null;

  return {
    id: toStringValue(raw.name) ?? "unknown",
    name: toStringValue(raw.name) ?? "Unknown",
    country: toStringValue(raw.country) ?? "Unknown",
    type: toStringArray(raw.type),
    status: toStringValue(raw.status) ?? "Unknown",
    location: {
      latitude: toNumber(location?.latitude),
      longitude: toNumber(location?.longitude),
    },
    address: {
      line1: toStringValue(address?.line1),
      line2: toStringValue(address?.line2),
    },
    addressDetails: {
      city: toStringValue(addressDetails?.city),
      province: toStringValue(addressDetails?.province),
      postCode: toStringValue(addressDetails?.post_code),
      street: toStringValue(addressDetails?.street),
      buildingNumber: toStringValue(addressDetails?.building_number),
    },
    openingHours: toStringValue(raw.opening_hours),
    functions: toStringArray(raw.functions),
    locationType: toStringValue(raw.location_type),
    locationDescription: toStringValue(raw.location_description),
    paymentAvailable:
      typeof raw.payment_available === "boolean" ? raw.payment_available : null,
    lockerAvailability: availabilityRaw
      ? {
          status: availabilityStatus,
          details: availabilityDetails,
        }
      : null,
    availableCompartments: countAvailableCompartments(availabilityDetails),
  };
};

export const mapItems = (items: unknown[]) =>
  items.map((item) => {
    if (item && typeof item === "object") {
      return mapPoint(item as Record<string, unknown>);
    }

    return mapPoint({});
  });
