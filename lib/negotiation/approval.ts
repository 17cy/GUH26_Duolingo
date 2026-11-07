import type { DealStatus } from "@/lib/types";

// SPEC "Seller approval": the seller pre-approves when they confirm their list and floor price, so a
// deal agreed at or above the floor goes straight to "approved" (payment link next). policy.ts never
// accepts below the floor; if a price ever were below it (or no floor is set), ask the seller instead.
export function agreedDealStatus(pricePence: number, floorPrice: number | undefined): DealStatus {
  return floorPrice !== undefined && pricePence >= floorPrice ? "approved" : "awaiting_seller_approval";
}
