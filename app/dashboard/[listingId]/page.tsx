"use client";

import { use, useEffect, useState } from "react";
import { formatPounds, Label, LINE, SERIF } from "@/app/seller/cards";
import type { Deal, Listing, Message, TimelineEvent } from "@/lib/types";
import { NotificationFeed, SectionTitle } from "./widgets";

type DashboardData = { listing: Listing; events: TimelineEvent[]; deals: Deal[]; messages: Message[] };

const CARD = `rounded-[20px] border ${LINE} bg-[#FBF8F2] p-5 shadow-[0_24px_48px_rgba(59,106,140,0.12)]`;
const PRIMARY_BTN = "h-12 rounded-3xl bg-[#BAD8EC] px-5 text-sm font-medium tracking-[0.03em] text-[#14212B] hover:bg-[#A8CBE0] disabled:opacity-50";
const SECONDARY_BTN = "h-12 rounded-3xl border border-[rgba(30,43,54,0.22)] px-5 text-sm hover:bg-[#F6F0E6] disabled:opacity-50";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  priced: "Priced",
  posted: "Live",
  sold: "Sold",
  withdrawn: "Withdrawn",
  awaiting_seller_approval: "Needs your approval",
  approved: "Approved",
  rejected: "Rejected",
  awaiting_payment: "Awaiting payment",
  payment_held: "Payment held",
  in_delivery: "In delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const humanType = (t: string) => t.replace(/_/g, " ");

function ApprovalCard({ deal, onDecided }: { deal: Deal; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seller/deals/${deal.id}/${decision}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD} border-[#3B6A8C]/40`}>
      <Label>Needs your approval</Label>
      <p className={`${SERIF} mt-2 text-[22px] leading-snug`}>
        Selly agreed {formatPounds(deal.price)} with {deal.buyerName}
        {deal.bundleListingIds?.length ? ` for a bundle of ${deal.bundleListingIds.length} items` : ""}.
      </p>
      <p className="mt-1 text-sm text-[#5F6B73]">If you approve, the buyer gets a secure payment link. The money is held until handoff.</p>
      {error && <p className="mt-2 text-sm text-[#9B3B2E]">{error}</p>}
      <div className="mt-4 flex gap-2.5">
        <button type="button" disabled={busy} onClick={() => decide("approve")} className={`${PRIMARY_BTN} flex-1`}>
          Approve
        </button>
        <button type="button" disabled={busy} onClick={() => decide("reject")} className={`${SECONDARY_BTN} flex-[0_0_96px]`}>
          Reject
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/seller/events?listingId=${encodeURIComponent(listingId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't load the dashboard");
      setData(json as DashboardData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard");
    }
  }

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      if (!stopped) timer = setTimeout(tick, 2000); // poll every 2s, never overlapping
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const pending = data?.deals.filter((d) => d.status === "awaiting_seller_approval") ?? [];
  const otherDeals = data?.deals.filter((d) => d.status !== "awaiting_seller_approval") ?? [];
  const conversations = Object.entries(
    (data?.messages ?? []).reduce<Record<string, Message[]>>((acc, m) => {
      (acc[m.buyerName] ??= []).push(m);
      return acc;
    }, {}),
  );

  return (
    <div className="min-h-dvh bg-[#F6F0E6] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[#1E2B36]">
      <div className="mx-auto max-w-[430px] pb-10">
        <header className={`flex items-center justify-between border-b ${LINE} py-3 pl-5 pr-3`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`${SERIF} text-[32px] font-medium tracking-[0.05em]`}>Selly</span>
            <span className="h-px w-5 shrink-0 bg-[#3B6A8C]" />
            <span className="truncate text-[11px] uppercase tracking-[0.2em] text-[#3B6A8C]">Dashboard</span>
          </div>
          <a
            href={`/seller?listing=${encodeURIComponent(listingId)}`}
            className="ml-2 shrink-0 rounded-full border border-[rgba(30,43,54,0.22)] px-3 py-2 text-sm hover:bg-[#FBF8F2]"
          >
            Chat
          </a>
        </header>

        <main className="flex flex-col gap-6 px-5 pt-6">
          {error && !data && <p className="text-sm text-[#9B3B2E]">{error}</p>}
          {!data && !error && <p className={`${SERIF} text-[22px] text-[#5F6B73]`}>Loading…</p>}

          {data && (
            <>
              <section className={CARD}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionTitle>Listing</SectionTitle>
                    <h1 className={`${SERIF} text-[28px] font-medium leading-tight`}>{data.listing.item.name}</h1>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full bg-[#BAD8EC] px-3 py-1 text-xs font-medium text-[#14212B]">
                    {STATUS_LABEL[data.listing.status]}
                  </span>
                </div>
                <div className="mt-3 flex gap-6 text-sm">
                  {data.listing.listPrice !== undefined && (
                    <div>
                      <div className="text-[#5F6B73]">List price</div>
                      <div className={`${SERIF} text-[22px] font-medium`}>{formatPounds(data.listing.listPrice)}</div>
                    </div>
                  )}
                  {data.listing.floorPrice !== undefined && (
                    <div>
                      <div className="text-[#5F6B73]">Your floor (hidden)</div>
                      <div className={`${SERIF} text-[22px] font-medium`}>{formatPounds(data.listing.floorPrice)}</div>
                    </div>
                  )}
                </div>
              </section>

              {pending.map((deal) => (
                <ApprovalCard key={deal.id} deal={deal} onDecided={load} />
              ))}

              <NotificationFeed events={data.events} />

              {otherDeals.length > 0 && (
                <section>
                  <SectionTitle>Deals</SectionTitle>
                  <div className={`${CARD} py-2`}>
                    {otherDeals.map((d, i) => (
                      <div key={d.id} className={`flex items-center justify-between gap-3 ${i ? `border-t ${LINE}` : ""} py-3 text-sm`}>
                        <span>
                          {d.buyerName} · {formatPounds(d.price)}
                        </span>
                        <span className="text-[#5F6B73]">{STATUS_LABEL[d.status]}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionTitle>Buyer conversations</SectionTitle>
                {conversations.length === 0 ? (
                  <p className="text-sm text-[#5F6B73]">No buyer messages yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {conversations.map(([buyer, msgs]) => (
                      <details key={buyer} className={`${CARD} p-4`}>
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                          <span className="font-medium">{buyer}</span>
                          <span className="text-[#5F6B73]">{msgs.length} messages</span>
                        </summary>
                        <div className="mt-3 flex flex-col gap-2">
                          {msgs.map((m) => (
                            <div
                              key={m.id}
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                m.from === "buyer" ? "self-start bg-white" : m.from === "agent" ? "self-end bg-[#BAD8EC]" : "self-center text-xs text-[#5F6B73]"
                              }`}
                            >
                              {m.from !== "system" && <div className="mb-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5F6B73]">{m.from === "agent" ? "Selly" : buyer}</div>}
                              {m.text}
                              {m.flags?.length ? <div className="mt-1 text-[11px] text-[#9B3B2E]">Flagged: {m.flags.join(", ")}</div> : null}
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-[#5F6B73]">Read-only. Selly replies to buyers for you.</p>
                      </details>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionTitle>Timeline</SectionTitle>
                <ol className={`${CARD} py-2`}>
                  {[...data.events].reverse().map((e, i) => (
                    <li key={e.id} className={`flex gap-3 ${i ? `border-t ${LINE}` : ""} py-3 text-sm`}>
                      <span className="w-12 shrink-0 text-xs text-[#5F6B73]">{time(e.createdAt)}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#3B6A8C]">{humanType(e.type)}</div>
                        <div>{e.message}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
