// SPEC "Delivery": pickup proposes 3 time slots at a public meeting point (never an address).

export const MEETING_POINT = "a public place: the main entrance of the nearest train station";

const HOURS = [12, 15, 18];

/** Three slots tomorrow. Stable for a whole day, so the slot the buyer saw is the slot they book. */
export function proposePickupSlots(nowMs: number): string[] {
  const day = new Date(nowMs);
  day.setDate(day.getDate() + 1);
  const date = day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return HOURS.map((h) => `${date}, ${String(h).padStart(2, "0")}:00`);
}
