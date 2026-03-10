import { describe, it, expect } from "vitest";
import { trimOutliers, removeByIQR, applyOutlierFilter } from "@/valuation/outliers";

describe("trimOutliers", () => {
  it("returns values unchanged when fewer than 4 items", () => {
    expect(trimOutliers([100, 200, 300])).toEqual([100, 200, 300]);
  });

  it("removes top and bottom 10% for a normal dataset", () => {
    // 10 values: trim 1 from each end
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const result = trimOutliers(values, 10);
    expect(result).not.toContain(100);
    expect(result).not.toContain(1000);
    expect(result.length).toBe(8);
  });

  it("returns a sorted array", () => {
    const values = [500, 200, 800, 100, 600, 300, 700, 400];
    const result = trimOutliers(values);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
    }
  });

  it("does not trim when cutCount is zero (small dataset)", () => {
    // 4 items, 10% of 4 = 0.4, floor = 0 → no trim
    const values = [100, 200, 300, 400];
    const result = trimOutliers(values, 10);
    expect(result).toHaveLength(4);
  });
});

describe("removeByIQR", () => {
  it("returns values unchanged when fewer than 4 items", () => {
    expect(removeByIQR([100, 200, 300])).toEqual([100, 200, 300]);
  });

  it("removes outliers outside 1.5 * IQR", () => {
    // Main cluster: [1000, 1050, 1100, 1150], outlier: 5000
    const values = [1000, 1050, 1100, 1150, 5000];
    const result = removeByIQR(values);
    expect(result).not.toContain(5000);
    expect(result.length).toBe(4);
  });

  it("keeps all values when none are outliers", () => {
    const values = [1000, 1050, 1100, 1150, 1200, 1250];
    const result = removeByIQR(values);
    expect(result.length).toBe(6);
  });
});

describe("applyOutlierFilter", () => {
  it("returns empty array for empty input", () => {
    expect(applyOutlierFilter([], "trim10")).toEqual([]);
    expect(applyOutlierFilter([], "iqr")).toEqual([]);
  });

  it("applies trim10 method", () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const result = applyOutlierFilter(values, "trim10");
    expect(result).not.toContain(100);
    expect(result).not.toContain(1000);
  });

  it("applies IQR method", () => {
    const values = [1000, 1050, 1100, 1150, 5000];
    const result = applyOutlierFilter(values, "iqr");
    expect(result).not.toContain(5000);
  });
});
