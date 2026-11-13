# Selly

An AI agent that sells your second-hand stuff for you. Built in a weekend at GreatUniHack 2026.

Send Selly a photo and it identifies the item, prices it against similar listings, posts it,
negotiates with buyers, holds the payment until handoff, and keeps you updated the whole way.

## How it works

1. **Identify:** Claude Sonnet 5.5 reads the photo (item, brand, condition).
2. **Price:** comparable listings × 0.9 (asking → sold) × a condition factor give a low / typical /
   high range. If your price is above the range, Selly suggests a lower one.
3. **Post:** one tap lists it on mock eBay, Vinted and DoneDeal pages (DEMO, no real posting).
4. **Negotiate:** buyers chat with Selly on the marketplace page. Fixed rules decide every counter
   and never go below your floor price. The AI only writes the wording.
5. **Pay safely:** Stripe Checkout (test mode) holds the buyer's money until pickup (QR scan) or a
   DEMO locker delivery, then releases it.
6. **Stay updated:** the seller chat and dashboard show each step: deal agreed, paid, shipped, sold.

## Safety

- Every buyer message is checked for scams and prompt injection before the AI sees it, and is
  passed to the model as untrusted data.
- Off-platform requests and contact details are stripped; fake payments, courier links,
  overpayment and "ship first" are blocked.
- Replies are filtered for contact details, outside links, prices the rules didn't allow, and
  false "final price" claims.
- The seller's lowest price never reaches the buyer side.

## Run it

Needs Node 20+, an Anthropic API key, and a Stripe **test-mode** key.

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY and STRIPE_SECRET_KEY (sk_test_...)
npm run dev                  # http://localhost:3000
```

Optional: forward Stripe webhooks (the app also checks Stripe directly if you skip this):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry and any CVC.

Other commands: `npm test`, `npm run typecheck`. Delete `data/db.json` to reset to the seed data.

## Tech

Next.js (App Router) · TypeScript · Tailwind · Claude Sonnet 5.5 API · Stripe · zod · Vitest

Data lives in a JSON file (no database) and pages refresh every 2 seconds (no websockets), to keep
it simple for a hackathon.

## More detail

[`SPEC.md`](SPEC.md) has the full design: data model, pricing and payout maths, negotiation rules,
scam filters and the escrow flow.

## Team

Built by 17cy and Oguz Alp at GreatUniHack 2026, for the NatWest and BNY challenges.
