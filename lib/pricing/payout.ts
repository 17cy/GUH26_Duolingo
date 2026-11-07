import type { Category, Style } from "@/lib/types";

// SPEC.md "Payout maths". All amounts integer pence.

export const STYLE_FACTOR: Record<Style, number> = { firm: 0.95, flexible: 0.9, quick: 0.85 };

// Approximate card fee. Keep this the only place it's defined.
export const PAYMENT_FEE_RATE = 0.015;
export const PAYMENT_FEE_FIXED = 20;

export type LockerSize = "small" | "medium" | "large";
export const LOCKER_PRICE: Record<LockerSize, number> = { small: 350, medium: 650, large: 1200 };

export const CATEGORY_SIZE: Record<Category, LockerSize> = {
  headphones: "medium",
  electronics: "small",
  textbooks: "small",
  clothing_winter: "medium",
  bikes: "large",
  furniture: "large",
  other: "medium",
};

export interface PayoutLine {
  label: string;
  amount: number; // positive = money in, negative = deduction
}

export interface HandoffPayout {
  shipping: number;
  net: number;
  percentOfList: number;
  lines: PayoutLine[];
}

export interface Payout {
  listPrice: number;
  expectedDeal: number;
  paymentFee: number;
  pickup: HandoffPayout;
  locker: HandoffPayout & { size: LockerSize };
}

export function paymentFee(amount: number): number {
  return Math.round(amount * PAYMENT_FEE_RATE) + PAYMENT_FEE_FIXED;
}

export function netPayout(listPrice: number, style: Style, category: Category): Payout {
  const expectedDeal = Math.round(listPrice * STYLE_FACTOR[style]);
  const fee = paymentFee(expectedDeal);
  const size = CATEGORY_SIZE[category];

  const handoff = (shipping: number): HandoffPayout => {
    const net = Math.max(0, expectedDeal - fee - shipping);
    return {
      shipping,
      net,
      percentOfList: listPrice > 0 ? (net / listPrice) * 100 : 0,
      lines: [
        { label: "Expected deal after negotiation", amount: expectedDeal },
        { label: "Payment fee", amount: -fee },
        { label: "Shipping", amount: shipping === 0 ? 0 : -shipping },
      ],
    };
  };

  return { listPrice, expectedDeal, paymentFee: fee, pickup: handoff(0), locker: { ...handoff(LOCKER_PRICE[size]), size } };
}
