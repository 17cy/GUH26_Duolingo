import { findPoundAmounts } from "./offer";

// Output filter for agent messages (SPEC "Security"): no phone numbers, emails, or links except
// our own payment link, and no price the policy didn't allow.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\(?\d(?:[\s\-.()]*\d){8,}/g;
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

export interface FilterOptions {
  /** Prices the agent may mention (policy price, list price, buyer's own offer). */
  allowedPence: number[];
  /** Prices that must never appear (the floor, unless it's the policy price). */
  forbiddenPence: number[];
  allowedUrls: string[];
  /** True only when policy.ts marked this counter final (the floor). Otherwise "best/lowest/final price" is a false claim. */
  finalAllowed?: boolean;
}

// Claims that a price can't go lower. Only true on the policy's final counter.
const FINAL_CLAIM =
  /\b(?:best (?:i|we) can do|lowest (?:i|we) can (?:go|do)|(?:my|our|the) (?:final|lowest|best) (?:price|offer)|final (?:price|offer)|can'?t go (?:any )?lower|won'?t go (?:any )?lower|can'?t do (?:any )?(?:lower|less|better)|rock[- ]bottom|absolute (?:minimum|lowest)|as low as (?:i|we) can go|that'?s my limit)\b/i;

/** ok=false means the text mentioned a price it shouldn't, or falsely called a price final; the caller should use a template. */
export function filterAgentText(text: string, opts: FilterOptions): { text: string; ok: boolean } {
  const cleaned = text
    .replace(LINK, (m) => (opts.allowedUrls.includes(m.replace(/[.,!?)]+$/, "")) ? m : ""))
    .replace(EMAIL, "")
    .replace(PHONE, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const pricesOk = findPoundAmounts(cleaned).every((p) => opts.allowedPence.includes(p) && !opts.forbiddenPence.includes(p));
  const claimsOk = opts.finalAllowed === true || !FINAL_CLAIM.test(cleaned);
  return { text: cleaned, ok: pricesOk && claimsOk };
}
