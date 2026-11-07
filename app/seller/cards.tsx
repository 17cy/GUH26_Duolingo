"use client";

import { useState } from "react";
import type { PriceEstimate } from "@/lib/pricing/estimate";
import { netPayout } from "@/lib/pricing/payout";
import type { TrendAdvice } from "@/lib/pricing/trend";
import type { Item, Listing, Style } from "@/lib/types";

// Design tokens from the Selly design (Selly Chat.html).
// cream #F6F0E6 · card #FBF8F2 · ink #1E2B36 · bubble ink #14212B · muted #5F6B73 · blue #BAD8EC · deep blue #3B6A8C
export const SERIF = "font-[family-name:var(--font-serif),Georgia,serif]";
export const LINE = "border-[rgba(30,43,54,0.1)]";
const CARD = `rounded-[20px] border ${LINE} bg-[#FBF8F2] p-5 shadow-[0_24px_48px_rgba(59,106,140,0.12)]`;
const PRIMARY_BTN = "h-12 rounded-3xl bg-[#BAD8EC] px-5 text-sm font-medium tracking-[0.03em] text-[#14212B] hover:bg-[#A8CBE0] disabled:opacity-50";
const SECONDARY_BTN = "h-12 rounded-3xl border border-[rgba(30,43,54,0.22)] px-5 text-sm hover:bg-[#F6F0E6] disabled:opacity-50";

export function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

// "113" or "113.50" → pence; anything else → undefined.
function parsePounds(s: string): number | undefined {
  const m = s.trim().replace(/^£/, "").match(/^(\d{1,6})(?:\.(\d{1,2}))?$/);
  if (!m) return undefined;
  const pence = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return pence > 0 ? pence : undefined;
}

const roundPound = (pence: number) => Math.round(pence / 100) * 100;

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.24em] text-[#3B6A8C]">{children}</div>;
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.22em] text-[#5F6B73]">{children}</div>;
}

