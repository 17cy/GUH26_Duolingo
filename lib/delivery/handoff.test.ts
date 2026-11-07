import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents } from "@/lib/events";
import { captureByToken, type StripeLike } from "@/lib/payments/stripe";
import { getDeal, getListing, saveDeal } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { chooseLocker, choosePickup, syncTracking } from "./handoff";
import { STEP_MS } from "./mockCourier";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "selly-b4-"));
  process.env.DB_PATH = path.join(dir, "db.json");
});
afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

function heldDeal(overrides: Partial<Deal> = {}): Deal {
  return saveDeal({
    id: "deal1",
    listingId: "seed-sony",
    buyerName: "Sam",
    price: 11500,
    status: "payment_held",
    paymentIntentId: "pi_1",
    handoffToken: "tok",
    createdAt: "2026-11-07T10:00:00.000Z",
    ...overrides,
  });
}

function fakeStripe() {
  const capture = vi.fn(async () => ({ status: "succeeded" }));
  return { stripe: { paymentIntents: { capture, cancel: vi.fn() }, checkout: { sessions: {} } } as unknown as StripeLike, capture };
}

const types = () => listEvents("seed-sony").map((e) => e.type);

describe("locker path", () => {
  it("goes from payment_held to completed + delisted everywhere by itself", async () => {
    heldDeal();
    const { stripe, capture } = fakeStripe();

    expect(chooseLocker("deal1", T0)).toBe(true);
    expect(getDeal("deal1")).toMatchObject({ status: "in_delivery", handoffMethod: "locker" });
    expect(getDeal("deal1")!.handoffToken).toBeUndefined(); // no QR capture on the locker path
    expect(types()).toContain("shipment_created");

    await syncTracking("deal1", T0 + STEP_MS, stripe);
    expect(getDeal("deal1")!.status).toBe("in_delivery");
    expect(capture).not.toHaveBeenCalled();

    await syncTracking("deal1", T0 + 3 * STEP_MS, stripe);
    await syncTracking("deal1", T0 + 4 * STEP_MS, stripe);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(getDeal("deal1")!.status).toBe("completed");
    expect(getListing("seed-sony")!.status).toBe("sold");
    expect(types().filter((t) => t === "tracking_update")).toHaveLength(3);
    expect(listEvents("seed-sony").filter((e) => e.type === "delisted").map((e) => e.data?.platform)).toEqual([
      "ebay",
      "vinted",
      "donedeal",
    ]);
    expect(types()).toEqual(expect.arrayContaining(["payment_captured", "sold", "payout_sent"]));
  });

  it("stays in delivery and retries if capture fails", async () => {
    heldDeal();
    chooseLocker("deal1", T0);
    const { stripe, capture } = fakeStripe();
    capture.mockRejectedValueOnce(new Error("network"));
    await syncTracking("deal1", T0 + 3 * STEP_MS, stripe);
    expect(getDeal("deal1")!.status).toBe("in_delivery");
    await syncTracking("deal1", T0 + 3 * STEP_MS, stripe);
    expect(getDeal("deal1")!.status).toBe("completed");
    expect(capture).toHaveBeenCalledTimes(2);
  });
});

describe("pickup path", () => {
  it("books a slot once, tells the seller, and keeps the QR handoff", () => {
    heldDeal();
    expect(choosePickup("deal1", 1, T0)).toBe(true);
    const d = getDeal("deal1")!;
    expect(d).toMatchObject({ status: "payment_held", handoffMethod: "pickup", handoffToken: "tok" });
    expect(d.pickupSlot).toBeTruthy();
    expect(types()).toContain("pickup_scheduled");
    expect(choosePickup("deal1", 0, T0)).toBe(false);
    expect(chooseLocker("deal1", T0)).toBe(false);
  });

  it("rejects an invalid slot or a deal that isn't paid", () => {
    heldDeal({ status: "awaiting_payment" });
    expect(choosePickup("deal1", 0, T0)).toBe(false);
    heldDeal();
    expect(choosePickup("deal1", 5, T0)).toBe(false);
  });

  it("QR scan after pickup completes the sale and delists everywhere", async () => {
    heldDeal();
    choosePickup("deal1", 0, T0);
    const { stripe } = fakeStripe();
    await captureByToken("tok", stripe);
    expect(getDeal("deal1")!.status).toBe("completed");
    expect(types().filter((t) => t === "delisted")).toHaveLength(3);
  });
});
