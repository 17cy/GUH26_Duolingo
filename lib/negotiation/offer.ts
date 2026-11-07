// Deterministic offer parsing. The buyer's offer comes from their text, not from the model.

const MONEY = /£\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s?(?:pounds?|quid|gbp)\b/gi;
const BARE = /\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\b/;
const OFFER_WORDS = /\b(offer|do|pay|take|give|how about|would|accept|for|sell)\b/i;

const toPence = (whole: string, frac?: string) => Number(whole.replace(/,/g, "")) * 100 + (frac ? Number(frac) : 0);

/** Every £ amount mentioned in the text, in pence. */
export function findPoundAmounts(text: string): number[] {
  return [...text.matchAll(MONEY)].map((m) => (m[1] ? toPence(m[1], m[2]) : toPence(m[3], m[4])));
}

/** The buyer's offer in pence, or null if the message doesn't contain one. */
export function parseOfferPence(text: string): number | null {
  const money = findPoundAmounts(text);
  if (money.length) return money[0];
  if (!OFFER_WORDS.test(text)) return null;
  const bare = text.match(BARE);
  return bare ? toPence(bare[1], bare[2]) : null;
}
