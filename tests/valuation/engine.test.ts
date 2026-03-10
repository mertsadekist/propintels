import { describe, it, expect } from "vitest";
import { runValuationEngine, computePsf } from "@/valuation/engine";
import type { ClientInput, ComparableEntry, ValuationEngineConfig } from "@/valuation/types";

// ─────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────

const DEFAULT_CONFIG: ValuationEngineConfig = {
  areaTolerancePct: 15,
  outlierMethod: "trim10",
  minComps: 3,
  benchmark: "transactionMedianPsf",
  thresholds: {
    below_market: 0.95,
    aligned_max: 1.03,
    slightly_above_max: 1.1,
  },
};

const CLIENT_APARTMENT: ClientInput = {
  propertyType: "APARTMENT",
  bedrooms: 2,
  areaSqft: 1000,
  clientPrice: 1_200_000,
};

function makeTransaction(
  id: string,
  areaSqft: number,
  pricePerSqft: number,
  bedrooms = 2
): ComparableEntry {
  return {
    id,
    sourceType: "TRANSACTION",
    propertyType: "APARTMENT",
    bedrooms,
    transactionAreaSqft: areaSqft,
    transactionPsf: pricePerSqft,
    transactionDate: new Date(),
  };
}

function makeListing(
  id: string,
  areaSqft: number,
  askPsf: number,
  bedrooms = 2
): ComparableEntry {
  return {
    id,
    sourceType: "LISTING",
    propertyType: "APARTMENT",
    bedrooms,
    areaSqft,
    askPsf,
  };
}

// ─────────────────────────────────────────────
// runValuationEngine
// ─────────────────────────────────────────────

