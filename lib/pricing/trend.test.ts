import { describe, expect, it } from "vitest";
import { trendAdvice } from "./trend";

const on = (month: number) => new Date(2026, month - 1, 15);

describe("trendAdvice", () => {
  it("says sell now in a peak month", () => {
    const t = trendAdvice("headphones", on(11));
    expect(t.advice).toBe("sell_now");
    expect(t.message).toBe("Now is a good time to sell.");
    expect(t.label).toBe("Estimate from seasonal patterns");
  });

  it("suggests waiting when in a low month and a peak is within 4 months", () => {
    const t = trendAdvice("bikes", on(12)); // low Dec, peak Mar is 3 months away
    expect(t.advice).toBe("wait");
    expect(t.waitUntil).toBe("March");
    expect(t.message).toBe("Prices for bikes are usually higher in March. Sell now, or wait?");
  });

  it("counts a peak exactly 4 months away", () => {
    const t = trendAdvice("textbooks", on(5)); // low May, next peak Sep is 4 months away
    expect(t.advice).toBe("wait");
    expect(t.waitUntil).toBe("September");
  });

  it("wraps around the year end", () => {
    expect(trendAdvice("bikes", on(11)).waitUntil).toBe("March"); // low Nov, peak Mar is 4 months away
  });

  it("says sell now when the next peak is more than 4 months away", () => {
    expect(trendAdvice("headphones", on(6)).advice).toBe("sell_now"); // low Jun, peak Nov is 5 months away
  });

  it("says sell now for categories with no pattern", () => {
    expect(trendAdvice("other", on(3)).advice).toBe("sell_now");
  });
});
