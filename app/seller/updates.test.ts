import { describe, expect, it } from "vitest";
import type { Deal, EventType, TimelineEvent } from "@/lib/types";
import { sellerUpdate } from "./updates";

const deal: Deal = { id: "d1", listingId: "L", buyerName: "Quinn", price: 11500, status: "payment_held", createdAt: "" };
const ev = (type: EventType, message: string, data: Record<string, unknown> = {}): TimelineEvent => ({
  id: type,
  listingId: "L",
  type,
  message,
  data: { dealId: "d1", buyerName: "Quinn", ...data },
  createdAt: "",
});

describe("sellerUpdate — what Selly tells the seller in their chat", () => {
  it("deal agreed (auto-approved)", () => {
    const u = sellerUpdate(ev("deal_approved", "Auto-approved £115 with Quinn: at or above your lowest price", { price: 11500, auto: true }), deal)!;
    expect(u.text).toBe("Good news: Quinn agreed £115. That's at or above your lowest price, so I've approved it and sent them a secure payment link.");
  });

  it("deal needing approval links to the dashboard; the auto-approved deal_proposed is skipped", () => {
    const u = sellerUpdate(ev("deal_proposed", "Quinn agreed £115 — waiting for your approval", { price: 11500 }), deal)!;
    expect(u.text).toContain("needs your OK");
    expect(u.link).toEqual({ href: "/dashboard/L", label: "Approve or reject" });
    expect(sellerUpdate(ev("deal_proposed", "Quinn agreed £115", { price: 11500 }), deal)).toBeNull();
  });

  it("payment held", () => {
    expect(sellerUpdate(ev("payment_held", "£115 from Quinn is held safely until handoff"), deal)!.text).toBe(
      "Quinn has paid £115. The money is held safely until handoff, and they're choosing pickup or a parcel locker.",
    );
  });

  it("pickup booked, with the handoff QR link", () => {
    const u = sellerUpdate(ev("pickup_scheduled", "Quinn will collect on Sun 8 Nov, 15:00 at the station", { slot: "Sun 8 Nov, 15:00" }), deal)!;
    expect(u.text).toBe("Pickup booked: Quinn will collect on Sun 8 Nov, 15:00 at the station. When you meet, let them scan your handoff QR code.");
    expect(u.link).toEqual({ href: "/handoff/d1", label: "Show handoff QR" });
  });

  it("locker shipment and each tracking step", () => {
    const s = sellerUpdate(ev("shipment_created", "DEMO courier label created", { tracking: "SLY123" }), deal)!;
    expect(s.text).toBe("Quinn chose a parcel locker. DEMO courier label created, tracking SLY123.");
    expect(s.link).toEqual({ href: "/handoff/d1", label: "Track delivery" });
    expect(sellerUpdate(ev("tracking_update", "DEMO courier: Collected", { status: "collected" }), deal)!.text).toBe("DEMO courier: collected from you.");
    expect(sellerUpdate(ev("tracking_update", "DEMO courier: In transit", { status: "in_transit" }), deal)!.text).toBe("DEMO courier: on its way to the locker.");
    expect(sellerUpdate(ev("tracking_update", "DEMO courier: Delivered", { status: "delivered" }), deal)!.text).toBe("DEMO courier: delivered to Quinn's locker.");
    expect(sellerUpdate(ev("tracking_update", "DEMO courier: Label created", { status: "label_created" }), deal)).toBeNull();
  });

  it("sold and cancelled", () => {
    const sold = sellerUpdate(ev("sold", "Sold to Quinn for £115", { price: 11500 }), deal)!;
    expect(sold.text).toBe("Sold to Quinn for £115! The payment has been released to you (simulated payout).");
    expect(sold.link).toEqual({ href: "/dashboard/L", label: "See your savings" });
    expect(sellerUpdate(ev("payment_cancelled", "Deal with Quinn cancelled; held payment released"), deal)!.text).toBe(
      "The deal with Quinn was cancelled, and any held payment was released.",
    );
  });

  it("ignores everything else", () => {
    for (const t of ["offer_received", "counter_sent", "payment_link_sent", "payment_captured", "payout_sent", "delisted", "handed_over"] as EventType[]) {
      expect(sellerUpdate(ev(t, "x"), deal)).toBeNull();
    }
  });
});
