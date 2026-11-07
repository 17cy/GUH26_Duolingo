import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { estimatePrice, isBelowAllComps, itemKey, type Comp } from "./estimate";

const sony: Item = {
  name: "Sony WH-1000XM4",
  brand: "Sony",
  model: "WH-1000XM4",
  category: "headphones",
  condition: "good",
  defects: [],
  confidence: 0.95,
};

const comp = (pricePence: number): Comp => ({ title: "x", pricePence, condition: "good", platform: "ebay" });

describe("itemKey", () => {
  it("slugs the product name", () => {
    expect(itemKey(sony)).toBe("sony-wh-1000xm4");
    expect(itemKey({ ...sony, name: "  Anker 65W USB-C charger " })).toBe("anker-65w-usb-c-charger");
  });
});

describe("estimatePrice", () => {
  it("uses the exact-item comps for the seed Sony (market × 0.9 × good 0.85)", () => {
    const e = estimatePrice(sony)!;
    expect(e.source).toBe("item");
    expect(e.compsCount).toBe(8);
    // comps 11000..17500: p25 12875, median 14750, p75 15625 → ×0.9×0.85, rounded to £1
    expect(e.low).toBe(9800);
    expect(e.typical).toBe(11300);
    expect(e.high).toBe(12000);
  });

  it("falls back to category comps when the item has none", () => {
    const e = estimatePrice({ ...sony, name: "Bose QC35" })!;
    expect(e.source).toBe("category");
    expect(e.compsCount).toBe(5);
  });

  it("returns null when there are no comps at all", () => {
    expect(estimatePrice(sony, { comps: {} })).toBeNull();
  });

  it("handles a single comp (low = typical = high)", () => {
    const e = estimatePrice({ ...sony, condition: "new" }, { comps: { headphones: [comp(10000)] } })!;
    expect([e.low, e.typical, e.high]).toEqual([9000, 9000, 9000]);
  });

  it("applies the seller's condition multiplier", () => {
    const comps = { headphones: [comp(10000)] };
    expect(estimatePrice({ ...sony, condition: "new" }, { comps })!.typical).toBe(9000);
    expect(estimatePrice({ ...sony, condition: "like_new" }, { comps })!.typical).toBe(8600); // 8550 → £86
    expect(estimatePrice({ ...sony, condition: "fair" }, { comps })!.typical).toBe(6300);
    expect(estimatePrice({ ...sony, condition: "poor" }, { comps })!.typical).toBe(4500);
  });

  it("positions the wanted price against the range and suggests a lower list price when above", () => {
    expect(estimatePrice(sony, { wantedPrice: 14000 })!.wanted).toEqual({ price: 14000, position: "above", suggestedPrice: 11300 });
    expect(estimatePrice(sony, { wantedPrice: 11000 })!.wanted).toEqual({ price: 11000, position: "at" });
    expect(estimatePrice(sony, { wantedPrice: 12000 })!.wanted?.position).toBe("at"); // equal to high is still in range
    expect(estimatePrice(sony, { wantedPrice: 9000 })!.wanted?.position).toBe("below");
    expect(estimatePrice(sony)!.wanted).toBeUndefined();
  });
});

describe("isBelowAllComps", () => {
  const e = estimatePrice(sony)!; // lowest adjusted comp: 11000 × 0.765 = 8415
  it("is true only when strictly below every adjusted comp", () => {
    expect(isBelowAllComps(8400, e)).toBe(true);
    expect(isBelowAllComps(8415, e)).toBe(false);
    expect(isBelowAllComps(14000, e)).toBe(false);
  });
});
