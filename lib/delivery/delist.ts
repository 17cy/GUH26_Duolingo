import { addEvent } from "@/lib/events";
import type { Listing, Platform } from "@/lib/types";

// SPEC "Delisting (mocked)": on completed, one delisted event per platform the listing was on.

const PLATFORM_NAME: Record<Platform, string> = { ebay: "eBay", vinted: "Vinted", donedeal: "DoneDeal" };

export function delistEverywhere(listing: Listing): void {
  for (const platform of listing.platforms) {
    addEvent(listing.id, "delisted", `Delisted from ${PLATFORM_NAME[platform]} (DEMO)`, { platform });
  }
}
