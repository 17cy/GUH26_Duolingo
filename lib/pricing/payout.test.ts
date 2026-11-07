import { describe, expect, it } from "vitest";
import { dealNet, netPayout, splitProceeds } from "./payout";

describe("dealNet", () => {
  it("takes the payment fee off the agreed price for pickup", () => {
    expect(dealNet(11500, "headphones", "pickup")).toBe(11500 - (173 + 20)); // round(172.5) = 173
  });
  it("also takes locker shipping by category size", () => {
    expect(dealNet(11500, "headphones", "locker")).toBe(11500 - 193 - 650);
    expect(dealNet(4700, "electronics", "locker")).toBe(4700 - (71 + 20) - 350);
  });
  it("treats an unknown handoff as pickup and never goes negative", () => {
    expect(dealNet(11500, "headphones", undefined)).toBe(11307);
    expect(dealNet(100, "furniture", "locker")).toBe(0);
  });
});

describe("splitProceeds", () => {
  it("splits 70/30 by default and keeps whole pence summing to the total", () => {
    expect(splitProceeds(11307)).toEqual({ save: 7915, spend: 3392 });
    expect(splitProceeds(11307, 50)).toEqual({ save: 5654, spend: 5653 });
  });
  it("handles 0% and 100%", () => {
    expect(splitProceeds(1000, 0)).toEqual({ save: 0, spend: 1000 });
    expect(splitProceeds(1000, 100)).toEqual({ save: 1000, spend: 0 });
  });
});

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
