import { z } from "zod";
import { chooseLocker, choosePickup } from "@/lib/delivery/handoff";
import { BuyerName, buyerConversation, buyerVisibleListing } from "@/lib/negotiation/conversation";
import { readDb } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("method", [
  z.object({ listingId: z.string().min(1).max(64), buyerName: BuyerName, method: z.literal("pickup"), slot: z.number().int().min(0).max(2) }),
  z.object({ listingId: z.string().min(1).max(64), buyerName: BuyerName, method: z.literal("locker") }),
]);

// POST /api/buyer/handoff — after payment is held, the buyer picks pickup (with a slot) or locker.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  const { listingId, buyerName } = body.data;

  const listing = buyerVisibleListing(listingId);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  const deal = readDb()
    .deals.filter((d) => d.listingId === listingId && d.buyerName === buyerName && d.status === "payment_held")
    .at(-1);
  const ok = deal && (body.data.method === "pickup" ? choosePickup(deal.id, body.data.slot) : chooseLocker(deal.id));
  if (!ok) return Response.json({ error: "Delivery can only be chosen once, after payment is held" }, { status: 409 });

  return Response.json(await buyerConversation(listing, buyerName));
}
