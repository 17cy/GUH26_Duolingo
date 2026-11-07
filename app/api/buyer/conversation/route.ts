import { BuyerName, buyerConversation, buyerVisibleListing } from "@/lib/negotiation/conversation";

export const runtime = "nodejs";

// GET /api/buyer/conversation?listingId=...&buyer=... — polled by the buyer page every 2s.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const listing = buyerVisibleListing(url.searchParams.get("listingId") ?? "");
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
  const buyer = BuyerName.safeParse(url.searchParams.get("buyer") ?? "");
  if (!buyer.success) return Response.json({ error: "Enter your name to start chatting" }, { status: 400 });
  return Response.json(await buyerConversation(listing, buyer.data));
}
