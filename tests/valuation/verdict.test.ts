import { describe, it, expect } from "vitest";
import { computeVerdict, generateExplanations } from "@/valuation/verdict";
import type { ValuationEngineConfig } from "@/valuation/types";

const THRESHOLDS: ValuationEngineConfig["thresholds"] = {
  below_market: 0.95,
  aligned_max: 1.03,
  slightly_above_max: 1.1,
};

describe("computeVerdict", () => {
  it("returns BELOW_MARKET when ratio < 0.95", () => {
    const { verdict, ratio } = computeVerdict(900, 1000, THRESHOLDS);
    expect(verdict).toBe("BELOW_MARKET");
    expect(ratio).toBeCloseTo(0.9, 5);
  });

  it("returns ALIGNED when ratio is between 0.95 and 1.03", () => {
    const { verdict, ratio } = computeVerdict(1000, 1000, THRESHOLDS);
    expect(verdict).toBe("ALIGNED");
    expect(ratio).toBeCloseTo(1.0, 5);
  });

  it("returns ALIGNED at the upper boundary (ratio = 1.03)", () => {
    const { verdict } = computeVerdict(1030, 1000, THRESHOLDS);
    expect(verdict).toBe("ALIGNED");
  });

  it("returns SLIGHTLY_ABOVE when ratio is between 1.03 and 1.10", () => {
    const { verdict, ratio } = computeVerdict(1070, 1000, THRESHOLDS);
    expect(verdict).toBe("SLIGHTLY_ABOVE");
    expect(ratio).toBeCloseTo(1.07, 5);
  });

  it("returns SLIGHTLY_ABOVE at the upper boundary (ratio = 1.10)", () => {
    const { verdict } = computeVerdict(1100, 1000, THRESHOLDS);
    expect(verdict).toBe("SLIGHTLY_ABOVE");
  });

  it("returns ABOVE_MARKET when ratio > 1.10", () => {
    const { verdict, ratio } = computeVerdict(1500, 1000, THRESHOLDS);
    expect(verdict).toBe("ABOVE_MARKET");
    expect(ratio).toBeCloseTo(1.5, 5);
  });

  it("computes ratio correctly as clientPsf / benchmarkPsf", () => {
    const { ratio } = computeVerdict(1250, 1000, THRESHOLDS);
    expect(ratio).toBeCloseTo(1.25, 5);
  });
});

describe("generateExplanations", () => {
  it("returns an array with at least 3 explanation strings", () => {
    const explanations = generateExplanations(
      1200, 1200, 1.0, "ALIGNED", 5, 3, 15
    );
    expect(Array.isArray(explanations)).toBe(true);
    expect(explanations.length).toBeGreaterThanOrEqual(3);
  });

  it("mentions listing and transaction counts in the first explanation", () => {
    const explanations = generateExplanations(
      1200, 1200, 1.0, "ALIGNED", 5, 3, 15
    );
    expect(explanations[0]).toContain("5");
    expect(explanations[0]).toContain("3");
  });

  it("mentions the client PSF in an explanation", () => {
    const explanations = generateExplanations(
      1200, 1200, 1.0, "ALIGNED", 5, 3, 15
    );
    const combined = explanations.join(" ");
    expect(combined).toContain("1200");
  });

  it("returns a BELOW_MARKET-specific explanation", () => {
    const explanations = generateExplanations(
      900, 1000, 0.9, "BELOW_MARKET", 5, 3, 15
    );
    expect(explanations.some((e) => e.toLowerCase().includes("below"))).toBe(true);
  });

  it("returns an ABOVE_MARKET-specific explanation", () => {
    const explanations = generateExplanations(
      1500, 1000, 1.5, "ABOVE_MARKET", 5, 3, 15
    );
    expect(explanations.some((e) => e.toLowerCase().includes("above"))).toBe(true);
  });

  it("returns an INSUFFICIENT_DATA explanation", () => {
    const explanations = generateExplanations(
      1200, 1200, 1.0, "INSUFFICIENT_DATA", 0, 0, 15
    );
    expect(explanations.some((e) => e.toLowerCase().includes("insufficient"))).toBe(true);
  });
});
