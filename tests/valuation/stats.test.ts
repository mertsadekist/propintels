import { describe, it, expect } from "vitest";
import { computeAggregates, computeMedian, getBenchmarkPsf } from "@/valuation/stats";

describe("computeMedian", () => {
  it("returns the middle value for an odd-length array", () => {
    expect(computeMedian([1, 2, 3])).toBe(2);
    expect(computeMedian([10, 20, 30, 40, 50])).toBe(30);
  });

  it("returns the average of two middle values for an even-length array", () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    expect(computeMedian([100, 200, 300, 400])).toBe(250);
  });

  it("returns the single value for a single-element array", () => {
    expect(computeMedian([42])).toBe(42);
  });
});

describe("computeAggregates", () => {
  it("returns null for an empty array", () => {
    expect(computeAggregates([])).toBeNull();
  });

  it("computes correct count, mean, median, min, max", () => {
    const result = computeAggregates([1000, 1200, 1100, 1300, 1050]);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(5);
    expect(result!.min).toBe(1000);
    expect(result!.max).toBe(1300);
    expect(result!.mean).toBeCloseTo(1130, 1);
    expect(result!.median).toBe(1100);
  });

  it("returns a sorted values array", () => {
    const result = computeAggregates([1300, 1000, 1200, 1100]);
    expect(result!.values).toEqual([1000, 1100, 1200, 1300]);
  });

  it("handles a single value", () => {
    const result = computeAggregates([500]);
    expect(result!.count).toBe(1);
    expect(result!.mean).toBe(500);
    expect(result!.median).toBe(500);
    expect(result!.min).toBe(500);
    expect(result!.max).toBe(500);
  });
});

describe("getBenchmarkPsf", () => {
  const listings = computeAggregates([1000, 1050, 1100]);   // median 1050
  const transactions = computeAggregates([1200, 1250, 1300]); // median 1250

  it("prefers transaction median when benchmark is transactionMedianPsf", () => {
    const psf = getBenchmarkPsf(listings, transactions, "transactionMedianPsf");
    expect(psf).toBe(1250);
  });

  it("falls back to listing median when no transactions and benchmark is transactionMedianPsf", () => {
    const psf = getBenchmarkPsf(listings, null, "transactionMedianPsf");
    expect(psf).toBe(1050);
  });

  it("prefers listing median when benchmark is listingMedianPsf", () => {
    const psf = getBenchmarkPsf(listings, transactions, "listingMedianPsf");
    expect(psf).toBe(1050);
  });

  it("falls back to transaction median when no listings and benchmark is listingMedianPsf", () => {
    const psf = getBenchmarkPsf(null, transactions, "listingMedianPsf");
    expect(psf).toBe(1250);
  });

  it("returns null when both sources are null", () => {
    expect(getBenchmarkPsf(null, null, "transactionMedianPsf")).toBeNull();
    expect(getBenchmarkPsf(null, null, "listingMedianPsf")).toBeNull();
  });
});
