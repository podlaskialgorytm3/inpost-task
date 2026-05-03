import { describe, it, expect } from "vitest";
import { calculateDistanceKm, isOpenAtTime } from "@/lib/inpost";

describe("inpost utility functions", () => {
  it("calculates approximate distance between Warsaw and Krakow", () => {
    const warLat = 52.2297;
    const warLon = 21.0122;
    const krkLat = 50.0647;
    const krkLon = 19.945;

    const d = calculateDistanceKm(warLat, warLon, krkLat, krkLon);
    // rough distance ~ 252 km
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(320);
  });

  it("detects open status for simple ranges", () => {
    expect(isOpenAtTime("08:00-20:00", "09:30")).toBe(true);
    expect(isOpenAtTime("08:00-20:00", "21:00")).toBe(false);
    expect(isOpenAtTime("24/7", "03:00")).toBe(true);
  });

  it("treats overnight ranges as spanning midnight", () => {
    expect(isOpenAtTime("22:00-06:00", "23:00")).toBe(true);
    expect(isOpenAtTime("22:00-06:00", "05:00")).toBe(true);
    expect(isOpenAtTime("22:00-06:00", "12:00")).toBe(false);
  });

  it("returns false for empty or unparseable hours", () => {
    expect(isOpenAtTime(null, "10:00")).toBe(false);
    expect(isOpenAtTime("closed", "10:00")).toBe(false);
  });
});
