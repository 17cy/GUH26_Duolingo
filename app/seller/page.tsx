"use client";

import { useRef, useState } from "react";
import type { Item, Listing } from "@/lib/types";

type ChatEntry =
  | { from: "seller"; text: string; photoUrl?: string }
  | { from: "agent"; text: string; listing?: Listing };

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

function ItemCard({ listing }: { listing: Listing }) {
  const { item } = listing;
  const brandModel = [item.brand, item.model].filter(Boolean).join(" · ");
  const pct = Math.round(item.confidence * 100);
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-gray-900">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={listing.imageUrl} alt={item.name} className="h-24 w-24 shrink-0 rounded object-cover" />
        <div className="min-w-0 text-sm">
          <p className="text-base font-semibold">{item.name}</p>
          {brandModel && <p className="text-gray-600">{brandModel}</p>}
          <p>
            Condition: <span className="font-medium">{CONDITION_LABEL[item.condition]}</span>
          </p>
          <p>Defects: {item.defects.length ? item.defects.join(", ") : "none spotted"}</p>
          {listing.wantedPrice !== undefined && <p>Your price: {formatPounds(listing.wantedPrice)}</p>}
        </div>
      </div>
      <div className="mt-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Match confidence</span>
          <div className="h-1.5 flex-1 rounded-full bg-gray-200">
            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-medium">{pct}%</span>
        </div>
        <p className="mt-1 text-gray-600">{confidenceNote(item.confidence)}</p>
      </div>
    </div>
  );
}

export default function SellerPage() {
  const [chat, setChat] = useState<ChatEntry[]>([
    {
      from: "agent",
      text: "Hi! Tap + to add a photo of what you'd like to sell, and tell me a bit about it. Add a price if you have one in mind, e.g. \"want £120\".",
    },
  ]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickPhoto(file: File | undefined) {
    setPhoto(file ?? null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (!photo && !text.trim())) return;

    const photoUrl = photo ? URL.createObjectURL(photo) : undefined;
    setChat((c) => [...c, { from: "seller", text, photoUrl }]);
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

    try {
      const res = await fetch("/api/seller/identify", { method: "POST", body: form });
      const data = await res.json();
      setChat((c) => [
        ...c,
        res.ok
          ? { from: "agent", text: "Here's what I see:", listing: data.listing as Listing }
          : { from: "agent", text: data.error ?? "Something went wrong." },
      ]);
    } catch {
      setChat((c) => [...c, { from: "agent", text: "Couldn't reach the server. Try again." }]);
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-gray-50 p-4 text-gray-900">
      <h1 className="mb-4 text-xl font-bold">Selly</h1>

      <div className="flex-1 space-y-3">
        {chat.map((m, i) => (
          <div key={i} className={m.from === "seller" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.from === "seller" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
              {m.from === "seller" && m.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photoUrl} alt="Your photo" className="mb-1 max-h-48 rounded-lg" />
              )}
              {m.text && <p>{m.text}</p>}
              {m.from === "agent" && m.listing && <ItemCard listing={m.listing} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-gray-500">Looking at your photo…</p>}
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-4 bg-gray-50 pb-2 pt-2">
        {photo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(photo)} alt="" className="h-10 w-10 rounded object-cover" />
            <span className="min-w-0 flex-1 truncate">{photo.name}</span>
            <button type="button" onClick={() => pickPhoto(undefined)} aria-label="Remove photo" className="px-2 text-gray-500 hover:text-gray-900">
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1.5 shadow-sm focus-within:border-blue-500">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Add photo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl leading-none text-white hover:bg-blue-700"
          >
            +
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
            className="hidden"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Sony headphones, barely used, want £120"
            maxLength={500}
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent px-1 py-1 outline-none"
          />
          <button
            type="submit"
            disabled={busy || (!photo && !text.trim())}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 disabled:text-gray-300"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15 12 3.4 13.9z" />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}
