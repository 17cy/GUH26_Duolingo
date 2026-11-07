import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import Stripe from "stripe";
import { delistEverywhere } from "@/lib/delivery/delist";
import { addEvent } from "@/lib/events";
import { addMessage, getDeal, getListing, readDb, saveDeal, saveListing } from "@/lib/store";
import type { Deal } from "@/lib/types";

// SPEC "Payment and escrow" + "Handoff". Stripe test mode only, hosted Checkout (no card data
// here), manual capture = money held until the buyer scans the handoff QR.

export type StripeLike = Pick<Stripe, "checkout" | "paymentIntents">;

let client: Stripe | undefined;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...)");
  client ??= new Stripe(key);
  return client;
}

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const now = () => new Date().toISOString();

export function tellBuyer(deal: Deal, text: string, id = nanoid()) {
  if (readDb().messages.some((m) => m.id === id)) return;
  addMessage({ id, listingId: deal.listingId, buyerName: deal.buyerName, from: "agent", text, createdAt: now() });
}

export function checkoutSessionParams(deal: Deal, itemName: string, baseUrl: string, nowMs = Date.now()) {
  return {
    mode: "payment" as const,
    line_items: [
      { quantity: 1, price_data: { currency: process.env.CURRENCY ?? "gbp", unit_amount: deal.price, product_data: { name: itemName } } },
    ],
    payment_intent_data: { capture_method: "manual" as const, metadata: { dealId: deal.id } },
    metadata: { dealId: deal.id },
    // Stripe requires at least 30 minutes; the extra minute absorbs clock skew.
    expires_at: Math.floor(nowMs / 1000) + 31 * 60,
    success_url: `${baseUrl}/buy/${deal.listingId}?paid=1`,
    cancel_url: `${baseUrl}/buy/${deal.listingId}`,
  };
}

const creating = new Set<string>();

/** On an approved deal, creates its single Checkout Session and posts the link to the buyer. */
export async function ensurePaymentLink(dealId: string, stripe: StripeLike = getStripe()): Promise<void> {
  const deal = getDeal(dealId);
  if (!deal || deal.status !== "approved" || deal.stripeSessionId || creating.has(dealId)) return;
  const listing = getListing(deal.listingId);
  if (!listing) return;

  creating.add(dealId);
  try {
    const session = await stripe.checkout.sessions.create(checkoutSessionParams(deal, listing.item.name, appUrl()));
    const latest = getDeal(dealId);
    if (!latest || latest.status !== "approved") return;
    saveDeal({ ...latest, stripeSessionId: session.id, status: "awaiting_payment" });
    addEvent(deal.listingId, "payment_link_sent", `Secure payment link sent to ${deal.buyerName} for ${gbp(deal.price)}`, {
      dealId,
      buyerName: deal.buyerName,
    });
    tellBuyer(
      deal,
      `Pay ${gbp(deal.price)} securely here: ${session.url} — your money is held safely and only released to the seller when you collect the item. The link expires in 30 minutes.`,
      `paylink-${deal.id}`,
    );
  } finally {
    creating.delete(dealId);
  }
}

export interface CompletedSession {
  id: string;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string } | null;
  amount_total: number | null;
}

/** Webhook checkout.session.completed → payment_held. Idempotent; ignores anything that doesn't match. */
export function markPaymentHeld(session: CompletedSession): Deal | null {
  const deal = getDeal(session.metadata?.dealId ?? "");
  if (!deal || deal.status !== "awaiting_payment" || deal.stripeSessionId !== session.id || session.amount_total !== deal.price) return null;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi) return null;

  const held = saveDeal({ ...deal, status: "payment_held", paymentIntentId: pi, handoffToken: randomBytes(32).toString("base64url") });
  addEvent(deal.listingId, "payment_held", `${gbp(deal.price)} from ${deal.buyerName} is held safely until handoff`, {
    dealId: deal.id,
    buyerName: deal.buyerName,
  });
  tellBuyer(
    deal,
    `Payment received — ${gbp(deal.price)} is held safely and only released to the seller at handoff. Choose how you'd like to get it: pick it up in person, or have it sent to a parcel locker.`,
    `held-${deal.id}`,
  );
  return held;
}

/** Buyer scanned the QR: capture the held payment and complete the sale. Token is single use. */
export async function captureByToken(token: string, stripe: StripeLike = getStripe()): Promise<Deal | null> {
  const deal = readDb().deals.find((d) => d.handoffToken === token && d.status === "payment_held");
  if (!deal || !deal.paymentIntentId) return null;

  // Burn the token before the network call so a double scan can't capture twice.
  saveDeal({ ...deal, handoffToken: undefined });
  try {
    return await completeSale({ ...deal, handoffToken: undefined }, stripe, `Handed over to ${deal.buyerName}`);
  } catch (err) {
    saveDeal(deal);
    throw err;
  }
}

/**
 * Captures the held payment and completes the sale: deal completed, listing sold, events,
 * simulated payout, and delisted on every platform. Shared by QR pickup and locker delivery.
 * Throws (and changes nothing) if Stripe capture fails.
 */
export async function completeSale(deal: Deal, stripe: StripeLike, handedOverMessage: string): Promise<Deal> {
  await stripe.paymentIntents.capture(deal.paymentIntentId!);

  const done = saveDeal({ ...deal, status: "completed" });
  const listing = getListing(deal.listingId);
  if (listing) saveListing({ ...listing, status: "sold" });
  const data = { dealId: deal.id, buyerName: deal.buyerName };
  addEvent(deal.listingId, "handed_over", handedOverMessage, data);
  addEvent(deal.listingId, "payment_captured", `${gbp(deal.price)} captured from escrow`, data);
  addEvent(deal.listingId, "sold", `Sold to ${deal.buyerName} for ${gbp(deal.price)}`, { ...data, price: deal.price });
  addEvent(deal.listingId, "payout_sent", `Payout of ${gbp(deal.price)} sent to ${listing?.sellerName ?? "the seller"} (simulated)`, {
    ...data,
    simulated: true,
  });
  if (listing) delistEverywhere(listing);
  tellBuyer(deal, "Handover confirmed and the payment has been released to the seller. Enjoy!", `done-${deal.id}`);
  return done;
}

const CANCELLABLE: ReadonlySet<Deal["status"]> = new Set(["awaiting_seller_approval", "approved", "awaiting_payment", "payment_held"]);

/** Handoff didn't happen: release the held payment (or kill the unpaid link) and cancel the deal. */
export async function cancelDeal(dealId: string, stripe: StripeLike = getStripe()): Promise<boolean> {
  const deal = getDeal(dealId);
  if (!deal || !CANCELLABLE.has(deal.status)) return false;

  if (deal.status === "payment_held" && deal.paymentIntentId) {
    await stripe.paymentIntents.cancel(deal.paymentIntentId);
  } else if (deal.status === "awaiting_payment" && deal.stripeSessionId) {
    await stripe.checkout.sessions.expire(deal.stripeSessionId).catch(() => {}); // already expired is fine
  }

  saveDeal({ ...deal, status: "cancelled", handoffToken: undefined });
  addEvent(deal.listingId, "payment_cancelled", `Deal with ${deal.buyerName} cancelled${deal.status === "payment_held" ? "; held payment released" : ""}`, {
    dealId,
    buyerName: deal.buyerName,
  });
  tellBuyer(deal, "This deal was cancelled and any held payment has been released — you haven't been charged.", `cancelled-${deal.id}`);
  return true;
}
