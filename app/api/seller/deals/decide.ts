import { addEvent } from "@/lib/events";
import { getDeal, saveDeal } from "@/lib/store";

// SPEC.md "Seller approval": only flips the status and logs the event.
// Person B's code reacts to "approved" (payment link) and "rejected" (tells the buyer).
export async function decideDeal(dealId: string, decision: "approved" | "rejected"): Promise<Response> {
  const deal = getDeal(dealId);
  if (!deal) return Response.json({ error: "Deal not found" }, { status: 404 });
  if (deal.status !== "awaiting_seller_approval") {
    return Response.json({ error: `This deal is already ${deal.status}` }, { status: 409 });
  }

  const updated = saveDeal({ ...deal, status: decision });
  const price = `£${(deal.price / 100).toFixed(2)}`;
  addEvent(
    deal.listingId,
    decision === "approved" ? "deal_approved" : "deal_rejected",
    decision === "approved" ? `Seller approved ${price} deal with ${deal.buyerName}` : `Seller rejected ${price} offer from ${deal.buyerName}`,
    { dealId: deal.id, price: deal.price },
  );
  return Response.json({ deal: updated });
}
