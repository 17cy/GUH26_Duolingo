import { describe, expect, it } from "vitest";
import type { CompsTable } from "@/lib/pricing/estimate";
import type { Item } from "@/lib/types";
import { marketFacts } from "./market";

const item: Item = { name: "Widget", category: "other", condition: "new", defects: [], confidence: 1 };
// Adjusted comp = price × 0.9 (asking→sold) × 1.0 (new) → 9000, 10800, 12600.
const comps: CompsTable = {
  widget: [
    { title: "a", pricePence: 10000, condition: "good", platform: "ebay" },
    { title: "b", pricePence: 12000, condition: "good", platform: "ebay" },
    { title: "c", pricePence: 14000, condition: "good", platform: "ebay" },
  ],
};

describe("marketFacts", () => {
  it("below every comp → lowest + below-typical claims", () => {
    const m = marketFacts({ item, listPrice: 8000 }, comps)!;
    expect(m.facts).toMatchObject({ typical: 10800, compsCount: 3, isBelowAllComps: true });
    expect(m.claims.join(" ")).toMatch(/lowest/);
    expect(m.claims.join(" ")).toMatch(/£108/);
    expect(m.claimPence).toEqual([10800]);
  });

  it("below typical but not below all → no 'lowest' claim", () => {
    const m = marketFacts({ item, listPrice: 10000 }, comps)!;
    expect(m.facts.isBelowAllComps).toBe(false);
    expect(m.claims.join(" ")).not.toMatch(/lowest/);
    expect(m.claimPence).toEqual([10800]);
  });

  it("at or above typical → no price claims", () => {
    const m = marketFacts({ item, listPrice: 13000 }, comps)!;
    expect(m.claims).toEqual([]);
    expect(m.claimPence).toEqual([]);
  });

  it("no comps → null", () => {
    expect(marketFacts({ item, listPrice: 1000 }, {})).toBeNull();
  });
});
