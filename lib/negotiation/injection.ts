// Prompt-injection detector from SPEC.md "Security". Visibility only: on a match we log an
// injection_attempt event and continue. The real defence is structural (no floor in context,
// every price checked by policy.ts).

const PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget)\b.{0,30}\b(instructions?|rules|prompt|guidelines)\b/,
  /(^|[\s[(<])system\s*:/,
  /\[\s*system\s*\]|<\s*\/?\s*system\s*>/,
  /\byou are now\b/,
  /\bdeveloper mode\b|\bdev mode\b|\bjailbreak\b/,
  /\bnew instructions?\b/,
  /\b(reveal|show|print|repeat)\b.{0,20}\b(system )?prompt\b/,
  /\boverride\b.{0,20}\bprice\b/,
  /\bset the price to\b|\bthe (new|real|actual) price is\b/,
  /\bpretend (to be|you('re| are))\b|\brole[\s-]?play\b|\bact as (if|an?|the)\b/,
];

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function looksLikeInjection(text: string): boolean {
  const t = normalize(text);
  return PATTERNS.some((re) => re.test(t));
}
