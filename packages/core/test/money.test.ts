import { describe, it, expect } from "vitest";
import { assertMinorUnits, toMajorUnits, xBet, totalBet } from "../src/index.js";

describe("money (integer minor units, denominator 100)", () => {
  it("accepts integer minor units", () => {
    expect(assertMinorUnits(41665, "payout")).toBe(41665);
  });

  it("rejects non-integer money (no binary float totals)", () => {
    expect(() => assertMinorUnits(1.5, "round_win")).toThrow(/not an integer/);
    expect(() => assertMinorUnits(NaN, "x")).toThrow();
  });

  it("converts to major units for display only", () => {
    expect(toMajorUnits(41665)).toBeCloseTo(416.65, 10);
    expect(toMajorUnits(100)).toBe(1);
  });

  it("computes xBet multiplier", () => {
    expect(xBet(500, 100)).toBe(5);
    expect(xBet(0, 100)).toBe(0);
    expect(xBet(100, 0)).toBe(0); // guard divide-by-zero
  });

  it("computes total bet", () => {
    expect(totalBet(5, 20)).toBe(100);
    expect(totalBet(5, 20, 20)).toBe(2000);
  });

  it("summing minor units stays exact where floats would drift", () => {
    let total = 0;
    for (let i = 0; i < 10; i++) total += 10; // 0.10 * 10
    expect(total).toBe(100); // 1.00 exactly, integer path
  });
});