function Row({ label, children, last }: { label: React.ReactNode; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-t ${last ? "border-b" : ""} ${LINE} py-3 text-sm`}>
      <span className="shrink-0 text-[#5F6B73]">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

const CONDITION_LABEL: Record<Item["condition"], string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };

// Confidence is how sure the model is of the exact product (not just the type of item).
function confidenceNote(confidence: number): string {
  if (confidence >= 0.85) return "I'm confident this is the exact model.";
  if (confidence >= 0.6) return "The brand and type are clear, but the exact model is a best guess. A close-up of the label or model number would help.";
  return "I'm not sure what this is exactly. Try a clearer photo or tell me the model.";
}

export function ItemCard({ listing }: { listing: Listing }) {
  const { item } = listing;
  const brandModel = [item.brand, item.model].filter(Boolean).join(" · ");
  const pct = Math.round(item.confidence * 100);
  return (
    <div className={CARD}>
      <CardLabel>{listing.status === "draft" ? "Draft listing" : `Listing · ${listing.status}`}</CardLabel>
      <div className={`${SERIF} mt-1.5 text-[28px] font-medium leading-tight`}>{item.name}</div>
      <div className="mt-3.5 flex flex-col">
        {brandModel && <Row label="Brand / model">{brandModel}</Row>}
        <Row label="Condition">{CONDITION_LABEL[item.condition]}</Row>
        <Row label="Defects">{item.defects.length ? item.defects.join(", ") : "None spotted"}</Row>
        {listing.wantedPrice !== undefined && (
          <Row label="Your price">
            <span className={`${SERIF} text-[22px] font-medium leading-none`}>{formatPounds(listing.wantedPrice)}</span>
          </Row>
        )}
        <div className={`border-t border-b ${LINE} py-3 text-sm`}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[#5F6B73]">Match confidence</span>
            <div className="h-1 flex-1 rounded-full bg-[rgba(30,43,54,0.1)]">
              <div className="h-1 rounded-full bg-[#3B6A8C]" style={{ width: `${pct}%` }} />
            </div>
            <span>{pct}%</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#5F6B73]">{confidenceNote(item.confidence)}</p>
        </div>
      </div>
    </div>
  );
}

function wantedNote(estimate: PriceEstimate): string | null {
  const w = estimate.wanted;
  if (!w) return null;
  if (w.position === "above")
    return `Your ${formatPounds(w.price)} is above the market range. I'd suggest listing at ${formatPounds(w.suggestedPrice!)} so it actually sells.`;
  if (w.position === "below") return `Your ${formatPounds(w.price)} is below the market range, so it should sell quickly.`;
  return `Your ${formatPounds(w.price)} is in line with the market.`;
}

export function PricingCard({
  estimate,
  trend,
  onChoose,
  chosen,
}: {
  estimate: PriceEstimate;
  trend: TrendAdvice;
  onChoose?: (choice: "sell_now" | "wait") => void;
  chosen?: boolean;
}) {
  const note = wantedNote(estimate);
  return (
    <div className={CARD}>
      <CardLabel>Market price</CardLabel>
      <div className="mt-3 grid grid-cols-3 text-center">
        {(
          [
            ["Low", estimate.low],
            ["Typical", estimate.typical],
            ["High", estimate.high],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-[#5F6B73]">{label}</div>
            <div className={`${SERIF} text-[26px] font-medium ${label === "Typical" ? "text-[#1E2B36]" : "text-[#5F6B73]"}`}>{formatPounds(value)}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-[#5F6B73]">
        From {estimate.compsCount} similar {estimate.source === "item" ? "listings" : "items in this category"} (asking prices), adjusted for
        condition.
      </p>
      {note && <p className={`mt-3 border-t ${LINE} pt-3 text-sm leading-relaxed`}>{note}</p>}

      <div className={`mt-3 border-t ${LINE} pt-3`}>
        <div className="flex items-center justify-between">
          <CardLabel>Timing</CardLabel>
          <span className="text-[11px] text-[#5F6B73]">{trend.label}</span>
        </div>
        <p className={`${SERIF} mt-1.5 text-xl leading-snug`}>
          {trend.message}
          {trend.advice === "sell_now" && " Sell now, or wait?"}
        </p>
      </div>
      {onChoose && !chosen && (
        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={() => onChoose("sell_now")} className={`${PRIMARY_BTN} flex-1`}>
            Sell now
          </button>
          <button type="button" onClick={() => onChoose("wait")} className={`${SECONDARY_BTN} flex-[0_0_96px]`}>
            Wait
          </button>
        </div>
      )}
    </div>
  );
}

const PLATFORM_LINKS: { platform: string; name: string }[] = [
  { platform: "ebay", name: "eBay" },
  { platform: "vinted", name: "Vinted" },
  { platform: "donedeal", name: "DoneDeal" },
];

// "Post everywhere" (mocked: no real platform calls). Once posted, links to the DEMO pages and the dashboard.
export function PostCard({ listing, onPosted }: { listing: Listing; onPosted?: (listing: Listing) => void }) {
  const [current, setCurrent] = useState(listing);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/seller/listings/${listing.id}/post`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't post the listing");
      setCurrent(data.listing as Listing);
      onPosted?.(data.listing as Listing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post the listing");
    }
    setPosting(false);
  }

  const posted = current.status !== "draft" && current.status !== "priced";
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <CardLabel>{posted ? "Live on" : "Post everywhere"}</CardLabel>
        <span className="rounded-full border border-[rgba(30,43,54,0.22)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5F6B73]">Demo</span>
      </div>
      {posted ? (
        <>
          <div className="mt-2 flex flex-col">
            {PLATFORM_LINKS.map((p, i) => (
              <a
                key={p.platform}
                href={`/m/${p.platform}/${current.id}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between border-t ${i === PLATFORM_LINKS.length - 1 ? "border-b" : ""} ${LINE} py-3 text-sm hover:text-[#3B6A8C]`}
              >
                <span>{p.name} (mock page)</span>
                <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
          <a href={`/dashboard/${current.id}`} className={`${PRIMARY_BTN} mt-4 flex w-full items-center justify-center`}>
            Open dashboard
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-[#5F6B73]">
            I&apos;ll list it on eBay, Vinted and DoneDeal at {formatPounds(current.listPrice ?? 0)}. In this demo the posts are simulated, nothing goes to the real sites.
          </p>
          {error && <p className="mt-3 text-sm text-[#9B3B2E]">{error}</p>}
          <button type="button" onClick={post} disabled={posting} className={`${PRIMARY_BTN} mt-4 w-full`}>
            {posting ? "Posting…" : "Post everywhere"}
          </button>
        </>
      )}
    </div>
  );
}

const STYLES: { value: Style; label: string; hint: string }[] = [
  { value: "firm", label: "Firm", hint: "Small discounts only" },
  { value: "flexible", label: "Flexible", hint: "Haggles a bit" },
  { value: "quick", label: "Quick", hint: "Sells fast, bigger discounts" },
];

function PayoutBreakdown({ listPrice, style, category }: { listPrice: number; style: Style; category: Item["category"] }) {
  const p = netPayout(listPrice, style, category);
  const lo = Math.round(p.locker.percentOfList);
  const hi = Math.round(p.pickup.percentOfList);
  return (
    <div className={`mt-3 border-t ${LINE} pt-3 text-sm`}>
      <CardLabel>Your payout</CardLabel>
      <p className={`${SERIF} mt-1.5 text-xl leading-snug`}>
        You&apos;ll likely receive about {lo === hi ? lo : `${lo}–${hi}`}% of your list price after negotiation and fees.
      </p>
      <div className="mt-2 flex flex-col">
        <Row label="Expected deal after negotiation">{formatPounds(p.expectedDeal)}</Row>
        <Row label="Payment fee">−{formatPounds(p.paymentFee)}</Row>
        <Row label="Pickup in person">
          <span className="font-medium">{formatPounds(p.pickup.net)}</span>
        </Row>
        <Row label={`Locker delivery (${p.locker.size}, −${formatPounds(p.locker.shipping)})`} last>
          <span className="font-medium">{formatPounds(p.locker.net)}</span>
        </Row>
      </div>
    </div>
  );
}

export function ConfirmCard({
  listing,
  defaultListPrice,
  onConfirmed,
}: {
  listing: Listing;
  defaultListPrice: number;
  onConfirmed: (listing: Listing) => void;
}) {
  const editable = listing.status === "draft" || listing.status === "priced";
  const startList = listing.listPrice ?? defaultListPrice;
  const [listText, setListText] = useState(String(startList / 100));
  const [floorText, setFloorText] = useState(String((listing.floorPrice ?? roundPound(startList * 0.8)) / 100));
  const [floorTouched, setFloorTouched] = useState(listing.floorPrice !== undefined);
  const [style, setStyle] = useState<Style>(listing.style);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const listPrice = parsePounds(listText);
  const floorPrice = parsePounds(floorText);
  const invalid =
    listPrice === undefined
      ? "Enter a list price like 113 or 113.50"
      : floorPrice === undefined
        ? "Enter a floor price like 90"
        : floorPrice > listPrice
          ? "The floor can't be above the list price"
          : null;

  function changeList(v: string) {
    setListText(v);
    const p = parsePounds(v);
    if (!floorTouched && p !== undefined) setFloorText(String(roundPound(p * 0.8) / 100)); // default floor: 80% of list
  }

  async function confirm() {
    if (invalid || listPrice === undefined || floorPrice === undefined) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/seller/listings/${listing.id}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listPrice, floorPrice, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the price");
      setDone(true);
      onConfirmed(data.listing as Listing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the price");
    }
    setSaving(false);
  }

  const locked = !editable || done;
  const inputCls = `${SERIF} h-11 w-full rounded-xl border border-[rgba(30,43,54,0.22)] bg-white/60 pl-7 pr-2 text-[22px] outline-none focus:border-[#3B6A8C] disabled:opacity-60`;

  return (
    <div className={CARD}>
      <CardLabel>Confirm your price</CardLabel>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-[#5F6B73]">List price</span>
          <div className="relative mt-1">
            <span className={`${SERIF} absolute left-2.5 top-1/2 -translate-y-1/2 text-[22px]`}>£</span>
            <input value={listText} onChange={(e) => changeList(e.target.value)} inputMode="decimal" disabled={locked} className={inputCls} />
          </div>
        </label>
        <label className="text-sm">
          <span className="text-[#5F6B73]">Lowest you&apos;ll accept</span>
          <div className="relative mt-1">
            <span className={`${SERIF} absolute left-2.5 top-1/2 -translate-y-1/2 text-[22px]`}>£</span>
            <input
              value={floorText}
              onChange={(e) => {
                setFloorText(e.target.value);
                setFloorTouched(true);
              }}
              inputMode="decimal"
              disabled={locked}
              className={inputCls}
            />
          </div>
        </label>
      </div>
      <p className="mt-1.5 text-xs text-[#5F6B73]">Buyers never see your lowest price. Selly won&apos;t go below it.</p>

      <div className="mt-4 text-sm text-[#5F6B73]">Negotiation style</div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={locked}
            onClick={() => setStyle(s.value)}
            className={`rounded-2xl border px-2 py-2 text-left disabled:opacity-60 ${
              style === s.value ? "border-[#3B6A8C] bg-[#BAD8EC]/50" : "border-[rgba(30,43,54,0.22)]"
            }`}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-[11px] leading-tight text-[#5F6B73]">{s.hint}</div>
          </button>
        ))}
      </div>

      {listPrice !== undefined && <PayoutBreakdown listPrice={listPrice} style={style} category={listing.item.category} />}

      {(invalid || error) && !locked && <p className="mt-3 text-sm text-[#9B3B2E]">{error ?? invalid}</p>}
      {!editable && !done && <p className="mt-3 text-sm text-[#5F6B73]">This listing is already {listing.status}, so its price can&apos;t be changed here.</p>}
      {editable && !done && (
        <button type="button" onClick={confirm} disabled={!!invalid || saving} className={`${PRIMARY_BTN} mt-4 w-full`}>
          {saving ? "Saving…" : "Confirm price"}
        </button>
      )}
    </div>
  );
}
