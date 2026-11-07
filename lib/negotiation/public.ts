import type { Deal, Listing } from "@/lib/types";

// The ONLY shape of a listing or deal that may reach the buyer side or the negotiation model.
// Allowlist, so new secret fields on Listing never leak by default.

export type PublicListing = Pick<Listing, "id" | "sellerName" | "item" | "imageUrl" | "description" | "listPrice" | "status">;
export type PublicDeal = Pick<Deal, "id" | "listingId" | "price" | "status">;

export function toPublicListing(l: Listing): PublicListing {
  return {
    id: l.id,
    sellerName: l.sellerName,
    item: l.item,
    imageUrl: l.imageUrl,
    description: l.description,
    listPrice: l.listPrice,
    status: l.status,
  };
}

export function toPublicDeal(d: Deal): PublicDeal {
  return { id: d.id, listingId: d.listingId, price: d.price, status: d.status };
}
