"use client";

import { useState } from "react";
import type { Item, Listing } from "@/lib/types";

type ChatEntry =
  | { from: "seller"; text: string; photoUrl: string; wantedPrice?: string }
  | { from: "agent"; text: string; listing?: Listing };

const CONDITION_LABEL: Record<Item["condition"], string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function ItemCard({ listing }: { listing: Listing }) {
  const { item } = listing;
  const brandModel = [item.brand, item.model].filter(Boolean).join(" · ");
  return (
    <div className="mt-2 flex gap-3 rounded-lg border border-gray-200 bg-white p-3 text-gray-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={listing.imageUrl} alt={item.name} className="h-24 w-24 rounded object-cover" />
      <div className="min-w-0 text-sm">
        <p className="text-base font-semibold">{item.name}</p>
        {brandModel && <p className="text-gray-600">{brandModel}</p>}
        <p>
          Condition: <span className="font-medium">{CONDITION_LABEL[item.condition]}</span>
        </p>
        <p>Defects: {item.defects.length ? item.defects.join(", ") : "none spotted"}</p>
        <p className="text-gray-600">Confidence: {Math.round(item.confidence * 100)}%</p>
      </div>
    </div>
  );
}

export default function SellerPage() {
  const [chat, setChat] = useState<ChatEntry[]>([
    { from: "agent", text: "Hi! Send me a photo of what you'd like to sell, with a short description." },
  ]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [wantedPrice, setWantedPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!photo || busy) return;
    setBusy(true);
    setChat((c) => [...c, { from: "seller", text, photoUrl: URL.createObjectURL(photo), wantedPrice: wantedPrice || undefined }]);

    const form = new FormData();
    form.append("photo", photo);
    form.append("text", text);
    if (wantedPrice) form.append("wantedPrice", wantedPrice);

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
    setPhoto(null);
    setText("");
    setWantedPrice("");
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-gray-50 p-4 text-gray-900">
      <h1 className="mb-4 text-xl font-bold">FlipAgent — sell something</h1>

      <div className="flex-1 space-y-3">
        {chat.map((m, i) => (
          <div key={i} className={m.from === "seller" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.from === "seller" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
              {m.from === "seller" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photoUrl} alt="Your photo" className="mb-1 max-h-48 rounded" />
              )}
              {m.text && <p>{m.text}</p>}
              {m.from === "seller" && m.wantedPrice && <p className="text-sm opacity-80">Hoping for £{m.wantedPrice}</p>}
              {m.from === "agent" && m.listing && <ItemCard listing={m.listing} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-gray-500">Looking at your photo…</p>}
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-4 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
          key={photo ? "has-photo" : "no-photo"}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Sony headphones, barely used"
          maxLength={500}
          className="w-full rounded border border-gray-300 px-2 py-1"
        />
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-sm">
            £
            <input
              value={wantedPrice}
              onChange={(e) => setWantedPrice(e.target.value)}
              placeholder="Wanted price (optional)"
              inputMode="decimal"
              className="w-44 rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={!photo || busy}
            className="ml-auto rounded bg-blue-600 px-4 py-1 font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
