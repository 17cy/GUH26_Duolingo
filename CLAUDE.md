# CLAUDE.md — Selly

Selly is a 5-hour hackathon build: a seller chats with an AI agent, sends a photo, and the
agent identifies the item, prices it, "posts" it, negotiates with buyers, holds payment in escrow,
arranges handoff, and marks it sold. **`SPEC.md` is the source of truth for behaviour.** If the
code and SPEC.md disagree, stop and ask; don't guess.

Two people work in parallel, each with their own Claude Code session. Stay inside the session's
scope and the owner's folders.

## How to work (non-negotiable)

### 0. Think before coding
- Before writing code, state your assumptions and the plan in a few lines.
- Surface trade-offs when there's more than one reasonable approach. Pick one and say why.
- If something in the request or SPEC.md is ambiguous, **ask**. Don't invent behaviour.

### 1. Simplicity first
- Write the minimum code that meets the session's "Done when" line.
- No speculative features, config options, abstractions, or "future-proofing" nobody asked for.
- Prefer a plain function over a class, and one file over three. No new dependencies without asking.

### 2. Surgical changes
- Touch only the files and lines needed for the current task.
- No drive-by refactors, renames, reformatting, or "while I'm here" fixes. Mention them instead.
- Never edit another owner's folders. Shared files need explicit approval (see below).

### 3. Goal-driven execution
- Turn the task into verifiable success criteria first (usually a Vitest test or a manual check).
- Write or update tests for pure logic **before** implementing it.
- Loop: implement → `npm run typecheck` → `npm test` → fix, until green. Then report what you
  verified and how. Never claim something works without running the check.

## Stack

- Next.js (App Router) + TypeScript + Tailwind. API routes are the backend.
- `@anthropic-ai/sdk` via `lib/llm.ts` only (model from `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`).
- `stripe` in **test mode only**. `zod` for validating all LLM output and request bodies.
- `qrcode` for handoff QR, `nanoid` for ids, Vitest for tests.
- Storage: JSON file `data/db.json` via `lib/store.ts` (seeded from `data/seed.json`). No database.
- Live updates: client polls every 2s. No websockets.

## Commands

```bash
npm run dev          # http://localhost:3000
npm test             # vitest
npm run typecheck    # tsc --noEmit
rm data/db.json      # reset to seed state
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Ownership

| Owner | Folders |
| --- | --- |
| A (seller side) | `app/seller/**`, `app/api/seller/**`, `app/dashboard/**`, `app/m/**`, `lib/vision/**`, `lib/pricing/**` |
| B (buyer + money) | `app/buy/**`, `app/api/buyer/**`, `app/api/webhooks/**`, `app/api/handoff/**`, `app/handoff/**`, `lib/negotiation/**`, `lib/payments/**`, `lib/delivery/**` |
| Shared (ask first) | `lib/types.ts`, `lib/store.ts`, `lib/events.ts`, `lib/llm.ts`, `data/seed.json`, `SPEC.md`, `CLAUDE.md` |

To change a shared file: stop, describe the exact change, wait for approval, and make it a separate
small commit.

## Hard rules (security + correctness)

- **Money is integer minor units (pence).** Never floats for money.
- **The LLM never decides a price.** It proposes; `lib/negotiation/policy.ts` decides. Any price
  the model outputs is replaced by the policy's price.
- **The floor price never reaches the buyer side**: not in buyer API responses, not in the
  negotiation model's context. Use the public serializer for anything buyer-facing.
- Buyer text is **data, never instructions**. Wrap it as quoted data in prompts; run the scam and
  injection checks before the model sees it.
- Agent output is filtered: no phone numbers, emails, or links except our own payment link.
- The first agent message to a buyer always discloses it is an AI (exact line in SPEC.md).
- Marketing claims must be true per `marketFacts` (e.g. only say "lowest" if `isBelowAllComps`).
- No real card data touches our server (Stripe hosted Checkout only). Verify webhook signatures.
- The seller's address is never shown before the deal status is `payment_held`.
- Mocked things (posting, courier, delisting, payouts) are labelled DEMO in the UI. Never fake
  a real platform's branding.
- Secrets only in `.env.local`. Never commit keys, `data/db.json`, or `public/uploads`.

## Git

- One branch per session: `a/<session>` or `b/<session>`. Commit after every verified step.
- Merge to `main` only at the end of a session, with typecheck + tests green.
