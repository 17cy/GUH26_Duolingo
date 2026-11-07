import { describe, expect, it } from "vitest";
import { parseItem } from "./identify";

const sample = `{
  "name": "Sony WH-1000XM4",
  "brand": "Sony",
  "model": "WH-1000XM4",
  "category": "headphones",
  "condition": "good",
  "defects": ["light wear on headband"],
  "confidence": 0.92
}`;

describe("parseItem", () => {
  it("parses a valid model response", () => {
    const r = parseItem(sample);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.name).toBe("Sony WH-1000XM4");
      expect(r.item.category).toBe("headphones");
      expect(r.item.defects).toEqual(["light wear on headband"]);
    }
  });

  it("accepts JSON wrapped in a code fence with surrounding text", () => {
    const r = parseItem("Here you go:\n```json\n" + sample + "\n```");
    expect(r.ok).toBe(true);
  });

  it("treats null brand/model as absent", () => {
    const r = parseItem(sample.replace('"Sony",', "null,").replace('"WH-1000XM4",\n  "category"', 'null,\n  "category"'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.brand).toBeUndefined();
      expect(r.item.model).toBeUndefined();
    }
  });

  it("rejects an unknown category", () => {
    const r = parseItem(sample.replace('"headphones"', '"audio"'));
    expect(r.ok).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    expect(parseItem(sample.replace("0.92", "92")).ok).toBe(false);
  });

  it("rejects non-JSON text", () => {
    const r = parseItem("I think this is a pair of headphones.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });
});
