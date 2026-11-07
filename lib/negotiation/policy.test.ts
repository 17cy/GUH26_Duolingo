import { describe, expect, it } from "vitest";
import type { Style } from "@/lib/types";
import { bundlePrice, decide } from "./policy";

const sony = { listPrice: 14000, floorPrice: 11000, style: "flexible" as Style };

describe("decide — SPEC test table (L 14000, F 11000, flexible)", () => {
  it.each([
    [0, 0, { action: "decline_lowball" }],
    [3000, 0, { action: "decline_lowball" }],
    [6900, 0, { action: "decline_lowball" }],
    [7000, 0, { action: "counter", pricePence: 13300 }],
    [10000, 1, { action: "counter", pricePence: 12500 }],
    [11500, 0, { action: "counter", pricePence: 13300 }],
    [11500, 1, { action: "accept", pricePence: 11500 }],
    [13300, 0, { action: "accept", pricePence: 13300 }],
    [20000, 0, { action: "accept", pricePence: 14000 }],
  ])("offer %i with %i counters", (offer, n, expected) => {
    expect(decide(sony, offer, n)).toMatchObject(expected);
  });

  it("offer 10999 after 5 counters counters at >= floor", () => {
    const d = decide(sony, 10999, 5);
    expect(d.action).toBe("counter");
    expect(d.pricePence).toBeGreaterThanOrEqual(11000);
  });
});

describe("decide — edges", () => {
  it("lowball boundary: 0%, 49%, 50%", () => {
    expect(decide(sony, 0, 0).action).toBe("decline_lowball");
    expect(decide(sony, 6860, 0).action).toBe("decline_lowball");
    expect(decide(sony, 7000, 0).action).toBe("counter");
  });

  it("offer exactly at floor: counter on round 0, accept from round 1 (flexible)", () => {
    expect(decide(sony, 11000, 0)).toMatchObject({ action: "counter", pricePence: 13300 });
    expect(decide(sony, 11000, 1)).toEqual({ action: "accept", pricePence: 11000 });
  });

  it("firm needs 2 counters before accepting at floor", () => {
    const firm = { ...sony, style: "firm" as Style };
    expect(decide(firm, 11000, 1).action).toBe("counter");
    expect(decide(firm, 11000, 2)).toEqual({ action: "accept", pricePence: 11000 });
  });

  it("quick steps by (L-F)/2", () => {
    const quick = { ...sony, style: "quick" as Style };
    expect(decide(quick, 9000, 0)).toMatchObject({ action: "counter", pricePence: 12500 });
  });

  it("offers above list are accepted at list", () => {
    expect(decide(sony, 14000, 0)).toEqual({ action: "accept", pricePence: 14000 });
    expect(decide(sony, 99999, 3)).toEqual({ action: "accept", pricePence: 14000 });
  });

  it("after 6 counters the ask is the floor and marked final", () => {
    expect(decide(sony, 10000, 6)).toEqual({ action: "counter", pricePence: 11000, final: true });
    const firm = { ...sony, style: "firm" as Style };
    expect(decide(firm, 10000, 9)).toEqual({ action: "counter", pricePence: 11000, final: true });
  });

  it("lowball does not depend on round", () => {
    expect(decide(sony, 5000, 4).action).toBe("decline_lowball");
  });

  it("throws without list/floor or with invalid offer", () => {
    expect(() => decide({ style: "flexible" }, 10000, 0)).toThrow();
    expect(() => decide({ listPrice: 10000, floorPrice: 12000, style: "flexible" }, 10000, 0)).toThrow();
    expect(() => decide(sony, 100.5, 0)).toThrow();
    expect(() => decide(sony, -1, 0)).toThrow();
    expect(() => decide(sony, 10000, -1)).toThrow();
  });
});

describe("decide — property: never below floor", () => {
  it("holds for 20k random cases", () => {
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % max;
    };
    const styles: Style[] = ["firm", "flexible", "quick"];
    for (let i = 0; i < 20000; i++) {
      const listPrice = 100 + rand(200000);
      const floorPrice = rand(listPrice + 1);
      const style = styles[rand(3)];
      const offer = rand(listPrice * 2);
      const n = rand(10);
      const d = decide({ listPrice, floorPrice, style }, offer, n);
      if (d.action !== "decline_lowball") {
        expect(d.pricePence).toBeGreaterThanOrEqual(floorPrice);
        expect(d.pricePence).toBeLessThanOrEqual(listPrice);
        expect(Number.isInteger(d.pricePence)).toBe(true);
      }
    }
  });
});

describe("bundlePrice", () => {
  it("is round100(0.9 × sum of list prices)", () => {
    const charger = { listPrice: 1500, floorPrice: 1000 };
    expect(bundlePrice([{ listPrice: 14000, floorPrice: 11000 }, charger])).toBe(14000);
  });

  it("never goes below the sum of floors", () => {
    expect(bundlePrice([{ listPrice: 1000, floorPrice: 950 }, { listPrice: 1000, floorPrice: 950 }])).toBe(1900);
  });
});
