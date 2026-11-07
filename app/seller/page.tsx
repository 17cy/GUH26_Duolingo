"use client";

import { useEffect, useRef, useState } from "react";
import { estimatePrice, type PriceEstimate } from "@/lib/pricing/estimate";
import { trendAdvice, type TrendAdvice } from "@/lib/pricing/trend";
import type { Listing } from "@/lib/types";
import { ConfirmCard, formatPounds, ItemCard, Label, LINE, PostCard, PricingCard, SERIF } from "./cards";

type ChatEntry =
  | { from: "seller"; text: string; photoUrl?: string }
  | {
      from: "agent";
      text: string;
      listing?: Listing;
      pricing?: { estimate: PriceEstimate; trend: TrendAdvice };
      confirm?: { defaultListPrice: number };
      post?: true;
      error?: { retry?: { photo: File; photoUrl: string; text: string } };
    };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // same limit as /api/seller/identify
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IDENTIFY_TIMEOUT_MS = 60_000;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle" aria-hidden>
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5F6B73]" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

const GREETING: ChatEntry = {
  from: "agent",
  text: "Hi! Tap + to add a photo of what you'd like to sell, and tell me a bit about it. Add a price if you have one in mind, e.g. “want £67”.",
};

// Starting list price for the confirm step: the seller's own price unless it's above market.
function defaultListPrice(listing: Listing, estimate: PriceEstimate | null): number {
  if (!estimate) return listing.wantedPrice ?? 0;
  const w = estimate.wanted;
  if (!w) return estimate.typical;
  return w.position === "above" ? w.suggestedPrice! : w.price;
}

function PlusIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default function SellerPage() {
  const [chat, setChat] = useState<ChatEntry[]>([GREETING]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, busy]);

  // /seller?listing=<id> reopens an existing listing (e.g. the seed item) in the chat.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("listing");
    if (!id) return;
    fetch(`/api/seller/listings/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => (data.listing ? showListing(data.listing as Listing, "Here's your listing.") : say(data.error ?? "Listing not found.")))
      .catch(() => say("Couldn't load that listing."));
  }, []);

  function say(text: string) {
    setChat((c) => [...c, { from: "agent", text }]);
  }

  function sayError(text: string, retry?: { photo: File; photoUrl: string; text: string }) {
    setChat((c) => [...c, { from: "agent", text, error: { retry } }]);
  }

  // Picks up where the listing is: a draft gets pricing, a priced one gets "Post everywhere",
  // a live one gets its links. Finished steps are never offered again.
  function showListing(listing: Listing, intro: string) {
    const next = ((): ChatEntry | null => {
      if (listing.status === "draft") {
        const estimate = estimatePrice(listing.item, { wantedPrice: listing.wantedPrice });
        return estimate
          ? { from: "agent", text: "Here's what similar items go for.", listing, pricing: { estimate, trend: trendAdvice(listing.item.category) } }
          : { from: "agent", text: "I couldn't find similar items to compare, so set a price you're happy with.", listing, confirm: { defaultListPrice: defaultListPrice(listing, null) } };
      }
      if (listing.status === "priced") return { from: "agent", text: "It's priced and ready to post.", listing, post: true };
      if (listing.status === "posted") return { from: "agent", text: "It's live. Buyers can message it from any of these pages.", listing, post: true };
      return { from: "agent", text: listing.status === "sold" ? "This one has sold." : "This listing has been withdrawn." };
    })();
    setChat((c) => [...c, { from: "agent", text: intro, listing }, ...(next ? [next] : [])]);
  }

  function choose(entryIndex: number, choice: "sell_now" | "wait") {
    const entry = chat[entryIndex];
    if (entry.from !== "agent" || !entry.listing || !entry.pricing) return;
    const { listing, pricing } = entry;
    setChat((c) => [
      ...c,
      { from: "seller", text: choice === "sell_now" ? "Sell now" : "Wait" },
      choice === "sell_now"
        ? { from: "agent", text: "Great. Confirm your price and how hard I should negotiate.", listing, confirm: { defaultListPrice: defaultListPrice(listing, pricing.estimate) } }
        : {
            from: "agent",
            text: `No problem, your draft is saved. ${pricing.trend.waitUntil ? `Check back around ${pricing.trend.waitUntil}, or` : "Tap"} “Sell now” above whenever you're ready.`,
          },
    ]);
  }

  function priced(listing: Listing) {
    setChat((c) => [
      ...c,
      {
        from: "agent",
        text: `Done. Listed at ${formatPounds(listing.listPrice!)} with a ${formatPounds(listing.floorPrice!)} floor that buyers never see. Ready to post it everywhere?`,
        listing,
        post: true,
      },
    ]);
  }

  function posted() {
    say("Posted. I'll handle buyers from here, and you can follow everything on your dashboard.");
  }

  function pickPhoto(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (file && !PHOTO_TYPES.includes(file.type)) {
      sayError("That file isn't a photo I can read. Use a JPEG, PNG, WebP or GIF.");
      return;
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      sayError(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under 5 MB.`);
      return;
    }
    setPhoto(file ?? null);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function newListing() {
    if (busy) return;
    setChat([GREETING]);
    pickPhoto(undefined);
    setText("");
    window.history.replaceState(null, "", "/seller");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (!photo && !text.trim())) return;

    setChat((c) => [...c, { from: "seller", text, photoUrl: photoPreview ?? undefined }]);
    setText("");

    if (!photo) {
      say("Tap + to add a photo of the item and I'll identify it.");
      return;
    }

    const attempt = { photo, photoUrl: photoPreview ?? "", text };
    setPhoto(null);
    setPhotoPreview(null);
    await identify(attempt);
  }

  async function identify(attempt: { photo: File; photoUrl: string; text: string }) {
    setBusy(true);
    const form = new FormData();
    form.append("photo", attempt.photo);
    form.append("text", attempt.text);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), IDENTIFY_TIMEOUT_MS);
    try {
      const res = await fetch("/api/seller/identify", { method: "POST", body: form, signal: abort.signal });
      const data = await res.json().catch(() => ({}));
      if (res.ok) showListing(data.listing as Listing, "Here's what I see.");
      else sayError(data.error ?? "Something went wrong on my side.", res.status >= 500 ? attempt : undefined);
    } catch {
      sayError(abort.signal.aborted ? "That took too long. Check your connection and try again." : "I couldn't reach the server. Check your connection.", attempt);
    }
    clearTimeout(timer);
    setBusy(false);
  }

  function retry(attempt: { photo: File; photoUrl: string; text: string }) {
    if (busy) return;
    setChat((c) => [...c, { from: "seller", text: attempt.text ? `${attempt.text} (retry)` : "Retry", photoUrl: attempt.photoUrl }]);
    identify(attempt);
  }

  // Each pricing card only offers Sell now / Wait until "Sell now" has been chosen for that listing.
  const sellNowChosen = new Set(chat.flatMap((m) => (m.from === "agent" && m.confirm && m.listing ? [m.listing.id] : [])));

  return (
    <div className="min-h-dvh bg-[#F6F0E6] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[#1E2B36]">
      <div className="mx-auto flex h-dvh max-w-[430px] flex-col">
        <header className={`flex items-center justify-between border-b ${LINE} py-3 pl-5 pr-3`}>
          <div className="flex items-center gap-3">
            <h1 className={`${SERIF} text-[32px] font-medium tracking-[0.05em]`}>Selly</h1>
            <span className="h-px w-7 bg-[#3B6A8C]" />
          </div>
          <button
            type="button"
            onClick={newListing}
            aria-label="New listing"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(30,43,54,0.22)] hover:bg-[#FBF8F2]"
          >
            <PlusIcon size={18} />
          </button>
        </header>

        <section aria-label="Conversation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-4 pt-6">
          {chat.map((m, i) =>
            m.from === "seller" ? (
              <div key={i} className="flex w-fit min-w-24 max-w-[280px] flex-col gap-2.5 self-end rounded-[20px] bg-[#BAD8EC] p-3">
                {m.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt="Photo of the item" className="max-h-56 w-full rounded-xl object-cover" />
                )}
                {m.text && <div className="px-1 pb-0.5 text-[15px] leading-[1.55] text-[#14212B]">{m.text}</div>}
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-2.5">
                <Label>Selly</Label>
                <p role={m.error ? "alert" : undefined} className={`${SERIF} text-[22px] leading-[1.4] ${m.error ? "text-[#9B3B2E]" : ""}`}>
                  {m.text}
                </p>
                {m.error?.retry && (
                  <button
                    type="button"
                    onClick={() => retry(m.error!.retry!)}
                    disabled={busy}
                    className="h-11 self-start rounded-3xl border border-[rgba(30,43,54,0.22)] px-5 text-sm hover:bg-[#FBF8F2] disabled:opacity-50"
                  >
                    Try again
                  </button>
                )}
                {m.listing && !m.pricing && !m.confirm && !m.post && <ItemCard listing={m.listing} />}
                {m.listing && m.post && <PostCard listing={m.listing} onPosted={posted} />}
                {m.listing && m.pricing && (
                  <PricingCard
                    estimate={m.pricing.estimate}
                    trend={m.pricing.trend}
                    chosen={sellNowChosen.has(m.listing.id)}
                    onChoose={(choice) => choose(i, choice)}
                  />
                )}
                {m.listing && m.confirm && <ConfirmCard listing={m.listing} defaultListPrice={m.confirm.defaultListPrice} onConfirmed={priced} />}
              </div>
            ),
          )}
          {busy && (
            <div className="flex flex-col gap-2.5">
              <Label>Selly</Label>
              <p className={`${SERIF} flex items-center gap-3 text-[22px] leading-[1.4] text-[#5F6B73]`} aria-live="polite">
                Looking at your photo <TypingDots />
              </p>
            </div>
          )}
          <div ref={bottom} />
        </section>

        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          {photo && photoPreview && (
            <div className={`mb-2 flex items-center gap-3 rounded-2xl border ${LINE} bg-[#FBF8F2] p-2 text-sm`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <span className="min-w-0 flex-1 truncate text-[#5F6B73]">{photo.name}</span>
              <button type="button" onClick={() => pickPhoto(undefined)} aria-label="Remove photo" className="px-2 text-[#5F6B73] hover:text-[#1E2B36]">
                ✕
              </button>
            </div>
          )}
          <form
            onSubmit={send}
            className="flex items-center gap-1.5 rounded-[30px] border border-[rgba(30,43,54,0.14)] bg-[rgba(251,248,242,0.8)] p-1.5 shadow-[0_20px_40px_rgba(59,106,140,0.14)] backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Add a photo"
              disabled={busy}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#BAD8EC] text-[#14212B] hover:bg-[#A8CBE0] disabled:opacity-50"
            >
              <PlusIcon size={20} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
              className="hidden"
            />
            <label htmlFor="msg" className="sr-only">
              Describe what you&apos;d like to sell
            </label>
            <input
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Sony headphones, want £120"
              maxLength={500}
              disabled={busy}
              className="h-12 min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-[#6B7479]"
            />
            <button
              type="submit"
              disabled={busy || (!photo && !text.trim())}
              aria-label="Send message"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#3B6A8C] disabled:opacity-40"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
