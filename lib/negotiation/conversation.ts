import { z } from "zod";
import { getListing, listMessages } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { ensureConversation, findOpenDeal } from "./agent";
import { toPublicDeal, toPublicListing } from "./public";

// Everything the buyer page needs, built only from public serializers.

export const BuyerName = z.string().trim().min(1).max(40);

/** A listing the buyer side may see (anything that has been posted). */
export function buyerVisibleListing(id: string): Listing | undefined {
  const listing = getListing(id);
  return listing && (listing.status === "posted" || listing.status === "sold") ? listing : undefined;
}

export function buyerConversation(listing: Listing, buyerName: string) {
  ensureConversation(listing.id, buyerName);
  const deal = findOpenDeal(listing.id, buyerName);
  return {
    listing: toPublicListing(listing),
    messages: listMessages(listing.id, buyerName).map(({ id, from, text, createdAt }) => ({ id, from, text, createdAt })),
    deal: deal ? toPublicDeal(deal) : null,
  };
}
