import { addEvent } from "@/lib/events";
import { completeSale, getStripe, tellBuyer, type StripeLike } from "@/lib/payments/stripe";
import { getDeal, saveDeal } from "@/lib/store";
import { advanceTracking, createShipment, isDelivered, STEP_LABEL } from "./mockCourier";
import { MEETING_POINT, proposePickupSlots } from "./pickup";

// SPEC "Delivery (mocked)": after payment_held the buyer picks pickup (QR handoff) or locker
// (DEMO courier, captures on delivered). The buyer picks the pickup slot; the seller is told
// through the pickup_scheduled event on their timeline.

function choosable(dealId: string) {
  const deal = getDeal(dealId);
  return deal && deal.status === "payment_held" && !deal.handoffMethod ? deal : undefined;
}

export function choosePickup(dealId: string, slotIndex: number, nowMs = Date.now()): boolean {
  const deal = choosable(dealId);
  const slot = proposePickupSlots(nowMs)[slotIndex];
  if (!deal || !slot) return false;

  saveDeal({ ...deal, handoffMethod: "pickup", pickupSlot: slot });
  addEvent(deal.listingId, "pickup_scheduled", `${deal.buyerName} will collect on ${slot} at ${MEETING_POINT}`, {
    dealId,
    buyerName: deal.buyerName,
    slot,
  });
  tellBuyer(
    deal,
    `Booked: ${slot} at ${MEETING_POINT}. When you meet, check the item, then scan the QR code on the seller's phone to release the payment.`,
    `pickup-${deal.id}`,
  );
  return true;
}

export function chooseLocker(dealId: string, nowMs = Date.now()): boolean {
  const deal = choosable(dealId);
  if (!deal) return false;

  const tracking = createShipment(nowMs);
  // No QR on the locker path: delivery is the handoff.
  saveDeal({ ...deal, handoffMethod: "locker", handoffToken: undefined, status: "in_delivery", tracking });
  addEvent(deal.listingId, "shipment_created", `DEMO courier label created for ${deal.buyerName} (tracking ${tracking.number})`, {
    dealId,
    buyerName: deal.buyerName,
    tracking: tracking.number,
  });
  tellBuyer(
    deal,
    `Sending it to a parcel locker with our DEMO courier — tracking number ${tracking.number}. The payment is released to the seller automatically when it's delivered.`,
    `locker-${deal.id}`,
  );
  return true;
}

const syncing = new Set<string>();

/** Advances a locker deal's tracking to `nowMs`; on delivered, captures the payment and completes the sale. */
export async function syncTracking(dealId: string, nowMs = Date.now(), stripe?: StripeLike): Promise<void> {
  const deal = getDeal(dealId);
  if (!deal || deal.status !== "in_delivery" || !deal.tracking || syncing.has(dealId)) return;

  syncing.add(dealId);
  try {
    const { tracking, added } = advanceTracking(deal.tracking, nowMs);
    const current = added.length ? saveDeal({ ...deal, tracking }) : deal;
    for (const e of added) {
      addEvent(deal.listingId, "tracking_update", `DEMO courier: ${STEP_LABEL[e.status]}`, { dealId, status: e.status });
    }
    if (isDelivered(tracking)) {
      try {
        await completeSale(current, stripe ?? getStripe(), `Delivered to ${deal.buyerName}'s locker`);
      } catch (err) {
        console.error("capture on delivery failed; will retry on next poll", err);
      }
    }
  } finally {
    syncing.delete(dealId);
  }
}
