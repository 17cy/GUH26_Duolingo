import { syncTracking } from "@/lib/delivery/handoff";
import { listEvents } from "@/lib/events";
import { syncPaymentFromStripe } from "@/lib/payments/stripe";
import { dealNet } from "@/lib/pricing/payout";
import { getListing, listMessages, readDb } from "@/lib/store";

// Seller dashboard poll (every 2s). Seller-side only: includes floorPrice. Never reuse for the buyer side.
export async function GET(req: Request) {
  const listingId = new URL(req.url).searchParams.get("listingId");
  if (!listingId) return Response.json({ error: "listingId is required" }, { status: 400 });

  const listing = getListing(listingId);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  // Payments (if the webhook is late) and DEMO locker tracking advance lazily on polls; let the
  // seller's poll move them on too, so the seller hears even if the buyer closed their tab.
  for (const d of readDb().deals) {
    if (d.listingId !== listingId) continue;
    if (d.status === "awaiting_payment") await syncPaymentFromStripe(d.id).catch((err) => console.error("payment sync failed", err));
    if (d.status === "in_delivery") await syncTracking(d.id).catch((err) => console.error("tracking sync failed", err));
  }

  const db = readDb();
  const deals = db.deals.filter((d) => d.listingId === listingId || d.bundleListingIds?.includes(listingId));

  // Savings goal: every completed sale by this seller, across all their listings.
  const completedSales = db.deals.flatMap((d) => {
    const l = db.listings.find((x) => x.id === d.listingId);
    if (d.status !== "completed" || !l || l.sellerName !== listing.sellerName) return [];
    return [{ dealId: d.id, listingId: l.id, itemName: l.item.name, price: d.price, net: dealNet(d.price, l.item.category, d.handoffMethod) }];
  });

  return Response.json({ listing, events: listEvents(listingId), deals, messages: listMessages(listingId), completedSales });
}
