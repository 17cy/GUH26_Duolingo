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
}

/** ok=false means the text mentioned a price it shouldn't; the caller should use a template. */
export function filterAgentText(text: string, opts: FilterOptions): { text: string; ok: boolean } {
  const cleaned = text
    .replace(LINK, (m) => (opts.allowedUrls.includes(m.replace(/[.,!?)]+$/, "")) ? m : ""))
    .replace(EMAIL, "")
    .replace(PHONE, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const ok = findPoundAmounts(cleaned).every((p) => opts.allowedPence.includes(p) && !opts.forbiddenPence.includes(p));
  return { text: cleaned, ok };
}
