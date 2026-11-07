// Scam filter from SPEC.md "Scam filter". Runs on every buyer message before the model sees it.

export type ScamFlag =
  | "off_platform"
  | "contact_details"
  | "external_link"
  | "courier_scam"
  | "overpayment"
  | "fake_payment"
  | "ship_before_pay";

export interface ScamCheck {
  flags: ScamFlag[];
  block: boolean;
  /** The message with phone numbers, emails and external links removed. */
  sanitized: string;
}

const BLOCKING: ReadonlySet<ScamFlag> = new Set([
  "external_link",
  "courier_scam",
  "overpayment",
  "fake_payment",
  "ship_before_pay",
]);

const PHRASES: [ScamFlag, RegExp][] = [
  // "signal" only as a messaging app, so "bluetooth signal" stays clean.
  ["off_platform", /\b(whats\s?app|telegram|text me|call me|ring me|my number|email me)\b|\b(on|via|use) signal\b|\bsignal me\b/i],
  ["courier_scam", /\bmy courier\b|\bshipping agent\b|\bcourier link\b/i],
  ["overpayment", /\boverpa(y|id|ying|yment)\b|\bsend (me |back )?the difference\b|\brefund the (extra|difference)\b/i],
  [
    "fake_payment",
    /\bscan (this |the )?(qr )?(code )?to receive\b|\bverify your (card|bank|account)\b|\balready (sent|paid|transferred)( you)?( the)? (money|payment)\b|\bcheck your (email|inbox) for (the )?payment\b/i,
  ],
  ["ship_before_pay", /\b(send|post|ship) it (to me )?first\b|\b(send|post|ship)( it)? before (i|we) pay\b/i],
];

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// 9+ digits, optionally with +, spaces, dashes, dots or brackets between them.
const PHONE = /\+?\(?\d(?:[\s\-.()]*\d){8,}/g;
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co\.uk|uk|ie|net|org|ly|me|io|link|xyz|info|app|site|shop)\b(?:\/[^\s<>"]*)?/gi;

function hostOf(raw: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).host.toLowerCase();
  } catch {
    return null;
  }
}

export function checkMessage(text: string, appUrl = process.env.APP_URL ?? "http://localhost:3000"): ScamCheck {
  const flags = new Set<ScamFlag>();
  for (const [flag, re] of PHRASES) if (re.test(text)) flags.add(flag);

  const ownHost = hostOf(appUrl);
  // Emails first, so "gmail.com" inside an address isn't treated as a link.
  let sanitized = text.replace(EMAIL, () => {
    flags.add("contact_details");
    return "[contact removed]";
  });
  sanitized = sanitized.replace(LINK, (m) => {
    if (hostOf(m) === ownHost) return m;
    flags.add("external_link");
    return "[link removed]";
  });
  sanitized = sanitized.replace(PHONE, () => {
    flags.add("contact_details");
    return "[contact removed]";
  });

  const list = [...flags];
  return { flags: list, block: list.some((f) => BLOCKING.has(f)), sanitized };
}
