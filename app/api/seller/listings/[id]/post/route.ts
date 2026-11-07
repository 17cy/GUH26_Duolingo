import { addEvent } from "@/lib/events";
import { getListing, saveListing } from "@/lib/store";
import type { Platform } from "@/lib/types";

// SPEC.md "Posting (mocked)": no real API calls. One "posted" event per platform.
const PLATFORMS: Platform[] = ["ebay", "vinted", "donedeal"];
const PLATFORM_NAME: Record<Platform, string> = { ebay: "eBay", vinted: "Vinted", donedeal: "DoneDeal" };

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const listing = getListing((await params).id);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "priced") {
    return Response.json({ error: `Only a priced listing can be posted (this one is ${listing.status})` }, { status: 409 });
  }

  const updated = saveListing({ ...listing, status: "posted", platforms: PLATFORMS });
  for (const platform of PLATFORMS) {
    addEvent(listing.id, "posted", `Posted to ${PLATFORM_NAME[platform]} (DEMO)`, { platform });
  }
  return Response.json({ listing: updated });
}
