"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicDeal, PublicListing } from "@/lib/negotiation/public";
import type { Item } from "@/lib/types";

// Selly design tokens (shared with app/seller): cream #F6F0E6 · card #FBF8F2 · ink #1E2B36 ·
// muted #5F6B73 · blue #BAD8EC · deep blue #3B6A8C
const SERIF = "font-[family-name:var(--font-serif),Georgia,serif]";
const LINE = "border-[rgba(30,43,54,0.1)]";

interface ChatMessage {
  id: string;
  from: "buyer" | "agent" | "system";
  text: string;
}
interface Conversation {
  listing: PublicListing;
  messages: ChatMessage[];
  deal: PublicDeal | null;
}

const CONDITION: Record<Item["condition"], string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
const DEAL_STATUS: Partial<Record<PublicDeal["status"], string>> = {
  awaiting_seller_approval: "Waiting for the seller to approve",
  approved: "Approved — preparing your secure payment link",
  awaiting_payment: "Waiting for your payment",
  payment_held: "Payment held safely until handoff",
  in_delivery: "On its way",
  completed: "Handed over — payment released to the seller",
  cancelled: "Cancelled — any held payment was released",
};

// Only our Stripe Checkout links are ever rendered as links.
const CHECKOUT_URL = /https:\/\/checkout\.stripe\.com\/\S+/;

function AgentText({ text }: { text: string }) {
  const match = text.match(CHECKOUT_URL);
  if (!match) return <>{text}</>;
  const url = match[0].replace(/[.,!?)]+$/, "");
  const [before, after] = text.split(url);
  return (
    <>
      {before.replace(/\s*here:\s*$/, ".")}
      <a
        href={url}
        className="my-3 flex h-12 items-center justify-center rounded-full bg-[#3B6A8C] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[15px] text-white"
      >
        Pay securely with Stripe
      </a>
      {after.replace(/^\s*—\s*/, "")}
    </>
  );
}

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const storageKey = (id: string) => `selly-buyer-${id}`;

function readName(id: string): string {
  try {
    return localStorage.getItem(storageKey(id)) ?? "";
  } catch {
    return "";
  }
}

function ListingSummary({ listing }: { listing: PublicListing }) {
  const [imageOk, setImageOk] = useState(true);
  const { item } = listing;
  return (
    <div className={`flex gap-4 rounded-[20px] border ${LINE} bg-[#FBF8F2] p-4 shadow-[0_24px_48px_rgba(59,106,140,0.12)]`}>
      {imageOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.imageUrl} alt={item.name} onError={() => setImageOk(false)} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`${SERIF} text-[22px] font-medium leading-tight`}>{item.name}</div>
        <div className="mt-1 text-[13px] text-[#5F6B73]">
          {CONDITION[item.condition]}
          {item.defects.length > 0 && ` · ${item.defects.join(", ")}`}
        </div>
        {listing.listPrice !== undefined && <div className={`${SERIF} mt-1.5 text-[22px] font-medium`}>{gbp(listing.listPrice)}</div>}
      </div>
    </div>
  );
}

export default function BuyPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => setName(readName(listingId)), [listingId]);

  const load = useCallback(async () => {
    if (!name) return;
    const res = await fetch(`/api/buyer/conversation?listingId=${encodeURIComponent(listingId)}&buyer=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (res.ok) {
      setConvo(data);
      setError(null);
    } else setError(data.error ?? "Something went wrong.");
  }, [listingId, name]);

  // Poll every 2s for seller approval and payment updates.
  useEffect(() => {
    load().catch(() => setError("Couldn't reach the server."));
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [load]);

  const count = convo?.messages.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [count, busy]);

  function start(e: React.FormEvent) {
    e.preventDefault();
    const n = nameDraft.trim().slice(0, 40);
    if (!n) return;
    try {
      localStorage.setItem(storageKey(listingId), n);
    } catch {}
    setName(n);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (busy || !msg) return;
    setBusy(true);
    setText("");
    setConvo((c) => (c ? { ...c, messages: [...c.messages, { id: `pending-${Date.now()}`, from: "buyer", text: msg }] } : c));
    try {
      const res = await fetch("/api/buyer/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, buyerName: name, text: msg }),
      });
      const data = await res.json();
      if (res.ok) {
        setConvo(data);
        setError(null);
      } else {
        setError(data.error ?? "Something went wrong.");
        await load();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-dvh bg-[#F6F0E6] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[#1E2B36]">
      <div className="mx-auto flex h-dvh max-w-[430px] flex-col">
        <header className={`flex items-center gap-3 border-b ${LINE} px-5 py-3`}>
          <h1 className={`${SERIF} text-[32px] font-medium tracking-[0.05em]`}>Selly</h1>
          <span className="h-px w-7 bg-[#3B6A8C]" />
          <span className="ml-auto text-[11px] uppercase tracking-[0.22em] text-[#5F6B73]">Buying</span>
        </header>

        {!name ? (
          <form onSubmit={start} className="flex flex-1 flex-col justify-center gap-4 px-5">
            <p className={`${SERIF} text-[26px] leading-snug`}>Chat with the seller&apos;s AI assistant to ask questions and make an offer.</p>
            <label htmlFor="name" className="text-sm text-[#5F6B73]">
              Your first name
            </label>
            <input
              id="name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={40}
              autoFocus
              className={`h-12 rounded-2xl border ${LINE} bg-[#FBF8F2] px-4 text-[15px] outline-none focus:border-[#3B6A8C]`}
            />
            <button type="submit" disabled={!nameDraft.trim()} className="h-12 rounded-full bg-[#3B6A8C] text-[15px] text-white disabled:opacity-40">
              Start chatting
            </button>
          </form>
        ) : (
          <>
            <section aria-label="Conversation" className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4 pt-5">
              {convo && <ListingSummary listing={convo.listing} />}
              {convo?.deal && (
                <div className="rounded-2xl bg-[#BAD8EC] px-4 py-3 text-sm text-[#14212B]">
                  <span className="font-medium">Deal at {gbp(convo.deal.price)}</span> · {DEAL_STATUS[convo.deal.status] ?? convo.deal.status}
                </div>
              )}
              {convo?.messages.map((m) =>
                m.from === "buyer" ? (
                  <div key={m.id} className="max-w-[280px] self-end rounded-[20px] bg-[#BAD8EC] px-4 py-3 text-[15px] leading-[1.55] text-[#14212B]">
                    {m.text}
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col gap-1.5">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#3B6A8C]">Selly · AI assistant</div>
                    <div className={`${SERIF} text-[21px] leading-[1.4]`}>
                      <AgentText text={m.text} />
                    </div>
                  </div>
                ),
              )}
              {busy && <p className={`${SERIF} text-[21px] text-[#5F6B73]`}>Selly is typing…</p>}
              {error && (
                <p role="alert" className="text-sm text-[#9B3B2E]">
                  {error}
                </p>
              )}
              <div ref={bottom} />
            </section>

            <div className="px-4 pb-6 pt-3">
              <form
                onSubmit={send}
                className="flex items-center gap-1.5 rounded-[30px] border border-[rgba(30,43,54,0.14)] bg-[rgba(251,248,242,0.8)] p-1.5 pl-4 shadow-[0_20px_40px_rgba(59,106,140,0.14)] backdrop-blur-xl"
              >
                <label htmlFor="msg" className="sr-only">
                  Message the seller&apos;s assistant
                </label>
                <input
                  id="msg"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ask a question or make an offer"
                  maxLength={1000}
                  disabled={busy}
                  className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#6B7479]"
                />
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
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
          </>
        )}
      </div>
    </div>
  );
}
