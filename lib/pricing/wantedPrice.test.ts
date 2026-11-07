import { describe, expect, it } from "vitest";
import { extractWantedPrice } from "./wantedPrice";

describe("extractWantedPrice (pence)", () => {
  it.each([
    ["Sony headphones, want £120", 12000],
    ["£119.99 or near offer", 11999],
    ["£ 45", 4500],
    ["mouse, 15 quid", 1500],
    ["120 pounds please", 12000],
    ["selling for 80", 8000],
    ["asking 65.5", 6550],
    ["looking for around £30", 3000],
    ["wanted price: 40", 4000],
  ])("%s → %i", (text, pence) => {
    expect(extractWantedPrice(text)).toBe(pence);
  });

  it.each([
    "Sony WH-1000XM4, barely used",
    "Anker 65W USB-C charger",
    "iPhone 12 in good condition",
    "used for 2 years",
    "baseus mouse, almost new",
    "",
  ])("no price in %j", (text) => {
    expect(extractWantedPrice(text)).toBeUndefined();
  });
});
