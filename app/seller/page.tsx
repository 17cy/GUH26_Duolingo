"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, Listing } from "@/lib/types";

// Design tokens from the Selly design (Selly Chat.html).
// cream #F6F0E6 · card #FBF8F2 · ink #1E2B36 · bubble ink #14212B · muted #5F6B73 · blue #BAD8EC · deep blue #3B6A8C
const SERIF = "font-[family-name:var(--font-serif),Georgia,serif]";
const LINE = "border-[rgba(30,43,54,0.1)]";

type ChatEntry =
  | { from: "seller"; text: string; photoUrl?: string }
  | { from: "agent"; text: string; listing?: Listing };

const GREETING: ChatEntry = {
  from: "agent",
  text: "Hi! Tap + to add a photo of what you'd like to sell, and tell me a bit about it. Add a price if you have one in mind, e.g. “want £120”.",
};

const CONDITION_LABEL: Record<Item["condition"], string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

// Confidence is how sure the model is of the exact product (not just the type of item).
function confidenceNote(confidence: number): string {
  if (confidence >= 0.85) return "I'm confident this is the exact model.";
  if (confidence >= 0.6) return "The brand and type are clear, but the exact model is a best guess. A close-up of the label or model number would help.";
  return "I'm not sure what this is exactly. Try a clearer photo or tell me the model.";
}

function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

function PlusIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.24em] text-[#3B6A8C]">{children}</div>;
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-t ${last ? "border-b" : ""} ${LINE} py-3 text-sm`}>
      <span className="shrink-0 text-[#5F6B73]">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ItemCard({ listing }: { listing: Listing }) {
  const { item } = listing;
  const brandModel = [item.brand, item.model].filter(Boolean).join(" · ");
  const pct = Math.round(item.confidence * 100);
  return (
    <div className={`rounded-[20px] border ${LINE} bg-[#FBF8F2] p-5 shadow-[0_24px_48px_rgba(59,106,140,0.12)]`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#5F6B73]">Draft listing</div>
      <div className={`${SERIF} mt-1.5 text-[28px] font-medium leading-tight`}>{item.name}</div>
      <div className="mt-3.5 flex flex-col">
        {brandModel && <Row label="Brand / model">{brandModel}</Row>}
        <Row label="Condition">{CONDITION_LABEL[item.condition]}</Row>
        <Row label="Defects">{item.defects.length ? item.defects.join(", ") : "None spotted"}</Row>
        {listing.wantedPrice !== undefined && (
          <Row label="Asking price">
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

  function pickPhoto(file: File | undefined) {
    setPhoto(file ?? null);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function newListing() {
    if (busy) return;
    setChat([GREETING]);
    pickPhoto(undefined);
    setText("");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (!photo && !text.trim())) return;

    setChat((c) => [...c, { from: "seller", text, photoUrl: photoPreview ?? undefined }]);
    setText("");

    if (!photo) {
      setChat((c) => [...c, { from: "agent", text: "Tap + to add a photo of the item and I'll identify it." }]);
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.append("photo", photo);
    form.append("text", text);
    setPhoto(null);
    setPhotoPreview(null);

    try {
      const res = await fetch("/api/seller/identify", { method: "POST", body: form });
      const data = await res.json();
      setChat((c) => [
        ...c,
        res.ok
          ? { from: "agent", text: "Here's what I see.", listing: data.listing as Listing }
          : { from: "agent", text: data.error ?? "Something went wrong." },
      ]);
    } catch {
      setChat((c) => [...c, { from: "agent", text: "Couldn't reach the server. Try again." }]);
    }
    setBusy(false);
  }

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
              <div key={i} className="flex w-full max-w-[280px] flex-col gap-2.5 self-end rounded-[20px] bg-[#BAD8EC] p-3">
                {m.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt="Photo of the item" className="max-h-56 w-full rounded-xl object-cover" />
                )}
                {m.text && <div className="px-1 pb-0.5 text-[15px] leading-[1.55] text-[#14212B]">{m.text}</div>}
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-2.5">
                <Label>Selly</Label>
                <p className={`${SERIF} text-[22px] leading-[1.4]`}>{m.text}</p>
                {m.listing && <ItemCard listing={m.listing} />}
              </div>
            ),
          )}
          {busy && (
            <div className="flex flex-col gap-2.5">
              <Label>Selly</Label>
              <p className={`${SERIF} text-[22px] leading-[1.4] text-[#5F6B73]`}>Looking at your photo…</p>
            </div>
          )}
          <div ref={bottom} />
        </section>

        <div className="px-4 pb-6 pt-3">
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
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#BAD8EC] text-[#14212B] hover:bg-[#A8CBE0]"
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
              className="h-12 min-w-0 flex-1 bg-transparent px-1.5 text-[15px] outline-none placeholder:text-[#6B7479]"
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
