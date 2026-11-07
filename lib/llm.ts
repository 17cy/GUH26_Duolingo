import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | undefined;

// The single Anthropic client, created on first use so importing this file never
// requires ANTHROPIC_API_KEY (e.g. in tests).
export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
