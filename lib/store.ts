import fs from "node:fs";
import path from "node:path";
import type { Deal, Listing, Message, TimelineEvent } from "./types";

// JSON-file storage. data/db.json is created from data/seed.json if missing.
// DB_PATH overrides the location (used by tests so they never touch the real db).

export interface Db {
  listings: Listing[];
  deals: Deal[];
  messages: Message[];
  events: TimelineEvent[];
}

const SEED_PATH = path.join(process.cwd(), "data", "seed.json");

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "db.json");
}

export function readDb(): Db {
  const file = dbPath();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(SEED_PATH, file);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Db;
}

export function writeDb(db: Db): void {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2));
}

function upsert<T extends { id: string }>(rows: T[], row: T): void {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i === -1) rows.push(row);
  else rows[i] = row;
}

export function getListing(id: string): Listing | undefined {
  return readDb().listings.find((l) => l.id === id);
}

export function saveListing(listing: Listing): Listing {
  const db = readDb();
  upsert(db.listings, listing);
  writeDb(db);
  return listing;
}

export function listListings(): Listing[] {
  return readDb().listings;
}

export function getDeal(id: string): Deal | undefined {
  return readDb().deals.find((d) => d.id === id);
}

export function saveDeal(deal: Deal): Deal {
  const db = readDb();
  upsert(db.deals, deal);
  writeDb(db);
  return deal;
}

// Messages for a listing, optionally one buyer's conversation, oldest first.
export function listMessages(listingId: string, buyerName?: string): Message[] {
  return readDb().messages.filter(
    (m) => m.listingId === listingId && (buyerName === undefined || m.buyerName === buyerName),
  );
}

export function addMessage(message: Message): Message {
  const db = readDb();
  db.messages.push(message);
  writeDb(db);
  return message;
}
