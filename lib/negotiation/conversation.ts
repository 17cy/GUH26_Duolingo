import { z } from "zod";
import { syncTracking } from "@/lib/delivery/handoff";
import { MEETING_POINT, proposePickupSlots } from "@/lib/delivery/pickup";
import { ensurePaymentLink, syncPaymentFromStripe } from "@/lib/payments/stripe";
import { getListing, listMessages, readDb } from "@/lib/store";
import type { Listing, Platform } from "@/lib/types";
import { ensureConversation } from "./agent";
import { toPublicDeal, toPublicListing } from "./public";

// Everything the buyer page needs, built only from public serializers.

export const BuyerName = z.string().trim().min(1).max(40);

/** A listing the buyer side may see (anything that has been posted). */
export function buyerVisibleListing(id: string): Listing | undefined {
  const listing = getListing(id);
  return listing && (listing.status === "posted" || listing.status === "sold") ? listing : undefined;
}

/** The buyer's most recent deal on this listing, ignoring rejected ones (they keep negotiating). */
function latestDeal(listingId: string, buyerName: string) {
  return readDb()
    .deals.filter((d) => d.listingId === listingId && d.buyerName === buyerName && d.status !== "rejected")
    .at(-1);
}

/** Which mock marketplace page the buyer is chatting on (optional; absent = /buy). Allowlisted, so it can't become an open redirect. */
export const BuyerPlatform = z.enum(["ebay", "vinted", "donedeal"]).optional().catch(undefined);

/** `from` is where the buyer is chatting, so Stripe Checkout sends them back to the same page. */
export async function buyerConversation(listing: Listing, buyerName: string, from?: Platform) {
  ensureConversation(listing.id, buyerName);

  // Agreed deals are auto-approved (seller's floor = pre-approval); we react here by creating the payment link.
  const pending = latestDeal(listing.id, buyerName);
  if (pending?.status === "approved") {
    await ensurePaymentLink(pending.id, undefined, from).catch((err) => console.error("payment link failed", err));
  }
  // Paid but no webhook yet (e.g. `stripe listen` not running): check Stripe directly.
  if (pending?.status === "awaiting_payment") {
    await syncPaymentFromStripe(pending.id).catch((err) => console.error("payment sync failed", err));
  }
  // Locker tracking advances lazily whenever the buyer's chat polls.
  if (pending?.status === "in_delivery") await syncTracking(pending.id);

  const deal = latestDeal(listing.id, buyerName);
  const choosing = deal?.status === "payment_held" && !deal.handoffMethod;
  return {
    listing: toPublicListing(listing),
    messages: listMessages(listing.id, buyerName).map(({ id, from, text, createdAt }) => ({ id, from, text, createdAt })),
    deal: deal ? toPublicDeal(deal) : null,
    // Present only while the buyer still has to choose pickup or locker.
    handoffOptions: choosing ? { pickupSlots: proposePickupSlots(Date.now()), meetingPoint: MEETING_POINT } : null,
  };
}
