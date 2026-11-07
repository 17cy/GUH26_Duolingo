import type { Deal, TimelineEvent } from "@/lib/types";

// What Selly tells the seller in their chat as a live listing's deal progresses
// (agreed → paid → pickup/locker → tracking → sold). Everything else stays on the dashboard.

export interface SellerUpdate {
  text: string;
  link?: { href: string; label: string };
}

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

const TRACKING: Record<string, string> = {
  collected: "collected from you",
  in_transit: "on its way to the locker",
};

export function sellerUpdate(e: TimelineEvent, deal: Deal | undefined): SellerUpdate | null {
  const d = e.data ?? {};
  const buyer = String(d.buyerName ?? deal?.buyerName ?? "The buyer");
  const dealId = String(d.dealId ?? deal?.id ?? "");
  const price = typeof d.price === "number" ? d.price : deal?.price;
  const amount = price !== undefined ? gbp(price) : "the agreed price";

  switch (e.type) {
    case "deal_approved":
      return { text: `Good news: ${buyer} agreed ${amount}. That's at or above your lowest price, so I've approved it and sent them a secure payment link.` };
    case "deal_proposed":
      // Auto-approved deals also log deal_proposed; only the fallback (needs approval) is worth a message.
      return e.message.includes("waiting for your approval")
        ? { text: `${buyer} agreed ${amount}, but it needs your OK.`, link: { href: `/dashboard/${e.listingId}`, label: "Approve or reject" } }
        : null;
    case "payment_held":
      return { text: `${buyer} has paid ${amount}. The money is held safely until handoff, and they're choosing pickup or a parcel locker.` };
    case "pickup_scheduled":
      return {
        text: `Pickup booked: ${e.message}. When you meet, let them scan your handoff QR code.`,
        link: { href: `/handoff/${dealId}`, label: "Show handoff QR" },
      };
    case "shipment_created":
      return {
        text: `${buyer} chose a parcel locker. DEMO courier label created, tracking ${String(d.tracking ?? "")}.`,
        link: { href: `/handoff/${dealId}`, label: "Track delivery" },
      };
    case "tracking_update": {
      const status = String(d.status ?? "");
      if (status === "delivered") return { text: `DEMO courier: delivered to ${buyer}'s locker.` };
      return TRACKING[status] ? { text: `DEMO courier: ${TRACKING[status]}.` } : null;
    }
    case "sold":
      return {
        text: `Sold to ${buyer} for ${amount}! The payment has been released to you (simulated payout).`,
        link: { href: `/dashboard/${e.listingId}`, label: "Open dashboard" },
      };
    case "payment_cancelled":
      return { text: `The deal with ${buyer} was cancelled, and any held payment was released.` };
    default:
      return null;
  }
}
