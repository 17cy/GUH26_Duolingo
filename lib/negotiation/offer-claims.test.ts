import { describe, expect, it } from "vitest";
import { parseOfferPence } from "./offer";
import { filterAgentText } from "./output";

const MOUSE_LIST = 4700; // Baseus mouse, floor £38

describe("parseOfferPence: bare numbers in a negotiation (with list price)", () => {
  it.each([
    ["38", 3800],
    ["41", 4100],
    ["40 last price", 4000],
    ["42 last or im leaving", 4200],
    ["43 im done", 4300],
    ["44", 4400],
    ["45 sure omg", 4500],
    ["39.50?", 3950],
  ])("%s → %i", (text, pence) => {
    expect(parseOfferPence(text, MOUSE_LIST)).toBe(pence);
  });

  it.each([
    "iPhone 12 condition?",
    "I'm in Dublin 8",
    "2 items please",
    "3 years old?",
    "64 GB?",
    "1", // far below any sensible offer for a £47 item
    "5000", // far above
    "Can I collect on Saturday?",
  ])("no offer in %j", (text) => {
    expect(parseOfferPence(text, MOUSE_LIST)).toBeNull();
  });

  it("keeps the old behaviour without a list price", () => {
    expect(parseOfferPence("41")).toBeNull();
    expect(parseOfferPence("do 35")).toBe(3500);
  });
});

describe("filterAgentText: no false 'best/lowest/final price' claims", () => {
  const opts = { allowedPence: [4500, 3800, 4700], forbiddenPence: [], allowedUrls: [] };

  it.each([
    "£45 is the best I can do on this one.",
    "The lowest I can go is £45 for these.",
    "£45 is my final price.",
    "Sorry, I can't go any lower than £45.",
    "That's rock-bottom at £45.",
  ])("blocks %j on a non-final counter", (text) => {
    expect(filterAgentText(text, opts).ok).toBe(false);
  });

  it("allows the claim when the policy says it is final", () => {
    expect(filterAgentText("£38 is my final price.", { ...opts, finalAllowed: true }).ok).toBe(true);
  });

  it("allows ordinary counter wording", () => {
    expect(filterAgentText("I can do £45 for it. It's in like-new condition with no defects.", opts).ok).toBe(true);
    expect(filterAgentText("The current asking price is £45.", opts).ok).toBe(true);
  });
});
