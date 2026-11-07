// Pulls the seller's wanted price out of their chat message. Currency is always pounds.
// Returns integer pence, or undefined if no price is clearly stated.

const AMOUNT = String.raw`(\d{1,6})(?:\.(\d{1,2}))?`;

const PATTERNS = [
  new RegExp(String.raw`£\s?${AMOUNT}`), // £120, £ 119.99
  new RegExp(String.raw`\b${AMOUNT}\s?(?:pounds?|quid|gbp)\b`, "i"), // 120 pounds, 15 quid
  // "want 120", "asking 65", "for 80", "around 30", "wanted price: 40", but not "for 2 years"
  new RegExp(
    String.raw`\b(?:want(?:ed)?(?: price)?|asking|for|around|about)\s*(?:is|of)?\s*:?\s*${AMOUNT}\b(?!\s*(?:years?|months?|weeks?|days?|hours?|w\b|gb\b|tb\b))`,
    "i",
  ),
];

export function extractWantedPrice(text: string): number | undefined {
  for (const pattern of PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const pence = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
      return pence > 0 ? pence : undefined;
    }
  }
  return undefined;
}
