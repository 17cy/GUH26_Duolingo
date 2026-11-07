import type { Listing } from "@/lib/types";
import { decide } from "./policy";

// Turns (buyer's parsed offer, model's tool call) into the action we actually take.
// Every price comes from policy.ts or from a price policy.ts already produced; the model's
// price argument is never used.

export type ToolName = "make_counter" | "accept_offer" | "decline" | "offer_bundle" | "flag_scam";
export interface ToolCall {
  name: ToolName;
  price?: number;
}

export type Resolved =
  | { kind: "decline_lowball"; offerPence: number }
  | { kind: "counter"; pricePence: number; final: boolean; countsAsRound: boolean; offerPence?: number }
  | { kind: "accept"; pricePence: number; offerPence: number }
  | { kind: "offer_bundle" }
  | { kind: "flag_scam" }
  | { kind: "reply" };

export interface ResolveInput {
  listing: Pick<Listing, "listPrice" | "floorPrice" | "style">;
  countersMade: number;
  lastCounterPence: number | undefined;
  offerPence: number | null;
  tool: ToolCall | null;
}

export function resolveAction({ listing, countersMade, lastCounterPence, offerPence, tool }: ResolveInput): Resolved {
  if (tool?.name === "flag_scam") return { kind: "flag_scam" };

  // An explicit offer in the buyer's text: the policy decides, whatever the model chose.
  // With no number, "deal" / "I'll take it" means our standing ask (last counter, else list).
  const standingAsk = lastCounterPence ?? listing.listPrice!;
  const offer = offerPence ?? (tool?.name === "accept_offer" ? standingAsk : null);

  if (offer !== null) {
    const d = decide(listing, offer, countersMade);
    if (d.action === "decline_lowball") return { kind: "decline_lowball", offerPence: offer };
    if (d.action === "accept") return { kind: "accept", pricePence: d.pricePence, offerPence: offer };
    return { kind: "counter", pricePence: d.pricePence, final: d.final === true, countsAsRound: true, offerPence: offer };
  }

  if (tool?.name === "make_counter") {
    return { kind: "counter", pricePence: standingAsk, final: standingAsk === listing.floorPrice, countsAsRound: false };
  }
  if (tool?.name === "offer_bundle") return { kind: "offer_bundle" };
  return { kind: "reply" };
}
