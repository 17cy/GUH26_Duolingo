import { randomInt } from "node:crypto";
import type { Deal, TrackingStatus } from "@/lib/types";

// SPEC "Delivery (mocked)": DEMO courier. A fake tracking number; status advances every 10s:
// label_created → collected → in_transit → delivered. Pure: the caller passes the time, so
// tracking can be worked out lazily whenever a page polls (no background jobs needed).

export type Tracking = NonNullable<Deal["tracking"]>;
type TrackingEvent = Tracking["events"][number];

export const STEPS: TrackingStatus[] = ["label_created", "collected", "in_transit", "delivered"];
export const STEP_MS = 10_000;

export const STEP_LABEL: Record<TrackingStatus, string> = {
  label_created: "Label created",
  collected: "Collected from the seller's drop-off locker",
  in_transit: "In transit",
  delivered: "Delivered to the buyer's locker",
};

export function createShipment(nowMs: number): Tracking {
  return {
    number: `SLY${String(randomInt(0, 1e9)).padStart(9, "0")}`,
    events: [{ status: "label_created", at: new Date(nowMs).toISOString() }],
  };
}

export function isDelivered(t: Tracking): boolean {
  return t.events.some((e) => e.status === "delivered");
}

/** Adds every step that is due by `nowMs`. Returns the new tracking and just the added events. */
export function advanceTracking(t: Tracking, nowMs: number): { tracking: Tracking; added: TrackingEvent[] } {
  const start = Date.parse(t.events[0].at);
  const added: TrackingEvent[] = [];
  for (let i = t.events.length; i < STEPS.length; i++) {
    const due = start + i * STEP_MS;
    if (due > nowMs) break;
    added.push({ status: STEPS[i], at: new Date(due).toISOString() });
  }
  return { tracking: { ...t, events: [...t.events, ...added] }, added };
}
