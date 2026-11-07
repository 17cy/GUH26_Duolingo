// Deterministic offer parsing. The buyer's offer comes from their text, not from the model.

const MONEY = /£\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s?(?:pounds?|quid|gbp)\b/gi;
const BARE = /\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\b/;
const OFFER_WORDS = /\b(offer|do|pay|take|give|how about|would|accept|for|sell)\b/i;

const toPence = (whole: string, frac?: string) => Number(whole.replace(/,/g, "")) * 100 + (frac ? Number(frac) : 0);

/** Every £ amount mentioned in the text, in pence. */
export function findPoundAmounts(text: string): number[] {
  return [...text.matchAll(MONEY)].map((m) => (m[1] ? toPence(m[1], m[2]) : toPence(m[3], m[4])));
}

// A number that STARTS the message ("41", "40 last price", "43 im done") and isn't a quantity or unit.
const LEADING = /^\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?![\d.,])(?!\s*(?:x\b|%|items?\b|pcs\b|pieces?\b|years?\b|yrs?\b|months?\b|weeks?\b|days?\b|hours?\b|mins?\b|minutes?\b|km\b|miles?\b|gb\b|tb\b|mb\b|cm\b|mm\b|inch))/i;

/**
 * The buyer's offer in pence, or null if the message doesn't contain one.
 * With the list price, a bare leading number in a plausible range (10%–200% of list) also counts,
 * so "41" or "43 im done" are offers but "iPhone 12" or "Dublin 8" are not.
 */
export function parseOfferPence(text: string, listPrice?: number): number | null {
  const money = findPoundAmounts(text);
  if (money.length) return money[0];
  if (OFFER_WORDS.test(text)) {
    const bare = text.match(BARE);
    if (bare) return toPence(bare[1], bare[2]);
  }
  if (listPrice === undefined) return null;
  const lead = text.match(LEADING);
  if (!lead) return null;
  const pence = toPence(lead[1], lead[2]);
  return pence >= listPrice * 0.1 && pence <= listPrice * 2 ? pence : null;
}
