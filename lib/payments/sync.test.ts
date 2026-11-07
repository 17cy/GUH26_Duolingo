import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents } from "@/lib/events";
import { getDeal, saveDeal } from "@/lib/store";
import { syncPaymentFromStripe, type StripeLike } from "./stripe";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "selly-sync-"));
  process.env.DB_PATH = path.join(dir, "db.json");
  saveDeal({ id: "deal1", listingId: "seed-sony", buyerName: "Sam", price: 11500, status: "awaiting_payment", stripeSessionId: "cs_test_1", createdAt: "2026-11-07T10:00:00.000Z" });
});
afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

function stripeReturning(session: Record<string, unknown>) {
  const retrieve = vi.fn(async () => session);
  return { stripe: { checkout: { sessions: { retrieve } }, paymentIntents: {} } as unknown as StripeLike, retrieve };
}

const paid = {
  id: "cs_test_1",
  status: "complete",
  metadata: { dealId: "deal1" },
  amount_total: 11500,
  payment_intent: { id: "pi_1", status: "requires_capture" },
};

describe("syncPaymentFromStripe — no webhook needed", () => {
  it("marks the payment held when Stripe says the checkout is complete and the money is held", async () => {
    const { stripe, retrieve } = stripeReturning(paid);
    await syncPaymentFromStripe("deal1", stripe, 1_000_000);
    expect(retrieve).toHaveBeenCalledWith("cs_test_1", { expand: ["payment_intent"] });
    expect(getDeal("deal1")).toMatchObject({ status: "payment_held", paymentIntentId: "pi_1" });
    expect(listEvents("seed-sony").map((e) => e.type)).toContain("payment_held");
  });

  it("does nothing while the buyer hasn't paid", async () => {
    const { stripe } = stripeReturning({ ...paid, status: "open", payment_intent: null });
    await syncPaymentFromStripe("deal1", stripe, 2_000_000);
    expect(getDeal("deal1")!.status).toBe("awaiting_payment");
  });

  it("does nothing if the money isn't actually held", async () => {
    const { stripe } = stripeReturning({ ...paid, payment_intent: { id: "pi_1", status: "requires_payment_method" } });
    await syncPaymentFromStripe("deal1", stripe, 3_000_000);
    expect(getDeal("deal1")!.status).toBe("awaiting_payment");
  });

  it("asks Stripe at most every 3 seconds per deal", async () => {
    const { stripe, retrieve } = stripeReturning({ ...paid, status: "open", payment_intent: null });
    await syncPaymentFromStripe("deal1", stripe, 4_000_000);
    await syncPaymentFromStripe("deal1", stripe, 4_001_000);
    await syncPaymentFromStripe("deal1", stripe, 4_003_500);
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("ignores deals that aren't waiting for payment", async () => {
    saveDeal({ ...getDeal("deal1")!, status: "approved" });
    const { stripe, retrieve } = stripeReturning(paid);
    await syncPaymentFromStripe("deal1", stripe, 5_000_000);
    expect(retrieve).not.toHaveBeenCalled();
  });
});
