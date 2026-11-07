import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents } from "@/lib/events";
import { getDeal, getListing, listMessages, saveDeal } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { cancelDeal, captureByToken, checkoutSessionParams, ensurePaymentLink, markPaymentHeld, type StripeLike } from "./stripe";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "selly-pay-"));
  process.env.DB_PATH = path.join(dir, "db.json");
  process.env.APP_URL = "http://localhost:3000";
});
afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

function deal(overrides: Partial<Deal> = {}): Deal {
  return saveDeal({
    id: "deal1",
    listingId: "seed-sony",
    buyerName: "Sam",
    price: 11500,
    status: "approved",
    createdAt: "2026-11-07T10:00:00.000Z",
    ...overrides,
  });
}

function fakeStripe(): StripeLike & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { create: [], capture: [], cancel: [], expire: [] };
  return {
    calls,
    checkout: {
      sessions: {
        create: vi.fn(async (params: unknown) => {
          calls.create.push(params);
          return { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" };
        }),
        expire: vi.fn(async (id: string) => {
          calls.expire.push(id);
          return {};
        }),
      },
    },
    paymentIntents: {
      capture: vi.fn(async (id: string) => {
        calls.capture.push(id);
        return { status: "succeeded" };
      }),
      cancel: vi.fn(async (id: string) => {
        calls.cancel.push(id);
        return { status: "canceled" };
      }),
    },
  } as unknown as StripeLike & { calls: Record<string, unknown[]> };
}

describe("checkoutSessionParams", () => {
  it("locks the exact amount, manual capture, 30-minute expiry", () => {
    const now = Date.UTC(2026, 10, 7, 12, 0, 0);
    const p = checkoutSessionParams(deal(), "Sony WH-1000XM4", "http://localhost:3000", now);
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([
      { quantity: 1, price_data: { currency: "gbp", unit_amount: 11500, product_data: { name: "Sony WH-1000XM4" } } },
    ]);
    expect(p.payment_intent_data).toMatchObject({ capture_method: "manual", metadata: { dealId: "deal1" } });
    expect(p.metadata).toEqual({ dealId: "deal1" });
    const minutes = (p.expires_at! * 1000 - now) / 60000;
    expect(minutes).toBeGreaterThanOrEqual(30);
    expect(minutes).toBeLessThan(32);
    expect(p.success_url).toBe("http://localhost:3000/buy/seed-sony?paid=1");
  });
});

describe("ensurePaymentLink", () => {
  it("creates one link for an approved deal and posts it in the buyer chat", async () => {
    deal();
    const stripe = fakeStripe();
    await ensurePaymentLink("deal1", stripe);
    await ensurePaymentLink("deal1", stripe);
    expect(stripe.calls.create).toHaveLength(1);
    expect(getDeal("deal1")).toMatchObject({ status: "awaiting_payment", stripeSessionId: "cs_test_1" });
    expect(listMessages("seed-sony", "Sam").filter((m) => m.text.includes("checkout.stripe.com"))).toHaveLength(1);
    expect(listEvents("seed-sony").map((e) => e.type)).toContain("payment_link_sent");
  });

  it("does nothing before seller approval", async () => {
    deal({ status: "awaiting_seller_approval" });
    const stripe = fakeStripe();
    await ensurePaymentLink("deal1", stripe);
    expect(stripe.calls.create).toHaveLength(0);
  });
});

describe("markPaymentHeld", () => {
  it("moves awaiting_payment → payment_held with a 32-byte handoff token, once", () => {
    deal({ status: "awaiting_payment", stripeSessionId: "cs_test_1" });
    markPaymentHeld({ id: "cs_test_1", metadata: { dealId: "deal1" }, payment_intent: "pi_1", amount_total: 11500 });
    const d = getDeal("deal1")!;
    expect(d).toMatchObject({ status: "payment_held", paymentIntentId: "pi_1" });
    expect(Buffer.from(d.handoffToken!, "base64url")).toHaveLength(32);
    markPaymentHeld({ id: "cs_test_1", metadata: { dealId: "deal1" }, payment_intent: "pi_1", amount_total: 11500 });
    expect(listEvents("seed-sony").filter((e) => e.type === "payment_held")).toHaveLength(1);
  });

  it("ignores sessions that don't match the deal or amount", () => {
    deal({ status: "awaiting_payment", stripeSessionId: "cs_test_1" });
    markPaymentHeld({ id: "cs_other", metadata: { dealId: "deal1" }, payment_intent: "pi_1", amount_total: 11500 });
    markPaymentHeld({ id: "cs_test_1", metadata: { dealId: "deal1" }, payment_intent: "pi_1", amount_total: 100 });
    expect(getDeal("deal1")!.status).toBe("awaiting_payment");
  });
});

describe("captureByToken", () => {
  it("captures, completes the deal, marks the listing sold, and the token is single use", async () => {
    deal({ status: "payment_held", paymentIntentId: "pi_1", handoffToken: "tok" });
    const stripe = fakeStripe();
    const first = await captureByToken("tok", stripe);
    expect(first?.id).toBe("deal1");
    expect(stripe.calls.capture).toEqual(["pi_1"]);
    expect(getDeal("deal1")).toMatchObject({ status: "completed" });
    expect(getDeal("deal1")!.handoffToken).toBeUndefined();
    expect(getListing("seed-sony")!.status).toBe("sold");
    const types = listEvents("seed-sony").map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["handed_over", "payment_captured", "sold", "payout_sent"]));
    expect(await captureByToken("tok", stripe)).toBeNull();
    expect(stripe.calls.capture).toHaveLength(1);
  });

  it("restores the token if Stripe capture fails", async () => {
    deal({ status: "payment_held", paymentIntentId: "pi_1", handoffToken: "tok" });
    const stripe = fakeStripe();
    stripe.paymentIntents.capture = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as StripeLike["paymentIntents"]["capture"];
    await expect(captureByToken("tok", stripe)).rejects.toThrow();
    expect(getDeal("deal1")).toMatchObject({ status: "payment_held", handoffToken: "tok" });
  });
});

describe("cancelDeal", () => {
  it("cancels a held payment and invalidates the token", async () => {
    deal({ status: "payment_held", paymentIntentId: "pi_1", handoffToken: "tok" });
    const stripe = fakeStripe();
    expect(await cancelDeal("deal1", stripe)).toBe(true);
    expect(stripe.calls.cancel).toEqual(["pi_1"]);
    expect(getDeal("deal1")).toMatchObject({ status: "cancelled" });
    expect(getDeal("deal1")!.handoffToken).toBeUndefined();
    expect(listEvents("seed-sony").map((e) => e.type)).toContain("payment_cancelled");
  });

  it("expires an unpaid checkout session", async () => {
    deal({ status: "awaiting_payment", stripeSessionId: "cs_test_1" });
    const stripe = fakeStripe();
    expect(await cancelDeal("deal1", stripe)).toBe(true);
    expect(stripe.calls.expire).toEqual(["cs_test_1"]);
  });

  it("refuses to cancel a completed deal", async () => {
    deal({ status: "completed" });
    expect(await cancelDeal("deal1", fakeStripe())).toBe(false);
  });
});
