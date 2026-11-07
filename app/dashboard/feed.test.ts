import { describe, expect, it } from "vitest";
import type { EventType, TimelineEvent } from "@/lib/types";
import { buildFeed, newNotifications } from "./feed";

let n = 0;
const ev = (type: EventType, message: string = type): TimelineEvent => ({
  id: `e${++n}`,
  listingId: "L",
  type,
  message,
  createdAt: new Date(2026, 10, 7, 12, 0, n).toISOString(),
});

describe("buildFeed", () => {
  it("keeps only the SPEC notification types, newest first", () => {
    const feed = buildFeed([ev("posted"), ev("offer_received", "Jo offered £100"), ev("counter_sent"), ev("deal_proposed"), ev("payout_sent"), ev("sold")]);
    expect(feed.map((f) => f.type)).toEqual(["sold", "deal_proposed", "offer_received"]);
    expect(feed[2]).toMatchObject({ title: "New offer", message: "Jo offered £100" });
  });

  it("includes every SPEC type, including pickup and shipping updates", () => {
    const types: EventType[] = [
      "offer_received",
      "scam_flagged",
      "injection_attempt",
      "deal_proposed",
      "payment_held",
      "pickup_scheduled",
      "shipment_created",
      "tracking_update",
      "handed_over",
      "sold",
    ];
    expect(buildFeed(types.map((t) => ev(t))).length).toBe(types.length);
  });

  it("summarises lowball offers into one item at the latest lowball", () => {
    const feed = buildFeed([ev("lowball_declined"), ev("offer_received"), ev("lowball_declined"), ev("lowball_declined")]);
    expect(feed.map((f) => f.type)).toEqual(["lowball_declined", "offer_received"]);
    expect(feed[0].message).toBe("3 lowball offers declined");
    expect(buildFeed([ev("lowball_declined")])[0].message).toBe("1 lowball offer declined");
  });

  it("keeps logged order for events with the same timestamp", () => {
    const at = new Date(2026, 10, 7, 13).toISOString();
    const same = (["payment_held", "handed_over", "sold"] as EventType[]).map((t, i) => ({ ...ev(t), id: `s${i}`, createdAt: at }));
    expect(buildFeed(same).map((f) => f.type)).toEqual(["sold", "handed_over", "payment_held"]);
  });

  it("is empty with no notification events", () => {
    expect(buildFeed([ev("posted"), ev("priced")])).toEqual([]);
  });
});

describe("newNotifications", () => {
  it("returns items not seen before, oldest first, and never pushes lowball summaries", () => {
    const first = buildFeed([ev("offer_received")]);
    const seen = new Set(first.map((f) => f.id));
    const later = buildFeed([...[ev("lowball_declined"), ev("scam_flagged"), ev("sold")]]);
    expect(newNotifications(later, seen).map((f) => f.type)).toEqual(["scam_flagged", "sold"]);
    expect(newNotifications(first, seen)).toEqual([]);
  });
});
