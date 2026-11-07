import { describe, expect, it } from "vitest";
import { advanceTracking, createShipment, isDelivered, STEP_MS } from "./mockCourier";
import { proposePickupSlots } from "./pickup";

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

describe("mock courier tracking state machine", () => {
  it("starts at label_created with a DEMO tracking number", () => {
    const t = createShipment(T0);
    expect(t.number).toMatch(/^SLY\d{9}$/);
    expect(t.events).toEqual([{ status: "label_created", at: new Date(T0).toISOString() }]);
  });

  it("advances one step every 10s, in order", () => {
    const t = createShipment(T0);
    expect(advanceTracking(t, T0 + STEP_MS - 1).added).toEqual([]);
    expect(advanceTracking(t, T0 + STEP_MS).added.map((e) => e.status)).toEqual(["collected"]);
    const later = advanceTracking(t, T0 + 2.5 * STEP_MS);
    expect(later.tracking.events.map((e) => e.status)).toEqual(["label_created", "collected", "in_transit"]);
    expect(later.tracking.events[2].at).toBe(new Date(T0 + 2 * STEP_MS).toISOString());
  });

  it("is delivered after 30s (well under a minute) and never goes past delivered", () => {
    const t = advanceTracking(createShipment(T0), T0 + 3 * STEP_MS).tracking;
    expect(isDelivered(t)).toBe(true);
    const again = advanceTracking(t, T0 + 99 * STEP_MS);
    expect(again.added).toEqual([]);
    expect(again.tracking.events).toHaveLength(4);
  });

  it("is idempotent: advancing twice to the same time adds nothing new", () => {
    const first = advanceTracking(createShipment(T0), T0 + STEP_MS);
    expect(advanceTracking(first.tracking, T0 + STEP_MS).added).toEqual([]);
  });
});

describe("pickup slots", () => {
  it("proposes 3 distinct future slots", () => {
    const slots = proposePickupSlots(T0);
    expect(slots).toHaveLength(3);
    expect(new Set(slots).size).toBe(3);
    for (const s of slots) expect(s).toMatch(/\d{2}:\d{2}/);
  });
});
