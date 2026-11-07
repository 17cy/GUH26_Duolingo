import { listEvents } from "@/lib/events";
import { dealNet } from "@/lib/pricing/payout";
import { getListing, listMessages, readDb } from "@/lib/store";

// Seller dashboard poll (every 2s). Seller-side only: includes floorPrice. Never reuse for the buyer side.
export async function GET(req: Request) {
  const listingId = new URL(req.url).searchParams.get("listingId");
  if (!listingId) return Response.json({ error: "listingId is required" }, { status: 400 });

  const listing = getListing(listingId);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

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
