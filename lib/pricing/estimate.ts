import compsFixture from "@/data/comps.json";
import type { Condition, Item, Platform } from "@/lib/types";

// SPEC.md "Pricing". Comps are ASKING prices from similar listings (not sold prices).
// eBay Browse API (USE_EBAY=true) is a stretch goal and not implemented; fixtures are always used.

export interface Comp {
  title: string;
  pricePence: number;
  condition: Condition;
  platform: Platform;
}

export type CompsTable = Record<string, Comp[]>;

export const CONDITION_MULTIPLIER: Record<Condition, number> = { new: 1, like_new: 0.95, good: 0.85, fair: 0.7, poor: 0.5 };
export const ASKING_TO_SOLD = 0.9;

export interface WantedCheck {
  price: number;
  position: "below" | "at" | "above"; // vs the low..high market range
  suggestedPrice?: number; // only when above: list at the typical market price instead
}

export interface PriceEstimate {
  low: number;
  typical: number;
  high: number;
  compsCount: number;
  source: "item" | "category";
  adjustedComps: number[]; // each comp × 0.9 × seller's condition multiplier, sorted ascending
  wanted?: WantedCheck;
}

export function itemKey(item: Item): string {
  return item.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const roundPound = (pence: number) => Math.round(pence / 100) * 100;

// Linear-interpolation percentile over a sorted array.
function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function estimatePrice(
  item: Item,
  opts: { wantedPrice?: number; comps?: CompsTable } = {},
): PriceEstimate | null {
  const table = opts.comps ?? (compsFixture as CompsTable);
  const exact = table[itemKey(item)];
  const source = exact?.length ? "item" : "category";
  const comps = source === "item" ? exact : (table[item.category] ?? []);
  if (comps.length === 0) return null;

  const mult = CONDITION_MULTIPLIER[item.condition] * ASKING_TO_SOLD;
  const adjustedComps = comps.map((c) => Math.round(c.pricePence * mult)).sort((a, b) => a - b);

  const estimate: PriceEstimate = {
    low: roundPound(percentile(adjustedComps, 0.25)),
    typical: roundPound(percentile(adjustedComps, 0.5)),
    high: roundPound(percentile(adjustedComps, 0.75)),
    compsCount: comps.length,
    source,
    adjustedComps,
  };

  if (opts.wantedPrice !== undefined) {
    const w = opts.wantedPrice;
    estimate.wanted =
      w > estimate.high
        ? { price: w, position: "above", suggestedPrice: estimate.typical }
        : { price: w, position: w < estimate.low ? "below" : "at" };
  }
  return estimate;
}

// True only if listPrice is strictly below every adjusted comp. Gates "lowest" marketing claims.
export function isBelowAllComps(listPrice: number, estimate: PriceEstimate): boolean {
  return estimate.adjustedComps.every((p) => listPrice < p);
}
