import { nanoid } from "nanoid";
import { readDb, writeDb } from "./store";
import type { EventType, TimelineEvent } from "./types";

export function addEvent(
  listingId: string,
  type: EventType,
  message: string,
  data?: Record<string, unknown>,
): TimelineEvent {
  const event: TimelineEvent = {
    id: nanoid(),
    listingId,
    type,
    message,
    ...(data ? { data } : {}),
    createdAt: new Date().toISOString(),
  };
  const db = readDb();
  db.events.push(event);
  writeDb(db);
  return event;
}

// Events for a listing, oldest first.
export function listEvents(listingId: string): TimelineEvent[] {
  return readDb().events.filter((e) => e.listingId === listingId);
}
