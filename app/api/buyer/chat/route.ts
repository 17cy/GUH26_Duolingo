import { z } from "zod";
import { handleBuyerMessage } from "@/lib/negotiation/agent";
import { BuyerName, buyerConversation, buyerVisibleListing } from "@/lib/negotiation/conversation";

export const runtime = "nodejs";

const Body = z.object({
  listingId: z.string().min(1).max(64),
  buyerName: BuyerName,
  text: z.string().trim().min(1).max(1000),
});

// SPEC "Security": max 1 buyer message per second per buyer (in-memory).
const lastMessageAt = new Map<string, number>();

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });
  const { listingId, buyerName, text } = body.data;

  const listing = buyerVisibleListing(listingId);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  const key = `${listingId}:${buyerName}`;
  const now = Date.now();
  if (now - (lastMessageAt.get(key) ?? 0) < 1000) {
    return Response.json({ error: "You're sending messages too fast — wait a second." }, { status: 429 });
  }
  lastMessageAt.set(key, now);

  await handleBuyerMessage(listing, buyerName, text);
  return Response.json(buyerConversation(listing, buyerName));
}
