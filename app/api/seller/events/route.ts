import { listEvents } from "@/lib/events";
import { getListing, listMessages, readDb } from "@/lib/store";

// Seller dashboard poll (every 2s). Seller-side only: includes floorPrice. Never reuse for the buyer side.
export async function GET(req: Request) {
  const listingId = new URL(req.url).searchParams.get("listingId");
  if (!listingId) return Response.json({ error: "listingId is required" }, { status: 400 });

  const listing = getListing(listingId);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  const deals = readDb().deals.filter((d) => d.listingId === listingId || d.bundleListingIds?.includes(listingId));
  return Response.json({ listing, events: listEvents(listingId), deals, messages: listMessages(listingId) });
}
