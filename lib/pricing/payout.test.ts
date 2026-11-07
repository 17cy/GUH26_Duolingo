import { describe, expect, it } from "vitest";
import { netPayout } from "./payout";

describe("netPayout", () => {
  it("matches the SPEC worked example (14000, flexible, headphones)", () => {
    const p = netPayout(14000, "flexible", "headphones");
    expect(p.expectedDeal).toBe(12600);
    expect(p.paymentFee).toBe(209);
    expect(p.pickup.shipping).toBe(0);
    expect(p.pickup.net).toBe(12391);
    expect(p.locker.size).toBe("medium");
    expect(p.locker.shipping).toBe(650);
    expect(p.locker.net).toBe(11741);
    expect(p.pickup.percentOfList).toBeCloseTo(88.5, 1);
    expect(p.locker.percentOfList).toBeCloseTo(83.9, 1);
  });

  it("returns each deduction line for both handoff methods", () => {
    const p = netPayout(14000, "flexible", "headphones");
    expect(p.pickup.lines.map((l) => l.label)).toEqual(["Expected deal after negotiation", "Payment fee", "Shipping"]);
    expect(p.pickup.lines.map((l) => l.amount)).toEqual([12600, -209, 0]);
    expect(p.locker.lines.map((l) => l.amount)).toEqual([12600, -209, -650]);
  });

  it("applies each style factor", () => {
    expect(netPayout(10000, "firm", "electronics").expectedDeal).toBe(9500);
    expect(netPayout(10000, "flexible", "electronics").expectedDeal).toBe(9000);
    expect(netPayout(10000, "quick", "electronics").expectedDeal).toBe(8500);
  });

  it("maps category to locker size", () => {
    expect(netPayout(10000, "firm", "electronics").locker.shipping).toBe(350);
    expect(netPayout(10000, "firm", "textbooks").locker.shipping).toBe(350);
    expect(netPayout(10000, "firm", "clothing_winter").locker.shipping).toBe(650);
    expect(netPayout(10000, "firm", "bikes").locker.shipping).toBe(1200);
    expect(netPayout(10000, "firm", "furniture").locker.shipping).toBe(1200);
    expect(netPayout(10000, "firm", "other").locker.shipping).toBe(650);
  });

  it("keeps every amount an integer (pence)", () => {
    const p = netPayout(1999, "quick", "headphones");
    for (const v of [p.expectedDeal, p.paymentFee, p.pickup.net, p.locker.net]) expect(Number.isInteger(v)).toBe(true);
  });

  it("never reports a negative net for tiny prices", () => {
    const p = netPayout(100, "quick", "furniture");
    expect(p.locker.net).toBe(0);
    expect(p.pickup.net).toBeGreaterThanOrEqual(0);
  });
});
