import { estimatePrice, isBelowAllComps, type CompsTable } from "@/lib/pricing/estimate";
import type { Listing } from "@/lib/types";

// SPEC "Pricing" marketFacts, turned into the only marketing claims the agent may make
// (SPEC "Agent tone": "lowest" only if isBelowAllComps; "below the typical £X" only if listPrice < typical).

export interface MarketFacts {
  typical: number;
  low: number;
  high: number;
  compsCount: number;
  isBelowAllComps: boolean;
}

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

export function marketFacts(
  listing: Pick<Listing, "item" | "listPrice">,
  comps?: CompsTable,
): { facts: MarketFacts; claims: string[]; claimPence: number[] } | null {
  if (listing.listPrice === undefined) return null;
  const est = estimatePrice(listing.item, comps ? { comps } : {});
  if (!est) return null;

  const facts: MarketFacts = {
    typical: est.typical,
    low: est.low,
    high: est.high,
    compsCount: est.compsCount,
    isBelowAllComps: isBelowAllComps(listing.listPrice, est),
  };
  const claims: string[] = [];
  const claimPence: number[] = [];
  if (facts.isBelowAllComps) claims.push(`It's the lowest price of the ${facts.compsCount} similar listings found.`);
  if (listing.listPrice < facts.typical) {
    claims.push(`It's below the typical ${gbp(facts.typical)} for similar items.`);
    claimPence.push(facts.typical);
  }
  return { facts, claims, claimPence };
}
