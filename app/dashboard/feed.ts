import type { EventType, TimelineEvent } from "@/lib/types";

// SPEC.md "Notifications": the dashboard feed shows only these event types.
// Lowball offers are summarised ("3 lowball offers declined"), never pushed one by one.

const TITLE: Partial<Record<EventType, string>> = {
  offer_received: "New offer",
  lowball_declined: "Lowball offers blocked",
  scam_flagged: "Scam attempt blocked",
  injection_attempt: "Suspicious message ignored",
  deal_proposed: "Deal agreed",
  payment_held: "Payment held",
  handed_over: "Handed over",
  sold: "Sold",
};

export interface FeedItem {
  id: string;
  type: EventType;
  title: string;
  message: string;
  createdAt: string;
}

/** Feed items, newest first. All lowball events collapse into one summary item. */
export function buildFeed(events: TimelineEvent[]): FeedItem[] {
  const items: (FeedItem & { order: number })[] = [];
  let lowballs = 0;
  let lastLowball: { at: string; order: number } | null = null;

  events.forEach((e, order) => {
    if (e.type === "lowball_declined") {
      lowballs++;
      lastLowball = { at: e.createdAt, order };
    } else if (TITLE[e.type]) {
      items.push({ id: e.id, type: e.type, title: TITLE[e.type]!, message: e.message, createdAt: e.createdAt, order });
    }
  });
  if (lastLowball) {
    const { at, order } = lastLowball;
    items.push({
      id: `lowballs-${lowballs}`,
      type: "lowball_declined",
      title: TITLE.lowball_declined!,
      message: `${lowballs} lowball offer${lowballs === 1 ? "" : "s"} declined`,
      createdAt: at,
      order,
    });
  }
  // Newest first; events logged in the same millisecond keep their logged order.
  items.sort((a, b) => (a.createdAt === b.createdAt ? b.order - a.order : a.createdAt < b.createdAt ? 1 : -1));
  return items.map(({ id, type, title, message, createdAt }) => ({ id, type, title, message, createdAt }));
}

/** Items to push as notifications: not seen before and not a lowball summary. Oldest first. */
export function newNotifications(feed: FeedItem[], seen: Set<string>): FeedItem[] {
  return feed.filter((f) => !seen.has(f.id) && f.type !== "lowball_declined").reverse();
}
