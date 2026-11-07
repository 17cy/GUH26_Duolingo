import { describe, expect, it } from "vitest";
import { checkMessage } from "./scam";

const APP = "http://localhost:3000";

describe("checkMessage — blocking scams", () => {
  it.each([
    ["Click https://bit.ly/pay-now to get paid", "external_link"],
    ["go to paypa1-secure.com/claim", "external_link"],
    ["My courier will collect it tomorrow", "courier_scam"],
    ["I'll use a shipping agent, they send a courier link", "courier_scam"],
    ["I'll overpay and you send the difference back", "overpayment"],
    ["Please refund the extra £50", "overpayment"],
    ["Scan to receive your payment", "fake_payment"],
    ["Verify your card so I can pay", "fake_payment"],
    ["I already sent the money, check your email for payment", "fake_payment"],
    ["Can you send it first? I'll pay after", "ship_before_pay"],
    ["Please post it first", "ship_before_pay"],
    ["I can't ship before I pay... I mean you ship before I pay", "ship_before_pay"],
  ])("%s → %s (blocked)", (text, flag) => {
    const r = checkMessage(text, APP);
    expect(r.flags).toContain(flag);
    expect(r.block).toBe(true);
  });
});

describe("checkMessage — flag but don't block", () => {
  it.each([
    ["Can I WhatsApp you?", "off_platform"],
    ["add me on telegram", "off_platform"],
    ["message me on Signal", "off_platform"],
    ["just text me", "off_platform"],
    ["call me later", "off_platform"],
    ["here's my number", "off_platform"],
    ["email me the details", "off_platform"],
  ])("%s → %s", (text, flag) => {
    const r = checkMessage(text, APP);
    expect(r.flags).toContain(flag);
    expect(r.block).toBe(false);
  });

  it("strips phone numbers and emails", () => {
    const r = checkMessage("Text me on 07700 900123 or bob.smith+x@gmail.com", APP);
    expect(r.flags).toEqual(expect.arrayContaining(["off_platform", "contact_details"]));
    expect(r.block).toBe(false);
    expect(r.sanitized).not.toMatch(/07700|900123|gmail/);
  });

  it("detects +44 numbers", () => {
    expect(checkMessage("ring +44 7700 900 123", APP).flags).toContain("contact_details");
  });

  it("strips external links from sanitized text", () => {
    expect(checkMessage("see https://evil.example/x", APP).sanitized).not.toContain("evil");
  });
});

describe("checkMessage — normal messages are not flagged", () => {
  it.each([
    "Is it still available?",
    "Can you do £100?",
    "Does it come with the case?",
    "Can I collect on Saturday?",
    "How's the battery life?",
    "How's the bluetooth signal?",
    "I'll pay £115.50 for it",
    "Would 11000 work? I'm in Dublin 8",
  ])("%s", (text) => {
    const r = checkMessage(text, APP);
    expect(r.flags).toEqual([]);
    expect(r.block).toBe(false);
    expect(r.sanitized).toBe(text);
  });

  it("our own app URL is allowed", () => {
    const r = checkMessage("I paid at http://localhost:3000/buy/seed-sony", APP);
    expect(r.flags).toEqual([]);
  });
});