describe("runValuationEngine", () => {
  it("returns INSUFFICIENT_DATA when there are fewer comps than minComps", () => {
    const result = runValuationEngine(
      CLIENT_APARTMENT,
      [makeTransaction("t1", 1000, 1150)], // only 1 comp, minComps=3
      DEFAULT_CONFIG
    );

    expect(result.verdict).toBe("INSUFFICIENT_DATA");
    expect(result.ratioToMarket).toBeNull();
    expect(result.recommendedMid).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("returns ALIGNED when client PSF matches the market benchmark", () => {
    // 3 transactions all at 1200 psf → benchmark = 1200, clientPsf = 1200
    const comps = [
      makeTransaction("t1", 950, 1200),
      makeTransaction("t2", 1000, 1200),
      makeTransaction("t3", 1050, 1200),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.verdict).toBe("ALIGNED");
    expect(result.ratioToMarket).toBeCloseTo(1.0, 2);
    expect(result.clientPsf).toBeCloseTo(1200, 0);
  });

  it("returns BELOW_MARKET when client PSF is significantly below benchmark", () => {
    // Benchmark ~ 1400 psf, client at 1200 → ratio ≈ 0.857
    const comps = [
      makeTransaction("t1", 950, 1400),
      makeTransaction("t2", 1000, 1400),
      makeTransaction("t3", 1050, 1400),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.verdict).toBe("BELOW_MARKET");
    expect(result.ratioToMarket).toBeLessThan(0.95);
  });

  it("returns SLIGHTLY_ABOVE when client PSF is slightly above benchmark", () => {
    // Benchmark 1100, client 1200 → ratio ≈ 1.09 (between 1.03 and 1.10)
    const comps = [
      makeTransaction("t1", 950, 1100),
      makeTransaction("t2", 1000, 1100),
      makeTransaction("t3", 1050, 1100),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.verdict).toBe("SLIGHTLY_ABOVE");
    expect(result.ratioToMarket).toBeGreaterThan(1.03);
    expect(result.ratioToMarket).toBeLessThanOrEqual(1.1);
  });

  it("returns ABOVE_MARKET when client PSF is far above benchmark", () => {
    // Benchmark 800, client 1200 → ratio = 1.5
    const comps = [
      makeTransaction("t1", 950, 800),
      makeTransaction("t2", 1000, 800),
      makeTransaction("t3", 1050, 800),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.verdict).toBe("ABOVE_MARKET");
    expect(result.ratioToMarket).toBeGreaterThan(1.1);
  });

  it("filters out comparables outside the area tolerance", () => {
    // Only t2 is within ±15% of 1000 sqft (850–1150)
    const comps = [
      makeTransaction("t1", 500, 1200), // too small
      makeTransaction("t2", 1000, 1200), // within tolerance
      makeTransaction("t3", 1500, 1200), // too large
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    // Only 1 comp matches → INSUFFICIENT_DATA
    expect(result.verdict).toBe("INSUFFICIENT_DATA");
    expect(result.compsUsed).toHaveLength(1);
    expect(result.compsUsed[0]).toBe("t2");
  });

  it("filters out comparables with different property type", () => {
    const villaComps: ComparableEntry[] = [
      {
        id: "v1",
        sourceType: "TRANSACTION",
        propertyType: "VILLA", // wrong type
        bedrooms: 2,
        transactionAreaSqft: 1000,
        transactionPsf: 1200,
      },
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, villaComps, DEFAULT_CONFIG);
    expect(result.verdict).toBe("INSUFFICIENT_DATA");
    expect(result.compsUsed).toHaveLength(0);
  });

  it("filters out comparables with different bedroom count", () => {
    const threeBedComps = [
      makeTransaction("t1", 1000, 1200, 3), // 3-bed vs 2-bed client
      makeTransaction("t2", 1000, 1200, 3),
      makeTransaction("t3", 1000, 1200, 3),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, threeBedComps, DEFAULT_CONFIG);
    expect(result.verdict).toBe("INSUFFICIENT_DATA");
  });

  it("uses listing comps as fallback when no transactions are available", () => {
    const config: ValuationEngineConfig = {
      ...DEFAULT_CONFIG,
      benchmark: "listingMedianPsf",
    };

    const listingComps = [
      makeListing("l1", 950, 1200),
      makeListing("l2", 1000, 1200),
      makeListing("l3", 1050, 1200),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, listingComps, config);
    expect(result.verdict).toBe("ALIGNED");
    expect(result.listings?.count).toBe(3);
    expect(result.transactions).toBeNull();
  });

  it("computes a recommended price range (low / mid / high)", () => {
    const comps = [
      makeTransaction("t1", 950, 1100),
      makeTransaction("t2", 1000, 1200),
      makeTransaction("t3", 1050, 1300),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.recommendedLow).not.toBeNull();
    expect(result.recommendedMid).not.toBeNull();
    expect(result.recommendedHigh).not.toBeNull();
    expect(result.recommendedLow!).toBeLessThanOrEqual(result.recommendedMid!);
    expect(result.recommendedMid!).toBeLessThanOrEqual(result.recommendedHigh!);
  });

  it("includes explanations in the output", () => {
    const comps = [
      makeTransaction("t1", 950, 1200),
      makeTransaction("t2", 1000, 1200),
      makeTransaction("t3", 1050, 1200),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(Array.isArray(result.explanations)).toBe(true);
    expect(result.explanations.length).toBeGreaterThan(0);
  });

  it("sets rulesVersion and config snapshot in output", () => {
    const comps = [
      makeTransaction("t1", 950, 1200),
      makeTransaction("t2", 1000, 1200),
      makeTransaction("t3", 1050, 1200),
    ];

    const result = runValuationEngine(CLIENT_APARTMENT, comps, DEFAULT_CONFIG);

    expect(result.rulesVersion).toBe(1);
    expect(result.areaTolerancePct).toBe(15);
    expect(result.outlierMethod).toBe("trim10");
    expect(result.minComps).toBe(3);
    expect(result.benchmark).toBe("transactionMedianPsf");
  });
});

// ─────────────────────────────────────────────
// computePsf
// ─────────────────────────────────────────────

describe("computePsf", () => {
  it("computes askPsf for LISTING entries", () => {
    const result = computePsf({
      sourceType: "LISTING",
      areaSqft: 1000,
      askPrice: 1_200_000,
    });
    expect(result.askPsf).toBeCloseTo(1200, 2);
    expect(result.transactionPsf).toBeNull();
  });

  it("computes lowPsf when lowestPrice is provided", () => {
    const result = computePsf({
      sourceType: "LISTING",
      areaSqft: 1000,
      askPrice: 1_200_000,
      lowestPrice: 1_100_000,
    });
    expect(result.lowPsf).toBeCloseTo(1100, 2);
  });

  it("computes transactionPsf for TRANSACTION entries", () => {
    const result = computePsf({
      sourceType: "TRANSACTION",
      transactionAreaSqft: 900,
      transactionPrice: 990_000,
    });
    expect(result.transactionPsf).toBeCloseTo(1100, 2);
    expect(result.askPsf).toBeNull();
  });

  it("returns null for askPsf when areaSqft is zero", () => {
    const result = computePsf({
      sourceType: "LISTING",
      areaSqft: 0,
      askPrice: 1_000_000,
    });
    expect(result.askPsf).toBeNull();
  });

  it("returns null for transactionPsf when area is missing", () => {
    const result = computePsf({
      sourceType: "TRANSACTION",
      transactionPrice: 900_000,
    });
    expect(result.transactionPsf).toBeNull();
  });
});
