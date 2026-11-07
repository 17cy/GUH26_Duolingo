"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentText, DEAL_STATUS } from "@/app/buy/AgentText";
import type { PublicDeal } from "@/lib/negotiation/public";

// The marketplace's own "Message seller" box (mock, neutral styling). Talks to Person B's buyer APIs
// (/api/buyer/conversation, /api/buyer/chat), which do the negotiation, scam checks and public-only data.

interface ChatMessage {
  id: string;
  from: "buyer" | "agent" | "system";
  text: string;
}
interface Conversation {
  messages: ChatMessage[];
  deal: PublicDeal | null;
}

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const storageKey = (id: string) => `selly-buyer-${id}`; // same key as /buy, so a buyer keeps one conversation

function readName(id: string): string {
  try {
    return localStorage.getItem(storageKey(id)) ?? "";
  } catch {
    return "";
  }
}

export default function MarketplaceChat({ listingId, sellerName, platformName }: { listingId: string; sellerName: string; platformName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
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

  // Poll every 2s while the message box is open (seller approval, payment updates).
  useEffect(() => {
    if (!open) return;
    load().catch(() => setError("Couldn't reach the server."));
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [open, load]);

  const count = convo?.messages.length ?? 0;
  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, count, busy]);

  function openBox() {
    setOpen(true);
    setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

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

  if (!open) {
    return (
      <button type="button" onClick={openBox} className="rounded bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700">
        Message seller
      </button>
    );
  }

  return (
    <div ref={panel} className="mt-2 overflow-hidden rounded border border-neutral-300 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold">Messages with {sellerName}</div>
          <div className="text-xs text-neutral-500">Replies come from Selly, an AI assistant selling on {sellerName}&apos;s behalf</div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close messages" className="px-2 text-neutral-500 hover:text-neutral-900">
          ✕
        </button>
      </div>

      {!name ? (
        <form onSubmit={start} className="space-y-2 p-4">
          <label htmlFor="buyer-name" className="block text-sm text-neutral-600">
            Your first name ({platformName} demo account)
          </label>
          <div className="flex gap-2">
            <input
              id="buyer-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={40}
              autoFocus
              className="h-10 min-w-0 flex-1 rounded border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
            />
            <button type="submit" disabled={!nameDraft.trim()} className="rounded bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-40">
              Start
            </button>
          </div>
        </form>
      ) : (
        <>
          {convo?.deal && (
            <div className="border-b border-neutral-200 bg-amber-50 px-4 py-2 text-sm">
              <span className="font-semibold">Deal at {gbp(convo.deal.price)}</span> · {DEAL_STATUS[convo.deal.status] ?? convo.deal.status}
            </div>
          )}
          <div className="flex max-h-[420px] min-h-[200px] flex-col gap-2 overflow-y-auto bg-neutral-100 p-3">
            {convo?.messages.map((m) =>
              m.from === "system" ? (
                <div key={m.id} className="self-center text-xs text-neutral-500">
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.from === "buyer" ? "self-end bg-neutral-900 text-white" : "self-start border border-neutral-200 bg-white"
                  }`}
                >
                  {m.from === "agent" && <div className="mb-0.5 text-[11px] font-semibold text-neutral-500">{sellerName} · via Selly (AI)</div>}
                  {m.from === "agent" ? (
                    <AgentText
                      text={m.text}
                      buttonClassName="my-2 flex h-10 items-center justify-center rounded bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-700"
                    />
                  ) : (
                    m.text
                  )}
                </div>
              ),
            )}
            {busy && <div className="self-start text-xs text-neutral-500">Selly is typing…</div>}
            {error && (
              <div role="alert" className="self-center text-xs text-red-700">
                {error}
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-neutral-200 p-2">
            <label htmlFor="buyer-msg" className="sr-only">
              Message {sellerName}
            </label>
            <input
              id="buyer-msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question or make an offer"
              maxLength={1000}
              disabled={busy}
              className="h-10 min-w-0 flex-1 rounded border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
            />
            <button type="submit" disabled={busy || !text.trim()} className="rounded bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
