import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addEvent, listEvents } from "./events";
import { getListing, listListings, saveListing } from "./store";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "selly-"));
  process.env.DB_PATH = path.join(dir, "db.json");
});

afterEach(() => {
  delete process.env.DB_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("creates the db from seed and round-trips a listing", () => {
    expect(getListing("seed-sony")?.listPrice).toBe(14000);
    expect(listListings()).toHaveLength(2);

    const sony = getListing("seed-sony")!;
    saveListing({ ...sony, status: "sold" });
    expect(getListing("seed-sony")?.status).toBe("sold");
    expect(listListings()).toHaveLength(2);
  });

  it("stores events in the same db file", () => {
    addEvent("seed-sony", "offer_received", "Offer of £100", { offer: 10000 });
    expect(listEvents("seed-sony").map((e) => e.type)).toEqual(["posted", "offer_received"]);
  });
});
