"use client";

import { useState } from "react";
import type { PublicDeal } from "@/lib/negotiation/public";
import type { TrackingStatus } from "@/lib/types";

// Shared by every buyer chat: choosing pickup or locker after payment is held, and the DEMO
// courier tracking. Pass the same listingId/buyerName the chat uses; onUpdate receives the
// fresh conversation (same shape as GET /api/buyer/conversation).

export interface HandoffOptions {
  pickupSlots: string[];
  meetingPoint: string;
}

const BTN = "h-11 rounded-full px-4 text-[14px] disabled:opacity-40";

export function HandoffChoice({
  listingId,
  buyerName,
  options,
  onUpdate,
}: {
  listingId: string;
  buyerName: string;
  options: HandoffOptions;
  onUpdate: (conversation: unknown) => void;
}) {
  const [mode, setMode] = useState<"choose" | "pickup">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(body: { method: "pickup"; slot: number } | { method: "locker" }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/buyer/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId, buyerName, ...body }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) onUpdate(data);
    else setError(data?.error ?? "Couldn't save your choice. Try again.");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(30,43,54,0.1)] bg-[#FBF8F2] p-4 text-[14px] text-[#1E2B36]">
      {mode === "choose" ? (
        <>
          <div className="font-medium">How would you like to get it?</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => setMode("pickup")} className={`${BTN} bg-[#3B6A8C] text-white`}>
              Pick up in person
            </button>
            <button type="button" disabled={busy} onClick={() => choose({ method: "locker" })} className={`${BTN} border border-[#3B6A8C] text-[#3B6A8C]`}>
              Parcel locker (DEMO courier)
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="font-medium">Pick a time — meeting at {options.meetingPoint}</div>
          <div className="flex flex-col gap-2">
            {options.pickupSlots.map((slot, i) => (
              <button key={slot} type="button" disabled={busy} onClick={() => choose({ method: "pickup", slot: i })} className={`${BTN} bg-[#BAD8EC] text-left text-[#14212B]`}>
                {slot}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => setMode("choose")} className="self-start text-[13px] text-[#5F6B73] underline">
            Back
          </button>
        </>
      )}
      {error && <p className="text-[13px] text-[#9B3B2E]">{error}</p>}
    </div>
  );
}

const STEPS: { status: TrackingStatus; label: string }[] = [
  { status: "label_created", label: "Label created" },
  { status: "collected", label: "Collected" },
  { status: "in_transit", label: "In transit" },
  { status: "delivered", label: "Delivered" },
];

export function TrackingSteps({ tracking }: { tracking: NonNullable<PublicDeal["tracking"]> }) {
  const done = new Set(tracking.events.map((e) => e.status));
  return (
    <div className="rounded-2xl border border-[rgba(30,43,54,0.1)] bg-[#FBF8F2] p-4 text-[14px] text-[#1E2B36]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">DEMO courier</span>
        <span className="text-[12px] text-[#5F6B73]">{tracking.number}</span>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {STEPS.map((s) => (
          <li key={s.status} className={`flex items-center gap-2 ${done.has(s.status) ? "" : "text-[#9AA3A8]"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${done.has(s.status) ? "bg-[#3B6A8C]" : "bg-[rgba(30,43,54,0.15)]"}`} />
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
