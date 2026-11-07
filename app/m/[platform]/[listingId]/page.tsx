import { notFound } from "next/navigation";
import { getListing } from "@/lib/store";
import type { Condition, Platform } from "@/lib/types";
import MarketplaceChat from "./MarketplaceChat";

// SPEC.md "Posting (mocked)": a plain mock marketplace page, clearly DEMO, no real logos or branding.
// Public data only: never render floorPrice (or anything else not listed below).

export const dynamic = "force-dynamic";

const PLATFORM_NAME: Record<Platform, string> = { ebay: "eBay", vinted: "Vinted", donedeal: "DoneDeal" };
const CONDITION_LABEL: Record<Condition, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };

export default async function MockMarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; listingId: string }>;
  searchParams: Promise<{ chat?: string; paid?: string }>;
}) {
  const { platform, listingId } = await params;
  const { chat, paid } = await searchParams;
  // Stripe Checkout returns here with ?chat=1 (&paid=1 on success), so reopen the buyer's chat.
  const returnedFromCheckout = chat === "1" ? (paid === "1" ? "paid" : "cancelled") : undefined;
  if (!(platform in PLATFORM_NAME)) notFound();
  const name = PLATFORM_NAME[platform as Platform];

  const listing = getListing(listingId);
  const live = listing && listing.platforms.includes(platform as Platform) && listing.status === "posted";

  return (
    <div className="min-h-dvh bg-neutral-100 font-sans text-neutral-900">
      <div role="note" className="bg-amber-300 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
        DEMO — mock marketplace. This is not the real {name} site.
      </div>
      <div className="mx-auto max-w-2xl p-4">
        <p className="mb-4 text-sm text-neutral-500">Mock {name} listing</p>

        {!listing || !live ? (
          <div className="rounded border border-neutral-300 bg-white p-6 text-center">
            <p className="font-semibold">{listing?.status === "sold" ? "This item has sold." : "This listing isn't available."}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-neutral-300 bg-white">
            {listing.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.imageUrl} alt={listing.item.name} className="max-h-96 w-full bg-neutral-200 object-contain" />
            )}
            <div className="space-y-3 p-4">
              <h1 className="text-2xl font-semibold">{listing.item.name}</h1>
              {listing.listPrice !== undefined && <p className="text-3xl font-bold">£{(listing.listPrice / 100).toFixed(2)}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-neutral-500">Condition</dt>
                <dd>{CONDITION_LABEL[listing.item.condition]}</dd>
                {listing.item.defects.length > 0 && (
                  <>
                    <dt className="text-neutral-500">Notes</dt>
                    <dd>{listing.item.defects.join(", ")}</dd>
                  </>
                )}
                <dt className="text-neutral-500">Seller</dt>
                <dd>{listing.sellerName}</dd>
              </dl>
              {listing.description && <p className="text-sm text-neutral-700">{listing.description}</p>}
              <p className="text-xs text-neutral-500">Messages are answered by Selly, an AI assistant selling on the owner&apos;s behalf.</p>
              <MarketplaceChat
                listingId={listing.id}
                sellerName={listing.sellerName}
                platform={platform as Platform}
                platformName={name}
                returnedFromCheckout={returnedFromCheckout}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
