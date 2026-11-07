import { describe, expect, it } from "vitest";
import { agreedDealStatus } from "./approval";

describe("agreedDealStatus — the seller's floor is their pre-approval", () => {
  it("auto-approves a deal at or above the floor", () => {
    expect(agreedDealStatus(11500, 11000)).toBe("approved");
    expect(agreedDealStatus(11000, 11000)).toBe("approved");
  });

  it("falls back to asking the seller if a price is ever below the floor or the floor is missing", () => {
    expect(agreedDealStatus(10999, 11000)).toBe("awaiting_seller_approval");
    expect(agreedDealStatus(11500, undefined)).toBe("awaiting_seller_approval");
  });
});
