import type { Listing, Style } from "@/lib/types";

// Pure negotiation rules from SPEC.md "Negotiation rules". The LLM never decides a price;
// every price it proposes is replaced by what this module returns.

export type Decision =
  | { action: "decline_lowball"; pricePence?: undefined }
  | { action: "counter"; pricePence: number; final?: true }
  | { action: "accept"; pricePence: number };

const STEP_DIVISOR: Record<Style, number> = { flexible: 4, firm: 6, quick: 2 };
const MIN_COUNTERS_TO_ACCEPT_FLOOR: Record<Style, number> = { flexible: 1, quick: 1, firm: 2 };
const MAX_COUNTERS = 6;

const round100 = (pence: number) => Math.round(pence / 100) * 100;

function prices(listing: Pick<Listing, "listPrice" | "floorPrice">) {
  const { listPrice: L, floorPrice: F } = listing;
  if (!Number.isInteger(L) || !Number.isInteger(F) || L! <= 0 || F! < 0 || F! > L!) {
    throw new RangeError("listing needs integer listPrice >= floorPrice >= 0");
  }
  return { L: L!, F: F! };
}

/** The price the agent asks for after `countersMade` counters. Never below the floor. */
export function currentAsk(listing: Pick<Listing, "listPrice" | "floorPrice" | "style">, countersMade: number): number {
  const { L, F } = prices(listing);
  if (countersMade >= MAX_COUNTERS) return F;
  const step = (L - F) / STEP_DIVISOR[listing.style];
  return Math.min(L, Math.max(F, round100(L - step * (countersMade + 1))));
}

export function decide(
  listing: Pick<Listing, "listPrice" | "floorPrice" | "style">,
  offerPence: number,
  countersMade: number,
): Decision {
  const { L, F } = prices(listing);
  if (!Number.isInteger(offerPence) || offerPence < 0) throw new RangeError("offer must be integer pence >= 0");
  if (!Number.isInteger(countersMade) || countersMade < 0) throw new RangeError("countersMade must be integer >= 0");

  if (offerPence < 0.5 * L) return { action: "decline_lowball" };

  const ask = currentAsk(listing, countersMade);
  const floorAcceptable = offerPence >= F && countersMade >= MIN_COUNTERS_TO_ACCEPT_FLOOR[listing.style];
  if (offerPence >= ask || floorAcceptable) return { action: "accept", pricePence: Math.min(offerPence, L) };

  return ask === F ? { action: "counter", pricePence: F, final: true } : { action: "counter", pricePence: ask };
}

/** Bundle price: round100(0.9 × sum of list prices), never below the sum of floors. */
export function bundlePrice(listings: Pick<Listing, "listPrice" | "floorPrice">[]): number {
  let sumL = 0;
  let sumF = 0;
  for (const l of listings) {
    const { L, F } = prices(l);
    sumL += L;
    sumF += F;
  }
  return Math.max(sumF, round100(0.9 * sumL));
}
